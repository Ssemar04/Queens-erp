import json
from flask import Blueprint, request, jsonify

import services.chat_service as chat_service
from models.serializers import (
    chat_user_from_row,
    chat_channel_from_row,
    chat_message_from_row,
)
from routes.guards import require_admin_user, require_employee_user

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


def _employee_or_403():
    user, err = require_employee_user()
    if err:
        return None, err
    return user, None


# --- Chat Access Gate ---
@chat_bp.route("/access", methods=["GET"])
def chat_access_check():
    user, err = _employee_or_403()
    if err:
        return err
    from services.database import get_central_db
    db = get_central_db()
    employee = db.execute(
        "SELECT id, code, name, email, role, department FROM employees WHERE lower(email) = lower(?)",
        (user["email"],),
    ).fetchone()
    chat_user = chat_service.ensure_chat_user_for_account(
        {"id": user["id"], "name": user["name"], "role": user["role"]}
    )
    return jsonify({
        "allowed": True,
        "employee": {
            "id": employee["id"] if employee else None,
            "code": employee["code"] if employee else None,
            "name": employee["name"] if employee else None,
            "department": employee["department"] if employee else None,
            "position": employee["role"] if employee else None,
        },
        "chatUser": chat_user_from_row(chat_user) if chat_user else None,
    })


# --- Chat Users ---
@chat_bp.route("/users", methods=["GET"])
def get_all_chat_users():
    _, err = _employee_or_403()
    if err:
        return err
    users = chat_service.get_chat_users()
    return jsonify([chat_user_from_row(u) for u in users])


@chat_bp.route("/users/<user_id>", methods=["GET"])
def get_single_chat_user(user_id):
    _, err = _employee_or_403()
    if err:
        return err
    user = chat_service.get_chat_user(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    return jsonify(chat_user_from_row(user))


@chat_bp.route("/employees", methods=["GET"])
def get_chat_employees_directory():
    _, err = _employee_or_403()
    if err:
        return err
    directory = chat_service.get_active_employees_directory()
    return jsonify(directory)


# --- Presence ---
@chat_bp.route("/presence/heartbeat", methods=["POST"])
def presence_heartbeat():
    user, err = _employee_or_403()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    uid = str(data.get("userId") or user["id"])
    chat_service.cleanup_stale_presence()
    result = chat_service.heartbeat_presence(uid)
    return jsonify(chat_user_from_row(result))


@chat_bp.route("/presence/offline", methods=["POST"])
def presence_offline():
    user, err = _employee_or_403()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    uid = str(data.get("userId") or user["id"])
    chat_service.set_user_offline(uid)
    return jsonify({"success": True})


# --- Typing ---
@chat_bp.route("/channels/<channel_id>/typing", methods=["POST"])
def set_typing_route(channel_id):
    user, err = _employee_or_403()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    is_typing = bool(data.get("typing") or data.get("isTyping"))
    uid = str(data.get("userId") or user["id"])
    chat_service.cleanup_stale_typing()
    chat_service.set_typing(uid, channel_id, is_typing)
    return jsonify({"success": True})


@chat_bp.route("/channels/<channel_id>/typing", methods=["GET"])
def get_typing_route(channel_id):
    _, err = _employee_or_403()
    if err:
        return err
    chat_service.cleanup_stale_typing()
    typing = chat_service.get_typing_in_channel(channel_id)
    return jsonify(typing)


# --- Read Receipts & Unread ---
@chat_bp.route("/channels/<channel_id>/read", methods=["POST"])
def mark_read_route(channel_id):
    user, err = _employee_or_403()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    uid = str(data.get("userId") or user["id"])
    result = chat_service.mark_channel_read(uid, channel_id)
    return jsonify(result)


@chat_bp.route("/channels/<channel_id>/read", methods=["GET"])
def get_read_state_route(channel_id):
    _, err = _employee_or_403()
    if err:
        return err
    state = chat_service.get_channel_read_state(channel_id)
    return jsonify(state)


@chat_bp.route("/unread", methods=["GET"])
def get_unread_route():
    user, err = _employee_or_403()
    if err:
        return err
    counts = chat_service.get_unread_counts_for_user(user["id"])
    return jsonify(counts)


# --- Chat Channels ---
@chat_bp.route("/channels", methods=["GET"])
def get_all_chat_channels():
    _, err = _employee_or_403()
    if err:
        return err
    channels = chat_service.get_chat_channels()
    return jsonify([chat_channel_from_row(c) for c in channels])


@chat_bp.route("/channels", methods=["POST"])
def create_chat_channel_route():
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"success": False, "message": "Name is required"}), 400
    try:
        channel = chat_service.create_chat_channel(data)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400
    return jsonify(chat_channel_from_row(channel)), 201


@chat_bp.route("/dm", methods=["POST"])
def start_direct_message_route():
    user, err = _employee_or_403()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("targetUserId") or data.get("target_user_id")
    if not target_user_id:
        return jsonify({"success": False, "message": "Target employee user ID is required"}), 400

    try:
        channel = chat_service.get_or_create_dm_channel(user["id"], target_user_id)
        return jsonify(chat_channel_from_row(channel)), 201
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


