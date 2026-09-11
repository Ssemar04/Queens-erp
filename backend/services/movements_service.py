import json
import uuid
from datetime import datetime, timezone

from services.database import get_db


VALID_MOVEMENT_TYPES = {"received", "shipped", "adjusted", "transferred"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_movements(limit=None):
    sql = """
        SELECT
            sm.*,
            t.id AS transaction_id,
            t.transaction_number,
            t.transaction_type,
            t.transaction_date,
            t.item_name AS transaction_item_name,
            t.customer_id AS transaction_customer_id,
            t.customer_name AS transaction_customer_name,
            t.telephone AS transaction_telephone,
            t.email AS transaction_email,
            t.unit_price AS transaction_unit_price,
            t.discount AS transaction_discount,
            t.tax AS transaction_tax,
            t.vat_rate AS transaction_vat_rate,
            t.total_amount AS transaction_total_amount,
            t.amount_paid AS transaction_amount_paid,
            t.balance AS transaction_balance,
            t.amount_tendered AS transaction_amount_tendered,
            t.change_due AS transaction_change_due,
            t.cumulative_amount AS transaction_cumulative_amount,
            t.payment_method AS transaction_payment_method,
            t.status AS transaction_status,
            t.created_by AS transaction_created_by,
            t.asset_id AS transaction_asset_id,
            t.asset_name AS transaction_asset_name,
            t.sale_details AS transaction_sale_details
        FROM stock_movements sm
        LEFT JOIN transactions t ON t.movement_id = sm.id
        ORDER BY sm.created_at DESC
    """
    params = []
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    return get_db().execute(sql, params).fetchall()


def get_movement(movement_id):
    return get_db().execute(
        """
        SELECT
            sm.*,
            t.id AS transaction_id,
            t.transaction_number,
            t.transaction_type,
            t.transaction_date,
            t.item_name AS transaction_item_name,
            t.customer_id AS transaction_customer_id,
            t.customer_name AS transaction_customer_name,
            t.telephone AS transaction_telephone,
            t.email AS transaction_email,
            t.unit_price AS transaction_unit_price,
            t.discount AS transaction_discount,
            t.tax AS transaction_tax,
            t.vat_rate AS transaction_vat_rate,
            t.total_amount AS transaction_total_amount,
            t.amount_paid AS transaction_amount_paid,
            t.balance AS transaction_balance,
            t.amount_tendered AS transaction_amount_tendered,
            t.change_due AS transaction_change_due,
            t.cumulative_amount AS transaction_cumulative_amount,
            t.payment_method AS transaction_payment_method,
            t.status AS transaction_status,
            t.created_by AS transaction_created_by,
            t.asset_id AS transaction_asset_id,
            t.asset_name AS transaction_asset_name,
            t.sale_details AS transaction_sale_details
        FROM stock_movements sm
        LEFT JOIN transactions t ON t.movement_id = sm.id
        WHERE sm.id = ?
        """,
        (movement_id,),
    ).fetchone()


def get_item(item_id):
    return get_db().execute(
        """
        SELECT *
        FROM items
        WHERE id = ?
        """,
        (item_id,),
    ).fetchone()


def resulting_stock(item, movement_type, quantity):
    current = int(item["current_stock"] or 0)
    if movement_type == "received":
        return current + abs(quantity)
    if movement_type == "shipped":
        return max(0, current - abs(quantity))
    if movement_type == "adjusted":
        return max(0, current + quantity)
    return current


def create_movement(data, commit=True):
    movement_type = data.get("type") or data.get("movementType")
    raw_quantity = data.get("quantity")
    try:
        if raw_quantity in (None, ""):
            raise ValueError("quantity is required")
        quantity = int(raw_quantity)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"quantity must be an integer (got {raw_quantity!r})") from exc

    sale = data.get("sale")
    if sale is not None and not isinstance(sale, dict):
        raise ValueError("sale must be an object when provided")

    sale_json = json.dumps(sale) if sale else None
    item_id = data.get("itemId") or None
    item = get_item(item_id) if item_id else None
    if item_id and not item:
        return None
    if not item and not sale:
        return None

    created_at = data.get("createdAt") or current_timestamp()
    db = get_db()

    # Determine branch_id: if item exists, use item's branch; otherwise use to_branch_id or from_branch_id
    branch_id = item["branch_id"] if item else (
        data.get("toBranchId") or data.get("fromBranchId") or data.get("toLocationId") or data.get("fromLocationId")
    )

    db.execute(
        """
        INSERT INTO stock_movements (
            id, item_id, movement_type, quantity, from_branch_id,
            to_branch_id, from_location_id, to_location_id, reference, notes, performed_by, created_at, sale, branch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            item_id,
            movement_type,
            quantity,
            data.get("fromBranchId") or data.get("fromLocationId"),
            data.get("toBranchId") or data.get("toLocationId"),
            data.get("fromLocationId"),
            data.get("toLocationId"),
            data.get("reference") or "",
            data.get("notes") or "",
            data.get("performedBy") or "system",
            created_at,
            sale_json,
            branch_id,
        ),
    )

    if sale:
        receipt_number = sale.get("receiptNumber") or data.get("reference") or f"TXN-{data['id']}"
        db.execute(
            """
            INSERT INTO transactions (
                id, movement_id, transaction_number, transaction_type, transaction_date,
                item_id, item_name, customer_id, customer_name, telephone, email, quantity,
                unit_price, discount, tax, vat_rate, total_amount, amount_paid,
                balance, amount_tendered, change_due, cumulative_amount, payment_method,
                status, reference, notes, created_by, asset_id, asset_name, sale_details,
                branch_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sale.get("transactionId") or str(uuid.uuid4()),
                data["id"],
                receipt_number,
                "sale",
                created_at,
                item_id,
                sale.get("itemName") or (item["name"] if item else ""),
                sale.get("customerId"),
                sale.get("customer") or "",
                sale.get("telephone") or "",
                sale.get("email") or "",
                abs(quantity),
                float(sale.get("unitPrice") or 0),
                float(sale.get("discount") or 0),
                float(sale.get("vat") or 0),
                float(sale.get("vatRate") or 0),
                float(sale.get("totalAmount") or 0),
                float(sale.get("deposit") or 0),
                float(sale.get("balance") or 0),
                float(sale.get("amountTendered") or 0),
                float(sale.get("changeDue") or 0),
                float(sale.get("cumulativeAmount") or 0),
                sale.get("paymentMethod") or "cash",
                sale.get("status") or "paid",
                receipt_number,
                data.get("notes") or "",
                sale.get("staff") or data.get("performedBy") or "system",
                sale.get("assetId"),
                sale.get("assetName"),
                json.dumps(sale),
                branch_id,
                created_at,
                created_at,
            ),
        )

    if item:
        item_updates = {
            "current_stock": resulting_stock(item, movement_type, quantity),
            "updated_at": current_timestamp(),
        }
        if movement_type == "transferred" and (data.get("toBranchId") or data.get("toLocationId")):
            item_updates["branch_id"] = data.get("toBranchId") or data.get("toLocationId")

        assignments = ", ".join(f"{column} = ?" for column in item_updates)
        params = list(item_updates.values()) + [item_id]
        db.execute(
            f"""
            UPDATE items
            SET {assignments}
            WHERE id = ?
            """,
            params,
        )
    if commit:
        db.commit()
    return get_movement(data["id"])


