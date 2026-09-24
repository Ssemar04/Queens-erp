import sqlite3

from flask import Blueprint, jsonify, request

from models.serializers import (
    purchase_order_from_record,
    sales_order_document_from_row,
    sales_order_from_row,
    sales_order_item_from_row,
)
from routes.guards import require_admin_user, require_current_user, require_manager_user
from services import orders_service


orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/api/orders")
def list_orders():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    rows = orders_service.list_orders()
    result = []
    for row in rows:
        items = orders_service.list_order_items(row["id"])
        result.append(sales_order_from_row(row, items))
    return jsonify(result)


@orders_bp.route("/api/orders/<order_id>")
def get_order(order_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = orders_service.get_order(order_id)
    if not row:
        return jsonify({"success": False, "message": "Order not found"}), 404

    items = orders_service.list_order_items(order_id)
    return jsonify(sales_order_from_row(row, items))


@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    user, auth_error = require_current_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    
    # Auto-populate missing required fields with fallback defaults
    import uuid
    import datetime
    today = datetime.date.today().isoformat()
    
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    if not data.get("lpoNumber"):
        data["lpoNumber"] = f"LPO-{datetime.date.today().year}-{uuid.uuid4().hex[:4].upper()}"
    if not data.get("dateReceived"):
        data["dateReceived"] = today
    if not data.get("customerName"):
        data["customerName"] = "General Client"
    if not data.get("dateToBeDelivered"):
        data["dateToBeDelivered"] = today
    if not data.get("handledBy"):
        data["handledBy"] = (user.get("name") if isinstance(user, dict) else None) or "Queenstech Staff"

    if data.get("status") and data["status"] not in orders_service.VALID_STATUSES:
        data["status"] = "submitted"

    try:
        row = orders_service.create_order(data)
        items = orders_service.list_order_items(data["id"])
    except sqlite3.IntegrityError:
        return jsonify({
            "success": False,
            "message": "An order with that ID or LPO number already exists"
        }), 409

    return jsonify(sales_order_from_row(row, items)), 201


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
        data["status"] = "submitted"

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
        row = orders_service.get_order(order_id)

    items = orders_service.list_order_items(order_id)
    return jsonify(sales_order_from_row(row, items))


@orders_bp.route("/api/orders/<order_id>", methods=["DELETE"])
def delete_order(order_id):
    _, auth_error = require_admin_user()
    if auth_error:
        return auth_error

    if orders_service.delete_order(order_id) == 0:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    return jsonify({"success": True})


# ---------- Sales Order Documents ----------

@orders_bp.route("/api/documents", methods=["GET"])
def list_all_documents():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    rows = orders_service.list_documents()
    return jsonify([sales_order_document_from_row(r) for r in rows])


@orders_bp.route("/api/documents", methods=["POST"])
def upload_global_document():
    user, auth_error = require_manager_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    required_fields = ["documentType", "fileName", "dataUrl"]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    payload = dict(data)
    if "salesOrderId" not in payload or not payload["salesOrderId"]:
        payload["salesOrderId"] = "shared"
    if "uploadedBy" not in payload or not payload["uploadedBy"]:
        try:
            payload["uploadedBy"] = user.get("name") or user.get("email") or ""
        except Exception:
            pass

    row = orders_service.upload_document(payload)
    if not row:
        return jsonify({"success": False, "message": "Failed to upload document"}), 500

    return jsonify(sales_order_document_from_row(row)), 201


@orders_bp.route("/api/orders/<order_id>/documents", methods=["GET"])
def list_order_documents(order_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    rows = orders_service.list_documents(order_id=order_id)
    return jsonify([sales_order_document_from_row(r) for r in rows])


@orders_bp.route("/api/orders/<order_id>/documents", methods=["POST"])
def upload_order_document(order_id):
    user, auth_error = require_manager_user()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    required_fields = ["documentType", "fileName", "dataUrl"]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required field: {', '.join(missing)}"
        }), 400

    payload = dict(data)
    payload["salesOrderId"] = order_id or "shared"
    if "uploadedBy" not in payload or not payload["uploadedBy"]:
        try:
            payload["uploadedBy"] = user.get("name") or user.get("email") or ""
        except Exception:
            pass

    row = orders_service.upload_document(payload)
    if not row:
        return jsonify({"success": False, "message": "Failed to upload document"}), 500

    return jsonify(sales_order_document_from_row(row)), 201


@orders_bp.route("/api/documents/<doc_id>", methods=["GET"])
def get_order_document(doc_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    row = orders_service.get_document(doc_id)
    if not row:
        return jsonify({"success": False, "message": "Document not found"}), 404

    return jsonify(sales_order_document_from_row(row))


@orders_bp.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_order_document(doc_id):
    _, auth_error = require_manager_user()
    if auth_error:
        return auth_error

    if orders_service.delete_document(doc_id) == 0:
        return jsonify({"success": False, "message": "Document not found"}), 404

    return jsonify({"success": True})


# ---------- Purchase Orders ----------

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
        record = orders_service.create_purchase_order(data, str(user["id"]) if user else "")
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
