
import uuid
from datetime import datetime, timezone

from services.database import get_db


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _asset_record(row):
    db = get_db()

    readings = db.execute(
        """
        SELECT * FROM asset_meter_readings
        WHERE asset_id = ?
        ORDER BY date DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()

    services = db.execute(
        """
        SELECT * FROM asset_service_records
        WHERE asset_id = ?
        ORDER BY date DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()

    income = db.execute(
        """
        SELECT * FROM asset_income
        WHERE asset_id = ?
        ORDER BY date DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()

    consumables = db.execute(
        """
        SELECT * FROM asset_consumables
        WHERE asset_id = ?
        ORDER BY date_replaced DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()

    monthly_targets = db.execute(
        """
        SELECT * FROM asset_monthly_targets
        WHERE asset_id = ?
        ORDER BY period DESC
        """,
        (row["id"],),
    ).fetchall()

    return row, readings, services, income, consumables, monthly_targets


def get_assets():
    return [
        _asset_record(row)
        for row in get_db().execute(
            """
            SELECT * FROM assets
            ORDER BY created_at DESC
            """
        ).fetchall()
    ]


def get_asset(asset_id):
    row = get_db().execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
    if not row:
        return None
    return _asset_record(row)


def create_asset(asset_data):
    db = get_db()
    asset_id = asset_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    tag = asset_data.get("tag") or next_tag()

    db.execute(
        """
        INSERT INTO assets (
            id, tag, name, category, serial_number, manufacturer, model, location,
            assigned_to, staff, purchase_date, purchase_cost, salvage_value, useful_life_years,
            status, condition, meter_unit, service_interval_meter, service_interval_days,
            last_service_date, last_service_meter, warranty_expiry, insurance_expiry,
            notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            asset_id,
            tag,
            asset_data["name"],
            asset_data["category"],
            asset_data.get("serialNumber", ""),
            asset_data.get("manufacturer", ""),
            asset_data.get("model", ""),
            asset_data.get("location", ""),
            asset_data.get("assignedTo", ""),
            asset_data.get("staff", ""),
            asset_data["purchaseDate"],
            asset_data.get("purchaseCost", 0),
            asset_data.get("salvageValue", 0),
            asset_data.get("usefulLifeYears", 5),
            asset_data.get("status", "active"),
            asset_data.get("condition", "good"),
            asset_data.get("meterUnit", "km"),
            asset_data.get("serviceIntervalMeter", 0),
            asset_data.get("serviceIntervalDays", 0),
            asset_data.get("lastServiceDate"),
            asset_data.get("lastServiceMeter"),
            asset_data.get("warrantyExpiry"),
            asset_data.get("insuranceExpiry"),
            asset_data.get("notes"),
            asset_data.get("createdAt") or now,
            asset_data.get("updatedAt") or now,
        ),
    )
    db.commit()
    return get_asset(asset_id)


def update_asset(asset_id, asset_data):
    db = get_db()
    now = current_timestamp()
    update_fields = []
    params = []

    allowed_fields = [
        "tag", "name", "category", "serialNumber", "manufacturer", "model", "location",
        "assignedTo", "staff", "purchaseDate", "purchaseCost", "salvageValue", "usefulLifeYears",
        "status", "condition", "meterUnit", "serviceIntervalMeter", "serviceIntervalDays",
        "lastServiceDate", "lastServiceMeter", "warrantyExpiry", "insuranceExpiry", "notes",
    ]

    field_mapping = {
        "serialNumber": "serial_number",
        "assignedTo": "assigned_to",
        "purchaseDate": "purchase_date",
        "purchaseCost": "purchase_cost",
        "salvageValue": "salvage_value",
        "usefulLifeYears": "useful_life_years",
        "meterUnit": "meter_unit",
        "serviceIntervalMeter": "service_interval_meter",
        "serviceIntervalDays": "service_interval_days",
        "lastServiceDate": "last_service_date",
        "lastServiceMeter": "last_service_meter",
        "warrantyExpiry": "warranty_expiry",
        "insuranceExpiry": "insurance_expiry",
    }

    for field in allowed_fields:
        if field in asset_data:
            db_field = field_mapping.get(field, field)
            update_fields.append(f"{db_field} = ?")
            params.append(asset_data[field])

    update_fields.append("updated_at = ?")
    params.append(now)
    params.append(asset_id)

    if update_fields:
        db.execute(
            f"UPDATE assets SET {', '.join(update_fields)} WHERE id = ?",
            params,
        )
        db.commit()

    return get_asset(asset_id)


def delete_asset(asset_id):
    db = get_db()
    cursor = db.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    db.commit()
    return cursor.rowcount


def add_meter_reading(asset_id, reading_data):
    db = get_db()
    reading_id = reading_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()

    db.execute(
        """
        INSERT INTO asset_meter_readings (id, asset_id, date, value, recorded_by, note)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            reading_id,
            asset_id,
            reading_data["date"],
            reading_data["value"],
            reading_data.get("recordedBy", ""),
            reading_data.get("note"),
        ),
    )

    # Update asset's updated_at
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))

    db.commit()
    return get_asset(asset_id)


