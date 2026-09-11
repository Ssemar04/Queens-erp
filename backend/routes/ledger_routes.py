import sqlite3
import uuid

from flask import Blueprint, jsonify, request

from models.serializers import ledger_entry_from_record
from routes.guards import require_current_user
from services import ledger_service


ledger_bp = Blueprint("ledger", __name__)


def validate_kind(kind):
    return kind in ledger_service.VALID_KINDS


def missing_response(fields):
    return jsonify({
        "success": False,
        "message": f"Missing required field: {', '.join(fields)}",
    }), 400


@ledger_bp.route("/api/ledger/<kind>")
def list_ledger_entries(kind):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not validate_kind(kind):
        return jsonify({"success": False, "message": "Invalid ledger kind"}), 400

    return jsonify([ledger_entry_from_record(record) for record in ledger_service.list_entries(kind)])


@ledger_bp.route("/api/ledger/<kind>", methods=["POST"])
def create_ledger_entry(kind):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not validate_kind(kind):
        return jsonify({"success": False, "message": "Invalid ledger kind"}), 400

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    data["kind"] = kind

    required = ["id", "kind", "reference", "partyName", "issueDate", "dueDate", "amount"]
    missing = [field for field in required if data.get(field) in (None, "")]
    if missing:
        return missing_response(missing)

    if data.get("status") and data["status"] not in ledger_service.VALID_STATUSES:
        return jsonify({"success": False, "message": "Invalid ledger status"}), 400

    try:
        record = ledger_service.create_entry(data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A ledger entry with that ID already exists"}), 409

    return jsonify(ledger_entry_from_record(record)), 201


@ledger_bp.route("/api/ledger/<kind>/<entry_id>", methods=["DELETE"])
def delete_ledger_entry(kind, entry_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not validate_kind(kind):
        return jsonify({"success": False, "message": "Invalid ledger kind"}), 400

    entry = ledger_service.get_entry(entry_id)
    if not entry or entry[0]["kind"] != kind:
        return jsonify({"success": False, "message": "Ledger entry not found"}), 404

    ledger_service.delete_entry(entry_id)
    return jsonify({"success": True})


@ledger_bp.route("/api/ledger/<kind>/<entry_id>/payments", methods=["POST"])
def create_ledger_payment(kind, entry_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not validate_kind(kind):
        return jsonify({"success": False, "message": "Invalid ledger kind"}), 400

    entry = ledger_service.get_entry(entry_id)
    if not entry or entry[0]["kind"] != kind:
        return jsonify({"success": False, "message": "Ledger entry not found"}), 404

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    required = ["id", "date", "amount", "method"]
    missing = [field for field in required if data.get(field) in (None, "")]
    if missing:
        return missing_response(missing)

    if data["method"] not in ledger_service.VALID_PAYMENT_METHODS:
        return jsonify({"success": False, "message": "Invalid payment method"}), 400

    amount = float(data.get("amount") or 0)
    balance = max(0, float(entry[0]["amount"] or 0) - float(entry[0]["paid"] or 0))
    if amount <= 0 or amount > balance:
        return jsonify({"success": False, "message": "Payment amount exceeds ledger balance"}), 400

    try:
        record = ledger_service.create_payment(entry_id, data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A payment with that ID already exists"}), 409

    return jsonify(ledger_entry_from_record(record)), 201
