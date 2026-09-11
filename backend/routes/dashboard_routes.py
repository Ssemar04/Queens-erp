from flask import Blueprint, jsonify, request

from routes.guards import require_current_user
from services.dashboard_service import get_dashboard_metrics, get_branch_dashboard_stats

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
def home():
    return jsonify({
        "message": "Backend Running"
    })


@dashboard_bp.route("/api/dashboard")
def dashboard():
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify(get_dashboard_metrics())


@dashboard_bp.route("/api/dashboard/branch/<branch_id>")
def branch_dashboard(branch_id):
    _, auth_error = require_current_user()
    if auth_error:
        return auth_error

    return jsonify(get_branch_dashboard_stats(branch_id))