def add_service_record(asset_id, service_data):
    db = get_db()
    service_id = service_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()

    db.execute(
        """
        INSERT INTO asset_service_records (
            id, asset_id, date, type, performed_by, cost, notes, next_due_date, next_due_meter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            service_id,
            asset_id,
            service_data["date"],
            service_data["type"],
            service_data.get("performedBy", ""),
            service_data.get("cost", 0),
            service_data.get("notes", ""),
            service_data.get("nextDueDate"),
            service_data.get("nextDueMeter"),
        ),
    )

    # Update asset's last_service_date, last_service_meter, and updated_at
    if service_data.get("date"):
        db.execute(
            """
            UPDATE assets
            SET last_service_date = ?, last_service_meter = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                service_data["date"],
                service_data.get("lastServiceMeter"),
                now,
                asset_id,
            ),
        )
    else:
        db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))

    db.commit()
    return get_asset(asset_id)


def next_tag():
    row = get_db().execute(
        """
        SELECT MAX(CAST(SUBSTR(tag, 5) AS INTEGER)) AS last_number
        FROM assets
        WHERE tag LIKE 'AST-%'
        """
    ).fetchone()
    if not row or row["last_number"] is None:
        return "AST-1001"
    next_number = int(row["last_number"]) + 1
    return f"AST-{next_number:04d}"


def list_asset_income(asset_id, date_from=None, date_to=None):
    db = get_db()
    sql = "SELECT * FROM asset_income WHERE asset_id = ?"
    params = [asset_id]
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    sql += " ORDER BY date DESC, created_at DESC"
    return db.execute(sql, params).fetchall()


def add_asset_income(asset_id, data):
    db = get_db()
    if not get_asset(asset_id):
        return None
    now = current_timestamp()
    income_id = data.get("id") or str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO asset_income (
            id, asset_id, date, source, amount, currency, description, reference,
            recorded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            income_id,
            asset_id,
            data["date"],
            data.get("source", ""),
            float(data.get("amount", 0) or 0),
            data.get("currency", "UGX") or "UGX",
            data.get("description", ""),
            data.get("reference", ""),
            data.get("recordedBy", data.get("recorded_by", "")),
            now, now,
        ),
    )
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))
    db.commit()
    row = db.execute("SELECT * FROM asset_income WHERE id = ?", (income_id,)).fetchone()
    return row


def update_asset_income(asset_id, income_id, data):
    db = get_db()
    if not get_asset(asset_id):
        return None
    existing = db.execute(
        "SELECT * FROM asset_income WHERE id = ? AND asset_id = ?",
        (income_id, asset_id)
    ).fetchone()
    if not existing:
        return None
    now = current_timestamp()
    update_fields = []
    params = []
    field_mapping = {
        "date": "date",
        "source": "source",
        "amount": "amount",
        "currency": "currency",
        "description": "description",
        "reference": "reference",
        "recordedBy": "recorded_by",
    }
    for k, db_k in field_mapping.items():
        if k in data:
            val = data[k]
            if k == "amount":
                val = float(val or 0)
            update_fields.append(f"{db_k} = ?")
            params.append(val)
    if not update_fields:
        return existing
    update_fields.append("updated_at = ?")
    params.append(now)
    params.extend([income_id, asset_id])
    db.execute(
        f"UPDATE asset_income SET {', '.join(update_fields)} WHERE id = ? AND asset_id = ?",
        params,
    )
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))
    db.commit()
    return db.execute("SELECT * FROM asset_income WHERE id = ?", (income_id,)).fetchone()


