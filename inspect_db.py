
import sqlite3

db_path = r'd:\\House\\qterp\\backend\\app.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Tables:")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

for table in tables:
    table_name = table[0]
    print(f"\n=== {table_name} ===")
    cursor.execute(f"PRAGMA table_info({table_name});")
    columns = cursor.fetchall()
    for col in columns:
        print(col)
    print()

conn.close()
