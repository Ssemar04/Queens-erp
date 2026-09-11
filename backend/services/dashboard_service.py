from datetime import datetime, timezone
from services.database import get_db, get_branch_db


def get_dashboard_metrics():
    rows = get_db().execute(
        """
        SELECT key, value
        FROM dashboard_metrics
        """
    ).fetchall()

    return {row["key"]: row["value"] for row in rows}


def get_branch_dashboard_stats(branch_id):
    db = get_branch_db(branch_id)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    item_count_row = db.execute(
        """
        SELECT COUNT(*) AS count FROM items WHERE branch_id = ? OR 1=1
        """,
        (branch_id,)
    ).fetchone()
    items_count = item_count_row["count"]

    total_value_row = db.execute(
        """
        SELECT COALESCE(SUM(cost_price * current_stock), 0) AS total_value
        FROM items WHERE branch_id = ? OR 1=1
        """,
        (branch_id,)
    ).fetchone()
    total_value = total_value_row["total_value"]

    low_stock_row = db.execute(
        """
        SELECT COUNT(*) AS count FROM items WHERE (branch_id = ? OR 1=1)
        AND current_stock > 0 AND current_stock <= reorder_point
        """,
        (branch_id,)
    ).fetchone()
    low_stock_count = low_stock_row["count"]

    out_of_stock_row = db.execute(
        """
        SELECT COUNT(*) AS count FROM items WHERE (branch_id = ? OR 1=1)
        AND current_stock = 0
        """,
        (branch_id,)
    ).fetchone()
    out_of_stock_count = out_of_stock_row["count"]

    sales_count_row = db.execute(
        """
        SELECT COUNT(*) AS count FROM transactions WHERE (branch_id = ? OR 1=1)
        AND transaction_type = 'sale'
        """,
        (branch_id,)
    ).fetchone()
    sales_count = sales_count_row["count"]

    daily_value_row = db.execute(
        """
        SELECT COALESCE(SUM(total_amount), 0) AS daily_value
        FROM transactions WHERE (branch_id = ? OR 1=1)
        AND transaction_type = 'sale'
        AND transaction_date >= ?
        """,
        (branch_id, today_start)
    ).fetchone()
    daily_transactions_value = daily_value_row["daily_value"]

    return {
        "items_count": items_count,
        "total_value": total_value,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "sales_count": sales_count,
        "daily_transactions_value": daily_transactions_value,
    }