def create_movements(movements):
    if not isinstance(movements, list):
        raise ValueError("movements must be a list")
    if not movements:
        return []

    db = get_db()
    created_ids = []
    try:
        for movement in movements:
            if not isinstance(movement, dict):
                raise ValueError("each movement must be an object")
            row = create_movement(movement, commit=False)
            if not row:
                raise ValueError(f"Item not found for movement {movement.get('id')}")
            created_ids.append(movement["id"])
        db.commit()
    except Exception:
        db.rollback()
        raise

    return [get_movement(movement_id) for movement_id in created_ids]


VALID_TRANSACTION_STATUSES = {"paid", "partial", "pending", "void"}


def update_transaction_status_by_receipt(receipt_number, new_status):
    if new_status not in VALID_TRANSACTION_STATUSES:
        return None
    db = get_db()
    now = current_timestamp()

    transactions = db.execute(
        "SELECT id, sale_details FROM transactions WHERE transaction_number = ?",
        (receipt_number,),
    ).fetchall()

    db.execute(
        """
        UPDATE transactions
        SET status = ?, updated_at = ?
        WHERE transaction_number = ?
        """,
        (new_status, now, receipt_number),
    )

    for transaction in transactions:
        if not transaction["sale_details"]:
            continue
        try:
            sale_details = json.loads(transaction["sale_details"])
        except (json.JSONDecodeError, TypeError):
            continue
        sale_details["status"] = new_status
        db.execute(
            "UPDATE transactions SET sale_details = ? WHERE id = ?",
            (json.dumps(sale_details), transaction["id"]),
        )

    movements = db.execute(
        "SELECT id, sale FROM stock_movements WHERE reference = ?",
        (receipt_number,),
    ).fetchall()

    for movement in movements:
        if not movement["sale"]:
            continue
        try:
            sale_details = json.loads(movement["sale"])
        except (json.JSONDecodeError, TypeError):
            continue
        sale_details["status"] = new_status
        db.execute(
            "UPDATE stock_movements SET sale = ? WHERE id = ?",
            (json.dumps(sale_details), movement["id"]),
        )

    db.commit()

    # Return the updated movements list
    return list_movements()
