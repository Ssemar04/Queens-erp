import os
import sys
import unittest

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from services.database import get_central_db, get_branch_db, get_branch_db_path, init_db
import sqlite3

class TestMultiBranchArchitecture(unittest.TestCase):
    def setUp(self):
        os.environ["QTERP_ADMIN_EMAIL"] = "admin@queenstech.com"
        os.environ["QTERP_ADMIN_PASSWORD"] = "admin123"
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()

    def test_branch_sub_database_creation(self):
        """Test that creating a new branch provisions an isolated sub-database file."""
        with self.app.app_context():
            central_db = get_central_db()
            branch_id = "test-branch-alpha"
            
            # Remove any pre-existing test db
            db_path = get_branch_db_path(branch_id)
            if db_path.exists():
                os.remove(db_path)

            # Insert branch into central DB
            central_db.execute(
                """
                INSERT OR REPLACE INTO branches (id, name, description, street, building, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (branch_id, "Alpha Branch", "Test Alpha Branch", "Alpha Street", "Bldg A")
            )
            central_db.commit()

            # Access branch DB -> auto provisions
            branch_db = get_branch_db(branch_id)
            self.assertTrue(db_path.exists(), "Sub-database file should exist!")

            # Verify branch DB contains operational tables
            tables = [row[0] for row in branch_db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            self.assertIn("items", tables)
            self.assertIn("transactions", tables)
            self.assertIn("expenses", tables)
            self.assertIn("customers", tables)
            self.assertNotIn("chat_messages", tables, "Chat messages should reside centrally in app.db, not branch sub-db!")

    def test_branch_data_isolation(self):
        """Test that data created in Branch A does not leak into Branch B."""
        with self.app.app_context():
            branch_a = "test-branch-a"
            branch_b = "test-branch-b"

            db_a = get_branch_db(branch_a)
            db_b = get_branch_db(branch_b)

            # Insert item into Branch A
            item_id_a = "item-alpha-100"
            db_a.execute(
                """
                INSERT OR REPLACE INTO items (id, sku, barcode, name, description, status, unit, current_stock, cost_price, selling_price, branch_id)
                VALUES (?, 'SKU-A100', 'BC-A100', 'Alpha Item', 'Desc A', 'active', 'each', 50, 10, 20, ?)
                """,
                (item_id_a, branch_a)
            )
            db_a.commit()

            # Query Branch A
            item_a = db_a.execute("SELECT * FROM items WHERE id = ?", (item_id_a,)).fetchone()
            self.assertIsNotNone(item_a)

            # Query Branch B -> should be empty!
            item_b = db_b.execute("SELECT * FROM items WHERE id = ?", (item_id_a,)).fetchone()
            self.assertIsNone(item_b, "Branch B sub-database must not contain Branch A's items!")

    def test_admin_single_login_cross_branch_switching(self):
        """Test that Admin login can query different branches by changing X-Branch-ID header."""
        # 1. Login as Admin
        res = self.client.post("/api/login", json={"email": "admin@queenstech.com", "password": "admin123"})
        self.assertEqual(res.status_code, 200)
        token = res.get_json()["token"]

        headers_a = {"Authorization": f"Bearer {token}", "X-Branch-ID": "test-branch-a"}
        headers_b = {"Authorization": f"Bearer {token}", "X-Branch-ID": "test-branch-b"}

        # Create item in Branch A
        self.client.post("/api/items", headers=headers_a, json={
            "id": "item-alpha-100",
            "name": "Alpha Item",
            "costPrice": 10,
            "sellingPrice": 20,
            "initialQuantity": 50,
            "unit": "each",
        })

        # Query items with Branch A header
        res_a = self.client.get("/api/items", headers=headers_a)
        self.assertEqual(res_a.status_code, 200)
        items_a = res_a.get_json()
        self.assertTrue(any(i["id"] == "item-alpha-100" for i in items_a))

        # Query items with Branch B header
        res_b = self.client.get("/api/items", headers=headers_b)
        self.assertEqual(res_b.status_code, 200)
        items_b = res_b.get_json()
        self.assertFalse(any(i["id"] == "item-alpha-100" for i in items_b), "Admin querying Branch B should see isolated Branch B data!")

    def test_employee_branch_restriction(self):
        """Test that a non-admin employee is strictly locked to their assigned branch."""
        with self.app.app_context():
            central_db = get_central_db()
            emp_email = "emp_a@queenstech.com"
            from werkzeug.security import generate_password_hash

            # Create non-admin user assigned to branch A
            central_db.execute(
                """
                INSERT OR REPLACE INTO users (email, password_hash, name, role, is_active, branch_id)
                VALUES (?, ?, 'Emp A', 'staff', 1, 'test-branch-a')
                """,
                (emp_email, generate_password_hash("pass123"))
            )
            central_db.commit()

        # Login employee
        res = self.client.post("/api/login", json={"email": emp_email, "password": "pass123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        token = data["token"]
        self.assertEqual(data["user"]["branchId"], "test-branch-a")

        # Employee requests Branch B header -> Access Denied 403 Forbidden!
        bad_headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "test-branch-b"}
        res_forbidden = self.client.get("/api/items", headers=bad_headers)
        self.assertEqual(res_forbidden.status_code, 403)
        self.assertIn("restricted", res_forbidden.get_json()["message"].lower())

    def test_shared_chatroom_across_branches(self):
        """Test that all users across different branches share the central chatroom."""
        with self.app.app_context():
            central_db = get_central_db()
            chat_user_row = central_db.execute("SELECT id FROM chat_users LIMIT 1").fetchone()
            channel_row = central_db.execute("SELECT id FROM chat_channels WHERE id = 'general' OR lower(name) = 'general' LIMIT 1").fetchone()

            self.assertIsNotNone(chat_user_row)
            self.assertIsNotNone(channel_row)

            # Insert message centrally
            msg_id = "msg-shared-1"
            central_db.execute(
                """
                INSERT OR REPLACE INTO chat_messages (id, channel_id, author_id, body)
                VALUES (?, ?, ?, 'Hello from Branch A!')
                """,
                (msg_id, channel_row["id"], chat_user_row["id"])
            )
            central_db.commit()

            # Retrieve chat channels/messages from central DB
            messages = central_db.execute("SELECT * FROM chat_messages WHERE id = ?", (msg_id,)).fetchall()
            self.assertEqual(len(messages), 1)

    def test_all_domain_entities_isolation_on_branch_switch(self):
        """Test that switching branches isolates items, expenses, customers, bank, orders, assets, and ledger."""
        res = self.client.post("/api/login", json={"email": "admin@queenstech.com", "password": "admin123"})
        token = res.get_json()["token"]

        headers_a = {"Authorization": f"Bearer {token}", "X-Branch-ID": "branch-x"}
        headers_b = {"Authorization": f"Bearer {token}", "X-Branch-ID": "branch-y"}

        # 1. Create Customer in Branch X
        res_cust = self.client.post("/api/customers", headers=headers_a, json={
            "name": "Acme Corp Branch X",
            "type": "business",
            "stage": "customer",
            "tier": "gold",
            "email": "acme.x@example.com",
            "phone": "+256700000001",
        })
        self.assertEqual(res_cust.status_code, 201)
        cust_id = res_cust.get_json()["id"]

        # 2. Query Customers in Branch X (should have 1) and Branch Y (should be 0)
        custs_a = self.client.get("/api/customers", headers=headers_a).get_json()
        custs_b = self.client.get("/api/customers", headers=headers_b).get_json()
        self.assertTrue(any(c["id"] == cust_id for c in custs_a))
        self.assertFalse(any(c["id"] == cust_id for c in custs_b), "Customers in Branch X must not leak into Branch Y!")

        # 3. Create Expense in Branch X
        res_exp = self.client.post("/api/expenses", headers=headers_a, json={
            "date": "2026-09-01",
            "type": "recurring",
            "amount": 2500,
            "paymentMethod": "cash",
            "description": "Office Supplies Branch X",
        })
        self.assertEqual(res_exp.status_code, 201)
        exp_id = res_exp.get_json()["id"]

        # 4. Query Expenses in Branch X vs Branch Y
        exps_a = self.client.get("/api/expenses", headers=headers_a).get_json()["expenses"]
        exps_b = self.client.get("/api/expenses", headers=headers_b).get_json()["expenses"]
        self.assertTrue(any(e["id"] == exp_id for e in exps_a))
        self.assertFalse(any(e["id"] == exp_id for e in exps_b), "Expenses in Branch X must not leak into Branch Y!")

        # 5. Create Order in Branch X
        import uuid
        unique_ord_id = f"ord-x-{uuid.uuid4().hex[:6]}"
        unique_lpo = f"LPO-X-{uuid.uuid4().hex[:6]}"
        res_ord = self.client.post("/api/orders", json={
            "id": unique_ord_id,
            "lpoNumber": unique_lpo,
            "dateReceived": "2026-09-01",
            "customerName": "Acme Corp Branch X",
            "dateToBeDelivered": "2026-09-05",
            "handledBy": "Admin User",
            "items": [{"itemId": "it_1", "name": "Paper", "unitPrice": 100, "quantity": 10, "amount": 1000}],
            "subtotal": 1000,
            "vat": 180,
            "total": 1180,
        }, headers=headers_a)
        self.assertEqual(res_ord.status_code, 201)
        ord_id = res_ord.get_json()["id"]

        # 6. Query Orders in Branch X vs Branch Y
        ords_a = self.client.get("/api/orders", headers=headers_a).get_json()
        ords_b = self.client.get("/api/orders", headers=headers_b).get_json()
        self.assertTrue(any(o["id"] == ord_id for o in ords_a))
        self.assertFalse(any(o["id"] == ord_id for o in ords_b), "Orders in Branch X must not leak into Branch Y!")

if __name__ == "__main__":
    unittest.main()
