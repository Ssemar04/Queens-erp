import json
import uuid
from datetime import datetime, timezone

from services.database import get_db, table_exists
import sys


VALID_KINDS = {"debtor", "creditor"}
VALID_STATUSES = {"draft", "open", "partial", "paid", "overdue", "disputed"}
VALID_PAYMENT_METHODS = {
    "cash", "mpesa", "bank", "cheque", "card",
    "mobile", "mobile_money", "bank_transfer", "credit"
}


def normalize_payment_method(method):
    if not method:
        return "cash"
    m = str(method).lower().strip()
    if m in {"mobile_money", "mobile"}:
        return "mpesa"
    if m == "bank_transfer":
        return "bank"
    if m in VALID_PAYMENT_METHODS:
        return m
    return "cash"


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
    try:
        amt = float(amount or 0)
        pd = float(paid or 0)
    except (ValueError, TypeError):
        amt = 0.0
        pd = 0.0

    if max(0.0, amt - pd) <= 0.0001:
        return "paid"

    overdue = False
    if due_date:
        try:
            due_str = str(due_date).strip().split("T")[0]
            dt_due = datetime.strptime(due_str, "%Y-%m-%d").date()
            overdue = datetime.now(timezone.utc).date() > dt_due
        except Exception:
            overdue = False

    if pd > 0:
        return "overdue" if overdue else "partial"
    return "overdue" if overdue else "open"


def create_entry(data):
    created_at = data.get("createdAt") or current_timestamp()
    amount = float(data.get("amount") or 0)
    paid = float(data.get("paid") or 0)
    status = compute_status(data.get("status") or "open", amount, paid, data.get("dueDate"))
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

    try:
        payment_amt = float(payment.get("amount") or 0)
    except (ValueError, TypeError):
        payment_amt = 0.0

    try:
        existing_paid = float(row["paid"] or 0)
    except (ValueError, TypeError):
        existing_paid = 0.0

    try:
        total_amt = float(row["amount"] or 0)
    except (ValueError, TypeError):
        total_amt = 0.0

    paid = existing_paid + payment_amt
    due_date_val = row["due_date"] if "due_date" in row.keys() else None
    status = compute_status(row["status"], total_amt, paid, due_date_val)

    db = get_db()
    db.execute(
        """
        UPDATE ledger_entries
        SET paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (paid, status, entry_id),
    )

    # Sync debtor payment with customers table and transactions/orders tables safely
    if str(row["kind"]).lower() == "debtor":
        try:
            party_name = (row["party_name"] or "").strip() if "party_name" in row.keys() else ""
        except Exception:
            party_name = ""

        try:
            party_ref = (row["party_ref"] or "").strip() if "party_ref" in row.keys() else ""
        except Exception:
            party_ref = ""

        if (party_ref or party_name) and table_exists(db, "customers"):
            sql_parts = []
            params = [payment_amt]
            if party_ref:
                sql_parts.append("id = ?")
                params.append(party_ref)
                sql_parts.append("phone = ?")
                params.append(party_ref)
            if party_name:
                sql_parts.append("LOWER(name) = LOWER(?)")
                params.append(party_name)

            if sql_parts:
                try:
                    db.execute(
                        f"""
                        UPDATE customers
                        SET outstanding_balance = CASE WHEN outstanding_balance >= ? THEN outstanding_balance - ? ELSE 0.0 END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE {" OR ".join(sql_parts)}
                        """,
                        [payment_amt, payment_amt] + params[1:],
                    )
                except Exception as exc:
                    print(f"[ledger_service] Customer update notice: {exc}", file=sys.stderr)

        rem_balance = max(0.0, total_amt - paid)
        new_txn_status = "paid" if rem_balance <= 0.0001 else "partial"
        try:
            ref_num = (row["reference"] or "").strip() if "reference" in row.keys() else ""
        except Exception:
            ref_num = ""

        if ref_num:
            if table_exists(db, "sales_orders"):
                try:
                    db.execute(
                        """
                        UPDATE sales_orders
                        SET status = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE lpo_number = ?
                        """,
                        (new_txn_status if new_txn_status == "paid" else "submitted", ref_num),
                    )
                except Exception as exc:
                    print(f"[ledger_service] sales_orders update notice: {exc}", file=sys.stderr)

            if table_exists(db, "transactions"):
                try:
                    db.execute(
                        """
                        UPDATE transactions
                        SET balance = ?, amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE transaction_number = ?
                        """,
                        (rem_balance, paid, new_txn_status, ref_num),
                    )
                except Exception as exc:
                    print(f"[ledger_service] transactions update notice: {exc}", file=sys.stderr)

    elif str(row["kind"]).lower() == "creditor":
        # Reverse-sync a supplier payment back to its source purchase so the
        # purchases page and the creditors ledger never diverge.
        src_purchase_id = row["source_purchase_id"] if "source_purchase_id" in row.keys() else None
        if src_purchase_id and table_exists(db, "purchases"):
            try:
                db.execute(
                    """
                    UPDATE purchases
                    SET paid_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (paid, purchase_payment_status(total_amt, paid), src_purchase_id),
                )
            except Exception as exc:
                print(f"[ledger_service] purchase sync notice: {exc}", file=sys.stderr)

    db.commit()
    return get_entry(entry_id)


