
import uuid
from datetime import datetime, timezone
from services.database import get_db


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


def get_loyalty_tiers():
    return get_db().execute(
        """
        SELECT * FROM loyalty_tiers ORDER BY min_points ASC
        """
    ).fetchall()


def get_loyalty_tier(tier_id):
    return get_db().execute(
        "SELECT * FROM loyalty_tiers WHERE id = ?",
        (tier_id,)
    ).fetchone()


def get_tier_for_points(points):
    """Get the tier that matches the given points
    """
    return get_db().execute(
        """
        SELECT * FROM loyalty_tiers
        WHERE min_points <= ?
        ORDER BY min_points DESC
        LIMIT 1
        """,
        (points,)
    ).fetchone()


def create_loyalty_tier(tier_data):
    db = get_db()
    tier_id = tier_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()
    db.execute(
        """
        INSERT INTO loyalty_tiers (id, name, min_points, max_points, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tier_id,
            tier_data["name"],
            tier_data.get("minPoints", 0),
            tier_data.get("maxPoints"),
            tier_data.get("color", "#0EA5E9"),
            now,
            now
        )
    )
    db.commit()
    return get_loyalty_tier(tier_id)


def update_loyalty_tier(tier_id, tier_data):
    db = get_db()
    now = current_timestamp()
    update_fields = []
    params = []
    allowed_fields = ["name", "minPoints", "maxPoints", "color"]
    field_mapping = {
        "minPoints": "min_points",
        "maxPoints": "max_points"
    }
    for field in allowed_fields:
        if field in tier_data:
            db_field = field_mapping.get(field, field)
            update_fields.append(f"{db_field} = ?")
            params.append(tier_data[field])
    if not update_fields:
        return None
    update_fields.append("updated_at = ?")
    params.append(now)
    params.append(tier_id)
    db.execute(
        f"UPDATE loyalty_tiers SET {', '.join(update_fields)} WHERE id = ?",
        params
    )
    db.commit()
    return get_loyalty_tier(tier_id)


def delete_loyalty_tier(tier_id):
    db = get_db()
    cursor = db.execute("DELETE FROM loyalty_tiers WHERE id = ?", (tier_id,))
    db.commit()
    return cursor.rowcount

