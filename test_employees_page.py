import os
import sys
import unittest

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from services.database import get_central_db, init_db

class TestEmployeesPage(unittest.TestCase):
    def setUp(self):
        os.environ["QTERP_ADMIN_EMAIL"] = "admin@queenstech.com"
        os.environ["QTERP_ADMIN_PASSWORD"] = "admin123"
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()
            db = get_central_db()
            db.execute("DELETE FROM employees WHERE email = 'jane.mukasa@queenstech.com'")
            db.execute("DELETE FROM users WHERE email = 'jane.mukasa@queenstech.com'")
            db.commit()

    def test_list_and_create_employee(self):
        res = self.client.post("/api/login", json={"email": "admin@queenstech.com", "password": "admin123"})
        self.assertEqual(res.status_code, 200)
        token = res.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. List employees
        res_list = self.client.get("/api/employees", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        initial_count = len(res_list.get_json())

        # 2. Get next code
        res_code = self.client.get("/api/employees/next-code", headers=headers)
        self.assertEqual(res_code.status_code, 200)
        code = res_code.get_json()["code"]
        self.assertTrue(code.startswith("EMP-"))

        # 3. Create employee
        emp_payload = {
            "name": "Jane Mukasa",
            "email": "jane.mukasa@queenstech.com",
            "phone": "+256 772 112233",
            "role": "Inventory Manager",
            "systemRole": "manager",
            "department": "Warehouse",
            "location": "Main Store",
            "branchId": "br_main",
            "employmentType": "full_time",
            "status": "active",
            "joinedAt": "2026-01-15",
            "salary": 1500000,
            "skills": ["Stock Audit", "Forklift"],
            "bio": "Experienced warehouse lead"
        }
        res_create = self.client.post("/api/employees", json=emp_payload, headers=headers)
        self.assertEqual(res_create.status_code, 201)
        created = res_create.get_json()
        self.assertEqual(created["name"], "Jane Mukasa")
        self.assertEqual(created["branchId"], "br_main")
        self.assertIn("credentials", created)
        self.assertTrue(created["credentials"]["oneTimePassword"])

        # 4. Verify user record created with branch_id
        with self.app.app_context():
            user = get_central_db().execute("SELECT * FROM users WHERE email = ?", ("jane.mukasa@queenstech.com",)).fetchone()
            self.assertIsNotNone(user)
            self.assertEqual(user["branch_id"], "br_main")
            self.assertEqual(user["role"], "manager")

        # 5. Update employee
        emp_id = created["id"]
        update_payload = {"phone": "+256 700 998877", "salary": 1800000}
        res_update = self.client.patch(f"/api/employees/{emp_id}", json=update_payload, headers=headers)
        self.assertEqual(res_update.status_code, 200)
        updated = res_update.get_json()
        self.assertEqual(updated["salary"], 1800000)

        # 6. Update employee account
        acc_payload = {"role": "admin", "isActive": True, "email": "jane.mukasa@queenstech.com"}
        res_acc = self.client.patch(f"/api/employees/{emp_id}/account", json=acc_payload, headers=headers)
        if res_acc.status_code != 200:
            print("ACCOUNT ERR:", res_acc.status_code, res_acc.get_json())
        self.assertEqual(res_acc.status_code, 200)

        # 7. Delete employee
        res_del = self.client.delete(f"/api/employees/{emp_id}", headers=headers)
        self.assertEqual(res_del.status_code, 204)

if __name__ == "__main__":
    unittest.main()