def create_payment_row(entry_id, payment):
    ref_val = payment.get("reference")
    note_val = payment.get("note")
    received_by_val = payment.get("receivedBy")
    staff_id_val = payment.get("staffId")
    created_at_val = payment.get("createdAt") or current_timestamp()

    try:
        amt = float(payment.get("amount") or 0)
    except (ValueError, TypeError):
        amt = 0.0

    get_db().execute(
        """
        INSERT INTO ledger_payments (
            id, entry_id, date, amount, method, reference, note,
            received_by, staff_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(payment["id"]),
            str(entry_id),
            str(payment["date"]),
            amt,
            str(payment["method"]),
            str(ref_val) if ref_val is not None else None,
            str(note_val) if note_val is not None else None,
            str(received_by_val).strip() if received_by_val else None,
            str(staff_id_val).strip() if staff_id_val else None,
            str(created_at_val),
        ),
    )


def purchase_payment_status(total, paid):
    try:
        t = float(total or 0)
        p = float(paid or 0)
    except (TypeError, ValueError):
        t, p = 0.0, 0.0
    if p <= 0.0:
        return "unpaid"
    if t - p <= 0.0001:
        return "paid"
    return "partially_paid"


def _row_get(row, name, default=None):
    try:
        val = row[name]
        return default if val is None else val
    except (KeyError, IndexError, TypeError):
        return default


def _close(a, b):
    try:
        return abs(float(a or 0) - float(b or 0)) <= 0.0001
    except (TypeError, ValueError):
        return False


def sync_creditor_from_purchase(purchase, existing=None, existing_loaded=False):
    """Upsert a creditor ledger entry mirroring an outstanding purchase payable.

    Idempotent and change-detecting: it only writes when the desired state differs
    from what is stored, so it is cheap to run on every creditors-page load.
    Returns the linked ledger entry id, or None when there is nothing to track.

    Pass existing/existing_loaded=True to skip the per-row lookup when the caller
    has already bulk-loaded the linked creditor entries (see reconcile below).
    """
    db = get_db()
    if not table_exists(db, "ledger_entries") or not table_exists(db, "purchases"):
        return None

    purchase_id = _row_get(purchase, "id")
    if not purchase_id:
        return None

    total = float(_row_get(purchase, "total_amount", 0) or 0)
    paid = float(_row_get(purchase, "paid_amount", 0) or 0)
    balance = max(0.0, total - paid)
    reference = _row_get(purchase, "purchase_number", "") or ""
    party_name = _row_get(purchase, "supplier_name", "") or ""
    party_ref = _row_get(purchase, "supplier_id")
    issue_date = _row_get(purchase, "purchase_date") or current_timestamp()[:10]
    due_date = _row_get(purchase, "expected_delivery_date") or issue_date
    category = _row_get(purchase, "category", "Inventory") or "Inventory"
    items_summary = _row_get(purchase, "items_summary", "") or ""
    raw_notes = _row_get(purchase, "notes", "") or ""

    if not existing_loaded:
        existing = db.execute(
            "SELECT * FROM ledger_entries WHERE source_purchase_id = ? LIMIT 1",
            (purchase_id,),
        ).fetchone()

    # Settled purchase: never open a new payable; if one already exists, close it out.
    if balance <= 0.0001:
        if not existing:
            return None
        settled_status = compute_status(existing["status"], total, total, due_date)
        if (
            str(_row_get(existing, "status", "")) == settled_status
            and _close(existing["paid"], total)
            and _close(existing["amount"], total)
            and str(_row_get(existing, "due_date", "")) == str(due_date)
        ):
            return existing["id"]
        db.execute(
            """
            UPDATE ledger_entries
            SET amount = ?, paid = ?, status = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (total, total, settled_status, due_date, existing["id"]),
        )
        db.commit()
        return existing["id"]

    note_parts = [f"Auto-synced from purchase {reference}".strip()]
    if items_summary:
        note_parts.append(str(items_summary))
    if raw_notes:
        note_parts.append(str(raw_notes))
    notes = " · ".join([part for part in note_parts if part])
    tags = json.dumps(["purchase", category])
    status = compute_status("open", total, paid, due_date)
    reference = reference or f"PO-{str(purchase_id)[:6]}"
    party_name = party_name or "Supplier"

    if existing:
        unchanged = (
            str(_row_get(existing, "reference", "")) == reference
            and str(_row_get(existing, "party_name", "")) == party_name
            and (_row_get(existing, "party_ref") or None) == (party_ref or None)
            and str(_row_get(existing, "issue_date", "")) == str(issue_date)
            and str(_row_get(existing, "due_date", "")) == str(due_date)
            and _close(existing["amount"], total)
            and _close(existing["paid"], paid)
            and str(_row_get(existing, "status", "")) == status
            and str(_row_get(existing, "notes", "") or "") == notes
            and str(_row_get(existing, "tags", "[]") or "[]") == tags
        )
        if unchanged:
            return existing["id"]
        db.execute(
            """
            UPDATE ledger_entries
            SET reference = ?, party_name = ?, party_ref = ?, issue_date = ?, due_date = ?,
                amount = ?, paid = ?, status = ?, notes = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                reference, party_name, party_ref, issue_date, due_date,
                total, paid, status, notes, tags, existing["id"],
            ),
        )
        db.commit()
        return existing["id"]

    entry_id = str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO ledger_entries (
            id, kind, reference, party_name, party_ref, issue_date, due_date,
            amount, currency, paid, status, notes, promise_to_pay, tags,
            source_purchase_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id, "creditor", reference, party_name, party_ref, issue_date, due_date,
            total, "UGX", paid, status, notes, None, tags,
            purchase_id, current_timestamp(), current_timestamp(),
        ),
    )
    db.commit()
    return entry_id


def reconcile_creditors_from_purchases():
    """Bulk-sync every outstanding (or already-linked) purchase to a creditor entry."""
    db = get_db()
    if not table_exists(db, "purchases") or not table_exists(db, "ledger_entries"):
        return {"synced": 0, "candidates": 0}

    rows = db.execute(
        """
        SELECT p.* FROM purchases p
        WHERE (p.total_amount - p.paid_amount) > 0.0001
           OR p.payment_status IN ('unpaid', 'partially_paid')
           OR EXISTS (
               SELECT 1 FROM ledger_entries le WHERE le.source_purchase_id = p.id
           )
        """
    ).fetchall()

    existing_map = {
        r["source_purchase_id"]: r
        for r in db.execute(
            "SELECT * FROM ledger_entries WHERE source_purchase_id IS NOT NULL"
        ).fetchall()
    }

    synced = 0
    for row in rows:
        try:
            entry_id = sync_creditor_from_purchase(
                row,
                existing=existing_map.get(_row_get(row, "id")),
                existing_loaded=True,
            )
            if entry_id:
                synced += 1
        except Exception as exc:
            print(f"[ledger_service] creditor reconcile notice: {exc}", file=sys.stderr)
    return {"synced": synced, "candidates": len(rows)}


def remove_creditor_for_purchase(purchase_id):
    """Delete the auto-synced creditor entry (and its payments) for a purchase."""
    db = get_db()
    if not table_exists(db, "ledger_entries"):
        return 0

    entry_ids = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM ledger_entries WHERE source_purchase_id = ?",
            (purchase_id,),
        ).fetchall()
    ]
    if not entry_ids:
        return 0

    placeholders = ", ".join("?" for _ in entry_ids)
    if table_exists(db, "ledger_payments"):
        db.execute(
            f"DELETE FROM ledger_payments WHERE entry_id IN ({placeholders})",
            entry_ids,
        )
    db.execute(
        f"DELETE FROM ledger_entries WHERE id IN ({placeholders})",
        entry_ids,
    )
    db.commit()
    return len(entry_ids)
