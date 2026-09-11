import json
import sqlite3
from datetime import datetime, timezone
import uuid
import random

from services.database import get_db, get_central_db, get_branch_db


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def next_sku():
    row = get_db().execute(
        "SELECT MAX(CAST(SUBSTR(sku, 5) AS INTEGER)) AS last_num FROM items WHERE sku LIKE 'SKU-%'"
    ).fetchone()
    if not row or row["last_num"] is None:
        return "SKU-001"
    next_num = int(row["last_num"]) + 1
    return f"SKU-{str(next_num).zfill(3)}"


def next_barcode():
    existing = set()
    for row in get_db().execute("SELECT barcode FROM items WHERE barcode IS NOT NULL").fetchall():
        existing.add(row["barcode"])
    
    while True:
        # Generate a random barcode like BC-XXXXXXX where X is alphanumeric
        random_part = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))
        candidate = f"BC-{random_part}"
        if candidate not in existing:
            return candidate


def list_items(filters):
    where_parts = []
    params = []

    if filters.get("categoryId"):
        where_parts.append("category_id = ?")
        params.append(filters["categoryId"])
    if filters.get("supplierId"):
        where_parts.append("supplier_id = ?")
        params.append(filters["supplierId"])
    if filters.get("branchId"):
        where_parts.append("branch_id = ?")
        params.append(filters["branchId"])
    if filters.get("status"):
        where_parts.append("status = ?")
        params.append(filters["status"])
    if filters.get("search"):
        where_parts.append("(LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)")
        search = f"%{filters['search'].lower()}%"
        params.extend([search, search])

    where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    return get_db().execute(
        f"""
        SELECT *
        FROM items
        {where}
        ORDER BY name ASC
        """,
        params,
    ).fetchall()


def get_item(item_id):
    return get_db().execute(
        """
        SELECT *
        FROM items
        WHERE id = ?
        """,
        (item_id,),
    ).fetchone()


