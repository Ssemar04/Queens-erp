import sqlite3
from flask import Blueprint, jsonify, request
from models.serializers import purchase_from_row
from services.purchases_service import (
    list_purchases,
    get_purchase,
    create_purchase,
    update_purchase,
    delete_purchase,
    next_purchase_number,
)

purchases_bp = Blueprint("purchases", __name__, url_prefix="/api/purchases")


@purchases_bp.route("", methods=["GET"])
def list_purchases_route():
    rows = list_purchases()
    return jsonify([purchase_from_row(row) for row in rows])


@purchases_bp.route("/next-number", methods=["GET"])
def next_purchase_number_route():
    return jsonify({"purchaseNumber": next_purchase_number()})


@purchases_bp.route("/<purchase_id>", methods=["GET"])
def get_single_purchase(purchase_id):
    row = get_purchase(purchase_id)
    if not row:
        return jsonify({"error": "Purchase not found"}), 404
    return jsonify(purchase_from_row(row))


@purchases_bp.route("", methods=["POST"])
def create_purchase_route():
    data = request.get_json(silent=True) or {}
    if not data.get("supplierName") or data.get("totalAmount") is None:
        return jsonify({"error": "Missing required fields (supplierName, totalAmount)"}), 400

    try:
        row = create_purchase(data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "A purchase with that PO number already exists"}), 409

    return jsonify(purchase_from_row(row)), 201


@purchases_bp.route("/<purchase_id>", methods=["PATCH"])
def update_purchase_route(purchase_id):
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No updates provided"}), 400

    if not get_purchase(purchase_id):
        return jsonify({"error": "Purchase not found"}), 404

    try:
        row = update_purchase(purchase_id, data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "A purchase with that PO number already exists"}), 409

    if not row:
        return jsonify({"error": "Purchase not found"}), 404
    return jsonify(purchase_from_row(row))


@purchases_bp.route("/<purchase_id>", methods=["DELETE"])
def delete_purchase_route(purchase_id):
    if delete_purchase(purchase_id) == 0:
        return jsonify({"error": "Purchase not found"}), 404
    return "", 204
