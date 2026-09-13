from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
from dotenv import load_dotenv
import os
import sys

load_dotenv()

from routes.auth_routes import auth_bp
from routes.bank_routes import bank_bp
from routes.catalog_routes import catalog_bp
from routes.customers_routes import customers_bp
from routes.dashboard_routes import dashboard_bp
from routes.expenses_routes import expenses_bp
from routes.ledger_routes import ledger_bp
from routes.movements_routes import movements_bp
from routes.notifications_routes import notifications_bp
from routes.orders_routes import orders_bp
from routes.assets_routes import assets_bp
from routes.employees_routes import employees_bp
from routes.chat_routes import chat_bp
from routes.loyalty_tiers_routes import loyalty_tiers_bp
from services.database import close_db, init_db, migrate_db


def create_app():
    print("Creating Flask app...", file=sys.stderr)
    app = Flask(__name__)

    from flask import request

    # Dev mode opens up all origins with fully permissive headers and credential support.
    # Use an explicit allowlist for browser preflight + simple requests (Chrome splits localhost vs 127.0.0.1).
    DEV_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5001",
        "http://127.0.0.1:5001",
        "http://0.0.0.0:3000",
    ]
    DEPLOYED_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    ALLOWED_ORIGINS = DEV_ORIGINS + DEPLOYED_ORIGINS

    CORS_ALLOW_HEADERS = [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-CSRF-Token",
        "X-Branch-ID",
    ]

    CORS(
        app,
        resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
        allow_headers=CORS_ALLOW_HEADERS,
        methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        supports_credentials=True,
        expose_headers=["Content-Type", "Authorization", "Content-Length", "ETag", "Last-Modified"],
        max_age=3600,
    )

    @app.before_request
    def _attach_cors_every_response():
        origin = request.headers.get("Origin")
        request._qterp_request_origin = origin

    @app.after_request
    def _apply_cors_headers(response):
        origin = getattr(request, "_qterp_request_origin", None) or request.headers.get("Origin")
        if origin and request.path.startswith("/api/"):
            if origin in ALLOWED_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = ", ".join(CORS_ALLOW_HEADERS)
            response.headers["Access-Control-Expose-Headers"] = "Content-Type, Authorization, Content-Length, ETag, Last-Modified"
            response.headers["Access-Control-Max-Age"] = "3600"
            response.headers["Vary"] = "Origin"
        if request.method == "OPTIONS":
            response.headers["Content-Length"] = "0"
            response.status_code = 204
        return response

    @app.before_request
    def handle_cors_preflight():
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            resp = make_response("", 204)
            origin = request.headers.get("Origin", "")
            if origin in ALLOWED_ORIGINS:
                resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Methods"] = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = ", ".join(CORS_ALLOW_HEADERS)
            resp.headers["Access-Control-Max-Age"] = "3600"
            resp.headers["Vary"] = "Origin"
            return resp

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    app.teardown_appcontext(close_db)
    print("Registering blueprints...", file=sys.stderr)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bank_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(customers_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(ledger_bp)
    app.register_blueprint(movements_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(assets_bp)
    app.register_blueprint(employees_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(loyalty_tiers_bp)

    print("Initializing database...", file=sys.stderr)
    with app.app_context():
        init_db()
        migrate_db()

    print("App created successfully!", file=sys.stderr)
    return app


app = create_app()


if __name__ == "__main__":
    print("Registered API routes:")
    for rule in sorted(app.url_map.iter_rules(), key=lambda item: str(item)):
        if str(rule).startswith("/api/"):
            print(f"  {rule}")

    print("Starting Flask server on http://0.0.0.0:5000", file=sys.stderr)
    try:
        app.run(
            host="0.0.0.0",
            port=5000,
            debug=True,
            use_reloader=False
        )
    except Exception as e:
        print(f"Error starting server: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
