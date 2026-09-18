import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import g
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "app.db"))
DATABASES_DIR = Path(os.getenv("DATABASES_DIR", BASE_DIR / "databases"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
DEFAULT_ADMIN_EMAIL = os.getenv("QTERP_ADMIN_EMAIL", "admin@queenstech.com")
DEFAULT_ADMIN_PASSWORD = os.getenv("QTERP_ADMIN_PASSWORD", "admin123")
DEFAULT_ADMIN_NAME = os.getenv("QTERP_ADMIN_NAME", "House")


def use_postgres() -> bool:
    return DATABASE_URL.startswith(("postgres://", "postgresql://"))


def get_postgres_schema_connection(schema: str):
    from services.postgres_adapter import connect_schema

    return connect_schema(DATABASE_URL, schema)


def get_central_db():
    if "central_db" not in g:
        if use_postgres():
            g.central_db = get_postgres_schema_connection("central")
        else:
            DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
            g.central_db = sqlite3.connect(DATABASE_PATH, timeout=30)
            g.central_db.row_factory = sqlite3.Row
            g.central_db.execute("PRAGMA busy_timeout = 30000")
            g.central_db.execute("PRAGMA foreign_keys = ON")
            g.central_db.execute("PRAGMA journal_mode = WAL")
            g.central_db.execute("PRAGMA synchronous = NORMAL")
            g.central_db.execute("PRAGMA temp_store = MEMORY")
    return g.central_db


def get_branch_db_path(branch_id: str) -> Path:
    clean_id = "".join(c for c in str(branch_id) if c.isalnum() or c in ("-", "_")).lower()
    if not clean_id:
        clean_id = "br_main"
    DATABASES_DIR.mkdir(parents=True, exist_ok=True)
    return DATABASES_DIR / f"branch_{clean_id}.db"


def resolve_request_branch_id() -> str:
    try:
        from flask import request
        branch_hdr = request.headers.get("X-Branch-ID")
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            if token:
                central_db = get_central_db()
                user = central_db.execute(
                    """
                    SELECT users.role, users.branch_id
                    FROM auth_sessions
                    JOIN users ON users.id = auth_sessions.user_id
                    WHERE auth_sessions.token = ?
                      AND auth_sessions.expires_at > CURRENT_TIMESTAMP
                      AND users.is_active = 1
                    """,
                    (token,),
                ).fetchone()
                if user:
                    if user["role"] != "admin" and user["branch_id"]:
                        return user["branch_id"]
                    if user["role"] == "admin" and branch_hdr:
                        return branch_hdr
        if branch_hdr:
            return branch_hdr
    except Exception:
        pass

    try:
        central_db = get_central_db()
        row = central_db.execute("SELECT id FROM branches WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1").fetchone()
        if row and row["id"]:
            return row["id"]
    except Exception:
        pass

    return "br_main"


def get_branch_db(branch_id=None):
    if not branch_id:
        branch_id = resolve_request_branch_id()

    clean_id = "".join(c for c in str(branch_id) if c.isalnum() or c in ("-", "_")).lower()
    if not clean_id:
        clean_id = "br_main"

    try:
        if "branch_dbs" not in g:
            g.branch_dbs = {}

        if clean_id not in g.branch_dbs:
            if use_postgres():
                from services.postgres_adapter import schema_name_for_branch

                conn = get_postgres_schema_connection(schema_name_for_branch(clean_id))
                is_new = not table_exists(conn, "items")
            else:
                db_path = get_branch_db_path(clean_id)
                is_new = not db_path.exists()
                conn = sqlite3.connect(db_path, timeout=30)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA busy_timeout = 30000")
                conn.execute("PRAGMA foreign_keys = ON")
                conn.execute("PRAGMA journal_mode = WAL")
                conn.execute("PRAGMA synchronous = NORMAL")
                conn.execute("PRAGMA temp_store = MEMORY")
            g.branch_dbs[clean_id] = conn
            if is_new:
                init_branch_db_tables(conn)
        return g.branch_dbs[clean_id]
    except RuntimeError:
        # Outside Flask app context
        if use_postgres():
            from services.postgres_adapter import schema_name_for_branch

            conn = get_postgres_schema_connection(schema_name_for_branch(clean_id))
            is_new = not table_exists(conn, "items")
        else:
            db_path = get_branch_db_path(clean_id)
            is_new = not db_path.exists()
            conn = sqlite3.connect(db_path, timeout=30)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA busy_timeout = 30000")
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA temp_store = MEMORY")
        if is_new:
            init_branch_db_tables(conn)
        return conn


def get_db():
    try:
        from flask import current_app
        if current_app.config.get("DATABASE") == ":memory:":
            return get_central_db()
    except RuntimeError:
        pass
    return get_branch_db()


def close_db(exception=None):
    try:
        central_db = g.pop("central_db", None)
        if central_db is not None:
            central_db.close()
    except RuntimeError:
        pass

    try:
        branch_dbs = g.pop("branch_dbs", None)
        if branch_dbs:
            for conn in branch_dbs.values():
                try:
                    conn.close()
                except Exception:
                    pass
    except RuntimeError:
        pass

    try:
        db = g.pop("db", None)
        if db is not None:
            db.close()
    except RuntimeError:
        pass



TRANSACTION_COLUMN_MIGRATIONS = [
    ("movement_id", "TEXT REFERENCES stock_movements (id) ON DELETE SET NULL"),
    ("item_name", "TEXT NOT NULL DEFAULT ''"),
    ("telephone", "TEXT NOT NULL DEFAULT ''"),
    ("email", "TEXT NOT NULL DEFAULT ''"),
    ("amount_tendered", "REAL NOT NULL DEFAULT 0"),
    ("change_due", "REAL NOT NULL DEFAULT 0"),
    ("vat_rate", "REAL NOT NULL DEFAULT 0"),
    ("cumulative_amount", "REAL NOT NULL DEFAULT 0"),
    ("asset_id", "TEXT"),
    ("asset_name", "TEXT"),
    ("sale_details", "TEXT"),
]

BRANCH_COLUMN_MIGRATIONS = [
    ("street", "TEXT NOT NULL DEFAULT ''"),
    ("building", "TEXT NOT NULL DEFAULT ''"),
    ("floor", "TEXT NOT NULL DEFAULT ''"),
    ("room_number", "TEXT NOT NULL DEFAULT ''"),
    ("branch_manager", "TEXT NOT NULL DEFAULT ''"),
    ("receipt_title", "TEXT NOT NULL DEFAULT ''"),
    ("phone", "TEXT NOT NULL DEFAULT ''"),
    ("email", "TEXT NOT NULL DEFAULT ''"),
    ("contact_line", "TEXT NOT NULL DEFAULT ''"),
    ("receipt_slogan", "TEXT NOT NULL DEFAULT ''"),
    ("tax_id", "TEXT NOT NULL DEFAULT ''"),
    ("receipt_verification_base_url", "TEXT NOT NULL DEFAULT ''"),
]


def table_exists(db, table_name):
    return db.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone() is not None


def add_missing_columns(db, table_name, column_migrations):
    if not table_exists(db, table_name):
        return

    existing_columns = {
        row["name"] for row in db.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    for column, definition in column_migrations:
        if column not in existing_columns:
            db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column} {definition}")


def ensure_user_account_columns(db):
    add_missing_columns(
        db,
        "users",
        [
            ("role", "TEXT NOT NULL DEFAULT 'staff'"),
            ("is_active", "INTEGER NOT NULL DEFAULT 1"),
            ("must_change_password", "INTEGER NOT NULL DEFAULT 0"),
            ("one_time_password", "TEXT"),
            ("branch_id", "TEXT"),
        ],
    )
    add_missing_columns(
        db,
        "employees",
        [
            ("branch_id", "TEXT"),
        ],
    )


def ensure_default_admin_user(db):
    ensure_user_account_columns(db)
    existing = db.execute(
        "SELECT id FROM users WHERE lower(email) = lower(?)",
        (DEFAULT_ADMIN_EMAIL,),
    ).fetchone()

    if existing:
        db.execute(
            """
            UPDATE users
            SET password_hash = ?, name = ?, role = 'admin', is_active = 1,
                must_change_password = 0, one_time_password = NULL
            WHERE id = ?
            """,
            (generate_password_hash(DEFAULT_ADMIN_PASSWORD), DEFAULT_ADMIN_NAME, existing["id"]),
        )
        return

    db.execute(
        """
        INSERT INTO users (
            email, password_hash, name, role, is_active,
            must_change_password, one_time_password
        )
        VALUES (?, ?, ?, 'admin', 1, 0, NULL)
        """,
        (
            DEFAULT_ADMIN_EMAIL,
            generate_password_hash(DEFAULT_ADMIN_PASSWORD),
            DEFAULT_ADMIN_NAME,
        ),
    )


def ensure_performance_indexes(db):
    if table_exists(db, "items"):
        db.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_items_name
                ON items (name);

            CREATE INDEX IF NOT EXISTS idx_items_status
                ON items (status);

            CREATE INDEX IF NOT EXISTS idx_items_category_id
                ON items (category_id);

            CREATE INDEX IF NOT EXISTS idx_items_supplier_id
                ON items (supplier_id);

            CREATE INDEX IF NOT EXISTS idx_items_branch_id
                ON items (branch_id);
            """
        )
    if table_exists(db, "stock_movements"):
        db.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at
                ON stock_movements (created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id
                ON stock_movements (item_id);

            CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
                ON stock_movements (reference);

            CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id
                ON stock_movements (branch_id);
            """
        )
    if table_exists(db, "transactions"):
        db.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_reference
                ON transactions (reference);
            """
        )
    if table_exists(db, "auth_sessions"):
        db.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_auth_sessions_token
                ON auth_sessions (token);
            """
        )


