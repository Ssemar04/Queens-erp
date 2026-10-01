import sqlite3
import uuid

from flask import Blueprint, jsonify, request

from models.serializers import loss_from_row
from routes.guards import require_current_user, require_manager_user
from services import losses_service


losses_bp = Blueprint("losses", __name__)


def missing_response(fields):
    return jsonify({
        "success": False,
        "message": f"Missing required field: {', '.join(fields)}",
    }), 400


def validate_loss_payload(data, partial=False):
    kind = data.get("kind")
    if kind is not None and str(kind).lower() not in losses_service.LOSS_KINDS:
        return jsonify({"success": False, "message": "Invalid loss kind"}), 400

    reason = data.get("reasonCode")
    if reason is not None and str(reason).lower() not in losses_service.LOSS_REASONS:
        return jsonify({"success": False, "message": "Invalid loss reason"}), 400

    status = data.get("status")
    if status is not None and str(status).lower() not in losses_service.LOSS_STATUSES:
        return jsonify({"success": False, "message": "Invalid loss status"}), 400

    for field in ("quantity", "unitValue", "totalValue"):
        if field in data and data[field] not in (None, ""):
            try:
                if float(data[field]) < 0:
                    return jsonify({"success": False, "message": f"{field} must not be negative"}), 400
            except (ValueError, TypeError):
                return jsonify({"success": False, "message": f"Invalid {field}"}), 400

    if not partial:
        if not data.get("date"):
            return missing_response(["date"])
        effective_kind = str(data.get("kind") or "inventory").lower()
        if effective_kind == "inventory" and not data.get("itemId"):
            return jsonify({"success": False, "message": "An inventory loss requires an item"}), 400
        if effective_kind == "asset" and not data.get("assetId"):
            return jsonify({"success": False, "message": "An asset loss requires an asset"}), 400

    return None


@losses_bp.route("/api/losses")
def get_losses():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify({
        "losses": [loss_from_row(row) for row in losses_service.list_losses()],
        "summary": losses_service.loss_summary(),
    })


@losses_bp.route("/api/losses/summary")
def get_loss_summary():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify(losses_service.loss_summary())


@losses_bp.route("/api/losses", methods=["POST"])
def create_loss():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    data.setdefault("reference", losses_service.next_reference())
    if not data.get("reportedBy"):
        data["reportedBy"] = user["name"] or user["email"] or "Unknown"

    validation_error = validate_loss_payload(data)
    if validation_error:
        return validation_error

    try:
        row = losses_service.create_loss(data)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A loss with that ID or reference already exists"}), 409

    return jsonify(loss_from_row(row)), 201


@losses_bp.route("/api/losses/<loss_id>", methods=["PATCH"])
def update_loss(loss_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not losses_service.get_loss(loss_id):
        return jsonify({"success": False, "message": "Loss record not found"}), 404

    data = request.get_json(silent=True) or {}
    validation_error = validate_loss_payload(data, partial=True)
    if validation_error:
        return validation_error

    row = losses_service.update_loss(loss_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(loss_from_row(row))


@losses_bp.route("/api/losses/<loss_id>/status", methods=["POST"])
def set_loss_status(loss_id):
    user, auth_error = require_manager_user()
    if auth_error:
        return auth_error

    if not losses_service.get_loss(loss_id):
        return jsonify({"success": False, "message": "Loss record not found"}), 404

    data = request.get_json(silent=True) or {}
    status = str(data.get("status") or "").lower()
    if status not in losses_service.LOSS_STATUSES:
        return jsonify({"success": False, "message": "Invalid loss status"}), 400

    actor = data.get("actor") or user["name"] or user["email"] or "Unknown"
    row = losses_service.set_status(loss_id, status, actor=actor, note=data.get("note"))
    return jsonify(loss_from_row(row))


@losses_bp.route("/api/losses/<loss_id>", methods=["DELETE"])
def delete_loss(loss_id):
    _, auth_error = require_manager_user()
    if auth_error:
        return auth_error

    if losses_service.delete_loss(loss_id) == 0:
        return jsonify({"success": False, "message": "Loss record not found"}), 404

    return jsonify({"success": True})
