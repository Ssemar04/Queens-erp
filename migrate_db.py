
import sqlite3

db_path = r'd:\\House\\qterp\\backend\\app.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Starting migration...")

try:
    # Step 1: Update items table
    print("Updating items table...")
    # Check if initial_quantity exists
    cursor.execute("PRAGMA table_info(items);")
    cols = [col[1] for col in cursor.fetchall()]
    if 'initial_quantity' not in cols:
        cursor.execute("ALTER TABLE items ADD COLUMN initial_quantity INTEGER NOT NULL DEFAULT 0;")
        print("Added initial_quantity column to items.")
    if 'branch_id' not in cols:
        cursor.execute("ALTER TABLE items ADD COLUMN branch_id TEXT;")
        # Copy values from location_id to branch_id
        cursor.execute("UPDATE items SET branch_id = location_id;")
        print("Added branch_id column to items and copied data from location_id.")
    if 'custom_fields' in cols:
        # SQLite doesn't support DROP COLUMN, so we'll just ignore it
        print("custom_fields column exists, but we'll just leave it for backward compatibility.")

    # Step 2: Update stock_movements table
    print("\nUpdating stock_movements table...")
    cursor.execute("PRAGMA table_info(stock_movements);")
    cols = [col[1] for col in cursor.fetchall()]
    if 'from_branch_id' not in cols:
        cursor.execute("ALTER TABLE stock_movements ADD COLUMN from_branch_id TEXT;")
        # Copy from_location_id to from_branch_id
        cursor.execute("UPDATE stock_movements SET from_branch_id = from_location_id;")
        print("Added from_branch_id column to stock_movements.")
    if 'to_branch_id' not in cols:
        cursor.execute("ALTER TABLE stock_movements ADD COLUMN to_branch_id TEXT;")
        # Copy to_location_id to to_branch_id
        cursor.execute("UPDATE stock_movements SET to_branch_id = to_location_id;")
        print("Added to_branch_id column to stock_movements.")

    conn.commit()
    print("\nMigration complete!")

except Exception as e:
    conn.rollback()
    print(f"Error during migration: {e}")
    import traceback
    print(traceback.format_exc())

conn.close()
