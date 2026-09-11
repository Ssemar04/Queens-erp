import os
import sys
import unittest

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from services.database import init_db

class TestAllPagesRoutes(unittest.TestCase):
    def setUp(self):
        os.environ["QTERP_ADMIN_EMAIL"] = "admin@queenstech.com"
        os.environ["QTERP_ADMIN_PASSWORD"] = "admin123"
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()

    def test_all_api_endpoints_load_without_error(self):
        # 1. Login
        res = self.client.post("/api/login", json={"email": "admin@queenstech.com", "password": "admin123"})
        self.assertEqual(res.status_code, 200)
        token = res.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        endpoints = [
            "/api/me",
            "/api/dashboard",
            "/api/items",
            "/api/categories",
            "/api/suppliers",
            "/api/branches",
            "/api/locations",
            "/api/movements",
            "/api/employees",
            "/api/bank",
            "/api/ledger/debtor",
            "/api/ledger/creditor",
            "/api/expenses",
            "/api/customers",
            "/api/assets",
            "/api/orders",
            "/api/chat/channels",
            "/api/chat/users",
            "/api/loyalty-tiers",
        ]

        failed = []
        for ep in endpoints:
            res = self.client.get(ep, headers=headers)
            if res.status_code != 200:
                failed.append((ep, res.status_code, res.data.decode("utf-8")))

        self.assertEqual(failed, [], f"The following endpoints failed to load: {failed}")

if __name__ == "__main__":
    unittest.main()
