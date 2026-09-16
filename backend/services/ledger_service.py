import json
from datetime import datetime, timezone

from services.database import get_db


VALID_KINDS = {"debtor", "creditor"}
VALID_STATUSES = {"draft", "open", "partial", "paid", "overdue", "disputed"}
VALID_PAYMENT_METHODS = {"cash", "mpesa", "bank", "cheque", "card"}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def list_entries(kind):
    rows = get_db().execute(
        """
        SELECT *
        FROM ledger_entries
        WHERE kind = ?
        ORDER BY created_at DESC
        """,
        (kind,),
    ).fetchall()
    return [entry_with_payments(row) for row in rows]


def get_entry(entry_id):
    row = get_db().execute(
        """
        SELECT *
        FROM ledger_entries
        WHERE id = ?
        """,
        (entry_id,),
    ).fetchone()
    return entry_with_payments(row) if row else None


def entry_with_payments(row):
    payments = get_db().execute(
        """
        SELECT *
        FROM ledger_payments
        WHERE entry_id = ?
        ORDER BY date DESC, created_at DESC
        """,
        (row["id"],),
    ).fetchall()
    return row, payments


def compute_status(status, amount, paid, due_date):
    if status in {"draft", "disputed"}:
        return status
    if max(0, amount - paid) == 0:
        return "paid"

    try:
        overdue = datetime.now(timezone.utc).date() > datetime.fromisoformat(due_date).date()
    except ValueError:
        overdue = False

    if paid > 0:
        return "overdue" if overdue else "partial"
    return "overdue" if overdue else "open"


def create_entry(data):
    created_at = data.get("createdAt") or current_timestamp()
    amount = float(data.get("amount") or 0)
    paid = float(data.get("paid") or 0)
    status = compute_status(data.get("status") or "open", amount, paid, data["dueDate"])
    payments = data.get("payments") if isinstance(data.get("payments"), list) else []

    get_db().execute(
        """
        INSERT INTO ledger_entries (
            id, kind, reference, party_name, party_ref, issue_date, due_date,
            amount, currency, paid, status, notes, promise_to_pay, tags,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["id"],
            data["kind"],
            data["reference"],
            data["partyName"],
            data.get("partyRef"),
            data["issueDate"],
            data["dueDate"],
            amount,
            data.get("currency") or "UGX",
            paid,
            status,
            data.get("notes"),
            data.get("promiseToPay"),
            json.dumps(data.get("tags") if isinstance(data.get("tags"), list) else []),
            created_at,
            data.get("updatedAt") or created_at,
        ),
    )

    for payment in payments:
        create_payment_row(data["id"], payment)

    get_db().commit()
    return get_entry(data["id"])


def delete_entry(entry_id):
    cursor = get_db().execute("DELETE FROM ledger_entries WHERE id = ?", (entry_id,))
    get_db().commit()
    return cursor.rowcount


def create_payment(entry_id, payment):
    entry = get_entry(entry_id)
    if not entry:
        return None

    create_payment_row(entry_id, payment)
    row, _ = entry
    payment_amt = float(payment.get("amount") or 0)
    paid = float(row["paid"] or 0) + payment_amt
    total_amt = float(row["amount"] or 0)
    status = compute_status(row["status"], total_amt, paid, row["due_date"])

    get_db().execute(
        """
        UPDATE ledger_entries
        SET paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (paid, status, entry_id),
    )

    # Sync debtor payment with customers table and transactions table
    if row["kind"] == "debtor":
        party_name = row["party_name"]
        party_ref = row["party_ref"] or ""
        
        get_db().execute(
            """
            UPDATE customers
            SET outstanding_balance = MAX(0.0, outstanding_balance - ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? OR LOWER(name) = LOWER(?) OR phone = ?
            """,
            (payment_amt, party_ref, party_name, party_ref),
        )

        rem_balance = max(0.0, total_amt - paid)
        new_txn_status = "paid" if rem_balance == 0 else "partial"
        get_db().execute(
            """
            UPDATE transactions
            SET balance = ?, amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE transaction_number = ?
            """,
            (rem_balance, paid, new_txn_status, row["reference"]),
        )

    get_db().commit()
    return get_entry(entry_id)


def create_payment_row(entry_id, payment):
    get_db().execute(
        """
        INSERT INTO ledger_payments (
            id, entry_id, date, amount, method, reference, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payment["id"],
            entry_id,
            payment["date"],
            float(payment.get("amount") or 0),
            payment["method"],
            payment.get("reference"),
            payment.get("note"),
            payment.get("createdAt") or current_timestamp(),
        ),
    )
