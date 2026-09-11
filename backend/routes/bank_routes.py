import sqlite3
import uuid

from flask import Blueprint, jsonify, request

from models.serializers import (
    bank_account_from_row,
    bank_statement_line_from_row,
    bank_transaction_from_row,
)
from routes.guards import require_current_user
from services import bank_service


bank_bp = Blueprint("bank", __name__)


def missing_response(fields):
    return jsonify({
        "success": False,
        "message": f"Missing required field: {', '.join(fields)}",
    }), 400


@bank_bp.route("/api/bank")
def get_bank_state():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify({
        "accounts": [bank_account_from_row(row) for row in bank_service.list_accounts()],
        "txns": [bank_transaction_from_row(row) for row in bank_service.list_transactions()],
        "statements": [bank_statement_line_from_row(row) for row in bank_service.list_statement_lines()],
    })


@bank_bp.route("/api/bank/accounts", methods=["POST"])
def create_bank_account():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    required = ["id", "accountName", "accountNumber", "bankName"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return missing_response(missing)

    if data.get("status") and data["status"] not in bank_service.VALID_ACCOUNT_STATUSES:
        return jsonify({"success": False, "message": "Invalid account status"}), 400

    if data.get("currency") and data["currency"] not in bank_service.VALID_CURRENCIES:
        return jsonify({"success": False, "message": "Invalid currency"}), 400

    try:
        row = bank_service.create_account(data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A bank account with that ID already exists"}), 409

    return jsonify(bank_account_from_row(row)), 201


@bank_bp.route("/api/bank/accounts/<account_id>", methods=["PATCH"])
def update_bank_account(account_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    if data.get("status") and data["status"] not in bank_service.VALID_ACCOUNT_STATUSES:
        return jsonify({"success": False, "message": "Invalid account status"}), 400

    if data.get("currency") and data["currency"] not in bank_service.VALID_CURRENCIES:
        return jsonify({"success": False, "message": "Invalid currency"}), 400

    if not bank_service.get_account(account_id):
        return jsonify({"success": False, "message": "Account not found"}), 404

    row = bank_service.update_account(account_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(bank_account_from_row(row))


@bank_bp.route("/api/bank/accounts/<account_id>", methods=["DELETE"])
def delete_bank_account(account_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if bank_service.delete_account(account_id) == 0:
        return jsonify({"success": False, "message": "Account not found"}), 404

    return jsonify({"success": True})


@bank_bp.route("/api/bank/transactions", methods=["POST"])
def create_bank_transaction():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    required = ["id", "accountId", "date", "type", "reference", "amount"]
    missing = [field for field in required if data.get(field) in (None, "")]
    if missing:
        return missing_response(missing)

    if data["type"] not in bank_service.VALID_TXN_TYPES:
        return jsonify({"success": False, "message": "Invalid transaction type"}), 400

    if not bank_service.get_account(data["accountId"]):
        return jsonify({"success": False, "message": "Account not found"}), 404

    try:
        row = bank_service.create_transaction(data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A bank transaction with that ID already exists"}), 409

    return jsonify(bank_transaction_from_row(row)), 201


@bank_bp.route("/api/bank/transactions/<txn_id>/reconciled", methods=["PATCH"])
def toggle_bank_transaction_reconciled(txn_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not bank_service.get_transaction(txn_id):
        return jsonify({"success": False, "message": "Transaction not found"}), 404

    return jsonify(bank_transaction_from_row(bank_service.toggle_transaction_reconciled(txn_id)))


@bank_bp.route("/api/bank/accounts/<account_id>/statements", methods=["POST"])
def import_bank_statement(account_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not bank_service.get_account(account_id):
        return jsonify({"success": False, "message": "Account not found"}), 404

    data = request.get_json(silent=True) or {}
    lines = data.get("lines") if isinstance(data.get("lines"), list) else []
    if not lines:
        return jsonify({"success": False, "message": "No statement lines provided"}), 400

    for line in lines:
        line.setdefault("id", str(uuid.uuid4()))
        missing = [field for field in ["id", "date", "amount"] if line.get(field) in (None, "")]
        if missing:
            return missing_response(missing)

    rows = bank_service.create_statement_lines(account_id, lines)
    return jsonify([bank_statement_line_from_row(row) for row in rows]), 201
