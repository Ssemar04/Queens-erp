import sqlite3

from flask import Blueprint, request, jsonify

from models.serializers import customer_from_record
from routes.guards import require_admin_user, require_current_user
from services.customers_service import (
    get_customers,
    get_customer,
    create_customer,
    update_customer,
    delete_customer,
    add_interaction,
)

customers_bp = Blueprint("customers", __name__, url_prefix="/api/customers")


@customers_bp.route("", methods=["GET"])
def list_customers():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    customers = get_customers()
    return jsonify([customer_from_record(customer) for customer in customers])


@customers_bp.route("/<customer_id>", methods=["GET"])
def get_single_customer(customer_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    customer = get_customer(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer_from_record(customer))


@customers_bp.route("", methods=["POST"])
def create_customer_route():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "Missing required field: name"}), 400

    try:
        customer = create_customer(data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "A customer with that reference already exists"}), 409

    return jsonify(customer_from_record(customer)), 201


@customers_bp.route("/<customer_id>", methods=["PATCH"])
def update_customer_route(customer_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No updates provided"}), 400

    if not get_customer(customer_id):
        return jsonify({"error": "Customer not found"}), 404

    try:
        customer = update_customer(customer_id, data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "A customer with that reference already exists"}), 409

    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer_from_record(customer))


@customers_bp.route("/next-reference", methods=["GET"])
def next_customer_reference_route():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    from services.customers_service import next_reference

    return jsonify({"reference": next_reference()})


@customers_bp.route("/<customer_id>", methods=["DELETE"])
def delete_customer_route(customer_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    if delete_customer(customer_id) == 0:
        return jsonify({"error": "Customer not found"}), 404
    return "", 204


@customers_bp.route("/<customer_id>/interactions", methods=["POST"])
def add_interaction_route(customer_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["type", "summary"] if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing required field: {', '.join(missing)}"}), 400

    customer = add_interaction(customer_id, data)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer_from_record(customer))
