
import sqlite3

from flask import Blueprint, request, jsonify

from models.serializers import (
    asset_from_record,
    asset_income_from_row,
    asset_consumable_from_row,
    asset_monthly_target_from_row,
)
from services.assets_service import (
    get_assets,
    get_asset,
    create_asset,
    update_asset,
    delete_asset,
    add_meter_reading,
    add_service_record,
    next_tag,
    list_asset_income,
    add_asset_income,
    update_asset_income,
    delete_asset_income,
    list_consumables,
    add_consumable,
    delete_consumable,
    get_monthly_targets,
    upsert_monthly_target,
    delete_monthly_target,
)

assets_bp = Blueprint("assets", __name__, url_prefix="/api/assets")


@assets_bp.route("", methods=["GET"])
def list_assets():
    assets = get_assets()
    return jsonify([asset_from_record(asset) for asset in assets])


@assets_bp.route("/next-tag", methods=["GET"])
def next_tag_route():
    return jsonify({"tag": next_tag()})


@assets_bp.route("/<asset_id>", methods=["GET"])
def get_single_asset(asset_id):
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_from_record(asset))


@assets_bp.route("", methods=["POST"])
def create_asset_route():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("purchaseDate"):
        return jsonify({"error": "Missing required fields (name, purchaseDate)"}), 400

    try:
        asset = create_asset(data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "An asset with that tag already exists"}), 409

    return jsonify(asset_from_record(asset)), 201


@assets_bp.route("/<asset_id>", methods=["PATCH"])
def update_asset_route(asset_id):
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No updates provided"}), 400

    if not get_asset(asset_id):
        return jsonify({"error": "Asset not found"}), 404

    try:
        asset = update_asset(asset_id, data)
    except sqlite3.IntegrityError:
        return jsonify({"error": "An asset with that tag already exists"}), 409

    if not asset:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_from_record(asset))


@assets_bp.route("/<asset_id>", methods=["DELETE"])
def delete_asset_route(asset_id):
    if delete_asset(asset_id) == 0:
        return jsonify({"error": "Asset not found"}), 404
    return "", 204


@assets_bp.route("/<asset_id>/meter-readings", methods=["POST"])
def add_meter_reading_route(asset_id):
    data = request.get_json(silent=True) or {}
    missing = [field for field in ["date", "value"] if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    asset = add_meter_reading(asset_id, data)
    if not asset:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_from_record(asset))


@assets_bp.route("/<asset_id>/service-records", methods=["POST"])
def add_service_record_route(asset_id):
    data = request.get_json(silent=True) or {}
    missing = [field for field in ["date", "type"] if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    asset = add_service_record(asset_id, data)
    if not asset:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_from_record(asset))



@assets_bp.route("/<asset_id>/income", methods=["GET"])
def list_asset_income_route(asset_id):
    if not get_asset(asset_id):
        return jsonify({"error": "Asset not found"}), 404
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    rows = list_asset_income(asset_id, date_from=date_from, date_to=date_to)
    return jsonify([asset_income_from_row(r) for r in rows])


@assets_bp.route("/<asset_id>/income", methods=["POST"])
def create_asset_income_route(asset_id):
    data = request.get_json(silent=True) or {}
    missing = [f for f in ("date", "amount") if f not in data or data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    try:
        row = add_asset_income(asset_id, data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if not row:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_income_from_row(row)), 201


@assets_bp.route("/<asset_id>/income/<income_id>", methods=["PATCH"])
def update_asset_income_route(asset_id, income_id):
    data = request.get_json(silent=True) or {}
    row = update_asset_income(asset_id, income_id, data)
    if not row:
        return jsonify({"error": "Income record not found"}), 404
    return jsonify(asset_income_from_row(row))


@assets_bp.route("/<asset_id>/income/<income_id>", methods=["DELETE"])
def delete_asset_income_route(asset_id, income_id):
    rows = delete_asset_income(asset_id, income_id)
    if rows == 0:
        return jsonify({"error": "Income record not found"}), 404
    return "", 204


@assets_bp.route("/<asset_id>/consumables", methods=["GET"])
def list_consumables_route(asset_id):
    if not get_asset(asset_id):
        return jsonify({"error": "Asset not found"}), 404
    rows = list_consumables(asset_id)
    if rows is None:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify([asset_consumable_from_row(r) for r in rows])


@assets_bp.route("/<asset_id>/consumables", methods=["POST"])
def create_consumable_route(asset_id):
    data = request.get_json(silent=True) or {}
    missing = [f for f in ("dateReplaced",) if f not in data or data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    try:
        row = add_consumable(asset_id, data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if not row:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_consumable_from_row(row)), 201


@assets_bp.route("/<asset_id>/consumables/<consumable_id>", methods=["DELETE"])
def delete_consumable_route(asset_id, consumable_id):
    rows = delete_consumable(asset_id, consumable_id)
    if rows == 0:
        return jsonify({"error": "Consumable record not found"}), 404
    return "", 204


@assets_bp.route("/<asset_id>/monthly-targets", methods=["GET"])
def get_monthly_targets_route(asset_id):
    if not get_asset(asset_id):
        return jsonify({"error": "Asset not found"}), 404
    rows = get_monthly_targets(asset_id)
    if rows is None:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify([asset_monthly_target_from_row(r) for r in rows])


@assets_bp.route("/<asset_id>/monthly-targets", methods=["POST"])
def upsert_monthly_target_route(asset_id):
    data = request.get_json(silent=True) or {}
    period = data.get("period")
    missing_period = not period
    if missing_period:
        return jsonify({"error": "Missing required field: period"}), 400
    try:
        row = upsert_monthly_target(asset_id, period, data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if not row:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify(asset_monthly_target_from_row(row)), 201


@assets_bp.route("/<asset_id>/monthly-targets/<period>", methods=["DELETE"])
def delete_monthly_target_route(asset_id, period):
    rows = delete_monthly_target(asset_id, period)
    if rows == 0:
        return jsonify({"error": "Monthly target not found"}), 404
    return "", 204
