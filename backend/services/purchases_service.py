import uuid
from datetime import datetime, timezone
from services.database import get_db

VALID_PAYMENT_STATUSES = {"unpaid", "partially_paid", "paid"}
VALID_ORDER_STATUSES = {"draft", "ordered", "received", "cancelled"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_purchases():
    return get_db().execute(
        """
        SELECT *
        FROM purchases
        ORDER BY purchase_date DESC, created_at DESC
        """
    ).fetchall()


def get_purchase(purchase_id):
    return get_db().execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,)).fetchone()


def next_purchase_number():
    row = get_db().execute(
        """
        SELECT purchase_number
        FROM purchases
        WHERE purchase_number LIKE 'PO-%'
        ORDER BY CAST(substr(purchase_number, 4) AS INTEGER) DESC
        LIMIT 1
        """
    ).fetchone()
    if row and row["purchase_number"]:
        try:
            last = int(row["purchase_number"].replace("PO-", ""))
        except ValueError:
            last = 1000
    else:
        last = 1000
    return f"PO-{last + 1}"


def create_purchase(data):
    db = get_db()
    purchase_id = data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    p_num = data.get("purchaseNumber") or next_purchase_number()

    db.execute(
        """
        INSERT INTO purchases (
            id, purchase_number, supplier_name, supplier_id, purchase_date,
            expected_delivery_date, category, items_summary, subtotal, tax_amount,
            discount_amount, total_amount, paid_amount, payment_status, order_status,
            payment_method, purchased_by, notes, attachment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            purchase_id,
            p_num,
            data.get("supplierName", ""),
            data.get("supplierId"),
            data.get("purchaseDate", now[:10]),
            data.get("expectedDeliveryDate"),
            data.get("category", "Inventory"),
            data.get("itemsSummary", ""),
            float(data.get("subtotal") or 0),
            float(data.get("taxAmount") or 0),
            float(data.get("discountAmount") or 0),
            float(data.get("totalAmount") or 0),
            float(data.get("paidAmount") or 0),
            data.get("paymentStatus", "unpaid"),
            data.get("orderStatus", "received"),
            data.get("paymentMethod", "bank_transfer"),
            data.get("purchasedBy", ""),
            data.get("notes", ""),
            data.get("attachment"),
            now,
            now,
        ),
    )
    db.commit()
    return get_purchase(purchase_id)


def update_purchase(purchase_id, data):
    db = get_db()
    fields = {
        "purchaseNumber": "purchase_number",
        "supplierName": "supplier_name",
        "supplierId": "supplier_id",
        "purchaseDate": "purchase_date",
        "expectedDeliveryDate": "expected_delivery_date",
        "category": "category",
        "itemsSummary": "items_summary",
        "subtotal": "subtotal",
        "taxAmount": "tax_amount",
        "discountAmount": "discount_amount",
        "totalAmount": "total_amount",
        "paidAmount": "paid_amount",
        "paymentStatus": "payment_status",
        "orderStatus": "order_status",
        "paymentMethod": "payment_method",
        "purchasedBy": "purchased_by",
        "notes": "notes",
        "attachment": "attachment",
    }
    assignments = []
    values = []
    for client_key, column in fields.items():
        if client_key in data:
            assignments.append(f"{column} = ?")
            values.append(data[client_key])

    if not assignments:
        return None

    assignments.append("updated_at = ?")
    values.extend([current_timestamp(), purchase_id])
    db.execute(f"UPDATE purchases SET {', '.join(assignments)} WHERE id = ?", values)
    db.commit()
    return get_purchase(purchase_id)


def delete_purchase(purchase_id):
    db = get_db()
    cursor = db.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
    db.commit()
    return cursor.rowcount
