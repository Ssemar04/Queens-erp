import os
import sys
import unittest

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from services.database import get_central_db, init_db
from werkzeug.security import generate_password_hash

class TestChatEmployeeDMMembers(unittest.TestCase):
    def setUp(self):
        os.environ["QTERP_ADMIN_EMAIL"] = "admin@queenstech.com"
        os.environ["QTERP_ADMIN_PASSWORD"] = "admin123"
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()

    def test_chat_features_and_access_control(self):
        # 1. Login as Admin
        res = self.client.post("/api/login", json={"email": "admin@queenstech.com", "password": "admin123"})
        self.assertEqual(res.status_code, 200)
        admin_token = res.get_json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Verify Admin chat access
        res = self.client.get("/api/chat/access", headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["allowed"])

        # 3. Create non-employee user in DB
        with self.app.app_context():
            db = get_central_db()
            db.execute("DELETE FROM users WHERE email = 'outsider@queenstech.com'")
            db.execute(
                """
                INSERT INTO users (email, password_hash, name, role, is_active)
                VALUES ('outsider@queenstech.com', ?, 'Outsider', 'staff', 1)
                """,
                (generate_password_hash("pass123"),)
            )
            db.commit()

        # Login as non-employee user
        res = self.client.post("/api/login", json={"email": "outsider@queenstech.com", "password": "pass123"})
        self.assertEqual(res.status_code, 200)
        outsider_token = res.get_json()["token"]
        outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

        # Verify chat access is DENIED (403) for non-employee
        res = self.client.get("/api/chat/access", headers=outsider_headers)
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json().get("allowed", False))

        # 4. Create two active employees in HR database
        emp1_data = {
            "name": "Jane Doe",
            "email": "jane.doe@queenstech.com",
            "phone": "0700000001",
            "role": "Sales Lead",
            "department": "Sales",
            "location": "Main Branch",
            "employmentType": "full_time",
            "status": "active",
            "joinedAt": "2026-01-01",
            "salary": 1500000,
            "skills": ["Sales"],
        }
        emp2_data = {
            "name": "John Smith",
            "email": "john.smith@queenstech.com",
            "phone": "0700000002",
            "role": "Inventory Officer",
            "department": "Operations",
            "location": "Main Branch",
            "employmentType": "full_time",
            "status": "active",
            "joinedAt": "2026-01-01",
            "salary": 1400000,
            "skills": ["Inventory"],
        }

        res1 = self.client.post("/api/employees", json=emp1_data, headers=admin_headers)
        self.assertEqual(res1.status_code, 201)
        emp1 = res1.get_json()

        res2 = self.client.post("/api/employees", json=emp2_data, headers=admin_headers)
        self.assertEqual(res2.status_code, 201)
        emp2 = res2.get_json()

        # 5. Direct Message (DM) Creation between employees
        res_dm = self.client.post("/api/chat/dm", json={"targetUserId": emp2["id"]}, headers=admin_headers)
        self.assertEqual(res_dm.status_code, 201)
        dm_channel = res_dm.get_json()
        self.assertEqual(dm_channel["type"], "dm")
        self.assertEqual(len(dm_channel["memberIds"]), 2)

        # 6. Admin create channel & add/remove employee
        res_chan = self.client.post("/api/chat/channels", json={"name": "Sales Team", "description": "Sales channel"}, headers=admin_headers)
        self.assertEqual(res_chan.status_code, 201)
        chan = res_chan.get_json()

        # Admin adds emp1 to channel
        res_add = self.client.post(f"/api/chat/channels/{chan['id']}/members", json={"userId": emp1["id"]}, headers=admin_headers)
        self.assertEqual(res_add.status_code, 200)
        self.assertGreater(len(res_add.get_json()["memberIds"]), 0)

        # Admin removes emp1 from channel
        res_rem = self.client.delete(f"/api/chat/channels/{chan['id']}/members/{emp1['id']}", headers=admin_headers)
        self.assertEqual(res_rem.status_code, 200)

if __name__ == "__main__":
    unittest.main()