def make_transaction_number_non_unique(db):
    if not table_exists(db, "transactions"):
        return

    table_sql_row = db.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'"
    ).fetchone()
    table_sql = table_sql_row["sql"] if table_sql_row else ""
    if "transaction_number TEXT NOT NULL UNIQUE" not in table_sql:
        return

    db.commit()
    db.execute("PRAGMA foreign_keys = OFF")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS transactions_new (
            id TEXT PRIMARY KEY,
            movement_id TEXT,
            transaction_number TEXT NOT NULL,
            transaction_type TEXT NOT NULL DEFAULT 'sale',
            transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            item_id TEXT,
            item_name TEXT NOT NULL DEFAULT '',
            customer_id TEXT,
            customer_name TEXT NOT NULL DEFAULT '',
            telephone TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL DEFAULT 0,
            unit_price REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            tax REAL NOT NULL DEFAULT 0,
            vat_rate REAL NOT NULL DEFAULT 0,
            total_amount REAL NOT NULL DEFAULT 0,
            amount_paid REAL NOT NULL DEFAULT 0,
            balance REAL NOT NULL DEFAULT 0,
            amount_tendered REAL NOT NULL DEFAULT 0,
            change_due REAL NOT NULL DEFAULT 0,
            cumulative_amount REAL NOT NULL DEFAULT 0,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            status TEXT NOT NULL DEFAULT 'paid',
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_by TEXT NOT NULL DEFAULT '',
            asset_id TEXT,
            asset_name TEXT,
            sale_details TEXT,
            branch_id TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (movement_id) REFERENCES stock_movements (id) ON DELETE SET NULL,
            FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
            FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
        );

        INSERT INTO transactions_new (
            id, movement_id, transaction_number, transaction_type, transaction_date,
            item_id, item_name, customer_id, customer_name, telephone, email, quantity,
            unit_price, discount, tax, vat_rate, total_amount, amount_paid,
            balance, amount_tendered, change_due, cumulative_amount, payment_method,
            status, reference, notes, created_by, asset_id, asset_name, sale_details,
            branch_id, created_at, updated_at
        )
        SELECT
            id, movement_id, transaction_number, transaction_type, transaction_date,
            item_id, item_name, customer_id, customer_name, telephone, email, quantity,
            unit_price, discount, tax, vat_rate, total_amount, amount_paid,
            balance, amount_tendered, change_due, cumulative_amount, payment_method,
            status, reference, notes, created_by, asset_id, asset_name, sale_details,
            branch_id, created_at, updated_at
        FROM transactions;

        DROP TABLE transactions;
        ALTER TABLE transactions_new RENAME TO transactions;

        CREATE INDEX IF NOT EXISTS idx_transactions_date
            ON transactions (transaction_date);

        CREATE INDEX IF NOT EXISTS idx_transactions_item_id
            ON transactions (item_id);

        CREATE INDEX IF NOT EXISTS idx_transactions_customer_id
            ON transactions (customer_id);

        CREATE INDEX IF NOT EXISTS idx_transactions_number
            ON transactions (transaction_number);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_movement_id
            ON transactions (movement_id)
            WHERE movement_id IS NOT NULL;
        """
    )
    db.execute("PRAGMA foreign_keys = ON")
    db.commit()


def make_stock_movements_item_nullable(db):
    if not table_exists(db, "stock_movements"):
        return

    columns = db.execute("PRAGMA table_info(stock_movements)").fetchall()
    item_column = next((column for column in columns if column["name"] == "item_id"), None)
    if not item_column or item_column["notnull"] == 0:
        return

    db.commit()
    db.execute("PRAGMA foreign_keys = OFF")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS stock_movements_new (
            id TEXT PRIMARY KEY,
            item_id TEXT,
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            from_location_id TEXT,
            to_location_id TEXT,
            from_branch_id TEXT,
            to_branch_id TEXT,
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            performed_by TEXT NOT NULL DEFAULT 'system',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sale TEXT,
            FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL,
            FOREIGN KEY (from_branch_id) REFERENCES branches (id) ON DELETE SET NULL,
            FOREIGN KEY (to_branch_id) REFERENCES branches (id) ON DELETE SET NULL
        );

        INSERT INTO stock_movements_new (
            id, item_id, movement_type, quantity, from_location_id, to_location_id,
            from_branch_id, to_branch_id, reference, notes, performed_by, created_at, sale
        )
        SELECT
            id, item_id, movement_type, quantity, from_location_id, to_location_id,
            from_branch_id, to_branch_id, reference, notes, performed_by, created_at, sale
        FROM stock_movements;

        DROP TABLE stock_movements;
        ALTER TABLE stock_movements_new RENAME TO stock_movements;
        """
    )
    db.execute("PRAGMA foreign_keys = ON")
    db.commit()


