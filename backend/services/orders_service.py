import json
from datetime import datetime, timezone

from services.database import get_db, get_central_db
from services.loyalty_tiers_service import get_tier_for_points


VALID_STATUSES = {"submitted", "declined", "successful", "decline", "draft", "confirmed", "in_progress", "delivered", "cancelled"}
VALID_PURCHASE_ORDER_STATUSES = {"draft", "submitted", "partial", "received", "cancelled"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_orders():
    return get_db().execute(
        """
        SELECT *
        FROM sales_orders
        ORDER BY created_at DESC
        """
    ).fetchall()


def get_order(order_id):
    return get_db().execute(
        """
        SELECT *
        FROM sales_orders
        WHERE id = ?
        """,
        (order_id,),
    ).fetchone()


def list_order_items(order_id):
    return get_db().execute(
        """
        SELECT *
        FROM sales_order_items
        WHERE sales_order_id = ?
        ORDER BY sort_order ASC, created_at ASC
        """,
        (order_id,),
    ).fetchall()


def create_order(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at
    attachment = data.get("quotationAttachment")
    db = get_db()
    employee_id = data.get("employeeId")
    handled_by = data.get("handledBy") or ""
    if employee_id:
        employee = get_central_db().execute("SELECT name FROM employees WHERE id = ?", (employee_id,)).fetchone()
        if employee:
            handled_by = employee["name"]
    items = data.get("items") or []
    if items:
        computed = sum(
            (int(it.get("quantity") or 1)) * float(it.get("unitPrice") or 0)
            for it in items
        )
        amount = float(data.get("amount") or computed)
    else:
        amount = float(data.get("amount") or 0)
    customer_id = data.get("customerId")
    if customer_id:
        existing_cust = db.execute("SELECT id FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not existing_cust:
            customer_id = None

    complaints = data.get("complaints") or []
    decline_reason = data.get("declineReason")
    req_docs = data.get("requiredDocumentTypes")
    acc_details = data.get("accountDetails")
    is_lpo_acc = 1 if data.get("isLpoAccount") else 0

    db.execute(
        """
        INSERT INTO sales_orders (
            id, lpo_number, date_received, customer_name, customer_id, customer_quotation,
            quotation_attachment, date_to_be_delivered, handled_by, employee_id, status,
            decline_reason, complaints, amount, notes, required_document_types, account_details,
            is_lpo_account, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["lpoNumber"],
            data["dateReceived"],
            data["customerName"],
            customer_id,
            data.get("customerQuotation") or "",
            json.dumps(attachment) if attachment else None,
            data.get("dateToBeDelivered") or current_timestamp()[:10],
            handled_by,
            employee_id,
            data.get("status") or "submitted",
            decline_reason,
            json.dumps(complaints),
            amount,
            data.get("notes"),
            json.dumps(req_docs) if req_docs is not None else None,
            json.dumps(acc_details) if acc_details is not None else None,
            is_lpo_acc,
            created_at,
            updated_at,
        ),
    )
    for idx, it in enumerate(items):
        item_id = it.get("itemId")
        if item_id:
            existing_item = db.execute("SELECT id FROM items WHERE id = ?", (item_id,)).fetchone()
            if not existing_item:
                item_id = None
        db.execute(
            """
            INSERT INTO sales_order_items (
                id, sales_order_id, item_id, name, quantity, unit_price, total, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                it.get("id") or f"soi-{data['id']}-{idx}",
                data["id"],
                item_id,
                it.get("name") or "",
                int(it.get("quantity") or 1),
                float(it.get("unitPrice") or 0),
                float(it.get("total") or (int(it.get("quantity") or 1) * float(it.get("unitPrice") or 0))),
                idx,
            ),
        )
    if data.get("customerId"):
        customer = db.execute("SELECT * FROM customers WHERE id = ?", (data["customerId"],)).fetchone()
        if customer:
            points = int(amount / 10000)
            new_total_orders = customer["total_orders"] + 1
            new_lifetime_value = customer["lifetime_value"] + amount
            new_avg_order_value = new_lifetime_value / new_total_orders if new_total_orders > 0 else 0
            new_loyalty_points = customer["loyalty_points"] + points
            tier = get_tier_for_points(new_loyalty_points)
            tier_name = tier["name"].lower() if tier else "bronze"
            db.execute(
                """
                UPDATE customers
                SET total_orders = ?, lifetime_value = ?, avg_order_value = ?, 
                    loyalty_points = ?, tier = ?, last_order_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    new_total_orders,
                    new_lifetime_value,
                    new_avg_order_value,
                    new_loyalty_points,
                    tier_name,
                    data.get("dateReceived") or created_at,
                    created_at,
                    data["customerId"],
                ),
            )
    db.commit()
    return get_order(data["id"])


def update_order(order_id, data):
    column_map = {
        "lpoNumber": "lpo_number",
        "dateReceived": "date_received",
        "customerName": "customer_name",
        "customerId": "customer_id",
        "customerQuotation": "customer_quotation",
        "quotationAttachment": "quotation_attachment",
        "dateToBeDelivered": "date_to_be_delivered",
        "handledBy": "handled_by",
        "employeeId": "employee_id",
        "status": "status",
        "declineReason": "decline_reason",
        "complaints": "complaints",
        "amount": "amount",
        "notes": "notes",
        "requiredDocumentTypes": "required_document_types",
        "accountDetails": "account_details",
        "isLpoAccount": "is_lpo_account",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []
    db = get_db()
    if "employeeId" in data:
        employee_id = data["employeeId"]
        if employee_id:
            employee = db.execute("SELECT name FROM employees WHERE id = ?", (employee_id,)).fetchone()
            if employee:
                updates.append("handled_by = ?")
                params.append(employee["name"])

    for key, column in column_map.items():
        if key not in data:
            continue

        value = data[key]
        if key == "quotationAttachment":
            value = json.dumps(value) if value else None
        elif key == "complaints":
            value = json.dumps(value) if value else "[]"
        elif key in ("requiredDocumentTypes", "accountDetails"):
            value = json.dumps(value) if value is not None else None
        elif key == "isLpoAccount":
            value = 1 if value else 0
        elif key == "amount":
            value = float(value or 0)

        updates.append(f"{column} = ?")
        params.append(value)

    if "items" in data:
        items = data.get("items") or []
        db.execute("DELETE FROM sales_order_items WHERE sales_order_id = ?", (order_id,))
        for idx, it in enumerate(items):
            db.execute(
                """
                INSERT INTO sales_order_items (
                    id, sales_order_id, item_id, name, quantity, unit_price, total, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    it.get("id") or f"soi-{order_id}-{idx}",
                    order_id,
                    it.get("itemId"),
                    it.get("name") or "",
                    int(it.get("quantity") or 1),
                    float(it.get("unitPrice") or 0),
                    float(it.get("total") or (int(it.get("quantity") or 1) * float(it.get("unitPrice") or 0))),
                    idx,
                ),
            )
        if "amount" not in data:
            computed = sum(
                (int(it.get("quantity") or 1)) * float(it.get("unitPrice") or 0)
                for it in items
            )
            updates.append("amount = ?")
            params.append(float(computed))

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        db.commit()
        return get_order(order_id)

    params.append(order_id)
    db.execute(
        f"""
        UPDATE sales_orders
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )
    db.commit()
    return get_order(order_id)


def delete_order(order_id):
    cursor = get_db().execute("DELETE FROM sales_orders WHERE id = ?", (order_id,))
    get_db().commit()
    return cursor.rowcount


def list_documents(order_id=None, document_type=None):
    db = get_db()
    sql = "SELECT * FROM sales_order_documents WHERE 1=1"
    params = []
    if order_id:
        sql += " AND sales_order_id = ?"
        params.append(order_id)
    if document_type:
        sql += " AND document_type = ?"
        params.append(document_type)
    sql += " ORDER BY uploaded_at DESC"
    return db.execute(sql, params).fetchall()


def get_document(doc_id):
    return get_db().execute(
        """
        SELECT *
        FROM sales_order_documents
        WHERE id = ?
        """,
        (doc_id,),
    ).fetchone()


def upload_document(data):
    db = get_db()
    now = current_timestamp()
    doc_id = data.get("id") or f"sod-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    db.execute(
        """
        INSERT INTO sales_order_documents (
            id, sales_order_id, document_type, title, description,
            file_name, file_type, file_size, data_url,
            uploaded_by, uploaded_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            doc_id,
            data["salesOrderId"],
            data["documentType"],
            data.get("title") or "",
            data.get("description") or "",
            data["fileName"],
            data.get("fileType") or "application/octet-stream",
            int(data.get("fileSize") or 0),
            data["dataUrl"],
            data.get("uploadedBy") or "",
            now,
            now,
        ),
    )
    db.commit()
    return get_document(doc_id)


def delete_document(doc_id):
    cursor = get_db().execute("DELETE FROM sales_order_documents WHERE id = ?", (doc_id,))
    get_db().commit()
    return cursor.rowcount


def _purchase_order_record(row):
    if not row:
        return None
    items = get_db().execute(
        """
        SELECT *
        FROM purchase_order_items
        WHERE purchase_order_id = ?
        ORDER BY id ASC
        """,
        (row["id"],),
    ).fetchall()
    return row, items


def list_purchase_orders():
    rows = get_db().execute(
        """
        SELECT *
        FROM purchase_orders
        ORDER BY created_at DESC
        """
    ).fetchall()
    return [_purchase_order_record(row) for row in rows]


def get_purchase_order(po_id):
    row = get_db().execute(
        """
        SELECT *
        FROM purchase_orders
        WHERE id = ?
        """,
        (po_id,),
    ).fetchone()
    return _purchase_order_record(row)


def _purchase_order_total(items):
    return sum(
        int(item.get("quantityOrdered") or 0) * float(item.get("unitCost") or 0)
        for item in items
    )


def create_purchase_order(data, created_by=""):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at
    items = data.get("items") or []
    total_cost = float(data.get("totalCost") or _purchase_order_total(items))
    db = get_db()

    db.execute(
        """
        INSERT INTO purchase_orders (
            id, order_number, supplier_id, status, total_cost,
            expected_delivery, notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data.get("orderNumber") or f"PO-{created_at[:4]}-{str(data['id'])[:8].upper()}",
            data["supplierId"],
            data.get("status") or "draft",
            total_cost,
            data.get("expectedDelivery"),
            data.get("notes") or "",
            data.get("createdBy") or created_by or "system",
            created_at,
            updated_at,
        ),
    )

    for item in items:
        db.execute(
            """
            INSERT INTO purchase_order_items (
                id, purchase_order_id, item_id,
                quantity_ordered, quantity_received, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                data["id"],
                item["itemId"],
                int(item.get("quantityOrdered") or 0),
                int(item.get("quantityReceived") or 0),
                float(item.get("unitCost") or 0),
            ),
        )

    db.commit()
    return get_purchase_order(data["id"])


def update_purchase_order(po_id, data):
    column_map = {
        "orderNumber": "order_number",
        "supplierId": "supplier_id",
        "status": "status",
        "totalCost": "total_cost",
        "expectedDelivery": "expected_delivery",
        "notes": "notes",
        "createdBy": "created_by",
        "updatedAt": "updated_at",
    }
    db = get_db()
    updates = []
    params = []

    for key, column in column_map.items():
        if key not in data:
            continue
        value = data[key]
        if key == "totalCost":
            value = float(value or 0)
        updates.append(f"{column} = ?")
        params.append(value)

    if "items" in data:
        items = data.get("items") or []
        db.execute("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", (po_id,))
        for item in items:
            db.execute(
                """
                INSERT INTO purchase_order_items (
                    id, purchase_order_id, item_id,
                    quantity_ordered, quantity_received, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    po_id,
                    item["itemId"],
                    int(item.get("quantityOrdered") or 0),
                    int(item.get("quantityReceived") or 0),
                    float(item.get("unitCost") or 0),
                ),
            )
        if "totalCost" not in data:
            updates.append("total_cost = ?")
            params.append(float(_purchase_order_total(items)))

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if updates:
        params.append(po_id)
        db.execute(
            f"""
            UPDATE purchase_orders
            SET {', '.join(updates)}
            WHERE id = ?
            """,
            params,
        )

    db.commit()
    return get_purchase_order(po_id)


def delete_purchase_order(po_id):
    cursor = get_db().execute("DELETE FROM purchase_orders WHERE id = ?", (po_id,))
    get_db().commit()
    return cursor.rowcount