@chat_bp.route("/channels/<channel_id>", methods=["GET"])
def get_single_chat_channel(channel_id):
    _, err = _employee_or_403()
    if err:
        return err
    channel = chat_service.get_chat_channel(channel_id)
    if not channel:
        return jsonify({"success": False, "message": "Channel not found"}), 404
    return jsonify(chat_channel_from_row(channel))


@chat_bp.route("/channels/<channel_id>", methods=["PATCH"])
def update_chat_channel_route(channel_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    try:
        channel = chat_service.update_chat_channel(channel_id, data)
        if not channel:
            return jsonify({"success": False, "message": "Channel not found"}), 404
        return jsonify(chat_channel_from_row(channel))
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


@chat_bp.route("/channels/<channel_id>", methods=["DELETE"])
def delete_chat_channel_route(channel_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    try:
        success = chat_service.delete_chat_channel(channel_id)
        if not success:
            return jsonify({"success": False, "message": "Channel not found"}), 404
        return jsonify({"success": True, "message": "Channel deleted"})
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


@chat_bp.route("/channels/<channel_id>/members", methods=["GET"])
def get_channel_members_route(channel_id):
    _, err = _employee_or_403()
    if err:
        return err
    members = chat_service.get_channel_members_enriched(channel_id)
    return jsonify(members)


@chat_bp.route("/channels/<channel_id>/members", methods=["POST"])
def add_channel_member_route(channel_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "User ID is required"}), 400

    try:
        chat_service.add_user_to_channel(channel_id, user_id)
        channel = chat_service.get_chat_channel(channel_id)
        return jsonify(chat_channel_from_row(channel))
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


@chat_bp.route("/channels/<channel_id>/members/<user_id>", methods=["DELETE"])
def remove_channel_member_route(channel_id, user_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    try:
        chat_service.remove_user_from_channel(channel_id, user_id)
        channel = chat_service.get_chat_channel(channel_id)
        return jsonify(chat_channel_from_row(channel))
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


# --- Chat Messages ---
@chat_bp.route("/channels/<channel_id>/messages", methods=["GET"])
def get_channel_messages_route(channel_id):
    _, err = _employee_or_403()
    if err:
        return err
    messages = chat_service.get_channel_messages(channel_id)
    return jsonify([chat_message_from_row(m) for m in messages])


@chat_bp.route("/messages", methods=["POST"])
def create_chat_message_route():
    user, err = _employee_or_403()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    if data.get("channelId") and not data.get("channel_id"):
        data["channel_id"] = data["channelId"]
    if data.get("authorId") and not data.get("author_id"):
        data["author_id"] = data["authorId"]
    if data.get("replyTo") and not data.get("reply_to"):
        data["reply_to"] = data["replyTo"]
    required = ["channel_id", "author_id"]
    if any(not data.get(f) for f in required):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    author_id = str(data["author_id"])
    current_id = str(user["id"])
    if author_id != current_id:
        return jsonify({"success": False, "message": "Cannot send messages on behalf of another user"}), 403

    try:
        chat_service.ensure_user_in_channel(data["author_id"], data["channel_id"])
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    if "mentions" in data and isinstance(data["mentions"], list):
        data["mentions"] = json.dumps(data["mentions"])
    if "attachments" in data and isinstance(data["attachments"], list):
        data["attachments"] = json.dumps(data["attachments"])
    if "reactions" in data and isinstance(data["reactions"], list):
        data["reactions"] = json.dumps(data["reactions"])

    message = chat_service.create_chat_message(data)
    return jsonify(chat_message_from_row(message)), 201


@chat_bp.route("/messages/<message_id>", methods=["PATCH"])
def update_chat_message_route(message_id):
    user, err = _employee_or_403()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    existing = chat_service.get_chat_message(message_id)
    if existing and str(existing["author_id"]) != str(user["id"]):
        _, admin_err = require_admin_user()
        if admin_err and "pinned" not in data:
            return jsonify({"success": False, "message": "Cannot edit another user's message"}), 403

    if "reactions" in data and isinstance(data["reactions"], list):
        data["reactions"] = json.dumps(data["reactions"])

    message = chat_service.update_chat_message(message_id, data)
    if not message:
        return jsonify({"success": False, "message": "Message not found"}), 404
    return jsonify(chat_message_from_row(message))


@chat_bp.route("/messages/<message_id>", methods=["DELETE"])
def delete_chat_message_route(message_id):
    user, err = _employee_or_403()
    if err:
        return err

    existing = chat_service.get_chat_message(message_id)
    if existing and str(existing["author_id"]) != str(user["id"]):
        _, admin_err = require_admin_user()
        if admin_err:
            return jsonify({"success": False, "message": "Cannot delete another user's message"}), 403

    if not chat_service.delete_chat_message(message_id):
        return jsonify({"success": False, "message": "Message not found"}), 404
    return jsonify({"success": True})
