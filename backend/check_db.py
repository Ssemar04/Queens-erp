
import sqlite3
from pathlib import Path

db_path = Path("app.db")

if db_path.exists():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("=== Users ===")
    users = cursor.execute("SELECT id, email, name FROM users").fetchall()
    for u in users:
        print(f"ID: {u['id']}, Email: {u['email']}, Name: {u['name']}")

    print("\n=== Auth Sessions ===")
    sessions = cursor.execute("SELECT id, user_id, token FROM auth_sessions").fetchall()
    for s in sessions:
        print(f"Session ID: {s['id']}, User ID: {s['user_id']}, Token: {s['token']}")

    conn.close()
else:
    print(f"No DB found at {db_path}")
