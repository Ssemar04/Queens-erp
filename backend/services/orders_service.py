import json
from datetime import datetime, timezone

from services.database import get_db, get_central_db
from services.loyalty_tiers_service import get_tier_for_points


VALID_STATUSES = {"draft", "confirmed", "in_progress", "delivered", "cancelled"}


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


def create_order(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at
    attachment = data.get("quotationAttachment")
    db = get_db()
    # Get employee name from employeeId if provided
    employee_id = data.get("employeeId")
    handled_by = data.get("handledBy") or ""
    if employee_id:
        employee = get_central_db().execute("SELECT name FROM employees WHERE id = ?", (employee_id,)).fetchone()
        if employee:
            handled_by = employee["name"]
    cursor = db.execute(
        """
        INSERT INTO sales_orders (
            id, lpo_number, date_received, customer_name, customer_id, customer_quotation,
            quotation_attachment, date_to_be_delivered, handled_by, employee_id, status,
            amount, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["lpoNumber"],
            data["dateReceived"],
            data["customerName"],
            data.get("customerId"),
            data.get("customerQuotation") or "",
            json.dumps(attachment) if attachment else None,
            data["dateToBeDelivered"],
            handled_by,
            employee_id,
            data.get("status") or "confirmed",
            float(data.get("amount") or 0),
            data.get("notes"),
            created_at,
            updated_at,
        ),
    )
    # If order is linked to customer, update customer stats and loyalty points
    if data.get("customerId"):
        amount = float(data.get("amount") or 0)
        # Calculate loyalty points (1 point per 10000 UGX)
        points = int(amount / 10000)
        # Update customer: increment loyalty points, total orders, lifetime value, average order value
        customer = db.execute("SELECT * FROM customers WHERE id = ?", (data["customerId"],)).fetchone()
        if customer:
            new_total_orders = customer["total_orders"] + 1
            new_lifetime_value = customer["lifetime_value"] + amount
            new_avg_order_value = new_lifetime_value / new_total_orders if new_total_orders > 0 else 0
            new_loyalty_points = customer["loyalty_points"] + points
            # Determine tier based on new loyalty points
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
                )
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
        "amount": "amount",
        "notes": "notes",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []
    db = get_db()
    # If employeeId is provided, get employee name and update handledBy
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
        elif key == "amount":
            value = float(value or 0)

        updates.append(f"{column} = ?")
        params.append(value)

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

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
