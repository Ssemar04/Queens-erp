from datetime import date, datetime, timezone
import uuid

from services.database import get_db


VALID_TYPES = {
    "low_stock",
    "zero_stock",
    "po_reminder",
    "po_overdue",
    "request_update",
    "system",
}

DEFAULT_PREFS = {
    "low_stock": True,
    "zero_stock": True,
    "po_reminder": True,
    "po_overdue": True,
    "request_update": True,
    "system": True,
}


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _user_id(user):
    return str(user["id"])


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except (ValueError, TypeError, AttributeError):
        try:
            return date.fromisoformat(str(value)[:10])
        except (ValueError, TypeError, AttributeError):
            return None


def ensure_default_preferences(user):
    db = get_db()
    for notification_type, enabled in DEFAULT_PREFS.items():
        db.execute(
            """
            INSERT OR IGNORE INTO notification_preferences (user_id, type, enabled)
            VALUES (?, ?, ?)
            """,
            (_user_id(user), notification_type, int(enabled)),
        )
    db.commit()


def get_preferences(user):
    ensure_default_preferences(user)
    rows = get_db().execute(
        """
        SELECT type, enabled
        FROM notification_preferences
        WHERE user_id = ?
        """,
        (_user_id(user),),
    ).fetchall()
    prefs = dict(DEFAULT_PREFS)
    for row in rows:
        prefs[row["type"]] = bool(row["enabled"])
    return prefs


def update_preferences(user, updates):
    db = get_db()
    ensure_default_preferences(user)
    for notification_type, enabled in (updates or {}).items():
        if notification_type not in VALID_TYPES:
            continue
        db.execute(
            """
            INSERT INTO notification_preferences (user_id, type, enabled, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, type) DO UPDATE SET
                enabled = excluded.enabled,
                updated_at = excluded.updated_at
            """,
            (_user_id(user), notification_type, int(bool(enabled)), current_timestamp()),
        )
    db.commit()
    return get_preferences(user)


def _add_generated(user, notification_type, title, message, link, reference_id, source_key):
    if not get_preferences(user).get(notification_type, True):
        return

    get_db().execute(
        """
        INSERT OR IGNORE INTO notifications (
            id, user_id, type, title, message, is_read, link, reference_id, source_key, created_at
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        """,
        (
            f"notif-{uuid.uuid4()}",
            _user_id(user),
            notification_type,
            title,
            message,
            link,
            reference_id,
            source_key,
            current_timestamp(),
        ),
    )


def generate_alerts(user):
    db = get_db()

    items = db.execute(
        """
        SELECT id, sku, name, current_stock, reorder_point
        FROM items
        WHERE status = 'active'
          AND reorder_point >= 0
          AND current_stock <= reorder_point
        """
    ).fetchall()
    for item in items:
        stock = int(item["current_stock"] or 0)
        reorder_point = int(item["reorder_point"] or 0)
        if stock <= 0:
            _add_generated(
                user,
                "zero_stock",
                f"Out of stock: {item['name']}",
                f"{item['sku']} is at zero. Reorder or transfer stock before taking new sales.",
                f"/app/catalog?item={item['id']}",
                item["id"],
                f"stock:zero:{item['id']}",
            )
        elif stock <= reorder_point:
            _add_generated(
                user,
                "low_stock",
                f"Low stock: {item['name']}",
                f"{item['sku']} has {stock} left against a reorder point of {reorder_point}.",
                f"/app/catalog?item={item['id']}",
                item["id"],
                f"stock:low:{item['id']}",
            )

    today = datetime.now(timezone.utc).date()
    orders = db.execute(
        """
        SELECT id, lpo_number, customer_name, date_to_be_delivered, status
        FROM sales_orders
        WHERE status NOT IN ('delivered', 'cancelled')
          AND date_to_be_delivered IS NOT NULL
        """
    ).fetchall()
    for order in orders:
        due = _parse_date(order["date_to_be_delivered"])
        if not due:
            continue
        days_until = (due - today).days
        if days_until < 0:
            _add_generated(
                user,
                "po_overdue",
                f"Delivery overdue: {order['lpo_number']}",
                f"{order['customer_name']} was due {abs(days_until)} day{'s' if abs(days_until) != 1 else ''} ago.",
                "/app/orders",
                order["id"],
                f"sales-order:overdue:{order['id']}",
            )
        elif days_until <= 3:
            when = "today" if days_until == 0 else f"in {days_until} day{'s' if days_until != 1 else ''}"
            _add_generated(
                user,
                "po_reminder",
                f"Delivery due soon: {order['lpo_number']}",
                f"{order['customer_name']} is due {when}.",
                "/app/orders",
                order["id"],
                f"sales-order:soon:{order['id']}",
            )

    db.commit()


def list_notifications(user):
    generate_alerts(user)
    return get_db().execute(
        """
        SELECT *
        FROM notifications
        WHERE user_id = ?
          AND dismissed_at IS NULL
        ORDER BY is_read ASC, created_at DESC
        """,
        (_user_id(user),),
    ).fetchall()


def mark_as_read(user, notification_id):
    cursor = get_db().execute(
        """
        UPDATE notifications
        SET is_read = 1
        WHERE id = ?
          AND user_id = ?
          AND dismissed_at IS NULL
        """,
        (notification_id, _user_id(user)),
    )
    get_db().commit()
    return cursor.rowcount


def mark_all_as_read(user):
    cursor = get_db().execute(
        """
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ?
          AND dismissed_at IS NULL
          AND is_read = 0
        """,
        (_user_id(user),),
    )
    get_db().commit()
    return cursor.rowcount


def dismiss_notification(user, notification_id):
    cursor = get_db().execute(
        """
        UPDATE notifications
        SET dismissed_at = ?
        WHERE id = ?
          AND user_id = ?
          AND dismissed_at IS NULL
        """,
        (current_timestamp(), notification_id, _user_id(user)),
    )
    get_db().commit()
    return cursor.rowcount
