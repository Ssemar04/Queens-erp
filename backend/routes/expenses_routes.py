import sqlite3
import uuid

from flask import Blueprint, jsonify, request

from models.serializers import (
    expense_audit_from_row,
    expense_category_from_row,
    expense_from_row,
)
from routes.guards import require_current_user
from services import expenses_service


expenses_bp = Blueprint("expenses", __name__)


def missing_response(fields):
    return jsonify({
        "success": False,
        "message": f"Missing required field: {', '.join(fields)}",
    }), 400


@expenses_bp.route("/api/expenses")
def get_expenses_state():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify({
        "categories": [expense_category_from_row(row) for row in expenses_service.list_categories()],
        "expenses": [expense_from_row(row) for row in expenses_service.list_expenses()],
        "audit": [expense_audit_from_row(row) for row in expenses_service.list_audit()],
    })


@expenses_bp.route("/api/expenses/categories", methods=["POST"])
def create_expense_category():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    missing = [field for field in ["id", "name"] if data.get(field) in (None, "")]
    if missing:
        return missing_response(missing)

    try:
        row = expenses_service.create_category(data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "A category with that ID already exists"}), 409

    return jsonify(expense_category_from_row(row)), 201


@expenses_bp.route("/api/expenses/categories/<category_id>", methods=["PATCH"])
def update_expense_category(category_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not expenses_service.get_category(category_id):
        return jsonify({"success": False, "message": "Category not found"}), 404

    row = expenses_service.update_category(category_id, request.get_json(silent=True) or {})
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(expense_category_from_row(row))


@expenses_bp.route("/api/expenses/categories/<category_id>", methods=["DELETE"])
def delete_expense_category(category_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if expenses_service.delete_category(category_id) == 0:
        return jsonify({"success": False, "message": "Category not found"}), 404

    return jsonify({"success": True})


@expenses_bp.route("/api/expenses", methods=["POST"])
def create_expense():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    data.setdefault("id", str(uuid.uuid4()))
    data.setdefault("reference", expenses_service.next_reference())
    missing = [field for field in ["id", "reference", "date", "type", "amount", "paymentMethod"] if data.get(field) in (None, "")]
    if missing:
        return missing_response(missing)

    validation_error = validate_expense_payload(data)
    if validation_error:
        return validation_error

    try:
        row = expenses_service.create_expense(data)
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "An expense with that ID or reference already exists"}), 409

    return jsonify(expense_from_row(row)), 201


@expenses_bp.route("/api/expenses/<expense_id>", methods=["PATCH"])
def update_expense(expense_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not expenses_service.get_expense(expense_id):
        return jsonify({"success": False, "message": "Expense not found"}), 404

    data = request.get_json(silent=True) or {}
    validation_error = validate_expense_payload(data, partial=True)
    if validation_error:
        return validation_error

    row = expenses_service.update_expense(expense_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(expense_from_row(row))


@expenses_bp.route("/api/expenses/<expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if expenses_service.delete_expense(expense_id) == 0:
        return jsonify({"success": False, "message": "Expense not found"}), 404

    return jsonify({"success": True})


@expenses_bp.route("/api/expenses/<expense_id>/decision", methods=["POST"])
def decide_expense(expense_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not expenses_service.get_expense(expense_id):
        return jsonify({"success": False, "message": "Expense not found"}), 404

    data = request.get_json(silent=True) or {}
    data.setdefault("auditId", str(uuid.uuid4()))
    if data.get("decision") not in {"approved", "rejected"}:
        return jsonify({"success": False, "message": "Invalid expense decision"}), 400

    return jsonify(expense_from_row(expenses_service.decide(expense_id, data)))


@expenses_bp.route("/api/expenses/<expense_id>/reimburse", methods=["POST"])
def reimburse_expense(expense_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if not expenses_service.get_expense(expense_id):
        return jsonify({"success": False, "message": "Expense not found"}), 404

    data = request.get_json(silent=True) or {}
    data.setdefault("auditId", str(uuid.uuid4()))
    return jsonify(expense_from_row(expenses_service.reimburse(expense_id, data)))


def validate_expense_payload(data, partial=False):
    if data.get("type") and data["type"] not in expenses_service.VALID_TYPES:
        return jsonify({"success": False, "message": "Invalid expense type"}), 400

    if data.get("status") and data["status"] not in expenses_service.VALID_STATUSES:
        return jsonify({"success": False, "message": "Invalid expense status"}), 400

    if data.get("paymentMethod") and data["paymentMethod"] not in expenses_service.VALID_PAYMENT_METHODS:
        return jsonify({"success": False, "message": "Invalid payment method"}), 400

    if data.get("categoryId") and not expenses_service.get_category(data["categoryId"]):
        return jsonify({"success": False, "message": "Category not found"}), 404

    if "amount" in data and data["amount"] is not None:
        try:
            val = float(data["amount"])
            if val < 0:
                return jsonify({"success": False, "message": "Expense amount must be positive"}), 400
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid expense amount"}), 400
    elif not partial:
        return jsonify({"success": False, "message": "Expense amount must be positive"}), 400

    return None