def init_central_db(db):
    ensure_user_account_columns(db)
    add_missing_columns(db, "branches", BRANCH_COLUMN_MIGRATIONS)

    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'staff',
            is_active INTEGER NOT NULL DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            one_time_password TEXT,
            branch_id TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            street TEXT NOT NULL DEFAULT '',
            building TEXT NOT NULL DEFAULT '',
            floor TEXT NOT NULL DEFAULT '',
            room_number TEXT NOT NULL DEFAULT '',
            branch_manager TEXT NOT NULL DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            avatar TEXT,
            role TEXT NOT NULL,
            department TEXT NOT NULL,
            manager TEXT,
            location TEXT NOT NULL,
            branch_id TEXT,
            employment_type TEXT NOT NULL,
            status TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            salary REAL NOT NULL,
            skills TEXT NOT NULL DEFAULT '[]',
            emergency_contact TEXT,
            bio TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT 'from-emerald-500 to-teal-600',
            online INTEGER NOT NULL DEFAULT 1,
            last_seen TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_channels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'group',
            emoji TEXT NOT NULL DEFAULT '💬',
            description TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_channel_members (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
            UNIQUE(channel_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            mentions TEXT NOT NULL DEFAULT '[]',
            attachments TEXT NOT NULL DEFAULT '[]',
            reactions TEXT NOT NULL DEFAULT '[]',
            reply_to TEXT,
            edited INTEGER NOT NULL DEFAULT 0,
            pinned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES chat_users(id) ON DELETE CASCADE,
            FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE SET NULL
        );
        """
    )
    add_missing_columns(db, "chat_users", [("last_seen", "TEXT")])
    ensure_default_admin_user(db)
    db.commit()


def init_branch_db_tables(db):
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS dashboard_metrics (
            key TEXT PRIMARY KEY,
            value INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            parent_id TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contact_name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            lead_time_days INTEGER NOT NULL DEFAULT 0,
            rating REAL NOT NULL DEFAULT 4,
            is_active INTEGER NOT NULL DEFAULT 1,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            sku TEXT NOT NULL UNIQUE,
            barcode TEXT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            category_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            unit TEXT NOT NULL DEFAULT 'each',
            initial_quantity INTEGER NOT NULL DEFAULT 0,
            current_stock INTEGER NOT NULL DEFAULT 0,
            reorder_point INTEGER NOT NULL DEFAULT 0,
            reorder_quantity INTEGER NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0,
            selling_price REAL NOT NULL DEFAULT 0,
            branch_id TEXT,
            supplier_id TEXT,
            image_url TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
            id TEXT PRIMARY KEY,
            item_id TEXT,
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            from_branch_id TEXT,
            to_branch_id TEXT,
            from_location_id TEXT,
            to_location_id TEXT,
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            performed_by TEXT NOT NULL DEFAULT 'system',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sale TEXT,
            branch_id TEXT,
            FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            movement_id TEXT,
            transaction_number TEXT NOT NULL,
            transaction_type TEXT NOT NULL DEFAULT 'sale',
            transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            item_id TEXT,
            item_name TEXT NOT NULL DEFAULT '',
            customer_id TEXT,
            customer_name TEXT NOT NULL DEFAULT '',
            telephone TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL DEFAULT 0,
            unit_price REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            tax REAL NOT NULL DEFAULT 0,
            vat_rate REAL NOT NULL DEFAULT 0,
            total_amount REAL NOT NULL DEFAULT 0,
            amount_paid REAL NOT NULL DEFAULT 0,
            balance REAL NOT NULL DEFAULT 0,
            amount_tendered REAL NOT NULL DEFAULT 0,
            change_due REAL NOT NULL DEFAULT 0,
            cumulative_amount REAL NOT NULL DEFAULT 0,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            status TEXT NOT NULL DEFAULT 'paid',
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_by TEXT NOT NULL DEFAULT '',
            asset_id TEXT,
            asset_name TEXT,
            sale_details TEXT,
            branch_id TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (movement_id) REFERENCES stock_movements (id) ON DELETE SET NULL,
            FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
            id TEXT PRIMARY KEY,
            lpo_number TEXT NOT NULL UNIQUE,
            date_received TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_id TEXT,
            customer_quotation TEXT NOT NULL DEFAULT '',
            quotation_attachment TEXT,
            date_to_be_delivered TEXT NOT NULL,
            handled_by TEXT NOT NULL,
            employee_id TEXT,
            status TEXT NOT NULL DEFAULT 'confirmed',
            amount REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS loyalty_tiers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            min_points INTEGER NOT NULL DEFAULT 0,
            max_points INTEGER,
            color TEXT NOT NULL DEFAULT '#0EA5E9',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_accounts (
            id TEXT PRIMARY KEY,
            account_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            branch TEXT NOT NULL DEFAULT '',
            swift_code TEXT NOT NULL DEFAULT '',
            currency TEXT NOT NULL DEFAULT 'UGX',
            opening_balance REAL NOT NULL DEFAULT 0,
            current_balance REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            color TEXT NOT NULL DEFAULT 'from-primary to-primary/70',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            date TEXT NOT NULL,
            txn_type TEXT NOT NULL,
            subtype TEXT,
            reference TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL,
            party TEXT NOT NULL DEFAULT '',
            mobile_provider TEXT,
            reconciled INTEGER NOT NULL DEFAULT 0,
            attachment TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bank_statement_lines (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            reference TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL,
            matched_txn_id TEXT,
            imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE,
            FOREIGN KEY (matched_txn_id) REFERENCES bank_transactions (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS ledger_entries (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            reference TEXT NOT NULL,
            party_name TEXT NOT NULL,
            party_ref TEXT,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'UGX',
            paid REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'open',
            notes TEXT,
            promise_to_pay TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ledger_payments (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            reference TEXT,
            note TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entry_id) REFERENCES ledger_entries (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS expense_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#0EA5E9',
            monthly_budget REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            reference TEXT NOT NULL UNIQUE,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            employee TEXT NOT NULL DEFAULT '',
            department TEXT NOT NULL DEFAULT '',
            category_id TEXT,
            vendor TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'UGX',
            payment_method TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            attachment TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            reimbursable INTEGER NOT NULL DEFAULT 0,
            reimbursed INTEGER NOT NULL DEFAULT 0,
            approved_by TEXT,
            rejected_reason TEXT,
            recurring TEXT,
            travel TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES expense_categories (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS expense_audit (
            id TEXT PRIMARY KEY,
            expense_id TEXT NOT NULL,
            action TEXT NOT NULL,
            actor TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            reference TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'company',
            stage TEXT NOT NULL DEFAULT 'lead',
            tier TEXT NOT NULL DEFAULT 'bronze',
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            country TEXT NOT NULL DEFAULT '',
            industry TEXT NOT NULL DEFAULT '',
            tax_id TEXT,
            website TEXT,
            contact_person TEXT,
            sales_rep TEXT NOT NULL DEFAULT '',
            payment_terms TEXT NOT NULL DEFAULT 'prepaid',
            credit_limit REAL NOT NULL DEFAULT 0,
            outstanding_balance REAL NOT NULL DEFAULT 0,
            lifetime_value REAL NOT NULL DEFAULT 0,
            total_orders INTEGER NOT NULL DEFAULT 0,
            avg_order_value REAL NOT NULL DEFAULT 0,
            loyalty_points INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]',
            notes TEXT NOT NULL DEFAULT '',
            last_order_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customer_interactions (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            type TEXT NOT NULL,
            summary TEXT NOT NULL,
            at TEXT NOT NULL,
            by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            tag TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            serial_number TEXT NOT NULL DEFAULT '',
            manufacturer TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            assigned_to TEXT NOT NULL DEFAULT '',
            purchase_date TEXT NOT NULL,
            purchase_cost REAL NOT NULL DEFAULT 0,
            salvage_value REAL NOT NULL DEFAULT 0,
            useful_life_years INTEGER NOT NULL DEFAULT 5,
            status TEXT NOT NULL DEFAULT 'active',
            condition TEXT NOT NULL DEFAULT 'good',
            meter_unit TEXT NOT NULL DEFAULT 'km',
            service_interval_meter INTEGER NOT NULL DEFAULT 0,
            service_interval_days INTEGER NOT NULL DEFAULT 0,
            last_service_date TEXT,
            last_service_meter INTEGER,
            warranty_expiry TEXT,
            insurance_expiry TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS asset_meter_readings (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            date TEXT NOT NULL,
            value INTEGER NOT NULL,
            recorded_by TEXT NOT NULL DEFAULT '',
            note TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS asset_service_records (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            performed_by TEXT NOT NULL DEFAULT '',
            cost REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            next_due_date TEXT,
            next_due_meter INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS asset_income (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            date TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'UGX',
            description TEXT NOT NULL DEFAULT '',
            reference TEXT NOT NULL DEFAULT '',
            recorded_by TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            order_number TEXT NOT NULL UNIQUE,
            supplier_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            total_cost REAL NOT NULL DEFAULT 0,
            expected_delivery TEXT,
            notes TEXT NOT NULL DEFAULT '',
            created_by TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id TEXT PRIMARY KEY,
            purchase_order_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity_ordered INTEGER NOT NULL DEFAULT 0,
            quantity_received INTEGER NOT NULL DEFAULT 0,
            unit_cost REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            link TEXT,
            reference_id TEXT,
            source_key TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            dismissed_at TEXT,
            UNIQUE(user_id, source_key)
        );

        CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, type)
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user_visible
            ON notifications(user_id, dismissed_at, is_read, created_at DESC);
        """
    )
    default_tiers = [
        ("tier-bronze", "Bronze", 0, 999, "#cd7f32"),
        ("tier-silver", "Silver", 1000, 4999, "#c0c0c0"),
        ("tier-gold", "Gold", 5000, 19999, "#ffd700"),
        ("tier-platinum", "Platinum", 20000, None, "#e5e4e2"),
    ]
    for tier_id, name, min_p, max_p, color in default_tiers:
        db.execute(
            """
            INSERT OR IGNORE INTO loyalty_tiers (id, name, min_points, max_points, color)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tier_id, name, min_p, max_p, color)
        )
    ensure_performance_indexes(db)
    db.commit()


def migrate_db():
    central_db = get_central_db()
    init_central_db(central_db)

    # Migrate any legacy 'requestor' roles in central DB to 'staff'
    central_db.execute("UPDATE users SET role = 'staff' WHERE lower(role) = 'requestor'")
    central_db.execute("UPDATE employees SET role = 'Staff' WHERE lower(role) = 'requestor'")
    central_db.commit()

    # Ensure default main branch exists in central branches registry
    existing_branch = central_db.execute("SELECT id FROM branches LIMIT 1").fetchone()
    if not existing_branch:
        central_db.execute(
            """
            INSERT INTO branches (
                id, name, description, street, building, floor, room_number, branch_manager, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            ("br_main", "Main Branch", "Company Headquarters & Primary Warehouse", "Main Street", "Headquarters", "1st Floor", "101", "House"),
        )
        central_db.commit()

    branches = central_db.execute("SELECT id FROM branches WHERE is_active = 1").fetchall()
    for branch in branches:
        init_branch_db_tables(get_branch_db(branch["id"]))

    from services.chat_service import ensure_chat_users_for_accounts, ensure_default_chat_channels, ensure_all_users_in_general_channel
    ensure_default_chat_channels(central_db)
    ensure_chat_users_for_accounts(central_db)
    ensure_all_users_in_general_channel(central_db)
    central_db.commit()


def init_db():
    migrate_db()



def seed_expenses(db):
    if db.execute("SELECT COUNT(*) AS count FROM expense_categories").fetchone()["count"] > 0:
        return

    today = datetime.now(timezone.utc)

    def iso_date(offset):
        return (today + timedelta(days=offset)).date().isoformat()

    categories = [
        ("c1", "Office supplies", "OFC", "#0EA5E9", 80000),
        ("c2", "Travel & accommodation", "TRV", "#F97316", 250000),
        ("c3", "Meals & entertainment", "MEL", "#10B981", 60000),
        ("c4", "Utilities", "UTL", "#6366F1", 120000),
        ("c5", "Software & subscriptions", "SFT", "#EC4899", 180000),
        ("c6", "Vendor services", "VND", "#EAB308", 320000),
    ]
    db.executemany(
        """
        INSERT OR IGNORE INTO expense_categories (id, name, code, color, monthly_budget)
        VALUES (?, ?, ?, ?, ?)
        """,
        categories,
    )

    expenses = [
        {
            "id": "e1",
            "reference": "EXP-02401",
            "date": iso_date(-1),
            "type": "employee",
            "employee": "Wamala Leo",
            "department": "Sales",
            "category_id": "c3",
            "vendor": "Java House",
            "amount": 4800,
            "payment_method": "card",
            "description": "Client lunch - Q3 pitch",
            "attachment": "receipt-4800.pdf",
            "status": "submitted",
            "reimbursable": 1,
            "reimbursed": 0,
            "approved_by": None,
            "rejected_reason": None,
            "recurring": None,
            "travel": None,
        },
        {
            "id": "e2",
            "reference": "EXP-02402",
            "date": iso_date(-2),
            "type": "travel",
            "employee": "Gayitano Simon",
            "department": "Operations",
            "category_id": "c2",
            "vendor": "Kenya Airways",
            "amount": 38500,
            "payment_method": "company_card",
            "description": "Nairobi to Mombasa site visit",
            "attachment": "boarding.pdf",
            "status": "approved",
            "reimbursable": 0,
            "reimbursed": 0,
            "approved_by": "Faith Njeri",
            "rejected_reason": None,
            "recurring": None,
            "travel": {"destination": "Mombasa", "purpose": "Warehouse audit", "mileage": 0},
        },
        {
            "id": "e3",
            "reference": "EXP-02403",
            "date": iso_date(-3),
            "type": "vendor",
            "employee": "Najib Ndawula",
            "department": "Procurement",
            "category_id": "c6",
            "vendor": "Mavuno Cleaning Co.",
            "amount": 22000,
            "payment_method": "bank_transfer",
            "description": "May janitorial services",
            "attachment": None,
            "status": "paid",
            "reimbursable": 0,
            "reimbursed": 0,
            "approved_by": "Faith Njeri",
            "rejected_reason": None,
            "recurring": None,
            "travel": None,
        },
        {
            "id": "e4",
            "reference": "EXP-02404",
            "date": iso_date(-4),
            "type": "recurring",
            "employee": "System",
            "department": "Engineering",
            "category_id": "c5",
            "vendor": "GitHub Enterprise",
            "amount": 18400,
            "payment_method": "company_card",
            "description": "Monthly seats x 8",
            "attachment": None,
            "status": "paid",
            "reimbursable": 0,
            "reimbursed": 0,
            "approved_by": "Faith Njeri",
            "rejected_reason": None,
            "recurring": {"frequency": "monthly", "nextRun": iso_date(26)},
            "travel": None,
        },
    ]

    for expense in expenses:
        db.execute(
            """
            INSERT OR IGNORE INTO expenses (
                id, reference, date, type, employee, department, category_id, vendor,
                amount, currency, payment_method, description, attachment, status,
                reimbursable, reimbursed, approved_by, rejected_reason, recurring,
                travel, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UGX', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                expense["id"], expense["reference"], expense["date"], expense["type"],
                expense["employee"], expense["department"], expense["category_id"],
                expense["vendor"], expense["amount"], expense["payment_method"],
                expense["description"], expense["attachment"], expense["status"],
                expense["reimbursable"], expense["reimbursed"], expense["approved_by"],
                expense["rejected_reason"], json.dumps(expense["recurring"]) if expense["recurring"] else None,
                json.dumps(expense["travel"]) if expense["travel"] else None,
                today.isoformat(), today.isoformat(),
            ),
        )

    audit = [
        (f"a{i}", expense["id"], "approved" if expense["status"] != "rejected" else "rejected", "Faith Njeri", "Auto-seeded", today.isoformat())
        for i, expense in enumerate(expenses)
    ]
    db.executemany(
        """
        INSERT OR IGNORE INTO expense_audit (id, expense_id, action, actor, note, at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        audit,
    )


def seed_customers(db):
    if db.execute("SELECT COUNT(*) AS count FROM customers").fetchone()["count"] > 0:
        return

    def days_ago(days):
        return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    customers = [
        {
            "id": "cus-demo-0001",
            "reference": "CUS-00001",
            "name": "Acme Holdings Ltd",
            "type": "company",
            "stage": "vip",
            "tier": "platinum",
            "email": "procurement@acme.co.ke",
            "phone": "+254 711 220 145",
            "address": "Riverside Drive 14",
            "city": "Nairobi",
            "country": "Kenya",
            "industry": "Construction",
            "tax_id": "P051234567X",
            "website": "acme.co.ke",
            "contact_person": "Esther Mwangi",
            "sales_rep": "Joyce Wanjiku",
            "payment_terms": "net_30",
            "credit_limit": 1500000,
            "outstanding_balance": 285000,
            "lifetime_value": 4820000,
            "total_orders": 47,
            "avg_order_value": 102553,
            "loyalty_points": 4820,
            "tags": ["strategic", "key-account"],
            "notes": "Quarterly business review every quarter.",
            "last_order_at": days_ago(2),
            "created_at": days_ago(420),
            "updated_at": days_ago(2),
        },
        {
            "id": "cus-demo-0002",
            "reference": "CUS-00002",
            "name": "Pinnacle Engineering",
            "type": "company",
            "stage": "active",
            "tier": "gold",
            "email": "ops@pinnacle.co.ke",
            "phone": "+254 722 845 901",
            "address": "Mombasa Road, Sameer Park",
            "city": "Nairobi",
            "country": "Kenya",
            "industry": "Engineering",
            "tax_id": "P052891011Y",
            "website": None,
            "contact_person": "David Kariuki",
            "sales_rep": "Brian Otieno",
            "payment_terms": "net_15",
            "credit_limit": 600000,
            "outstanding_balance": 92700,
            "lifetime_value": 1180000,
            "total_orders": 18,
            "avg_order_value": 65555,
            "loyalty_points": 1180,
            "tags": ["recurring"],
            "notes": "",
            "last_order_at": days_ago(4),
            "created_at": days_ago(220),
            "updated_at": days_ago(4),
        },
        {
            "id": "cus-demo-0003",
            "reference": "CUS-00003",
            "name": "Coastline Foods",
            "type": "company",
            "stage": "active",
            "tier": "silver",
            "email": "supplies@coastline.co.ke",
            "phone": "+254 733 102 887",
            "address": "Nyali Centre",
            "city": "Mombasa",
            "country": "Kenya",
            "industry": "Food & Beverage",
            "tax_id": None,
            "website": None,
            "contact_person": "Halima Said",
            "sales_rep": "Mary Achieng",
            "payment_terms": "net_7",
            "credit_limit": 400000,
            "outstanding_balance": 0,
            "lifetime_value": 645000,
            "total_orders": 12,
            "avg_order_value": 53750,
            "loyalty_points": 645,
            "tags": ["coast-region"],
            "notes": "",
            "last_order_at": days_ago(10),
            "created_at": days_ago(180),
            "updated_at": days_ago(10),
        },
        {
            "id": "cus-demo-0004",
            "reference": "CUS-00004",
            "name": "James Mutiso",
            "type": "individual",
            "stage": "prospect",
            "tier": "bronze",
            "email": "j.mutiso@gmail.com",
            "phone": "+254 700 998 211",
            "address": "Kileleshwa",
            "city": "Nairobi",
            "country": "Kenya",
            "industry": "Retail",
            "tax_id": None,
            "website": None,
            "contact_person": None,
            "sales_rep": "Brian Otieno",
            "payment_terms": "prepaid",
            "credit_limit": 0,
            "outstanding_balance": 0,
            "lifetime_value": 28000,
            "total_orders": 1,
            "avg_order_value": 28000,
            "loyalty_points": 28,
            "tags": ["walk-in"],
            "notes": "Interested in solar kits.",
            "last_order_at": days_ago(35),
            "created_at": days_ago(45),
            "updated_at": days_ago(7),
        },
        {
            "id": "cus-demo-0005",
            "reference": "CUS-00005",
            "name": "Savannah Logistics",
            "type": "company",
            "stage": "dormant",
            "tier": "silver",
            "email": "accounts@savannah.co.ke",
            "phone": "+254 720 334 110",
            "address": "ICD Road",
            "city": "Nairobi",
            "country": "Kenya",
            "industry": "Logistics",
            "tax_id": None,
            "website": None,
            "contact_person": "Patrick Ngugi",
            "sales_rep": "Joyce Wanjiku",
            "payment_terms": "net_30",
            "credit_limit": 500000,
            "outstanding_balance": 0,
            "lifetime_value": 412000,
            "total_orders": 9,
            "avg_order_value": 45777,
            "loyalty_points": 412,
            "tags": ["re-engage"],
            "notes": "No orders in 90+ days. Consider win-back campaign.",
            "last_order_at": days_ago(112),
            "created_at": days_ago(540),
            "updated_at": days_ago(15),
        },
        {
            "id": "cus-demo-0006",
            "reference": "CUS-00006",
            "name": "Brightway Schools",
            "type": "company",
            "stage": "lead",
            "tier": "bronze",
            "email": "admin@brightway.ac.ke",
            "phone": "+254 712 556 008",
            "address": "Karen",
            "city": "Nairobi",
            "country": "Kenya",
            "industry": "Education",
            "tax_id": None,
            "website": None,
            "contact_person": "Ruth Mumo",
            "sales_rep": "Mary Achieng",
            "payment_terms": "prepaid",
            "credit_limit": 0,
            "outstanding_balance": 0,
            "lifetime_value": 0,
            "total_orders": 0,
            "avg_order_value": 0,
            "loyalty_points": 0,
            "tags": ["education", "new"],
            "notes": "Discovery call scheduled.",
            "last_order_at": None,
            "created_at": days_ago(6),
            "updated_at": days_ago(1),
        },
    ]

    for customer in customers:
        db.execute(
            """
            INSERT OR IGNORE INTO customers (
                id, reference, name, type, stage, tier, email, phone, address, city,
                country, industry, tax_id, website, contact_person, sales_rep,
                payment_terms, credit_limit, outstanding_balance, lifetime_value,
                total_orders, avg_order_value, loyalty_points, tags, notes,
                last_order_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                customer["id"], customer["reference"], customer["name"], customer["type"],
                customer["stage"], customer["tier"], customer["email"], customer["phone"],
                customer["address"], customer["city"], customer["country"], customer["industry"],
                customer["tax_id"], customer["website"], customer["contact_person"],
                customer["sales_rep"], customer["payment_terms"], customer["credit_limit"],
                customer["outstanding_balance"], customer["lifetime_value"],
                customer["total_orders"], customer["avg_order_value"],
                customer["loyalty_points"], json.dumps(customer["tags"]), customer["notes"],
                customer["last_order_at"], customer["created_at"], customer["updated_at"],
            ),
        )

    interactions = [
        ("int-demo-0001", "cus-demo-0001", "order", "LPO-2026-0042 confirmed - UGX 184,500", days_ago(2), None),
        ("int-demo-0002", "cus-demo-0001", "call", "Esther called about pricing on bulk cement", days_ago(5), "Joyce"),
        ("int-demo-0003", "cus-demo-0002", "order", "LPO-2026-0041 confirmed", days_ago(4), None),
        ("int-demo-0004", "cus-demo-0002", "email", "Quotation QT-3387 sent", days_ago(9), "Brian"),
        ("int-demo-0005", "cus-demo-0003", "order", "LPO-2026-0040 delivered", days_ago(10), None),
        ("int-demo-0006", "cus-demo-0004", "note", "Requested catalog", days_ago(7), "Brian"),
        ("int-demo-0007", "cus-demo-0005", "email", "Win-back offer drafted", days_ago(15), None),
        ("int-demo-0008", "cus-demo-0006", "meeting", "Discovery call booked", days_ago(1), "Mary"),
    ]
    db.executemany(
        """
        INSERT OR IGNORE INTO customer_interactions (id, customer_id, type, summary, at, by)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        interactions,
    )


def seed_assets(db):
    if db.execute("SELECT COUNT(*) AS count FROM assets").fetchone()["count"] > 0:
        return

    today = datetime.now(timezone.utc)

    def iso_date(offset):
        return (today + timedelta(days=offset)).date().isoformat()

    assets = [
        {
            "id": "ast-demo-0001",
            "tag": "AST-1001",
            "name": "Toyota Hilux · KCA 442X",
            "category": "Vehicle",
            "serial_number": "AHTFR22G80",
            "manufacturer": "Toyota",
            "model": "Hilux 2.4 D-4D",
            "location": "qt upper",
            "assigned_to": "Najib Ndawula",
            "purchase_date": iso_date(-720),
            "purchase_cost": 3850000,
            "salvage_value": 600000,
            "useful_life_years": 8,
            "status": "active",
            "condition": "good",
            "meter_unit": "km",
            "service_interval_meter": 5000,
            "service_interval_days": 90,
            "last_service_date": iso_date(-85),
            "last_service_meter": 48200,
            "warranty_expiry": iso_date(360),
            "insurance_expiry": iso_date(40),
            "notes": "",
            "created_at": iso_date(-720),
            "updated_at": iso_date(-1),
        },
        {
            "id": "ast-demo-0002",
            "tag": "AST-1002",
            "name": "Cummins 60kVA Generator",
            "category": "Generator",
            "serial_number": "CMS-60K-8821",
            "manufacturer": "Cummins",
            "model": "C60D5",
            "location": "Industrial Area",
            "assigned_to": "Facilities",
            "purchase_date": iso_date(-1100),
            "purchase_cost": 1420000,
            "salvage_value": 200000,
            "useful_life_years": 10,
            "status": "active",
            "condition": "good",
            "meter_unit": "hours",
            "service_interval_meter": 250,
            "service_interval_days": 120,
            "last_service_date": iso_date(-110),
            "last_service_meter": 1840,
            "warranty_expiry": iso_date(-30),
            "insurance_expiry": iso_date(180),
            "notes": "",
            "created_at": iso_date(-1100),
            "updated_at": iso_date(-2),
        },
        {
            "id": "ast-demo-0003",
            "tag": "AST-1003",
            "name": "Heidelberg Offset Press",
            "category": "Machinery",
            "serial_number": "HD-PM52-9911",
            "manufacturer": "Heidelberg",
            "model": "Printmaster PM52",
            "location": "Printworks Floor",
            "assigned_to": "Production",
            "purchase_date": iso_date(-1600),
            "purchase_cost": 6200000,
            "salvage_value": 800000,
            "useful_life_years": 12,
            "status": "active",
            "condition": "good",
            "meter_unit": "cycles",
            "service_interval_meter": 50000,
            "service_interval_days": 60,
            "last_service_date": iso_date(-40),
            "last_service_meter": 312500,
            "warranty_expiry": None,
            "insurance_expiry": None,
            "notes": "",
            "created_at": iso_date(-1600),
            "updated_at": iso_date(-3),
        },
        {
            "id": "ast-demo-0004",
            "tag": "AST-1004",
            "name": "MacBook Pro 16\" · Design",
            "category": "IT",
            "serial_number": "C02ZK1XYMD6T",
            "manufacturer": "Apple",
            "model": "MBP16 M3 Pro",
            "location": "Design Studio",
            "assigned_to": "Shafi G.",
            "purchase_date": iso_date(-220),
            "purchase_cost": 380000,
            "salvage_value": 60000,
            "useful_life_years": 4,
            "status": "active",
            "condition": "excellent",
            "meter_unit": "hours",
            "service_interval_meter": 2000,
            "service_interval_days": 365,
            "last_service_date": None,
            "last_service_meter": None,
            "warranty_expiry": iso_date(510),
            "insurance_expiry": None,
            "notes": "",
            "created_at": iso_date(-220),
            "updated_at": iso_date(-4),
        },
        {
            "id": "ast-demo-0005",
            "tag": "AST-1005",
            "name": "Forklift · Linde H30",
            "category": "Machinery",
            "serial_number": "LD-H30-22810",
            "manufacturer": "Linde",
            "model": "H30D",
            "location": "qt lower",
            "assigned_to": "Logistics",
            "purchase_date": iso_date(-900),
            "purchase_cost": 2100000,
            "salvage_value": 350000,
            "useful_life_years": 10,
            "status": "maintenance",
            "condition": "fair",
            "meter_unit": "hours",
            "service_interval_meter": 500,
            "service_interval_days": 90,
            "last_service_date": iso_date(-130),
            "last_service_meter": 3240,
            "warranty_expiry": None,
            "insurance_expiry": None,
            "notes": "",
            "created_at": iso_date(-900),
            "updated_at": iso_date(-5),
        },
    ]

    for asset in assets:
        db.execute(
            """
            INSERT OR IGNORE INTO assets (
                id, tag, name, category, serial_number, manufacturer, model, location,
                assigned_to, purchase_date, purchase_cost, salvage_value, useful_life_years,
                status, condition, meter_unit, service_interval_meter, service_interval_days,
                last_service_date, last_service_meter, warranty_expiry, insurance_expiry,
                notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset["id"], asset["tag"], asset["name"], asset["category"], asset["serial_number"],
                asset["manufacturer"], asset["model"], asset["location"], asset["assigned_to"],
                asset["purchase_date"], asset["purchase_cost"], asset["salvage_value"], asset["useful_life_years"],
                asset["status"], asset["condition"], asset["meter_unit"], asset["service_interval_meter"],
                asset["service_interval_days"], asset["last_service_date"], asset["last_service_meter"],
                asset["warranty_expiry"], asset["insurance_expiry"], asset["notes"], asset["created_at"],
                asset["updated_at"],
            ),
        )

    # Add meter readings
    meter_readings = [
        {
            "id": "rdg-demo-0001",
            "asset_id": "ast-demo-0001",
            "date": iso_date(-14),
            "value": 48200,
            "recorded_by": "Najib N.",
            "note": None,
        },
        {
            "id": "rdg-demo-0002",
            "asset_id": "ast-demo-0001",
            "date": iso_date(-7),
            "value": 48350,
            "recorded_by": "Najib N.",
            "note": None,
        },
        {
            "id": "rdg-demo-0003",
            "asset_id": "ast-demo-0001",
            "date": iso_date(-1),
            "value": 48500,
            "recorded_by": "Najib N.",
            "note": None,
        },
        {
            "id": "rdg-demo-0004",
            "asset_id": "ast-demo-0002",
            "date": iso_date(-20),
            "value": 1840,
            "recorded_by": "Sam K.",
            "note": None,
        },
        {
            "id": "rdg-demo-0005",
            "asset_id": "ast-demo-0002",
            "date": iso_date(-10),
            "value": 1860,
            "recorded_by": "Sam K.",
            "note": None,
        },
        {
            "id": "rdg-demo-0006",
            "asset_id": "ast-demo-0003",
            "date": iso_date(-18),
            "value": 312500,
            "recorded_by": "Faith N.",
            "note": None,
        },
        {
            "id": "rdg-demo-0007",
            "asset_id": "ast-demo-0003",
            "date": iso_date(-9),
            "value": 322100,
            "recorded_by": "Faith N.",
            "note": None,
        },
        {
            "id": "rdg-demo-0008",
            "asset_id": "ast-demo-0005",
            "date": iso_date(-16),
            "value": 3240,
            "recorded_by": "Kevin K.",
            "note": None,
        },
        {
            "id": "rdg-demo-0009",
            "asset_id": "ast-demo-0005",
            "date": iso_date(-8),
            "value": 3270,
            "recorded_by": "Kevin K.",
            "note": None,
        },
    ]

    db.executemany(
        """
        INSERT OR IGNORE INTO asset_meter_readings (id, asset_id, date, value, recorded_by, note)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (r["id"], r["asset_id"], r["date"], r["value"], r["recorded_by"], r["note"])
            for r in meter_readings
        ],
    )

    # Add service records
    service_records = [
        {
            "id": "svc-demo-0001",
            "asset_id": "ast-demo-0001",
            "date": iso_date(-85),
            "type": "preventive",
            "performed_by": "Toyota Uganda",
            "cost": 18400,
            "notes": "5,000 km service",
            "next_due_date": iso_date(5),
            "next_due_meter": 53200,
        },
    ]

    db.executemany(
        """
        INSERT OR IGNORE INTO asset_service_records (
            id, asset_id, date, type, performed_by, cost, notes, next_due_date, next_due_meter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (s["id"], s["asset_id"], s["date"], s["type"], s["performed_by"], s["cost"],
             s["notes"], s["next_due_date"], s["next_due_meter"])
            for s in service_records
        ],
    )

    # Seed asset income
    if db.execute("SELECT COUNT(*) AS count FROM asset_income").fetchone()["count"] == 0:
        income_records = [
            {
                "id": "inc-demo-0001",
                "asset_id": "ast-demo-0001",
                "date": iso_date(-90),
                "source": "Rental",
                "amount": 350000,
                "currency": "UGX",
                "description": "Hilux rental — site logistics month",
                "reference": "INV-HLX-24005",
                "recorded_by": "Finance",
            },
            {
                "id": "inc-demo-0002",
                "asset_id": "ast-demo-0001",
                "date": iso_date(-60),
                "source": "Rental",
                "amount": 350000,
                "currency": "UGX",
                "description": "Hilux rental — client project month",
                "reference": "INV-HLX-24006",
                "recorded_by": "Finance",
            },
            {
                "id": "inc-demo-0003",
                "asset_id": "ast-demo-0001",
                "date": iso_date(-30),
                "source": "Rental",
                "amount": 380000,
                "currency": "UGX",
                "description": "Hilux rental — coastal run month",
                "reference": "INV-HLX-24007",
                "recorded_by": "Finance",
            },
            {
                "id": "inc-demo-0004",
                "asset_id": "ast-demo-0001",
                "date": iso_date(-5),
                "source": "Rental",
                "amount": 410000,
                "currency": "UGX",
                "description": "Hilux rental — current month",
                "reference": "INV-HLX-24008",
                "recorded_by": "Finance",
            },
            {
                "id": "inc-demo-0005",
                "asset_id": "ast-demo-0002",
                "date": iso_date(-75),
                "source": "Standby power",
                "amount": 180000,
                "currency": "UGX",
                "description": "Generator standby — warehouse backup",
                "reference": "INV-GEN-24011",
                "recorded_by": "Operations",
            },
            {
                "id": "inc-demo-0006",
                "asset_id": "ast-demo-0002",
                "date": iso_date(-45),
                "source": "Standby power",
                "amount": 210000,
                "currency": "UGX",
                "description": "Generator event rental — trade fair",
                "reference": "INV-GEN-24012",
                "recorded_by": "Operations",
            },
            {
                "id": "inc-demo-0007",
                "asset_id": "ast-demo-0002",
                "date": iso_date(-12),
                "source": "Standby power",
                "amount": 165000,
                "currency": "UGX",
                "description": "Generator standby — outage period",
                "reference": "INV-GEN-24013",
                "recorded_by": "Operations",
            },
            {
                "id": "inc-demo-0008",
                "asset_id": "ast-demo-0003",
                "date": iso_date(-80),
                "source": "Job press",
                "amount": 1250000,
                "currency": "UGX",
                "description": "Print run — annual report contract",
                "reference": "JOB-HDB-24101",
                "recorded_by": "Production",
            },
            {
                "id": "inc-demo-0009",
                "asset_id": "ast-demo-0003",
                "date": iso_date(-50),
                "source": "Job press",
                "amount": 980000,
                "currency": "UGX",
                "description": "Print run — catalog batch",
                "reference": "JOB-HDB-24102",
                "recorded_by": "Production",
            },
            {
                "id": "inc-demo-0010",
                "asset_id": "ast-demo-0003",
                "date": iso_date(-20),
                "source": "Job press",
                "amount": 1420000,
                "currency": "UGX",
                "description": "Print run — packaging job",
                "reference": "JOB-HDB-24103",
                "recorded_by": "Production",
            },
            {
                "id": "inc-demo-0011",
                "asset_id": "ast-demo-0004",
                "date": iso_date(-35),
                "source": "Billed services",
                "amount": 240000,
                "currency": "UGX",
                "description": "Design station billed hours on laptop",
                "reference": "BILL-MBP-24002",
                "recorded_by": "Design Studio",
            },
            {
                "id": "inc-demo-0012",
                "asset_id": "ast-demo-0004",
                "date": iso_date(-8),
                "source": "Billed services",
                "amount": 310000,
                "currency": "UGX",
                "description": "Design sprint / mockups — client retainer",
                "reference": "BILL-MBP-24003",
                "recorded_by": "Design Studio",
            },
            {
                "id": "inc-demo-0013",
                "asset_id": "ast-demo-0005",
                "date": iso_date(-110),
                "source": "Logistics",
                "amount": 520000,
                "currency": "UGX",
                "description": "Forklift dedicated contract — yard moves",
                "reference": "LOG-LIN-24009",
                "recorded_by": "Logistics",
            },
            {
                "id": "inc-demo-0014",
                "asset_id": "ast-demo-0005",
                "date": iso_date(-70),
                "source": "Logistics",
                "amount": 470000,
                "currency": "UGX",
                "description": "Forklift loading — container batch",
                "reference": "LOG-LIN-24010",
                "recorded_by": "Logistics",
            },
        ]
        db.executemany(
            """
            INSERT OR IGNORE INTO asset_income (
                id, asset_id, date, source, amount, currency, description, reference, recorded_by,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    i["id"], i["asset_id"], i["date"], i["source"], i["amount"], i["currency"],
                    i["description"], i["reference"], i["recorded_by"],
                    iso_date(0), iso_date(0),
                )
                for i in income_records
            ],
        )