def create_item(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at
    initial_quantity = int(data.get("initialQuantity") or data.get("currentStock") or 0)
    current_stock = int(data.get("currentStock") or initial_quantity or 0)
    item_id = data.get("id") or str(uuid.uuid4())
    sku = data.get("sku") or next_sku()
    barcode = data.get("barcode") or next_barcode()

    get_db().execute(
        """
        INSERT INTO items (
            id, sku, barcode, name, description, category_id, status, unit,
            initial_quantity, current_stock, reorder_point, reorder_quantity,
            cost_price, selling_price, branch_id, supplier_id, image_url,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            item_id,
            sku,
            barcode,
            data["name"],
            data.get("description") or "",
            data.get("categoryId"),
            data.get("status") or "active",
            data.get("unit") or "each",
            initial_quantity,
            current_stock,
            int(data.get("reorderPoint") or 0),
            int(data.get("reorderQuantity") or 0),
            float(data.get("costPrice") or 0),
            float(data.get("sellingPrice") or 0),
            data.get("branchId"),
            data.get("supplierId"),
            data.get("imageUrl"),
            created_at,
            updated_at,
        ),
    )
    get_db().commit()
    return get_item(item_id)


def update_item(item_id, data):
    db = get_db()
    column_map = {
        "sku": "sku",
        "barcode": "barcode",
        "name": "name",
        "description": "description",
        "categoryId": "category_id",
        "status": "status",
        "unit": "unit",
        "initialQuantity": "initial_quantity",
        "currentStock": "current_stock",
        "reorderPoint": "reorder_point",
        "reorderQuantity": "reorder_quantity",
        "costPrice": "cost_price",
        "sellingPrice": "selling_price",
        "branchId": "branch_id",
        "supplierId": "supplier_id",
        "imageUrl": "image_url",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []

    for key, column in column_map.items():
        if key not in data:
            continue

        value = data[key]
        if key in {"currentStock", "initialQuantity", "reorderPoint", "reorderQuantity"}:
            value = int(value or 0)
        elif key in {"costPrice", "sellingPrice"}:
            value = float(value or 0)

        updates.append(f"{column} = ?")
        params.append(value)

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

    params.append(item_id)
    db.execute(
        f"""
        UPDATE items
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )

    db.commit()
    return get_item(item_id)


def delete_item(item_id):
    cursor = get_db().execute("DELETE FROM items WHERE id = ?", (item_id,))
    get_db().commit()
    return cursor.rowcount





def list_categories():
    return get_db().execute("SELECT * FROM categories ORDER BY name ASC").fetchall()


def get_category(category_id):
    return get_db().execute(
        """
        SELECT *
        FROM categories
        WHERE id = ?
        """,
        (category_id,),
    ).fetchone()


def create_category(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at

    get_db().execute(
        """
        INSERT INTO categories (
            id, name, description, parent_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["name"],
            data.get("description") or "",
            data.get("parentId"),
            created_at,
            updated_at,
        ),
    )
    get_db().commit()
    return get_category(data["id"])


def update_category(category_id, data):
    column_map = {
        "name": "name",
        "description": "description",
        "parentId": "parent_id",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []
    for key, column in column_map.items():
        if key not in data:
            continue
        updates.append(f"{column} = ?")
        params.append(data[key])

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

    params.append(category_id)
    get_db().execute(
        f"""
        UPDATE categories
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )
    get_db().commit()
    return get_category(category_id)


def delete_category(category_id):
    cursor = get_db().execute("DELETE FROM categories WHERE id = ?", (category_id,))
    get_db().commit()
    return cursor.rowcount


def get_branch(branch_id):
    return get_central_db().execute(
        """
        SELECT * FROM branches
        WHERE id = ?
        """,
        (branch_id,),
    ).fetchone()


def create_branch(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at
    street = data.get("street") or data.get("address") or ""

    db = get_central_db()
    db.execute(
        """
        INSERT INTO branches (
            id, name, description, street, building, floor, room_number,
            branch_manager, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["name"],
            data.get("description") or "",
            street,
            data.get("building") or "",
            data.get("floor") or "",
            data.get("roomNumber") or "",
            data.get("branchManager") or "",
            int(data.get("isActive", True)),
            created_at,
            updated_at,
        ),
    )
    db.commit()

    # Automatically provision sub-database for the newly created branch!
    get_branch_db(data["id"])

    return get_branch(data["id"])


def update_branch(branch_id, data):
    if "street" not in data and "address" in data:
        data = {**data, "street": data.get("address")}

    column_map = {
        "name": "name",
        "description": "description",
        "street": "street",
        "building": "building",
        "floor": "floor",
        "roomNumber": "room_number",
        "branchManager": "branch_manager",
        "isActive": "is_active",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []
    for key, column in column_map.items():
        if key not in data:
            continue
        value = data[key]
        if key == "isActive":
            value = int(value or 1)
        updates.append(f"{column} = ?")
        params.append(value)

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

    params.append(branch_id)
    db = get_central_db()
    db.execute(
        f"""
        UPDATE branches
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )
    db.commit()
    return get_branch(branch_id)


def delete_branch(branch_id):
    db = get_central_db()
    cursor = db.execute("DELETE FROM branches WHERE id = ?", (branch_id,))
    db.commit()
    return cursor.rowcount


def list_suppliers():
    return get_db().execute("SELECT * FROM suppliers ORDER BY name ASC").fetchall()

def get_supplier(supplier_id):
    return get_db().execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()

def create_supplier(data):
    created_at = data.get("createdAt") or current_timestamp()
    updated_at = data.get("updatedAt") or created_at

    get_db().execute(
        """
        INSERT INTO suppliers (
            id, name, contact_name, email, phone, address,
            lead_time_days, rating, is_active, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["name"],
            data.get("contactName") or "",
            data.get("email") or "",
            data.get("phone") or "",
            data.get("address") or "",
            data.get("leadTimeDays") or 0,
            data.get("rating") or 4,
            int(data.get("isActive") or 1),
            data.get("notes") or "",
            created_at,
            updated_at,
        ),
    )
    get_db().commit()
    return get_supplier(data["id"])

def update_supplier(supplier_id, data):
    column_map = {
        "name": "name",
        "contactName": "contact_name",
        "email": "email",
        "phone": "phone",
        "address": "address",
        "leadTimeDays": "lead_time_days",
        "rating": "rating",
        "isActive": "is_active",
        "notes": "notes",
        "updatedAt": "updated_at",
    }

    updates = []
    params = []
    for key, column in column_map.items():
        if key not in data:
            continue
        value = data[key]
        if key == "isActive":
            value = int(value or 1)
        updates.append(f"{column} = ?")
        params.append(value)

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

    params.append(supplier_id)
    get_db().execute(
        f"""
        UPDATE suppliers
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )
    get_db().commit()
    return get_supplier(supplier_id)

def delete_supplier(supplier_id):
    cursor = get_db().execute("DELETE FROM suppliers WHERE id = ?", (supplier_id,))
    get_db().commit()
    return cursor.rowcount

def list_branches():
    return get_central_db().execute("SELECT * FROM branches ORDER BY name ASC").fetchall()


def list_movements(limit=None):
    sql = "SELECT * FROM stock_movements ORDER BY created_at DESC"
    params = []
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    return get_db().execute(sql, params).fetchall()


def is_unique_error(error):
    return isinstance(error, sqlite3.IntegrityError)
