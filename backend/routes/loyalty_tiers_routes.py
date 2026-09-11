
from flask import Blueprint, jsonify, request
from services.loyalty_tiers_service import (
    get_loyalty_tiers,
    get_loyalty_tier,
    create_loyalty_tier,
    update_loyalty_tier,
    delete_loyalty_tier
)


loyalty_tiers_bp = Blueprint("loyalty_tiers", __name__, url_prefix="/api/loyalty-tiers")


@loyalty_tiers_bp.route("", methods=["GET"])
def list_loyalty_tiers():
    tiers = get_loyalty_tiers()
    return jsonify([
        {
            "id": t["id"],
            "name": t["name"],
            "minPoints": t["min_points"],
            "maxPoints": t["max_points"],
            "color": t["color"],
            "createdAt": t["created_at"],
            "updatedAt": t["updated_at"]
        }
        for t in tiers
    ])


@loyalty_tiers_bp.route("/<tier_id>", methods=["GET"])
def get_single_tier(tier_id):
    tier = get_loyalty_tier(tier_id)
    if not tier:
        return jsonify({"error": "Tier not found"}), 404
    return jsonify({
        "id": tier["id"],
        "name": tier["name"],
        "minPoints": tier["min_points"],
        "maxPoints": tier["max_points"],
        "color": tier["color"],
        "createdAt": tier["created_at"],
        "updatedAt": tier["updated_at"]
    })


@loyalty_tiers_bp.route("", methods=["POST"])
def create_tier_route():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "Missing required field: name"}), 400
    try:
        tier = create_loyalty_tier(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({
        "id": tier["id"],
        "name": tier["name"],
        "minPoints": tier["min_points"],
        "maxPoints": tier["max_points"],
        "color": tier["color"],
        "createdAt": tier["created_at"],
        "updatedAt": tier["updated_at"]
    }), 201


@loyalty_tiers_bp.route("/<tier_id>", methods=["PATCH"])
def update_tier_route(tier_id):
    data = request.get_json(silent=True) or {}
    tier = update_loyalty_tier(tier_id, data)
    if not tier:
        return jsonify({"error": "Tier not found"}), 404
    return jsonify({
        "id": tier["id"],
        "name": tier["name"],
        "minPoints": tier["min_points"],
        "maxPoints": tier["max_points"],
        "color": tier["color"],
        "createdAt": tier["created_at"],
        "updatedAt": tier["updated_at"]
    })


@loyalty_tiers_bp.route("/<tier_id>", methods=["DELETE"])
def delete_tier_route(tier_id):
    if delete_loyalty_tier(tier_id) == 0:
        return jsonify({"error": "Tier not found"}), 404
    return "", 204

