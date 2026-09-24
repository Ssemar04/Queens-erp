from flask import jsonify, request

from services.auth_service import get_current_user
from services.database import get_central_db


def require_current_user():
    user = get_current_user()
    if not user:
        return None, (jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401)

    # Branch restriction enforcement for employees:
    branch_hdr = request.headers.get("X-Branch-ID")
    if branch_hdr and user["role"] != "admin" and user["branch_id"]:
        if branch_hdr.strip().lower() != str(user["branch_id"]).strip().lower():
            return None, (jsonify({
                "success": False,
                "message": f"Access denied. Your account is restricted to branch {user['branch_id']}."
            }), 403)

    return user, None


def require_admin_user():
    user, error = require_current_user()
    if error:
        return None, error
    if user["role"] != "admin":
        return None, (jsonify({
            "success": False,
            "message": "Admin access required"
        }), 403)
    return user, None


def require_manager_user():
    user, error = require_current_user()
    if error:
        return None, error
    role = (user.get("role") or "").lower()
    if role not in {"admin", "manager"}:
        return None, (jsonify({
            "success": False,
            "message": "Manager or Administrator access required"
        }), 403)
    return user, None


def require_employee_user():
    user, error = require_current_user()
    if error:
        return None, error

    db = get_central_db()
    employee = db.execute(
        """
        SELECT e.id, e.code, e.name, e.email, e.status, e.role, e.department, e.branch_id
        FROM employees e
        WHERE lower(e.email) = lower(?)
          AND e.status IN ('active', 'Active', 'ACTIVE')
        LIMIT 1
        """,
        (user["email"],),
    ).fetchone()

    if not employee:
        if user["role"] == "admin":
            enriched = {**dict(user), "employee_id": str(user["id"]), "employee_code": "ADM-001"}
            return enriched, None
        return None, (jsonify({
            "success": False,
            "message": "Access restricted to active company employees only"
        }), 403)

    enriched = {**dict(user), "employee_id": employee["id"], "employee_code": employee["code"]}
    return enriched, None