def delete_asset_income(asset_id, income_id):
    db = get_db()
    cursor = db.execute(
        "DELETE FROM asset_income WHERE id = ? AND asset_id = ?",
        (income_id, asset_id)
    )
    if cursor.rowcount == 0:
        return 0
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (current_timestamp(), asset_id))
    db.commit()
    return cursor.rowcount


def list_consumables(asset_id):
    db = get_db()
    if not get_asset(asset_id):
        return None
    return db.execute(
        """
        SELECT * FROM asset_consumables
        WHERE asset_id = ?
        ORDER BY date_replaced DESC, created_at DESC
        """,
        (asset_id,),
    ).fetchall()


def add_consumable(asset_id, data):
    db = get_db()
    if not get_asset(asset_id):
        return None
    consumable_id = data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    db.execute(
        """
        INSERT INTO asset_consumables (
            id, asset_id, name, unit, date_replaced, quantity, replaced_by, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            consumable_id,
            asset_id,
            data.get("name", ""),
            data.get("unit", ""),
            data["dateReplaced"],
            int(data.get("quantity", 1) or 1),
            data.get("replacedBy", ""),
            data.get("reason", ""),
            now,
        ),
    )
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))
    db.commit()
    return db.execute("SELECT * FROM asset_consumables WHERE id = ?", (consumable_id,)).fetchone()


def delete_consumable(asset_id, consumable_id):
    db = get_db()
    if not get_asset(asset_id):
        return 0
    cursor = db.execute(
        "DELETE FROM asset_consumables WHERE id = ? AND asset_id = ?",
        (consumable_id, asset_id),
    )
    if cursor.rowcount == 0:
        return 0
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (current_timestamp(), asset_id))
    db.commit()
    return cursor.rowcount


def get_monthly_targets(asset_id):
    db = get_db()
    if not get_asset(asset_id):
        return None
    return db.execute(
        """
        SELECT * FROM asset_monthly_targets
        WHERE asset_id = ?
        ORDER BY period DESC
        """,
        (asset_id,),
    ).fetchall()


def upsert_monthly_target(asset_id, period, data):
    db = get_db()
    if not get_asset(asset_id):
        return None
    now = current_timestamp()
    target_id = data.get("id") or str(uuid.uuid4())
    income_target = float(data.get("incomeTarget", 0) or 0)
    existing = db.execute(
        "SELECT id FROM asset_monthly_targets WHERE asset_id = ? AND period = ?",
        (asset_id, period),
    ).fetchone()
    if existing:
        target_id = existing["id"]
        db.execute(
            """
            UPDATE asset_monthly_targets
            SET income_target = ?, updated_at = ?
            WHERE id = ?
            """,
            (income_target, now, target_id),
        )
    else:
        db.execute(
            """
            INSERT INTO asset_monthly_targets (
                id, asset_id, period, income_target, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (target_id, asset_id, period, income_target, now, now),
        )
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (now, asset_id))
    db.commit()
    return db.execute("SELECT * FROM asset_monthly_targets WHERE id = ?", (target_id,)).fetchone()


def delete_monthly_target(asset_id, period):
    db = get_db()
    if not get_asset(asset_id):
        return 0
    cursor = db.execute(
        "DELETE FROM asset_monthly_targets WHERE asset_id = ? AND period = ?",
        (asset_id, period),
    )
    if cursor.rowcount == 0:
        return 0
    db.execute("UPDATE assets SET updated_at = ? WHERE id = ?", (current_timestamp(), asset_id))
    db.commit()
    return cursor.rowcount