def seed_employees(db):
    if db.execute("SELECT COUNT(*) AS count FROM employees").fetchone()["count"] > 0:
        return

    today = datetime.now(timezone.utc)
    def iso_date(offset):
        return (today + timedelta(days=offset)).date().isoformat()

    employees = [
        {
            "id": "e1",
            "code": "EMP-001",
            "name": "Ndawula Nagib",
            "email": "Najib@Queenstech.io",
            "phone": "+256 712 884 221",
            "role": "Head of Operations",
            "department": "Operations",
            "location": "QueenstechHQ",
            "employment_type": "full_time",
            "status": "active",
            "joined_at": "2022-03-14",
            "salary": 285000,
            "skills": ["Leadership", "SCM", "Lean"],
            "bio": "Drives warehouse throughput and last-mile reliability."
        },
        {
            "id": "e2",
            "code": "EMP-002",
            "name": "Gayitano Simon",
            "email": "simon@Queenstech.io",
            "phone": "+256 720 110 998",
            "role": "Inventory Manager",
            "department": "Warehouse",
            "manager": "Aisha Mwangi",
            "location": "M&S",
            "employment_type": "full_time",
            "status": "active",
            "joined_at": "2023-07-02",
            "salary": 165000,
            "skills": ["WMS", "Cycle Counts"]
        },
        {
            "id": "e3",
            "code": "EMP-003",
            "name": "Galiwango Shafik",
            "email": "shafik@Queenstech.io",
            "phone": "+256 733 442 117",
            "role": "Finance Lead",
            "department": "Finance",
            "location": "QueenstechHQ",
            "employment_type": "full_time",
            "status": "active",
            "joined_at": "2021-11-09",
            "salary": 245000,
            "skills": ["AP/AR", "Reconciliation", "Tax"]
        },
        {
            "id": "e4",
            "code": "EMP-004",
            "name": "Wamala Leo",
            "email": "leo@Queenstech.io",
            "phone": "+256 701 553 008",
            "role": "Procurement Officer",
            "department": "Procurement",
            "manager": "Aisha Mwangi",
            "location": "QueenstechHQ",
            "employment_type": "full_time",
            "status": "on_leave",
            "joined_at": "2022-06-20",
            "salary": 135000,
            "skills": ["RFQ", "Vendor Mgmt"]
        },
        {
            "id": "e5",
            "code": "EMP-005",
            "name": "Muliika Geofrey",
            "email": "geofrey@Queenstech.io",
            "phone": "+256 722 901 334",
            "role": "Sales Executive",
            "department": "Sales",
            "location": "Kisumu Branch",
            "employment_type": "full_time",
            "status": "active",
            "joined_at": "2024-01-15",
            "salary": 95000,
            "skills": ["B2B", "CRM"]
        },
        {
            "id": "e6",
            "code": "EMP-006",
            "name": "Mariam Nazziwa",
            "email": "mariam@Queenstech.io",
            "phone": "+256 715 220 776",
            "role": "Warehouse Associate",
            "department": "Warehouse",
            "manager": "Brian Otieno",
            "location": "Mombasa DC",
            "employment_type": "contract",
            "status": "probation",
            "joined_at": "2026-02-01",
            "salary": 52000,
            "skills": ["Forklift", "Picking"]
        },
        {
            "id": "e7",
            "code": "EMP-007",
            "name": "Khatrinah Nalukwago",
            "email": "khatrinah@Queenstech.io",
            "phone": "+256 728 116 553",
            "role": "HR Business Partner",
            "department": "People",
            "location": "QueenstechHQ",
            "employment_type": "full_time",
            "status": "active",
            "joined_at": "2020-09-01",
            "salary": 195000,
            "skills": ["L&D", "Comp & Ben"]
        },
    ]

    for emp in employees:
        db.execute(
            """
            INSERT OR IGNORE INTO employees (
                id, code, name, email, phone, avatar, role, department, manager,
                location, employment_type, status, joined_at, salary, skills,
                emergency_contact, bio, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                emp["id"], emp["code"], emp["name"], emp["email"], emp["phone"],
                emp.get("avatar"), emp["role"], emp["department"], emp.get("manager"),
                emp["location"], emp["employment_type"], emp["status"], emp["joined_at"],
                emp["salary"], json.dumps(emp.get("skills", [])), emp.get("emergency_contact"),
                emp.get("bio"), iso_date(-100), iso_date(-1)
            )
        )


def seed_chat(db):
    if db.execute("SELECT COUNT(*) AS count FROM chat_users").fetchone()["count"] > 0:
        return

    today = datetime.now(timezone.utc)

    def iso_date(offset_minutes):
        return (today - timedelta(minutes=offset_minutes)).isoformat()

    # Seed users
    chat_users = [
        ("me", "You", "Admin", "from-emerald-500 to-teal-600", 1),
        ("u1", "Ndawula Nagib", "Head of Operations", "from-rose-500 to-pink-600", 1),
        ("u2", "Gayitano Simon", "Inventory Manager", "from-blue-500 to-indigo-600", 1),
        ("u3", "Galiwango Shafik", "Finance Lead", "from-amber-500 to-orange-600", 0),
        ("u4", "Mariam Nazziwa", "Procurement Officer", "from-cyan-500 to-blue-600", 0),
    ]
    db.executemany(
        "INSERT OR IGNORE INTO chat_users (id, name, role, color, online) VALUES (?, ?, ?, ?, ?)",
        chat_users
    )

    # Seed channels
    chat_channels = [
        ("general", "General", "group", "💬", "Company-wide chatroom"),
        ("c1", "All-hands", "broadcast", "📣", "Company-wide announcements"),
        ("c2", "Warehouse Floor", "group", "📦", "Daily ops at qt & M&S"),
        ("c3", "Finance Huddle", "group", "💰", "AR/AP, reconciliation, payroll"),
        ("c4", "Sales Pipeline", "group", "🚀", "Live deals, quotes, LPOs"),
        ("c5", "Ndawula Nagib", "dm", "👤", None),
        ("c6", "Hassan Abdi", "dm", "👤", None),
    ]
    db.executemany(
        "INSERT OR IGNORE INTO chat_channels (id, name, type, emoji, description) VALUES (?, ?, ?, ?, ?)",
        chat_channels
    )

    # Seed channel members
    channel_members = [
        # General: everyone
        ("cm0", "general", "me"),
        ("cm0a", "general", "u1"),
        ("cm0b", "general", "u2"),
        ("cm0c", "general", "u3"),
        ("cm0d", "general", "u4"),
        # All-hands: everyone
        ("cm1", "c1", "me"),
        ("cm2", "c1", "u1"),
        ("cm3", "c1", "u2"),
        ("cm4", "c1", "u3"),
        ("cm5", "c1", "u4"),
        # Warehouse Floor: me, u1, u2, u4
        ("cm6", "c2", "me"),
        ("cm7", "c2", "u1"),
        ("cm8", "c2", "u2"),
        ("cm9", "c2", "u4"),
        # Finance: me, u3, let's add another (we'll use u6 for consistency with original data)
        ("cm10", "c3", "me"),
        ("cm11", "c3", "u3"),
        ("cm12", "c3", "u6"),
        # Sales: me, u1, u5, u8
        ("cm13", "c4", "me"),
        ("cm14", "c4", "u1"),
        ("cm15", "c4", "u5"),
        ("cm16", "c4", "u8"),
        # DM: me and u1
        ("cm17", "c5", "me"),
        ("cm18", "c5", "u1"),
        # DM: me and u7
        ("cm19", "c6", "me"),
        ("cm20", "c6", "u7"),
    ]
    # Note: we'll skip inserting members with user_ids we don't have (u5, u6, u7, u8) for now
    valid_user_ids = {u[0] for u in chat_users}
    filtered_channel_members = [
        cm for cm in channel_members if cm[2] in valid_user_ids
    ]
    db.executemany(
        "INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id) VALUES (?, ?, ?)",
        filtered_channel_members
    )

    # Seed messages
    chat_messages = [
        # c1: All-hands
        ("m1", "c1", "u1", "Good morning team! Q2 close kicks off Monday. Please clear pending LPOs before end of week. @Shafik can you share the checklist?",
         '["u3"]', "[]", '[{"emoji": "👍", "user_ids": ["me", "u2"]}, {"emoji": "🔥", "user_ids": ["u8"]}]',
         None, 0, 1, iso_date(380), iso_date(380)),
        ("m2", "c1", "u3", "On it 👌 Sharing the Q2-close checklist now.", "[]",
         '[{"id": "a1", "name": "Q2-Close-Checklist.pdf", "size": 184320, "type": "pdf"}]',
         '[{"emoji": "🙌", "user_ids": ["me", "u1"]}]', None, 0, 0, iso_date(370), iso_date(370)),
        ("m3", "c1", "u6", "Reminder: medical-cover enrolment closes Friday.", "[]", "[]", "[]", None, 0, 0, iso_date(120), iso_date(120)),
        # c2: Warehouse Floor
        ("m4", "c2", "u2", "Morning crew — cycle count for Bay 4 starts at 10. @You please approve the variance threshold.",
         '["me"]', "[]", '[{"emoji": "✅", "user_ids": ["me"]}]', None, 0, 0, iso_date(95), iso_date(95)),
        ("m5", "c2", "u4", "PO-2026-0184 received in full. Photos attached.", "[]",
         '[{"id": "a2", "name": "delivery-bay4-01.jpg", "size": 482300, "type": "image"}, {"id": "a3", "name": "delivery-bay4-02.jpg", "size": 391122, "type": "image"}]',
         '[{"emoji": "📸", "user_ids": ["u1", "u2"]}]', None, 0, 0, iso_date(60), iso_date(60)),
        ("m6", "c2", "me", "Nice. Move the overflow to Aisle C-7 and tag the bin.", "[]", "[]", "[]", None, 0, 0, iso_date(55), iso_date(55)),
        ("m7", "c2", "u1", "Heads-up: tomorrow's intake doubled. Bring in the temp pickers.", "[]", "[]",
         '[{"emoji": "💪", "user_ids": ["u2", "u4"]}]', None, 0, 0, iso_date(20), iso_date(20)),
        # c3: Finance Huddle
        ("m8", "c3", "u3", "Bank reconciliation for KCA done. Variance UGX 12,400 — investigating.", "[]", "[]", "[]", None, 0, 0, iso_date(140), iso_date(140)),
        ("m9", "c3", "u6", "Payroll register attached for review.", '["me"]',
         '[{"id": "a4", "name": "Payroll-Mar-2026.xlsx", "size": 88212, "type": "doc"}]', '[{"emoji": "👀", "user_ids": ["me"]}]',
         None, 0, 0, iso_date(40), iso_date(40)),
        # c4: Sales Pipeline
        ("m10", "c4", "u5", "Closed Acme Industries LPO — UGX 1.4M, delivery in 10 days. 🎉", "[]", "[]",
         '[{"emoji": "🎉", "user_ids": ["me", "u1", "u8"]}, {"emoji": "🥂", "user_ids": ["u1"]}]', None, 0, 0, iso_date(180), iso_date(180)),
        ("m11", "c4", "u8", "Pipeline forecast for next 30 days — confidence 78%.", "[]",
         '[{"id": "a5", "name": "Sales-Forecast-Apr.pdf", "size": 221440, "type": "pdf"}]', "[]", None, 0, 0, iso_date(15), iso_date(15)),
        # c5: DM with u1
        ("m12", "c5", "u1", "Hey — can we sync on the warehouse expansion at 3pm?", "[]", "[]", "[]", None, 0, 0, iso_date(25), iso_date(25)),
        ("m13", "c5", "me", "Works for me. I'll bring the lease draft.", "[]", "[]",
         '[{"emoji": "🙏", "user_ids": ["u1"]}]', None, 0, 0, iso_date(22), iso_date(22)),
        # c6: DM with u7
        ("m14", "c6", "u7", "Your VPN access has been renewed for 12 months.", "[]", "[]", "[]", None, 0, 0, iso_date(50), iso_date(50)),
    ]
    # Filter out messages with authors or replies we don't have
    filtered_chat_messages = []
    for msg in chat_messages:
        if msg[2] not in valid_user_ids:
            continue
        if msg[7] and msg[7] not in [m[0] for m in chat_messages]:
            msg = list(msg)
            msg[7] = None  # Set reply_to to None if we don't have that message
        filtered_chat_messages.append(msg)
    db.executemany(
        """
        INSERT OR IGNORE INTO chat_messages
        (id, channel_id, author_id, body, mentions, attachments, reactions, reply_to, edited, pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                m[0], m[1], m[2], m[3], json.dumps(m[4] if isinstance(m[4], list) else []),
                json.dumps(m[5] if isinstance(m[5], list) else []),
                json.dumps(m[6] if isinstance(m[6], list) else []),
                m[7], m[8], m[9], m[10], m[11]
            )
            for m in filtered_chat_messages
        ]
    )
