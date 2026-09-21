
from flask import Blueprint, request, jsonify

from models.serializers import employee_from_row
from services.employees_service import (
    get_employees,
    get_employee,
    create_employee,
    update_employee,
    delete_employee,
    next_employee_code,
    get_employee_credentials,
    reset_employee_credentials,
    update_employee_account,
)
from routes.guards import require_admin_user, require_current_user

employees_bp = Blueprint("employees", __name__, url_prefix="/api/employees")


@employees_bp.route("", methods=["GET"])
def list_employees():
    _, error = require_current_user()
    if error:
        return error
    employees = get_employees()
    return jsonify([employee_from_row(emp) for emp in employees])


@employees_bp.route("/<emp_id>", methods=["GET"])
def get_single_employee(emp_id):
    _, error = require_current_user()
    if error:
        return error
    emp = get_employee(emp_id)
    if not emp:
        return jsonify({"error": "Employee not found"}), 404
    return jsonify(employee_from_row(emp))


@employees_bp.route("/<emp_id>/credentials", methods=["GET"])
def get_credentials_route(emp_id):
    _, error = require_admin_user()
    if error:
        return error
    cred = get_employee_credentials(emp_id)
    if cred is None:
        return jsonify({"error": "Employee not found"}), 404
    return jsonify(cred)


@employees_bp.route("/<emp_id>/reset-credentials", methods=["POST"])
def reset_credentials_route(emp_id):
    _, error = require_admin_user()
    if error:
        return error
    cred = reset_employee_credentials(emp_id)
    if cred is None:
        return jsonify({"error": "Employee not found"}), 404
    return jsonify(cred)


@employees_bp.route("/next-code", methods=["GET"])
def get_next_code():
    _, error = require_admin_user()
    if error:
        return error
    return jsonify({"code": next_employee_code()})


@employees_bp.route("", methods=["POST"])
def create_employee_route():
    _, error = require_admin_user()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("email"):
        return jsonify({"error": "Name and email are required"}), 400
    emp, credentials = create_employee(data)
    res = employee_from_row(emp)
    if credentials:
        res["credentials"] = credentials
    return jsonify(res), 201


@employees_bp.route("/<emp_id>", methods=["PATCH"])
def update_employee_route(emp_id):
    _, error = require_admin_user()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    if not get_employee(emp_id):
        return jsonify({"error": "Employee not found"}), 404
    emp = update_employee(emp_id, data)
    return jsonify(employee_from_row(emp))


@employees_bp.route("/<emp_id>/account", methods=["PATCH"])
def update_employee_account_route(emp_id):
    _, error = require_admin_user()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    try:
        result = update_employee_account(emp_id, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if result is None:
        return jsonify({"error": "Employee not found"}), 404

    emp, credentials = result
    return jsonify({
        "employee": employee_from_row(emp),
        "credentials": credentials,
    })


@employees_bp.route("/<emp_id>", methods=["DELETE"])
def delete_employee_route(emp_id):
    _, error = require_admin_user()
    if error:
        return error
    if delete_employee(emp_id) == 0:
        return jsonify({"error": "Employee not found"}), 404
    return "", 204
