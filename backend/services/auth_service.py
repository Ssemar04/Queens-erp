import secrets

from flask import request
from werkzeug.security import check_password_hash, generate_password_hash

from services.database import get_central_db
from services.chat_service import ensure_chat_user_for_account


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return None

    return get_central_db().execute(
        """
        SELECT users.id, users.email, users.name, users.role, users.is_active, users.must_change_password, users.branch_id
        FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token = ?
          AND auth_sessions.expires_at > CURRENT_TIMESTAMP
          AND users.is_active = 1
        """,
        (token,),
    ).fetchone()


def login_user(email, password):
    normalized_email = (email or "").strip().lower()
    db = get_central_db()
    user = db.execute(
        """
        SELECT id, email, password_hash, name, role, is_active, must_change_password, branch_id
        FROM users
        WHERE lower(email) = ?
        """,
        (normalized_email,),
    ).fetchone()

    if not user or not user["is_active"] or not check_password_hash(user["password_hash"], password):
        return None, None

    token = secrets.token_urlsafe(32)
    db.execute(
        """
        INSERT INTO auth_sessions (user_id, token)
        VALUES (?, ?)
        """,
        (user["id"], token),
    )
    ensure_chat_user_for_account(user)
    db.commit()

    return user, token


def change_user_password(user_id, current_password, new_password):
    db = get_central_db()
    user = db.execute("SELECT id, password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], current_password):
        return False, "Current password is incorrect"

    if len(new_password) < 6:
        return False, "New password must be at least 6 characters long"

    new_hash = generate_password_hash(new_password)
    db.execute(
        "UPDATE users SET password_hash = ?, must_change_password = 0, one_time_password = NULL WHERE id = ?",
        (new_hash, user_id)
    )
    db.commit()
    return True, "Password updated successfully"


def logout_token(token):
    if not token:
        return

    db = get_central_db()
    db.execute(
        """
        DELETE FROM auth_sessions
        WHERE token = ?
        """,
        (token,),
    )
    db.commit()


def bearer_token_from_request():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return ""
    return auth_header.removeprefix("Bearer ").strip()
