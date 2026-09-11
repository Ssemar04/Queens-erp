from flask import Blueprint, jsonify, request

from models.serializers import notification_from_row
from routes.guards import require_current_user
from services import notifications_service


notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/api/notifications")
def list_notifications():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([notification_from_row(row) for row in notifications_service.list_notifications(user)])


@notifications_bp.route("/api/notifications/<notification_id>/read", methods=["PATCH"])
def mark_notification_read(notification_id):
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if notifications_service.mark_as_read(user, notification_id) == 0:
        return jsonify({"success": False, "message": "Notification not found"}), 404

    return jsonify({"success": True})


@notifications_bp.route("/api/notifications/read-all", methods=["PATCH"])
def mark_all_notifications_read():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    count = notifications_service.mark_all_as_read(user)
    return jsonify({"success": True, "count": count})


@notifications_bp.route("/api/notifications/<notification_id>", methods=["DELETE"])
def dismiss_notification(notification_id):
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if notifications_service.dismiss_notification(user, notification_id) == 0:
        return jsonify({"success": False, "message": "Notification not found"}), 404

    return jsonify({"success": True})


@notifications_bp.route("/api/notifications/preferences")
def get_notification_preferences():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify(notifications_service.get_preferences(user))


@notifications_bp.route("/api/notifications/preferences", methods=["PATCH"])
def update_notification_preferences():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    return jsonify(notifications_service.update_preferences(user, data))
