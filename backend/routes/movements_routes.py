import sqlite3
import sys
import traceback

from flask import Blueprint, jsonify, request

from models.serializers import movement_from_row
from routes.guards import require_current_user
from services import movements_service

movements_bp = Blueprint("movements", __name__)


def validate_movement_payload(data):
    if not isinstance(data, dict):
        return "Request body must be a JSON object"

    required = ["id", "type", "quantity"]
    missing = [field for field in required if data.get(field) in (None, "")]
    if not data.get("sale") and data.get("itemId") in (None, ""):
        missing.append("itemId")
    if missing:
        return f"Missing required field: {', '.join(missing)}"

    if data["type"] not in movements_service.VALID_MOVEMENT_TYPES:
        return f"Invalid movement type. Allowed: {', '.join(sorted(movements_service.VALID_MOVEMENT_TYPES))}"

    return None


@movements_bp.route("/api/movements")
def list_movements():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    try:
        rows = movements_service.list_movements(request.args.get("limit", type=int))
        return jsonify([movement_from_row(row) for row in rows])
    except Exception as exc:
        print(f"[movements.list] exception: {exc}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to load movements: {exc}",
        }), 500


@movements_bp.route("/api/movements", methods=["POST"])
def create_movement():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    validation_error = validate_movement_payload(data)
    if validation_error:
        return jsonify({
            "success": False,
            "message": validation_error,
        }), 400

    try:
        row = movements_service.create_movement(data)
    except sqlite3.IntegrityError as integ:
        print(f"[movements.create] IntegrityError: {integ}", file=sys.stderr)
        return jsonify({
            "success": False,
            "message": "A movement with that ID already exists"
        }), 409
    except (ValueError, TypeError) as bad_input:
        print(f"[movements.create] ValueError/TypeError: {bad_input}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Invalid movement payload: {bad_input}",
        }), 400
    except Exception as exc:
        print(f"[movements.create] unhandled exception: {exc}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to create movement: {exc}",
            "received_keys": sorted(data.keys()),
        }), 500

    if not row:
        return jsonify({
            "success": False,
            "message": "Item not found"
        }), 404

    return jsonify(movement_from_row(row)), 201


@movements_bp.route("/api/movements/bulk", methods=["POST"])
def create_movements_bulk():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    movements = data.get("movements") if isinstance(data, dict) else None
    if not isinstance(movements, list):
        return jsonify({
            "success": False,
            "message": "Request body must include a movements array",
        }), 400

    for index, movement in enumerate(movements):
        validation_error = validate_movement_payload(movement)
        if validation_error:
            return jsonify({
                "success": False,
                "message": f"Movement {index + 1}: {validation_error}",
            }), 400

    try:
        rows = movements_service.create_movements(movements)
    except sqlite3.IntegrityError as integ:
        print(f"[movements.bulk_create] IntegrityError: {integ}", file=sys.stderr)
        return jsonify({
            "success": False,
            "message": "One or more movements already exist",
        }), 409
    except (ValueError, TypeError) as bad_input:
        print(f"[movements.bulk_create] ValueError/TypeError: {bad_input}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Invalid movement payload: {bad_input}",
        }), 400
    except Exception as exc:
        print(f"[movements.bulk_create] unhandled exception: {exc}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to create movements: {exc}",
        }), 500

    return jsonify([movement_from_row(row) for row in rows]), 201


@movements_bp.route("/api/movements/receipt/<receipt_number>/status", methods=["PATCH"])
def update_transaction_status(receipt_number):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if not status:
        return jsonify({
            "success": False,
            "message": "Missing status field"
        }), 400

    if status not in movements_service.VALID_TRANSACTION_STATUSES:
        return jsonify({
            "success": False,
            "message": f"Invalid status. Allowed: {', '.join(sorted(movements_service.VALID_TRANSACTION_STATUSES))}"
        }), 400

    try:
        updated_rows = movements_service.update_transaction_status_by_receipt(receipt_number, status)
    except Exception as exc:
        print(f"[movements.update_status] exception: {exc}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to update transaction status: {exc}",
        }), 500

    return jsonify({
        "success": True,
        "message": "Transaction status updated",
        "movements": [movement_from_row(r) for r in updated_rows],
    })
