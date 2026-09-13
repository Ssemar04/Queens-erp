import sqlite3

from flask import Blueprint, jsonify, request

from models.serializers import purchase_order_from_record, sales_order_from_row
from routes.guards import require_current_user
from services import orders_service

orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/api/orders")
def list_orders():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([sales_order_from_row(row) for row in orders_service.list_orders()])


@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    required = ["id", "lpoNumber", "dateReceived", "customerName", "dateToBeDelivered", "handledBy"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    if data.get("status") and data["status"] not in orders_service.VALID_STATUSES:
        return jsonify({
            "success": False,
            "message": "Invalid order status"
        }), 400

    try:
        row = orders_service.create_order(data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "An order with that ID or LPO number already exists"
        }), 409

    return jsonify(sales_order_from_row(row)), 201


@orders_bp.route("/api/orders/<order_id>", methods=["PATCH"])
def update_order(order_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({
            "success": False,
            "message": "No updates provided"
        }), 400

    if data.get("status") and data["status"] not in orders_service.VALID_STATUSES:
        return jsonify({
            "success": False,
            "message": "Invalid order status"
        }), 400

    if not orders_service.get_order(order_id):
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    try:
        row = orders_service.update_order(order_id, data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "An order with that LPO number already exists"
        }), 409

    if not row:
        return jsonify({
            "success": False,
            "message": "No valid updates provided"
        }), 400

    return jsonify(sales_order_from_row(row))


@orders_bp.route("/api/orders/<order_id>", methods=["DELETE"])
def delete_order(order_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if orders_service.delete_order(order_id) == 0:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    return jsonify({"success": True})


@orders_bp.route("/api/purchase-orders")
def list_purchase_orders():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify([
        purchase_order_from_record(record)
        for record in orders_service.list_purchase_orders()
        if record
    ])


@orders_bp.route("/api/purchase-orders/<po_id>")
def get_purchase_order(po_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    record = orders_service.get_purchase_order(po_id)
    if not record:
        return jsonify({
            "success": False,
            "message": "Purchase order not found"
        }), 404

    return jsonify(purchase_order_from_record(record))


@orders_bp.route("/api/purchase-orders", methods=["POST"])
def create_purchase_order():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    required = ["id", "supplierId"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    if data.get("status") and data["status"] not in orders_service.VALID_PURCHASE_ORDER_STATUSES:
        return jsonify({
            "success": False,
            "message": "Invalid purchase order status"
        }), 400

    try:
        record = orders_service.create_purchase_order(data, str(user["id"]))
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A purchase order with that ID or order number already exists"
        }), 409

    return jsonify(purchase_order_from_record(record)), 201


@orders_bp.route("/api/purchase-orders/<po_id>", methods=["PATCH"])
def update_purchase_order(po_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({
            "success": False,
            "message": "No updates provided"
        }), 400

    if data.get("status") and data["status"] not in orders_service.VALID_PURCHASE_ORDER_STATUSES:
        return jsonify({
            "success": False,
            "message": "Invalid purchase order status"
        }), 400

    if not orders_service.get_purchase_order(po_id):
        return jsonify({
            "success": False,
            "message": "Purchase order not found"
        }), 404

    try:
        record = orders_service.update_purchase_order(po_id, data)
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "A purchase order with that order number already exists"
        }), 409

    return jsonify(purchase_order_from_record(record))


@orders_bp.route("/api/purchase-orders/<po_id>", methods=["DELETE"])
def delete_purchase_order(po_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    if orders_service.delete_purchase_order(po_id) == 0:
        return jsonify({
            "success": False,
            "message": "Purchase order not found"
        }), 404

    return jsonify({"success": True})
