
import uuid
import json
from datetime import datetime, timezone

from services.database import get_central_db as get_db, get_branch_db
from services.chat_service import ensure_chat_user_for_account, remove_chat_user


import secrets
import string
from werkzeug.security import generate_password_hash


VALID_ACCOUNT_ROLES = {"admin", "manager", "staff"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def generate_one_time_password():
    alphabet = string.ascii_letters + string.digits
    random_str = ''.join(secrets.choice(alphabet) for _ in range(8))
    return f"QTERP-{random_str}"


def normalize_account_role(role):
    normalized = (role or "").strip().lower()
    if normalized in VALID_ACCOUNT_ROLES:
        return normalized
    if "admin" in normalized:
        return "admin"
    if "manager" in normalized or "head" in normalized or "lead" in normalized:
        return "manager"
    return "staff"


def get_employees():
    return get_db().execute("SELECT * FROM employees ORDER BY created_at DESC").fetchall()


def get_employee(emp_id):
    return get_db().execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone()


def resolve_branch_id(db, branch_id=None, location=None):
    if branch_id:
        b = db.execute("SELECT id FROM branches WHERE lower(id) = lower(?)", (str(branch_id),)).fetchone()
        if b:
            return b["id"]
    if location:
        b = db.execute("SELECT id FROM branches WHERE lower(name) = lower(?) OR lower(id) = lower(?)", (str(location), str(location))).fetchone()
        if b:
            return b["id"]
    default_b = db.execute("SELECT id FROM branches WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1").fetchone()
    return default_b["id"] if default_b else "br_main"


def create_employee(emp_data):
    db = get_db()
    emp_id = emp_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    code = emp_data.get("code") or next_employee_code()
    skills = json.dumps(emp_data.get("skills", []))
    branch_id = resolve_branch_id(db, emp_data.get("branchId") or emp_data.get("branch_id"), emp_data.get("location"))
    # Pre-initialize sub-database schema for the employee's assigned branch
    try:
        get_branch_db(branch_id)
    except Exception:
        pass

    allowed_pages_val = emp_data.get("allowedPages") if "allowedPages" in emp_data else emp_data.get("allowed_pages")
    allowed_pages_str = json.dumps(allowed_pages_val) if isinstance(allowed_pages_val, list) else None

    db.execute(
        """
        INSERT INTO employees (
            id, code, name, email, phone, avatar, role, department, manager,
            location, branch_id, employment_type, status, joined_at, salary, skills,
            emergency_contact, bio, allowed_pages, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            emp_id, code, emp_data["name"], emp_data["email"], emp_data["phone"],
            emp_data.get("avatar"), emp_data["role"], emp_data["department"],
            emp_data.get("manager"), emp_data["location"], branch_id, emp_data["employmentType"],
            emp_data["status"], emp_data["joinedAt"], emp_data["salary"], skills,
            emp_data.get("emergencyContact"), emp_data.get("bio"), allowed_pages_str,
            emp_data.get("createdAt") or now, emp_data.get("updatedAt") or now
        )
    )

    # Generate one-time login credentials for the employee
    otp = generate_one_time_password()
    password_hash = generate_password_hash(otp)
    email = emp_data["email"]
    name = emp_data["name"]
    account_role = normalize_account_role(emp_data.get("systemRole") or emp_data.get("role"))

    existing_user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing_user:
        db.execute(
            """
            UPDATE users
            SET password_hash = ?, name = ?, role = ?, is_active = 1,
                must_change_password = 1, one_time_password = ?, branch_id = ?, allowed_pages = ?
            WHERE id = ?
            """,
            (password_hash, name, account_role, otp, branch_id, allowed_pages_str, existing_user["id"])
        )
        user_id = existing_user["id"]
    else:
        cursor = db.execute(
            """
            INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, one_time_password, branch_id, allowed_pages)
            VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)
            """,
            (email, password_hash, name, account_role, otp, branch_id, allowed_pages_str)
        )
        user_id = cursor.lastrowid

    ensure_chat_user_for_account({"id": user_id, "name": name, "role": account_role}, db=db)

    db.commit()

    credentials = {
        "email": email,
        "role": account_role,
        "isActive": True,
        "oneTimePassword": otp,
        "mustChangePassword": True
    }
    return get_employee(emp_id), credentials


def get_employee_credentials(emp_id):
    emp = get_employee(emp_id)
    if not emp:
        return None

    email = emp["email"]
    user = get_db().execute(
        "SELECT email, role, is_active, must_change_password, one_time_password FROM users WHERE email = ?",
        (email,)
    ).fetchone()

    if not user:
        return {
            "email": email,
            "role": normalize_account_role(emp["role"]),
            "isActive": False,
            "oneTimePassword": None,
            "mustChangePassword": False
        }

    return {
        "email": user["email"],
        "role": user["role"],
        "isActive": bool(user["is_active"]),
        "oneTimePassword": user["one_time_password"],
        "mustChangePassword": bool(user["must_change_password"])
    }


def reset_employee_credentials(emp_id):
    emp = get_employee(emp_id)
    if not emp:
        return None

    db = get_db()
    otp = generate_one_time_password()
    password_hash = generate_password_hash(otp)
    email = emp["email"]
    name = emp["name"]
    account_role = normalize_account_role(emp["role"])
    emp_branch_id = emp["branch_id"] if "branch_id" in emp.keys() else None
    branch_id = resolve_branch_id(db, emp_branch_id, emp["location"])
    try:
        get_branch_db(branch_id)
    except Exception:
        pass

    existing_user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing_user:
        db.execute(
            """
            UPDATE users
            SET password_hash = ?, name = ?, role = COALESCE(role, ?), is_active = 1,
                must_change_password = 1, one_time_password = ?, branch_id = ?
            WHERE id = ?
            """,
            (password_hash, name, account_role, otp, branch_id, existing_user["id"])
        )
        user_id = existing_user["id"]
    else:
        cursor = db.execute(
            """
            INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, one_time_password, branch_id)
            VALUES (?, ?, ?, ?, 1, 1, ?, ?)
            """,
            (email, password_hash, name, account_role, otp, branch_id)
        )
        user_id = cursor.lastrowid

    ensure_chat_user_for_account({"id": user_id, "name": name, "role": account_role}, db=db)

    db.commit()

    return {
        "email": email,
        "role": account_role,
        "isActive": True,
        "oneTimePassword": otp,
        "mustChangePassword": True
    }


def update_employee_account(emp_id, account_data):
    emp = get_employee(emp_id)
    if not emp:
        return None

    db = get_db()
    now = current_timestamp()
    old_email = emp["email"]
    next_email = (account_data.get("email") or old_email).strip()
    if not next_email:
        next_email = old_email
    next_role = normalize_account_role(account_data.get("role") or emp["role"])
    is_active = 1 if account_data.get("isActive", True) else 0
    emp_branch_id = emp["branch_id"] if "branch_id" in emp.keys() else None
    branch_id = resolve_branch_id(db, account_data.get("branchId") or account_data.get("branch_id") or emp_branch_id, emp["location"])
    try:
        get_branch_db(branch_id)
    except Exception:
        pass

    email_conflict = db.execute(
        """
        SELECT id FROM employees
        WHERE lower(email) = lower(?) AND id <> ?
        """,
        (next_email, emp_id),
    ).fetchone()
    if email_conflict:
        raise ValueError("Another employee already uses that email.")

    user_conflict = db.execute(
        """
        SELECT id FROM users
        WHERE lower(email) = lower(?)
          AND lower(email) <> lower(?)
        """,
        (next_email, old_email),
    ).fetchone()
    if user_conflict:
        raise ValueError("Another login account already uses that email.")

    user = db.execute("SELECT id FROM users WHERE lower(email) = lower(?)", (old_email,)).fetchone()
    if user:
        db.execute(
            """
            UPDATE users
            SET email = ?, name = ?, role = ?, is_active = ?, branch_id = ?
            WHERE id = ?
            """,
            (next_email, emp["name"], next_role, is_active, branch_id, user["id"]),
        )
        user_id = user["id"]
    else:
        otp = generate_one_time_password()
        cursor = db.execute(
            """
            INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, one_time_password, branch_id)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (next_email, generate_password_hash(otp), emp["name"], next_role, is_active, otp, branch_id),
        )
        user_id = cursor.lastrowid

    if is_active:
        ensure_chat_user_for_account({"id": user_id, "name": emp["name"], "role": next_role}, db=db)
    else:
        remove_chat_user(user_id, db=db)

    db.execute(
        """
        UPDATE employees
        SET email = ?, branch_id = ?, updated_at = ?
        WHERE id = ?
        """,
        (next_email, branch_id, now, emp_id),
    )
    db.commit()

    return get_employee(emp_id), get_employee_credentials(emp_id)


