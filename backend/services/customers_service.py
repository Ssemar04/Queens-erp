import json
import uuid
from datetime import datetime, timezone

from services.database import get_db
from services.loyalty_tiers_service import get_tier_for_points


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _customer_record(row):
    interactions = get_db().execute(
        """
        SELECT *
        FROM customer_interactions
        WHERE customer_id = ?
        ORDER BY at DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()
    return row, interactions


def get_customers():
    return [
        _customer_record(row)
        for row in get_db().execute(
            """
            SELECT *
            FROM customers
            ORDER BY created_at DESC
            """
        ).fetchall()
    ]


def get_customer(customer_id):
    row = get_db().execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        return None
    return _customer_record(row)


def create_customer(customer_data):
    db = get_db()
    customer_id = customer_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    tags = json.dumps(customer_data.get("tags", []))
    reference = customer_data.get("reference") or next_reference()
    if customer_data.get("autoReference") and reference_exists(reference):
        reference = next_reference()
    loyalty_points = customer_data.get("loyaltyPoints", 0)
    tier = get_tier_for_points(loyalty_points)
    tier_name = tier["name"].lower() if tier else "bronze"

    db.execute(
        """
        INSERT INTO customers (
            id, reference, name, type, stage, tier, email, phone, address, city,
            country, industry, tax_id, website, contact_person, sales_rep,
            payment_terms, credit_limit, outstanding_balance, lifetime_value,
            total_orders, avg_order_value, loyalty_points, tags, notes,
            last_order_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            customer_id,
            reference,
            customer_data["name"],
            customer_data.get("type", "company"),
            customer_data.get("stage", "lead"),
            tier_name,
            customer_data.get("email", ""),
            customer_data.get("phone", ""),
            customer_data.get("address", ""),
            customer_data.get("city", ""),
            customer_data.get("country", "Uganda"),
            customer_data.get("industry", ""),
            customer_data.get("taxId"),
            customer_data.get("website"),
            customer_data.get("contactPerson"),
            customer_data.get("salesRep", ""),
            customer_data.get("paymentTerms", "postpaid"),
            customer_data.get("creditLimit", 0),
            customer_data.get("outstandingBalance", 0),
            customer_data.get("lifetimeValue", 0),
            customer_data.get("totalOrders", 0),
            customer_data.get("avgOrderValue", 0),
            loyalty_points,
            tags,
            customer_data.get("notes", ""),
            customer_data.get("lastOrderAt"),
            customer_data.get("createdAt") or now,
            customer_data.get("updatedAt") or now,
        ),
    )
    for interaction in customer_data.get("interactions", []):
        db.execute(
            """
            INSERT INTO customer_interactions (id, customer_id, type, summary, at, by)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                interaction.get("id") or str(uuid.uuid4()),
                customer_id,
                interaction["type"],
                interaction["summary"],
                interaction.get("at") or now,
                interaction.get("by"),
            ),
        )
    db.commit()
    return get_customer(customer_id)


def update_customer(customer_id, customer_data):
    db = get_db()
    now = current_timestamp()
    update_fields = []
    params = []
    
    allowed_fields = [
        "reference", "name", "type", "email", "phone", "address",
        "city", "country", "industry", "taxId", "website", "contactPerson", "salesRep",
        "paymentTerms", "creditLimit", "outstandingBalance", "lifetimeValue",
        "totalOrders", "avgOrderValue", "loyaltyPoints", "tags", "notes", "lastOrderAt"
    ]
    
    field_mapping = {
        "taxId": "tax_id",
        "contactPerson": "contact_person",
        "salesRep": "sales_rep",
        "paymentTerms": "payment_terms",
        "creditLimit": "credit_limit",
        "outstandingBalance": "outstanding_balance",
        "lifetimeValue": "lifetime_value",
        "totalOrders": "total_orders",
        "avgOrderValue": "avg_order_value",
        "loyaltyPoints": "loyalty_points",
        "lastOrderAt": "last_order_at",
    }
    
    # If updating loyalty points, automatically calculate tier
    if "loyaltyPoints" in customer_data:
        tier = get_tier_for_points(customer_data["loyaltyPoints"])
        customer_data["tier"] = tier["name"].lower() if tier else "bronze"
        allowed_fields.append("tier")
    
    for field in allowed_fields:
        if field in customer_data:
            db_field = field_mapping.get(field, field)
            value = customer_data[field]
            if field == "tags":
                value = json.dumps(value)
            update_fields.append(f"{db_field} = ?")
            params.append(value)
    
    update_fields.append("updated_at = ?")
    params.append(now)
    params.append(customer_id)
    
    if update_fields:
        db.execute(
            f"UPDATE customers SET {', '.join(update_fields)} WHERE id = ?",
            params,
        )
        db.commit()
    
    return get_customer(customer_id)


def delete_customer(customer_id):
    db = get_db()
    db.execute("DELETE FROM customer_interactions WHERE customer_id = ?", (customer_id,))
    cursor = db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    db.commit()
    return cursor.rowcount


def add_interaction(customer_id, interaction_data):
    db = get_db()
    interaction_id = interaction_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    db.execute(
        """
        INSERT INTO customer_interactions (id, customer_id, type, summary, at, by)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            interaction_id,
            customer_id,
            interaction_data["type"],
            interaction_data["summary"],
            interaction_data.get("at") or now,
            interaction_data.get("by"),
        ),
    )
    db.execute("UPDATE customers SET updated_at = ? WHERE id = ?", (now, customer_id))
    db.commit()
    return get_customer(customer_id)


def next_reference():
    row = get_db().execute(
        """
        SELECT MAX(CAST(SUBSTR(reference, 5) AS INTEGER)) AS last_number
        FROM customers
        WHERE reference LIKE 'CUS-%'
        """
    ).fetchone()
    if not row or row["last_number"] is None:
        return "CUS-00001"

    next_number = int(row["last_number"]) + 1
    return f"CUS-{next_number:05d}"


def reference_exists(reference):
    return get_db().execute(
        """
        SELECT 1
        FROM customers
        WHERE reference = ?
        LIMIT 1
        """,
        (reference,),
    ).fetchone() is not None
