import json
import uuid
from datetime import datetime, timezone

from services.database import get_db


VALID_MOVEMENT_TYPES = {"received", "shipped", "adjusted", "transferred"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _money(value):
    try:
        return max(0.0, float(value or 0))
    except (TypeError, ValueError):
        return 0.0


def normalize_sale_payment(sale):
    normalized = dict(sale)
    total_amount = _money(normalized.get("totalAmount"))
    deposit = _money(normalized.get("deposit"))
    amount_tendered = _money(normalized.get("amountTendered"))

    balance = max(0.0, total_amount - deposit)
    change_due = max(0.0, amount_tendered - total_amount)

    normalized["totalAmount"] = total_amount
    normalized["deposit"] = deposit
    normalized["amountTendered"] = amount_tendered
    normalized["balance"] = balance
    normalized["changeDue"] = change_due
    normalized["status"] = "paid" if balance == 0 else ("partial" if deposit > 0 else "pending")
    return normalized


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
    if sale:
        sale = normalize_sale_payment(sale)

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
        balance_val = float(sale.get("balance") or 0)
        deposit_val = float(sale.get("deposit") or 0)
        raw_status = sale.get("status") or "paid"
        auto_status = "void" if raw_status == "void" else ("paid" if balance_val <= 0 else ("partial" if deposit_val > 0 else "pending"))

        synced_cust_id = sync_customer_from_sale(sale, created_at)
        cust_id_to_save = sale.get("customerId") or synced_cust_id

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
                cust_id_to_save,
                sale.get("customer") or "",
                sale.get("telephone") or "",
                sale.get("email") or "",
                abs(quantity),
                float(sale.get("unitPrice") or 0),
                float(sale.get("discount") or 0),
                float(sale.get("vat") or 0),
                float(sale.get("vatRate") or 0),
                float(sale.get("totalAmount") or 0),
                deposit_val,
                balance_val,
                float(sale.get("amountTendered") or 0),
                float(sale.get("changeDue") or 0),
                float(sale.get("cumulativeAmount") or 0),
                sale.get("paymentMethod") or "cash",
                auto_status,
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

        sync_debtor_from_sale(sale, receipt_number, created_at, cust_id_to_save)

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


def sync_customer_from_sale(sale, created_at):
    customer_name = (sale.get("customer") or "").strip()
    if not customer_name or customer_name.lower() == "walk-in":
        return None

    customer_id = sale.get("customerId")
    telephone = (sale.get("telephone") or "").strip()
    email = (sale.get("email") or "").strip()
    total_amount = float(sale.get("totalAmount") or 0)
    balance = float(sale.get("balance") or 0)

    db = get_db()
    existing = None

    if customer_id:
        existing = db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    
    if not existing and telephone:
        existing = db.execute("SELECT * FROM customers WHERE phone = ? AND phone != ''", (telephone,)).fetchone()
        
    if not existing and email:
        existing = db.execute("SELECT * FROM customers WHERE email = ? AND email != ''", (email,)).fetchone()

    if not existing and customer_name:
        existing = db.execute("SELECT * FROM customers WHERE LOWER(name) = LOWER(?)", (customer_name,)).fetchone()

    if existing:
        cust_id = existing["id"]
        new_ltv = float(existing["lifetime_value"] or 0) + total_amount
        new_balance = max(0.0, float(existing["outstanding_balance"] or 0) + balance)
        new_total_orders = int(existing["total_orders"] or 0) + 1
        new_phone = telephone or existing["phone"] or ""
        new_email = email or existing["email"] or ""
        
        db.execute(
            """
            UPDATE customers
            SET lifetime_value = ?,
                outstanding_balance = ?,
                total_orders = ?,
                phone = ?,
                email = ?,
                last_order_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (new_ltv, new_balance, new_total_orders, new_phone, new_email, created_at, created_at, cust_id),
        )
        return cust_id
    else:
        # Create new customer profile automatically
        from services.customers_service import create_customer
        new_cust_data = {
            "id": customer_id or str(uuid.uuid4()),
            "name": customer_name,
            "phone": telephone,
            "email": email,
            "type": "individual",
            "stage": "customer",
            "lifetimeValue": total_amount,
            "outstandingBalance": balance,
            "totalOrders": 1,
            "lastOrderAt": created_at,
            "createdAt": created_at,
            "updatedAt": created_at,
        }
        res = create_customer(new_cust_data)
        return res[0]["id"] if res else None


def sync_debtor_from_sale(sale, receipt_number, created_at, cust_id):
    balance = float(sale.get("balance") or 0)
    customer_name = (sale.get("customer") or "").strip()
    if balance <= 0 or not customer_name or customer_name.lower() == "walk-in":
        return None

    db = get_db()
    existing_entry = db.execute(
        "SELECT id FROM ledger_entries WHERE reference = ? AND kind = 'debtor'",
        (receipt_number,),
    ).fetchone()

    if existing_entry:
        return existing_entry["id"]

    from datetime import timedelta
    total_amount = float(sale.get("totalAmount") or 0)
    deposit = float(sale.get("deposit") or 0)
    issue_date = created_at[:10] if len(created_at) >= 10 else datetime.now(timezone.utc).date().isoformat()

    try:
        dt_issue = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        dt_issue = datetime.now(timezone.utc)

    due_date = (dt_issue + timedelta(days=14)).date().isoformat()
    entry_id = str(uuid.uuid4())
    status = "partial" if deposit > 0 else "open"
    notes = f"Sale transaction {receipt_number} from Transactions page"

    db.execute(
        """
        INSERT INTO ledger_entries (
            id, kind, reference, party_name, party_ref, issue_date, due_date,
            amount, currency, paid, status, notes, promise_to_pay, tags,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            "debtor",
            receipt_number,
            customer_name,
            cust_id or sale.get("telephone") or sale.get("email") or "",
            issue_date,
            due_date,
            total_amount,
            "UGX",
            deposit,
            status,
            notes,
            None,
            json.dumps(["sales", "debtor"]),
            created_at,
            created_at,
        ),
    )

    if deposit > 0:
        db.execute(
            """
            INSERT INTO ledger_payments (
                id, entry_id, date, amount, method, reference, note, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                entry_id,
                issue_date,
                deposit,
                sale.get("paymentMethod") or "cash",
                receipt_number,
                "Upfront payment at checkout",
                created_at,
            ),
        )

    return entry_id


def delete_transaction_by_receipt(receipt_number):
    if not receipt_number:
        return False
    receipt_number = str(receipt_number).strip()

    db = get_db()
    # 1. Fetch transactions for this receipt
    txns = db.execute(
        "SELECT id, item_id, quantity, total_amount, balance, customer_id FROM transactions WHERE transaction_number = ? OR reference = ?",
        (receipt_number, receipt_number),
    ).fetchall()

    # 2. Fetch stock movements linked to this receipt
    like_pattern = f'%"{receipt_number}"%'
    movements = db.execute(
        "SELECT id, item_id, movement_type, quantity, sale FROM stock_movements WHERE reference = ? OR sale LIKE ?",
        (receipt_number, like_pattern),
    ).fetchall()

    if not txns and not movements:
        return False

    now = current_timestamp()

    # 3. Restore item stock levels
    for m in movements:
        item_id = m["item_id"]
        raw_qty = m["quantity"]
        try:
            qty = abs(int(float(raw_qty or 0)))
        except (ValueError, TypeError):
            qty = 0

        m_type = str(m["movement_type"] or "").lower()
        if item_id and qty > 0:
            if m_type in ("shipped", "sale"):
                db.execute(
                    "UPDATE items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?",
                    (qty, now, item_id),
                )
            elif m_type in ("received", "purchase"):
                db.execute(
                    "UPDATE items SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ?",
                    (qty, now, item_id),
                )

    # 4. Reverse customer statistics if customer was associated
    for t in txns:
        cust_id = t["customer_id"]
        try:
            tot = float(t["total_amount"] or 0)
        except (ValueError, TypeError):
            tot = 0.0
        try:
            bal = float(t["balance"] or 0)
        except (ValueError, TypeError):
            bal = 0.0

        if cust_id:
            db.execute(
                """
                UPDATE customers
                SET lifetime_value = MAX(0.0, lifetime_value - ?),
                    outstanding_balance = MAX(0.0, outstanding_balance - ?),
                    total_orders = MAX(0, total_orders - 1),
                    updated_at = ?
                WHERE id = ?
                """,
                (tot, bal, now, cust_id),
            )

    # 5. Clean up associated debtor ledger entries and payments
    ledger_entries = db.execute(
        "SELECT id FROM ledger_entries WHERE reference = ? AND kind = 'debtor'",
        (receipt_number,),
    ).fetchall()
    for le in ledger_entries:
        db.execute("DELETE FROM ledger_payments WHERE entry_id = ?", (le["id"],))
    db.execute("DELETE FROM ledger_entries WHERE reference = ? AND kind = 'debtor'", (receipt_number,))

    # 6. Delete transactions and stock_movements
    db.execute("DELETE FROM transactions WHERE transaction_number = ? OR reference = ?", (receipt_number, receipt_number))
    db.execute("DELETE FROM stock_movements WHERE reference = ? OR sale LIKE ?", (receipt_number, like_pattern))

    db.commit()
    return True
