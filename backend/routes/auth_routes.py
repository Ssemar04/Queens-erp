from flask import Blueprint, jsonify, request

from models.serializers import serialize_user
from services.auth_service import (
    bearer_token_from_request,
    change_user_password,
    get_current_user,
    login_user,
    logout_token,
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required"
        }), 400

    user, token = login_user(email, password)
    if user and token:
        return jsonify({
            "success": True,
            "token": token,
            "user": serialize_user(user),
        })

    return jsonify({
        "success": False,
        "message": "Invalid email or password"
    }), 401


@auth_bp.route("/api/me")
def me():
    user = get_current_user()
    if not user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    return jsonify({
        "success": True,
        "user": serialize_user(user),
    })


@auth_bp.route("/api/change-password", methods=["POST"])
def change_password():
    user = get_current_user()
    if not user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    data = request.get_json(silent=True) or {}
    current_pass = data.get("currentPassword")
    new_pass = data.get("newPassword")

    if not current_pass or not new_pass:
        return jsonify({
            "success": False,
            "message": "Current and new password are required"
        }), 400

    ok, message = change_user_password(user["id"], current_pass, new_pass)
    if not ok:
        return jsonify({
            "success": False,
            "message": message
        }), 400

    return jsonify({
        "success": True,
        "message": message
    })


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    logout_token(bearer_token_from_request())
    return jsonify({"success": True})
