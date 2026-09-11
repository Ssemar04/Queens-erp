import json
from datetime import datetime, timezone

from services.database import get_db


VALID_STATUSES = {"draft", "submitted", "approved", "rejected", "reimbursed", "paid"}
VALID_PAYMENT_METHODS = {"cash", "card", "bank_transfer", "mobile", "petty_cash", "company_card"}
VALID_TYPES = {"employee", "travel", "vendor", "recurring"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_categories():
    return get_db().execute(
        """
        SELECT *
        FROM expense_categories
        ORDER BY name ASC
        """
    ).fetchall()


def get_category(category_id):
    return get_db().execute("SELECT * FROM expense_categories WHERE id = ?", (category_id,)).fetchone()


def create_category(data):
    get_db().execute(
        """
        INSERT INTO expense_categories (id, name, code, color, monthly_budget)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["name"],
            data.get("code") or data["name"][:3].upper(),
            data.get("color") or "#0EA5E9",
            float(data.get("monthlyBudget") or 0),
        ),
    )
    get_db().commit()
    return get_category(data["id"])


def update_category(category_id, data):
    fields = {
        "name": "name",
        "code": "code",
        "color": "color",
        "monthlyBudget": "monthly_budget",
    }
    assignments = []
    values = []
    for client_key, column in fields.items():
        if client_key in data:
            assignments.append(f"{column} = ?")
            value = data[client_key]
            values.append(float(value or 0) if client_key == "monthlyBudget" else value)

    if not assignments:
        return None

    assignments.append("updated_at = ?")
    values.extend([current_timestamp(), category_id])
    get_db().execute(
        f"UPDATE expense_categories SET {', '.join(assignments)} WHERE id = ?",
        values,
    )
    get_db().commit()
    return get_category(category_id)


def delete_category(category_id):
    cursor = get_db().execute("DELETE FROM expense_categories WHERE id = ?", (category_id,))
    get_db().commit()
    return cursor.rowcount


def list_expenses():
    return get_db().execute(
        """
        SELECT *
        FROM expenses
        ORDER BY date DESC, created_at DESC
        """
    ).fetchall()


def get_expense(expense_id):
    return get_db().execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()


def list_audit():
    return get_db().execute(
        """
        SELECT *
        FROM expense_audit
        ORDER BY at DESC
        """
    ).fetchall()


def next_reference():
    row = get_db().execute(
        """
        SELECT reference
        FROM expenses
        WHERE reference LIKE 'EXP-%'
        ORDER BY CAST(substr(reference, 5) AS INTEGER) DESC
        LIMIT 1
        """
    ).fetchone()
    last = int(row["reference"].replace("EXP-", "")) if row else 2400
    return f"EXP-{last + 1:05d}"


def create_expense(data):
    created_at = data.get("createdAt") or current_timestamp()
    get_db().execute(
        """
        INSERT INTO expenses (
            id, reference, date, type, employee, department, category_id, vendor,
            amount, currency, payment_method, description, attachment, status,
            reimbursable, reimbursed, approved_by, rejected_reason, recurring,
            travel, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        expense_values(data, created_at),
    )
    get_db().commit()
    return get_expense(data["id"])


def update_expense(expense_id, data):
    fields = {
        "reference": "reference",
        "date": "date",
        "type": "type",
        "employee": "employee",
        "department": "department",
        "categoryId": "category_id",
        "vendor": "vendor",
        "amount": "amount",
        "currency": "currency",
        "paymentMethod": "payment_method",
        "description": "description",
        "attachment": "attachment",
        "status": "status",
        "reimbursable": "reimbursable",
        "reimbursed": "reimbursed",
        "approvedBy": "approved_by",
        "rejectedReason": "rejected_reason",
        "recurring": "recurring",
        "travel": "travel",
    }
    assignments = []
    values = []
    for client_key, column in fields.items():
        if client_key in data:
            assignments.append(f"{column} = ?")
            values.append(normalize_value(client_key, data[client_key]))

    if not assignments:
        return None

    assignments.append("updated_at = ?")
    values.extend([current_timestamp(), expense_id])
    get_db().execute(f"UPDATE expenses SET {', '.join(assignments)} WHERE id = ?", values)
    get_db().commit()
    return get_expense(expense_id)


def delete_expense(expense_id):
    cursor = get_db().execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    get_db().commit()
    return cursor.rowcount


def add_audit(data):
    get_db().execute(
        """
        INSERT INTO expense_audit (id, expense_id, action, actor, note, at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["expenseId"],
            data["action"],
            data.get("actor") or "",
            data.get("note") or "",
            data.get("at") or current_timestamp(),
        ),
    )
    get_db().commit()


def decide(expense_id, data):
    status = data["decision"]
    actor = data.get("actor") or ""
    note = data.get("note") or ""
    updated = update_expense(
        expense_id,
        {
            "status": status,
            "approvedBy": actor if status == "approved" else None,
            "rejectedReason": note if status == "rejected" else None,
        },
    )
    add_audit({
        "id": data["auditId"],
        "expenseId": expense_id,
        "action": status,
        "actor": actor,
        "note": note,
    })
    return updated


def reimburse(expense_id, data):
    updated = update_expense(expense_id, {"status": "reimbursed", "reimbursed": True})
    add_audit({
        "id": data["auditId"],
        "expenseId": expense_id,
        "action": "reimbursed",
        "actor": data.get("actor") or "",
        "note": data.get("note") or "Reimbursement processed",
    })
    return updated


def expense_values(data, created_at):
    return (
        data["id"],
        data.get("reference") or next_reference(),
        data["date"],
        data["type"],
        data.get("employee") or "Unassigned",
        data.get("department") or "",
        data.get("categoryId") or None,
        data.get("vendor") or "",
        float(data.get("amount") or 0),
        data.get("currency") or "UGX",
        data["paymentMethod"],
        data.get("description") or "",
        data.get("attachment"),
        data.get("status") or "draft",
        1 if data.get("reimbursable") else 0,
        1 if data.get("reimbursed") else 0,
        data.get("approvedBy"),
        data.get("rejectedReason"),
        json.dumps(data.get("recurring")) if isinstance(data.get("recurring"), dict) else None,
        json.dumps(data.get("travel")) if isinstance(data.get("travel"), dict) else None,
        created_at,
        data.get("updatedAt") or created_at,
    )


def normalize_value(key, value):
    if key == "amount":
        return float(value or 0)
    if key == "categoryId":
        return value or None
    if key in {"reimbursable", "reimbursed"}:
        return 1 if value else 0
    if key in {"recurring", "travel"}:
        return json.dumps(value) if isinstance(value, dict) else None
    return value
