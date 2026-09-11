
import sqlite3
from pathlib import Path

db_path = Path("app.db")

if db_path.exists():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("=== Sales Orders Schema ===")
    cursor.execute("PRAGMA table_info(sales_orders)")
    for column in cursor.fetchall():
        print(column)

    print("\n=== Sales Orders ===")
    orders = cursor.execute("SELECT * FROM sales_orders").fetchall()
    for o in orders:
        print(dict(o))

    print("\n=== Employees ===")
    employees = cursor.execute("SELECT * FROM employees").fetchall()
    for e in employees:
        print(dict(e))

    conn.close()
else:
    print(f"No DB found at {db_path}")
