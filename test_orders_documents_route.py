import sys
from pathlib import Path

from flask import Flask


BACKEND_DIR = Path(__file__).parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from routes.orders_routes import orders_bp


def test_order_documents_route_supports_get_and_post():
    app = Flask(__name__)
    app.register_blueprint(orders_bp)

    methods_by_path = {}
    for rule in app.url_map.iter_rules():
        if str(rule) == "/api/orders/<order_id>/documents":
            methods_by_path.setdefault(str(rule), set()).update(rule.methods)

    assert methods_by_path["/api/orders/<order_id>/documents"] >= {"GET", "POST"}