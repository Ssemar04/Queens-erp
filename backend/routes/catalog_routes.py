import sqlite3

from flask import Blueprint, jsonify, request

from models.serializers import (
    category_from_row,
    item_from_row,
    location_from_row,
    branch_from_row,
    supplier_from_row,
)
from routes.guards import require_current_user
from services import catalog_service

catalog_bp = Blueprint("catalog", __name__)


@catalog_bp.route("/api/items")
def list_items():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([item_from_row(row) for row in catalog_service.list_items(request.args)])


@catalog_bp.route("/api/items/<item_id>")
def get_item(item_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = catalog_service.get_item(item_id)
    if not row:
        return jsonify({
            "success": False,
            "message": "Item not found"
        }), 404

    return jsonify(item_from_row(row))


@catalog_bp.route("/api/items/next-sku")
def get_next_sku():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify({"sku": catalog_service.next_sku()})


@catalog_bp.route("/api/items/next-barcode")
def get_next_barcode():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify({"barcode": catalog_service.next_barcode()})


@catalog_bp.route("/api/items", methods=["POST"])
def create_item():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["name"] if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    try:
        row = catalog_service.create_item(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "An item with that SKU or ID already exists"
        }), 409

    return jsonify(item_from_row(row)), 201


@catalog_bp.route("/api/items/<item_id>", methods=["PATCH"])
def update_item(item_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({
            "success": False,
            "message": "No updates provided"
        }), 400

    if not catalog_service.get_item(item_id):
        return jsonify({
            "success": False,
            "message": "Item not found"
        }), 404

    try:
        row = catalog_service.update_item(item_id, data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "An item with that SKU already exists"
        }), 409

    if not row:
        return jsonify({
            "success": False,
            "message": "No valid updates provided"
        }), 400

    return jsonify(item_from_row(row))


@catalog_bp.route("/api/items/<item_id>", methods=["DELETE"])
def delete_item(item_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if catalog_service.delete_item(item_id) == 0:
        return jsonify({
            "success": False,
            "message": "Item not found"
        }), 404

    return jsonify({"success": True})





@catalog_bp.route("/api/categories")
def list_categories():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([category_from_row(row) for row in catalog_service.list_categories()])


@catalog_bp.route("/api/categories", methods=["POST"])
def create_category():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["id", "name"] if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    try:
        row = catalog_service.create_category(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A category with that ID already exists"
        }), 409

    return jsonify(category_from_row(row)), 201


@catalog_bp.route("/api/suppliers")
def list_suppliers():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([supplier_from_row(row) for row in catalog_service.list_suppliers()])


@catalog_bp.route("/api/locations")
def list_locations():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([location_from_row(row) for row in catalog_service.list_branches()])


@catalog_bp.route("/api/branches")
def list_branches():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([branch_from_row(row) for row in catalog_service.list_branches()])

@catalog_bp.route("/api/categories/<category_id>", methods=["PATCH"])
def update_category(category_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    if not catalog_service.get_category(category_id):
        return jsonify({"success": False, "message": "Category not found"}), 404

    row = catalog_service.update_category(category_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(category_from_row(row))

@catalog_bp.route("/api/categories/<category_id>", methods=["DELETE"])
def delete_category(category_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if catalog_service.delete_category(category_id) == 0:
        return jsonify({"success": False, "message": "Category not found"}), 404

    return jsonify({"success": True})

@catalog_bp.route("/api/suppliers/<supplier_id>", methods=["GET"])
def get_supplier(supplier_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = catalog_service.get_supplier(supplier_id)
    if not row:
        return jsonify({"success": False, "message": "Supplier not found"}), 404

    return jsonify(supplier_from_row(row))

@catalog_bp.route("/api/suppliers", methods=["POST"])
def create_supplier():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["id", "name"] if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    try:
        row = catalog_service.create_supplier(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A supplier with that ID already exists"
        }), 409

    return jsonify(supplier_from_row(row)), 201

@catalog_bp.route("/api/suppliers/<supplier_id>", methods=["PATCH"])
def update_supplier(supplier_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    if not catalog_service.get_supplier(supplier_id):
        return jsonify({"success": False, "message": "Supplier not found"}), 404

    row = catalog_service.update_supplier(supplier_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(supplier_from_row(row))

@catalog_bp.route("/api/suppliers/<supplier_id>", methods=["DELETE"])
def delete_supplier(supplier_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if catalog_service.delete_supplier(supplier_id) == 0:
        return jsonify({"success": False, "message": "Supplier not found"}), 404

    return jsonify({"success": True})

@catalog_bp.route("/api/locations/<location_id>", methods=["GET"])
def get_location(location_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = catalog_service.get_branch(location_id)
    if not row:
        return jsonify({"success": False, "message": "Location not found"}), 404

    return jsonify(location_from_row(row))


@catalog_bp.route("/api/branches/<branch_id>", methods=["GET"])
def get_branch(branch_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = catalog_service.get_branch(branch_id)
    if not row:
        return jsonify({"success": False, "message": "Branch not found"}), 404

    return jsonify(branch_from_row(row))

@catalog_bp.route("/api/locations", methods=["POST"])
def create_location():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["id", "name"] if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    try:
        row = catalog_service.create_branch(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A location with that ID already exists"
        }), 409

    return jsonify(location_from_row(row)), 201


@catalog_bp.route("/api/branches", methods=["POST"])
def create_branch():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    missing = [field for field in ["id", "name"] if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    try:
        row = catalog_service.create_branch(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A branch with that ID already exists"
        }), 409

    return jsonify(branch_from_row(row)), 201

@catalog_bp.route("/api/locations/<location_id>", methods=["PATCH"])
def update_location(location_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    if not catalog_service.get_branch(location_id):
        return jsonify({"success": False, "message": "Location not found"}), 404

    row = catalog_service.update_branch(location_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(location_from_row(row))


@catalog_bp.route("/api/branches/<branch_id>", methods=["PATCH"])
def update_branch(branch_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No updates provided"}), 400

    if not catalog_service.get_branch(branch_id):
        return jsonify({"success": False, "message": "Branch not found"}), 404

    row = catalog_service.update_branch(branch_id, data)
    if not row:
        return jsonify({"success": False, "message": "No valid updates provided"}), 400

    return jsonify(branch_from_row(row))

@catalog_bp.route("/api/locations/<location_id>", methods=["DELETE"])
def delete_location(location_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if catalog_service.delete_branch(location_id) == 0:
        return jsonify({"success": False, "message": "Location not found"}), 404

    return jsonify({"success": True})


@catalog_bp.route("/api/branches/<branch_id>", methods=["DELETE"])
def delete_branch(branch_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if catalog_service.delete_branch(branch_id) == 0:
        return jsonify({"success": False, "message": "Branch not found"}), 404

    return jsonify({"success": True})
