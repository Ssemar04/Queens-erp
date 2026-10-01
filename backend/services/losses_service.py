import uuid
from datetime import datetime, timezone

from services import movements_service
from services.database import get_db, table_exists


LOSS_KINDS = {"inventory", "asset", "cash", "other"}
LOSS_REASONS = {
    "damaged",
    "expired",
    "theft",
    "spoilage",
    "transit",
    "accident",
    "write_off",
    "shortage",
    "return",
    "other",
}
LOSS_STATUSES = {"reported", "approved", "written_off", "rejected"}

# Kinds whose loss should decrement on-hand stock via a linked stock movement.
_STOCK_BACKED_KINDS = {"inventory"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _row_get(row, name, default=None):
    if row is None:
        return default
    try:
        keys = row.keys()
    except AttributeError:
        keys = None
    if keys is not None and name not in keys:
        return default
    try:
        value = row[name]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def _lookup_item(item_id):
    if not item_id or not table_exists(get_db(), "items"):
        return None
    return get_db().execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()


def _lookup_asset(asset_id):
    if not asset_id or not table_exists(get_db(), "assets"):
        return None
    return get_db().execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()


def list_losses():
    return get_db().execute(
        """
        SELECT * FROM loss_records
        ORDER BY date DESC, created_at DESC
        """
    ).fetchall()


def get_loss(loss_id):
    return get_db().execute("SELECT * FROM loss_records WHERE id = ?", (loss_id,)).fetchone()


def next_reference():
    row = get_db().execute(
        """
        SELECT reference FROM loss_records
        WHERE reference LIKE 'LOSS-%'
        ORDER BY CAST(substr(reference, 6) AS INTEGER) DESC
        LIMIT 1
        """
    ).fetchone()
    last = 0
    if row and row["reference"]:
        try:
            last = int(str(row["reference"]).replace("LOSS-", ""))
        except ValueError:
            last = 0
    return f"LOSS-{last + 1:05d}"


def _resolve_names_and_value(kind, item_id, asset_id, quantity, unit_value_raw, total_value_raw, item_name_raw, asset_name_raw):
    """Fill in item/asset labels and derive unit/total value when not supplied."""
    db = get_db()
    qty = abs(_safe_float(quantity, 0))

    item_name = (item_name_raw or "").strip()
    asset_name = (asset_name_raw or "").strip()
    unit_value = _safe_float(unit_value_raw, None) if unit_value_raw not in (None, "") else None

    if kind == "inventory" and item_id:
        item = _lookup_item(item_id)
        if item is not None:
            item_name = item_name or _row_get(item, "name", "") or ""
            if unit_value is None:
                unit_value = _safe_float(_row_get(item, "cost_price", 0), 0.0)
    elif kind == "asset" and asset_id:
        asset = _lookup_asset(asset_id)
        if asset is not None:
            asset_name = asset_name or _row_get(asset, "name", "") or ""

    if unit_value is None:
        unit_value = 0.0

    total_value = _safe_float(total_value_raw, None) if total_value_raw not in (None, "") else None
    if total_value is None:
        total_value = round(qty * unit_value, 2)

    return item_name, asset_name, round(unit_value, 2), round(total_value, 2)


def create_loss(data):
    db = get_db()
    loss_id = data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    reference = (data.get("reference") or next_reference()).strip()

    kind = (data.get("kind") or "inventory").strip().lower()
    if kind not in LOSS_KINDS:
        kind = "other"

    reason_code = (data.get("reasonCode") or "other").strip().lower()
    if reason_code not in LOSS_REASONS:
        reason_code = "other"

    status = (data.get("status") or "reported").strip().lower()
    if status not in LOSS_STATUSES:
        status = "reported"

    item_id = data.get("itemId") or None
    asset_id = data.get("assetId") or None
    quantity = abs(_safe_float(data.get("quantity"), 1 if kind == "asset" else 0))

    item_name, asset_name, unit_value, total_value = _resolve_names_and_value(
        kind, item_id, asset_id, quantity,
        data.get("unitValue"), data.get("totalValue"),
        data.get("itemName"), data.get("assetName"),
    )

    movement_id = None
    if kind in _STOCK_BACKED_KINDS and item_id:
        item = _lookup_item(item_id)
        if item is None:
            raise ValueError("Item not found for inventory loss")
        if _safe_float(_row_get(item, "current_stock", 0), 0) < quantity:
            raise ValueError(
                f"Insufficient stock to write off. On hand: {int(_safe_float(_row_get(item, 'current_stock', 0), 0))}"
            )
        movement = movements_service.create_movement(
            {
                "id": str(uuid.uuid4()),
                "itemId": item_id,
                "type": "adjusted",
                "quantity": -int(round(quantity)),
                "reference": reference,
                "notes": f"Loss write-off ({reason_code})"
                + (f": {data.get('description')}" if data.get("description") else ""),
                "performedBy": data.get("reportedBy") or "system",
            }
        )
        if movement is not None:
            movement_id = _row_get(movement, "id")

    db.execute(
        """
        INSERT INTO loss_records (
            id, reference, date, kind, item_id, item_name, asset_id, asset_name,
            quantity, unit_value, total_value, currency, reason_code, description,
            location_id, reported_by, status, approved_by, status_note,
            insurance_claim, attachment, movement_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            loss_id,
            reference,
            data.get("date") or now[:10],
            kind,
            item_id,
            item_name,
            asset_id,
            asset_name,
            quantity,
            unit_value,
            total_value,
            data.get("currency") or "UGX",
            reason_code,
            data.get("description") or "",
            data.get("locationId") or None,
            data.get("reportedBy") or "",
            status,
            data.get("approvedBy"),
            data.get("statusNote"),
            1 if data.get("insuranceClaim") else 0,
            data.get("attachment"),
            movement_id,
            data.get("createdAt") or now,
            now,
        ),
    )

    if kind == "asset" and asset_id and data.get("assetCondition"):
        db.execute(
            "UPDATE assets SET condition = ?, updated_at = ? WHERE id = ?",
            (str(data.get("assetCondition")), now, asset_id),
        )

    db.commit()
    return get_loss(loss_id)


# Fields editable after creation. Stock-affecting fields (kind, itemId, quantity)
# are intentionally excluded so on-hand levels never drift out of sync with the
# linked movement — delete and re-add to change those.
_UPDATABLE_FIELDS = {
    "date": "date",
    "reasonCode": "reason_code",
    "description": "description",
    "unitValue": "unit_value",
    "totalValue": "total_value",
    "currency": "currency",
    "locationId": "location_id",
    "reportedBy": "reported_by",
    "itemName": "item_name",
    "assetName": "asset_name",
    "status": "status",
    "approvedBy": "approved_by",
    "statusNote": "status_note",
    "insuranceClaim": "insurance_claim",
    "attachment": "attachment",
}


def update_loss(loss_id, data):
    db = get_db()
    existing = get_loss(loss_id)
    if not existing:
        return None

    assignments = []
    values = []
    for client_key, column in _UPDATABLE_FIELDS.items():
        if client_key not in data:
            continue
        value = data[client_key]
        if client_key in {"unitValue", "totalValue"}:
            value = round(_safe_float(value, 0), 2)
        elif client_key == "insuranceClaim":
            value = 1 if value else 0
        elif client_key == "reasonCode":
            value = str(value).strip().lower()
            if value not in LOSS_REASONS:
                value = "other"
        elif client_key == "status":
            value = str(value).strip().lower()
            if value not in LOSS_STATUSES:
                continue
        elif client_key == "locationId":
            value = value or None
        assignments.append(f"{column} = ?")
        values.append(value)

    if not assignments:
        return existing

    assignments.append("updated_at = ?")
    values.extend([current_timestamp(), loss_id])
    db.execute(f"UPDATE loss_records SET {', '.join(assignments)} WHERE id = ?", values)
    db.commit()
    return get_loss(loss_id)


def set_status(loss_id, status, actor=None, note=None):
    status = (status or "").strip().lower()
    if status not in LOSS_STATUSES:
        return None
    patch = {"status": status}
    if note is not None:
        patch["statusNote"] = note
    if status in {"approved", "written_off"} and actor:
        patch["approvedBy"] = actor
    return update_loss(loss_id, patch)


def delete_loss(loss_id):
    db = get_db()
    existing = get_loss(loss_id)
    if not existing:
        return 0

    now = current_timestamp()
    movement_id = _row_get(existing, "movement_id")
    item_id = _row_get(existing, "item_id")
    quantity = abs(_safe_float(_row_get(existing, "quantity", 0), 0))

    # Reverse the stock write-off recorded at creation time.
    if movement_id and item_id and table_exists(db, "items"):
        db.execute(
            "UPDATE items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?",
            (int(round(quantity)), now, item_id),
        )
        if table_exists(db, "stock_movements"):
            db.execute("DELETE FROM stock_movements WHERE id = ?", (movement_id,))

    cursor = db.execute("DELETE FROM loss_records WHERE id = ?", (loss_id,))
    db.commit()
    return cursor.rowcount


def loss_summary():
    db = get_db()
    totals = db.execute(
        "SELECT COUNT(*) AS c, COALESCE(SUM(total_value), 0) AS v FROM loss_records"
    ).fetchone()
    this_month = current_timestamp()[:7]
    month = db.execute(
        "SELECT COALESCE(SUM(total_value), 0) AS v FROM loss_records WHERE substr(date, 1, 7) = ?",
        (this_month,),
    ).fetchone()

    def grouped(column):
        rows = db.execute(
            f"""
            SELECT {column} AS key, COUNT(*) AS c, COALESCE(SUM(total_value), 0) AS v
            FROM loss_records
            GROUP BY {column}
            """
        ).fetchall()
        return [
            {
                "key": _row_get(r, "key", "") or "",
                "count": int(_safe_float(_row_get(r, "c", 0), 0)),
                "value": round(_safe_float(_row_get(r, "v", 0), 0), 2),
            }
            for r in rows
        ]

    return {
        "count": int(_safe_float(_row_get(totals, "c", 0), 0)),
        "totalValue": round(_safe_float(_row_get(totals, "v", 0), 0), 2),
        "thisMonthValue": round(_safe_float(_row_get(month, "v", 0), 0), 2),
        "byKind": grouped("kind"),
        "byReason": grouped("reason_code"),
        "byStatus": grouped("status"),
    }
