import json
import uuid
from datetime import datetime, timezone

from services.database import get_db


VALID_ACCOUNT_STATUSES = {"active", "inactive"}
VALID_CURRENCIES = {"UGX", "USD", "EUR", "GBP"}
VALID_TXN_TYPES = {"deposit", "withdrawal", "transfer_in", "transfer_out", "charge", "interest"}
ACCENTS = [
    "from-primary to-primary/70",
    "from-rose-600 to-rose-400",
    "from-emerald-600 to-emerald-400",
    "from-blue-700 to-blue-500",
    "from-amber-600 to-amber-400",
]


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_accounts():
    return get_db().execute(
        """
        SELECT *
        FROM bank_accounts
        ORDER BY created_at DESC
        """
    ).fetchall()


def get_account(account_id):
    return get_db().execute(
        """
        SELECT *
        FROM bank_accounts
        WHERE id = ?
        """,
        (account_id,),
    ).fetchone()


def create_account(data):
    created_at = data.get("createdAt") or current_timestamp()
    current_balance = float(data.get("currentBalance", data.get("openingBalance", 0)) or 0)
    account_count = get_db().execute("SELECT COUNT(*) AS count FROM bank_accounts").fetchone()["count"]

    get_db().execute(
        """
        INSERT INTO bank_accounts (
            id, account_name, account_number, bank_name, branch, swift_code, currency,
            opening_balance, current_balance, status, color, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["accountName"],
            data["accountNumber"],
            data["bankName"],
            data.get("branch") or "",
            data.get("swiftCode") or "",
            data.get("currency") or "UGX",
            float(data.get("openingBalance") or 0),
            current_balance,
            data.get("status") or "active",
            data.get("color") or ACCENTS[account_count % len(ACCENTS)],
            created_at,
            data.get("updatedAt") or created_at,
        ),
    )
    get_db().commit()
    return get_account(data["id"])


def update_account(account_id, data):
    column_map = {
        "accountName": "account_name",
        "accountNumber": "account_number",
        "bankName": "bank_name",
        "branch": "branch",
        "swiftCode": "swift_code",
        "currency": "currency",
        "openingBalance": "opening_balance",
        "currentBalance": "current_balance",
        "status": "status",
        "color": "color",
        "updatedAt": "updated_at",
    }
    updates = []
    params = []

    for key, column in column_map.items():
        if key not in data:
            continue

        value = data[key]
        if key in {"openingBalance", "currentBalance"}:
            value = float(value or 0)
        updates.append(f"{column} = ?")
        params.append(value)

    if "updatedAt" not in data:
        updates.append("updated_at = CURRENT_TIMESTAMP")

    if not updates:
        return None

    params.append(account_id)
    get_db().execute(
        f"""
        UPDATE bank_accounts
        SET {', '.join(updates)}
        WHERE id = ?
        """,
        params,
    )
    get_db().commit()
    return get_account(account_id)


def delete_account(account_id):
    cursor = get_db().execute("DELETE FROM bank_accounts WHERE id = ?", (account_id,))
    get_db().commit()
    return cursor.rowcount


def list_transactions():
    return get_db().execute(
        """
        SELECT *
        FROM bank_transactions
        ORDER BY date DESC, created_at DESC
        """
    ).fetchall()


def get_transaction(txn_id):
    return get_db().execute(
        """
        SELECT *
        FROM bank_transactions
        WHERE id = ?
        """,
        (txn_id,),
    ).fetchone()


def create_transaction(data):
    db = get_db()
    created_at = data.get("createdAt") or current_timestamp()
    amount = float(data.get("amount") or 0)
    attachment = data.get("attachment")
    customer_id = data.get("customerId")
    party = data.get("party") or ""

    db.execute(
        """
        INSERT INTO bank_transactions (
            id, account_id, date, txn_type, subtype, reference, description, amount,
            party, mobile_provider, reconciled, attachment, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["accountId"],
            data["date"],
            data["type"],
            data.get("subtype"),
            data["reference"],
            data.get("description") or "",
            amount,
            data.get("party") or "",
            data.get("mobileProvider"),
            1 if data.get("reconciled") else 0,
            json.dumps(attachment) if attachment else None,
            created_at,
            data.get("updatedAt") or created_at,
        ),
    )
    db.execute(
        """
        UPDATE bank_accounts
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (amount, data["accountId"]),
    )

    if customer_id and amount > 0:
        customer = db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if customer:
            new_lifetime_value = float(customer["lifetime_value"] or 0) + amount
            new_outstanding_balance = max(0.0, float(customer["outstanding_balance"] or 0) - amount)
            db.execute(
                """
                UPDATE customers
                SET lifetime_value = ?, outstanding_balance = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_lifetime_value, new_outstanding_balance, current_timestamp(), customer_id),
            )
            db.execute(
                """
                INSERT INTO customer_interactions (id, customer_id, type, summary, at, by)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    customer_id,
                    "deposit",
                    f"Deposit of {amount:.2f} recorded via bank entry for {party or 'customer'}",
                    created_at,
                    "system",
                ),
            )

    db.commit()
    return get_transaction(data["id"])


def toggle_transaction_reconciled(txn_id):
    get_db().execute(
        """
        UPDATE bank_transactions
        SET reconciled = CASE reconciled WHEN 1 THEN 0 ELSE 1 END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (txn_id,),
    )
    get_db().commit()
    return get_transaction(txn_id)


def list_statement_lines():
    return get_db().execute(
        """
        SELECT *
        FROM bank_statement_lines
        ORDER BY date DESC, imported_at DESC
        """
    ).fetchall()


def create_statement_lines(account_id, lines):
    imported_at = current_timestamp()
    rows = []
    for line in lines:
        get_db().execute(
            """
            INSERT INTO bank_statement_lines (
                id, account_id, date, description, reference, amount, matched_txn_id, imported_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                line["id"],
                account_id,
                line["date"],
                line.get("description") or "",
                line.get("reference") or "",
                float(line.get("amount") or 0),
                line.get("matchedTxnId"),
                imported_at,
            ),
        )
        rows.append(line["id"])

    get_db().commit()
    placeholders = ", ".join("?" for _ in rows)
    return get_db().execute(
        f"""
        SELECT *
        FROM bank_statement_lines
        WHERE id IN ({placeholders})
        ORDER BY date DESC, imported_at DESC
        """,
        rows,
    ).fetchall()