def update_employee(emp_id, emp_data):
    db = get_db()
    now = current_timestamp()
    original = get_employee(emp_id)
    updates = []
    params = []

    allowed_fields = {
        "name": "name",
        "email": "email",
        "phone": "phone",
        "avatar": "avatar",
        "role": "role",
        "department": "department",
        "manager": "manager",
        "location": "location",
        "employmentType": "employment_type",
        "status": "status",
        "joinedAt": "joined_at",
        "salary": "salary",
        "skills": "skills",
        "allowedPages": "allowed_pages",
        "allowed_pages": "allowed_pages",
        "emergencyContact": "emergency_contact",
        "bio": "bio"
    }

    for frontend_field, db_field in allowed_fields.items():
        if frontend_field in emp_data:
            value = emp_data[frontend_field]
            if frontend_field in ("skills", "allowedPages", "allowed_pages") and isinstance(value, (list, dict)):
                value = json.dumps(value)
            updates.append(f"{db_field} = ?")
            params.append(value)

    if "branchId" in emp_data or "branch_id" in emp_data or "location" in emp_data:
        branch_id = resolve_branch_id(db, emp_data.get("branchId") or emp_data.get("branch_id"), emp_data.get("location"))
        updates.append("branch_id = ?")
        params.append(branch_id)

    if not updates:
        return get_employee(emp_id)

    updates.append("updated_at = ?")
    params.append(now)
    params.append(emp_id)

    db.execute(
        f"UPDATE employees SET {', '.join(updates)} WHERE id = ?",
        params
    )
    updated = get_employee(emp_id)
    if original and updated:
        account_role = normalize_account_role(emp_data.get("systemRole") or updated["role"])
        new_branch_id = resolve_branch_id(db, emp_data.get("branchId") or emp_data.get("branch_id"), updated["location"])
        allowed_pages_str = json.dumps(emp_data["allowedPages"]) if "allowedPages" in emp_data and isinstance(emp_data["allowedPages"], list) else (updated["allowed_pages"] if "allowed_pages" in updated.keys() else None)
        try:
            get_branch_db(new_branch_id)
        except Exception:
            pass
        user = db.execute(
            "SELECT id FROM users WHERE email = ?",
            (original["email"],),
        ).fetchone()
        db.execute(
            """
            UPDATE users
            SET email = ?, name = ?, role = ?, branch_id = ?, allowed_pages = ?
            WHERE email = ?
            """,
            (updated["email"], updated["name"], account_role, new_branch_id, allowed_pages_str, original["email"]),
        )
        if user:
            ensure_chat_user_for_account({"id": user["id"], "name": updated["name"], "role": account_role}, db=db)
    db.commit()
    return get_employee(emp_id)


def delete_employee(emp_id):
    db = get_db()
    emp = get_employee(emp_id)
    if not emp:
        return 0

    email = emp["email"]
    cursor = db.execute("DELETE FROM employees WHERE id = ?", (emp_id,))

    if email:
        user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        db.execute(
            "DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)",
            (email,)
        )
        if user:
            remove_chat_user(user["id"], db=db)
        db.execute("DELETE FROM users WHERE email = ?", (email,))

    db.commit()
    return cursor.rowcount


def next_employee_code():
    row = get_db().execute(
        "SELECT MAX(CAST(SUBSTR(code, 5) AS INTEGER)) AS last_num FROM employees WHERE code LIKE 'EMP-%'"
    ).fetchone()
    if not row or row["last_num"] is None:
        return "EMP-001"
    next_num = int(row["last_num"]) + 1
    return f"EMP-{str(next_num).zfill(3)}"
