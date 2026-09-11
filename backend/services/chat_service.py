import uuid
import json
from datetime import datetime, timezone, timedelta
from services.database import get_central_db as get_db


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


PRESENCE_TIMEOUT_SECONDS = 60
TYPING_TIMEOUT_SECONDS = 8


def _ensure_chat_tables(db):
    pass


# --- Chat Users ---
def get_chat_users():
    return get_db().execute("SELECT * FROM chat_users").fetchall()


def get_chat_user(user_id):
    return get_db().execute("SELECT * FROM chat_users WHERE id = ?", (user_id,)).fetchone()


CHAT_COLORS = [
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-cyan-600",
    "from-violet-500 to-fuchsia-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-blue-600",
]


def chat_color_for_id(user_id):
    try:
        idx = int(str(user_id)) % len(CHAT_COLORS)
    except ValueError:
        idx = sum(ord(c) for c in str(user_id)) % len(CHAT_COLORS)
    return CHAT_COLORS[idx]


def add_user_to_default_channels(db, user_id):
    ensure_default_chat_channels(db)
    channels = db.execute(
        "SELECT id FROM chat_channels WHERE type IN ('group', 'broadcast')"
    ).fetchall()
    for channel in channels:
        db.execute(
            """
            INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id)
            VALUES (?, ?, ?)
            """,
            (str(uuid.uuid4()), channel["id"], str(user_id)),
        )


def ensure_default_chat_channels(db=None):
    db = db or get_db()
    existing = db.execute("SELECT id FROM chat_channels WHERE id = 'general'").fetchone()
    if existing:
        return

    db.execute(
        """
        INSERT OR IGNORE INTO chat_channels (id, name, type, emoji, description)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("general", "General", "group", "💬", "Company-wide chatroom"),
    )


def ensure_all_users_in_general_channel(db=None):
    """Ensures all active users are members of the general channel."""
    db = db or get_db()
    ensure_default_chat_channels(db)
    
    # Get all active chat users
    chat_users = db.execute("SELECT id FROM chat_users").fetchall()
    general_channel = db.execute("SELECT id FROM chat_channels WHERE id = 'general'").fetchone()
    
    if not general_channel:
        return
    
    # Add each user to the general channel if not already a member
    for user in chat_users:
        user_id = user["id"]
        db.execute(
            """
            INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id)
            VALUES (?, ?, ?)
            """,
            (str(uuid.uuid4()), "general", str(user_id)),
        )


def ensure_chat_user_for_account(user, *, db=None):
    if not user:
        return None

    db = db or get_db()
    user_id = str(user["id"])
    name = user["name"]
    role = user["role"]
    existing = db.execute("SELECT id FROM chat_users WHERE id = ?", (user_id,)).fetchone()

    if existing:
        db.execute(
            """
            UPDATE chat_users
            SET name = ?, role = ?, online = 1
            WHERE id = ?
            """,
            (name, role, user_id),
        )
    else:
        db.execute(
            """
            INSERT INTO chat_users (id, name, role, color, online)
            VALUES (?, ?, ?, ?, 1)
            """,
            (user_id, name, role, chat_color_for_id(user_id)),
        )

    add_user_to_default_channels(db, user_id)
    return get_chat_user(user_id)


def ensure_chat_users_for_accounts(db=None):
    db = db or get_db()
    users = db.execute(
        "SELECT id, name, role FROM users WHERE is_active = 1"
    ).fetchall()
    for user in users:
        ensure_chat_user_for_account(user, db=db)


def remove_chat_user(user_id, *, db=None):
    db = db or get_db()
    chat_user_id = str(user_id)
    db.execute("DELETE FROM chat_channel_members WHERE user_id = ?", (chat_user_id,))
    db.execute("UPDATE chat_users SET online = 0 WHERE id = ?", (chat_user_id,))


# --- Chat Channels ---
def get_chat_channels():
    return get_db().execute("SELECT * FROM chat_channels").fetchall()


def get_chat_channel(channel_id):
    return get_db().execute("SELECT * FROM chat_channels WHERE id = ?", (channel_id,)).fetchone()


def get_channel_members(channel_id):
    return get_db().execute(
        "SELECT user_id FROM chat_channel_members WHERE channel_id = ?", (channel_id,)
    ).fetchall()


def get_channel_members_enriched(channel_id):
    db = get_db()
    rows = db.execute(
        """
        SELECT
            cu.id AS user_id,
            cu.name AS user_name,
            cu.role AS user_role,
            cu.color AS user_color,
            cu.online AS online,
            cu.last_seen AS last_seen,
            e.id AS employee_id,
            e.code AS employee_code,
            e.name AS employee_name,
            e.department AS employee_department,
            e.role AS employee_position
        FROM chat_channel_members ccm
        JOIN chat_users cu ON ccm.user_id = cu.id
        LEFT JOIN employees e ON lower(e.email) = lower(cu.name) OR e.id = cu.id
        WHERE ccm.channel_id = ?
        ORDER BY cu.name ASC
        """,
        (channel_id,),
    ).fetchall()
    result = []
    for r in rows:
        def get(col, default=None):
            try:
                v = r[col]
                return v if v is not None else default
            except (KeyError, IndexError):
                return default
        employee = None
        if get("employee_id"):
            employee = {
                "id": get("employee_id"),
                "code": get("employee_code"),
                "name": get("employee_name") or get("user_name"),
                "department": get("employee_department"),
                "position": get("employee_position"),
            }
        result.append({
            "userId": get("user_id"),
            "name": get("user_name"),
            "role": get("user_role"),
            "color": get("user_color"),
            "online": bool(get("online", 1)),
            "lastSeen": get("last_seen"),
            "employee": employee,
        })
    return result


def get_active_employees_directory():
    db = get_db()
    rows = db.execute(
        """
        SELECT
            cu.id AS user_id,
            cu.name AS user_name,
            cu.role AS user_role,
            cu.color AS user_color,
            cu.online AS online,
            cu.last_seen AS last_seen,
            e.id AS employee_id,
            e.code AS employee_code,
            e.name AS employee_name,
            e.department AS employee_department,
            e.role AS employee_position
        FROM chat_users cu
        LEFT JOIN employees e ON e.id = cu.id OR lower(e.email) = lower(cu.name)
        WHERE cu.online IS NOT NULL
        ORDER BY COALESCE(e.name, cu.name) ASC
        """,
    ).fetchall()
    result = []
    for r in rows:
        def get(col, default=None):
            try:
                v = r[col]
                return v if v is not None else default
            except (KeyError, IndexError):
                return default
        employee = None
        if get("employee_id") or get("employee_code"):
            employee = {
                "id": get("employee_id"),
                "code": get("employee_code"),
                "name": get("employee_name") or get("user_name"),
                "department": get("employee_department"),
                "position": get("employee_position"),
            }
        result.append({
            "userId": get("user_id"),
            "name": get("user_name"),
            "role": get("user_role"),
            "color": get("user_color"),
            "online": bool(get("online", 1)),
            "lastSeen": get("last_seen"),
            "employee": employee,
        })
    return result


def create_chat_channel(channel_data):
    db = get_db()
    channel_id = channel_data.get("id") or str(uuid.uuid4())
    member_ids = [str(user_id) for user_id in (channel_data.get("member_ids") or channel_data.get("memberIds") or [])]
    if member_ids:
        placeholders = ",".join("?" for _ in member_ids)
        existing_rows = db.execute(
            f"SELECT id FROM chat_users WHERE id IN ({placeholders})",
            member_ids,
        ).fetchall()
        existing_ids = {row["id"] for row in existing_rows}
        missing_ids = [user_id for user_id in member_ids if user_id not in existing_ids]
        if missing_ids:
            raise ValueError("Channel members must be existing employees.")

    db.execute(
        """
        INSERT INTO chat_channels (id, name, type, emoji, description)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            channel_id,
            channel_data.get("name"),
            channel_data.get("type", "group"),
            channel_data.get("emoji", "💬"),
            channel_data.get("description"),
        ),
    )

    # Add members if provided
    if member_ids:
        for user_id in member_ids:
            db.execute(
                """
                INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id)
                VALUES (?, ?, ?)
                """,
                (str(uuid.uuid4()), channel_id, user_id),
            )
    db.commit()
    return get_chat_channel(channel_id)


def _resolve_chat_user_id(db, user_id):
    uid = str(user_id)
    cu = db.execute("SELECT id FROM chat_users WHERE id = ?", (uid,)).fetchone()
    if cu:
        return cu["id"]
    u = db.execute("SELECT id, name, role FROM users WHERE id = ?", (uid,)).fetchone()
    if u:
        ensure_chat_user_for_account(u, db=db)
        return str(u["id"])
    emp = db.execute("SELECT id, name, role, email FROM employees WHERE id = ? OR lower(email) = lower(?)", (uid, uid)).fetchone()
    if emp:
        u_acc = db.execute("SELECT id, name, role FROM users WHERE lower(email) = lower(?)", (emp["email"],)).fetchone()
        if u_acc:
            ensure_chat_user_for_account(u_acc, db=db)
            return str(u_acc["id"])
        else:
            ensure_chat_user_for_account({"id": emp["id"], "name": emp["name"], "role": emp["role"]}, db=db)
            return str(emp["id"])
    return uid


def get_or_create_dm_channel(user1_id, user2_id):
    db = get_db()
    u1 = _resolve_chat_user_id(db, user1_id)
    u2 = _resolve_chat_user_id(db, user2_id)
    if u1 == u2:
        raise ValueError("Cannot create a direct message with yourself.")

    u1_sorted, u2_sorted = sorted([u1, u2])
    dm_id = f"dm_{u1_sorted}_{u2_sorted}"

    existing = get_chat_channel(dm_id)
    if existing:
        db.execute(
            "INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), dm_id, u1),
        )
        db.execute(
            "INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), dm_id, u2),
        )
        db.commit()
        return get_chat_channel(dm_id)

    u1_row = db.execute("SELECT name FROM chat_users WHERE id = ?", (u1,)).fetchone()
    u2_row = db.execute("SELECT name FROM chat_users WHERE id = ?", (u2,)).fetchone()
    name1 = u1_row["name"] if u1_row else "Employee"
    name2 = u2_row["name"] if u2_row else "Employee"

    db.execute(
        """
        INSERT INTO chat_channels (id, name, type, emoji, description)
        VALUES (?, ?, 'dm', '💬', ?)
        """,
        (dm_id, f"{name1} & {name2}", f"Direct message between {name1} and {name2}"),
    )
    db.execute(
        "INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), dm_id, u1),
    )
    db.execute(
        "INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), dm_id, u2),
    )
    db.commit()
    return get_chat_channel(dm_id)


def update_chat_channel(channel_id, update_data):
    """Update channel name, emoji, and/or description."""
    db = get_db()
    channel = get_chat_channel(channel_id)
    if not channel:
        return None
    
    name = update_data.get("name") or channel["name"]
    emoji = update_data.get("emoji") or channel["emoji"]
    description = update_data.get("description") or channel["description"]
    
    db.execute(
        """
        UPDATE chat_channels
        SET name = ?, emoji = ?, description = ?
        WHERE id = ?
        """,
        (name, emoji, description, channel_id),
    )
    db.commit()
    return get_chat_channel(channel_id)


def delete_chat_channel(channel_id):
    """Delete a channel and all its members/messages."""
    db = get_db()
    channel = get_chat_channel(channel_id)
    if not channel:
        return False
    
    # Prevent deletion of the general channel
    if channel_id == "general":
        raise ValueError("Cannot delete the general channel.")
    
    db.execute("DELETE FROM chat_channel_members WHERE channel_id = ?", (channel_id,))
    db.execute("DELETE FROM chat_messages WHERE channel_id = ?", (channel_id,))
    db.execute("DELETE FROM chat_channels WHERE id = ?", (channel_id,))
    db.commit()
    return True


def add_user_to_channel(channel_id, user_id):
    """Add a user to a channel."""
    db = get_db()
    user_id_str = _resolve_chat_user_id(db, user_id)
    
    # Check if user exists
    user = db.execute("SELECT id FROM chat_users WHERE id = ?", (user_id_str,)).fetchone()
    if not user:
        raise ValueError("User not found.")
    
    # Check if channel exists
    channel = get_chat_channel(channel_id)
    if not channel:
        raise ValueError("Channel not found.")
    
    db.execute(
        """
        INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id)
        VALUES (?, ?, ?)
        """,
        (str(uuid.uuid4()), channel_id, user_id_str),
    )
    db.commit()
    return True


def remove_user_from_channel(channel_id, user_id):
    """Remove a user from a channel."""
    db = get_db()
    user_id_str = str(user_id)
    
    # Prevent removing all users from general channel
    if channel_id == "general":
        remaining = db.execute(
            "SELECT COUNT(*) as count FROM chat_channel_members WHERE channel_id = ? AND user_id != ?",
            (channel_id, user_id_str),
        ).fetchone()
        if remaining["count"] == 0:
            raise ValueError("Cannot remove the last user from the general channel.")
    
    db.execute(
        "DELETE FROM chat_channel_members WHERE channel_id = ? AND user_id = ?",
        (channel_id, user_id_str),
    )
    db.commit()
    return True


def ensure_user_in_channel(user_id, channel_id):
    """Ensure a user can send messages in a channel. Auto-adds to public channels if needed."""
    db = get_db()
    user_id_str = str(user_id)
    
    # Get the channel
    channel = get_chat_channel(channel_id)
    if not channel:
        raise ValueError("Channel not found.")
    
    # Get or create the chat user if it doesn't exist
    user = db.execute("SELECT id FROM chat_users WHERE id = ?", (user_id_str,)).fetchone()
    if not user:
        raise ValueError("User not found in chat system.")
    
    # Check if user is already a member of the channel
    is_member = db.execute(
        "SELECT id FROM chat_channel_members WHERE channel_id = ? AND user_id = ?",
        (channel_id, user_id_str)
    ).fetchone()
    
    # Auto-add to public/group channels
    if not is_member and channel["type"] in ("group", "broadcast"):
        db.execute(
            """
            INSERT OR IGNORE INTO chat_channel_members (id, channel_id, user_id)
            VALUES (?, ?, ?)
            """,
            (str(uuid.uuid4()), channel_id, user_id_str),
        )
        db.commit()
    elif not is_member and channel["type"] == "dm":
        raise ValueError("User is not a member of this direct message channel.")
    
    return True


# --- Chat Messages ---
def get_channel_messages(channel_id):
    return get_db().execute(
        "SELECT * FROM chat_messages WHERE channel_id = ? ORDER BY created_at ASC", (channel_id,)
    ).fetchall()


def get_chat_message(message_id):
    return get_db().execute(
        "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
    ).fetchone()


def create_chat_message(msg_data):
    db = get_db()
    msg_id = msg_data.get("id") or str(uuid.uuid4())
    now = current_timestamp()

    db.execute(
        """
        INSERT INTO chat_messages
        (id, channel_id, author_id, body, mentions, attachments, reactions, reply_to, edited, pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            msg_id,
            msg_data.get("channel_id"),
            msg_data.get("author_id"),
            msg_data.get("body", ""),
            msg_data.get("mentions", "[]"),
            msg_data.get("attachments", "[]"),
            msg_data.get("reactions", "[]"),
            msg_data.get("reply_to"),
            0,
            0,
            msg_data.get("created_at", now),
            msg_data.get("updated_at", now),
        ),
    )
    db.commit()
    return get_chat_message(msg_id)


def update_chat_message(msg_id, updates):
    db = get_db()

    # Update fields that are allowed
    allowed_updates = ["body", "pinned", "reactions", "edited", "updated_at"]
    set_clause = []
    params = []

    for field in allowed_updates:
        if field in updates:
            db_field = field
            if field == "body":
                set_clause.append("edited = 1")  # Mark as edited if body changed
            set_clause.append(f"{db_field} = ?")
            params.append(updates[field])

    # Always update updated_at
    if "updated_at" not in updates:
        set_clause.append("updated_at = CURRENT_TIMESTAMP")

    if not set_clause:
        return get_chat_message(msg_id)

    params.append(msg_id)
    db.execute(
        f"UPDATE chat_messages SET {', '.join(set_clause)} WHERE id = ?", params
    )
    db.commit()
    return get_chat_message(msg_id)


def delete_chat_message(msg_id):
    db = get_db()
    cursor = db.execute("DELETE FROM chat_messages WHERE id = ?", (msg_id,))
    db.commit()
    return cursor.rowcount > 0


# --- Presence & Typing ---
def heartbeat_presence(user_id):
    db = get_db()
    user_id_str = str(user_id)
    now = current_timestamp()
    db.execute(
        "UPDATE chat_users SET online = 1, last_seen = ? WHERE id = ?",
        (now, user_id_str),
    )
    try:
        db.execute("ALTER TABLE chat_users ADD COLUMN last_seen TEXT")
    except Exception:
        pass
    db.execute(
        "UPDATE chat_users SET online = 1, last_seen = ? WHERE id = ?",
        (now, user_id_str),
    )
    db.commit()
    return get_chat_user(user_id_str)


def set_user_offline(user_id):
    db = get_db()
    user_id_str = str(user_id)
    now = current_timestamp()
    try:
        db.execute("ALTER TABLE chat_users ADD COLUMN last_seen TEXT")
    except Exception:
        pass
    db.execute(
        "UPDATE chat_users SET online = 0, last_seen = ? WHERE id = ?",
        (now, user_id_str),
    )
    db.commit()
    return True


def cleanup_stale_presence():
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=PRESENCE_TIMEOUT_SECONDS)).isoformat()
    try:
        db.execute("ALTER TABLE chat_users ADD COLUMN last_seen TEXT")
    except Exception:
        pass
    db.execute(
        "UPDATE chat_users SET online = 0 WHERE (last_seen IS NULL OR last_seen < ?) AND online = 1",
        (cutoff,),
    )
    db.commit()


def set_typing(user_id, channel_id, is_typing):
    db = get_db()
    user_id_str = str(user_id)
    now = current_timestamp()
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=TYPING_TIMEOUT_SECONDS)).isoformat()

    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_typing (
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                is_typing INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, channel_id),
                FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
                FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
            )
            """
        )
    except Exception:
        pass

    if is_typing:
        db.execute(
            """
            INSERT INTO chat_typing (user_id, channel_id, is_typing, expires_at, updated_at)
            VALUES (?, ?, 1, ?, ?)
            ON CONFLICT(user_id, channel_id) DO UPDATE SET
                is_typing = 1,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (user_id_str, channel_id, expires_at, now),
        )
    else:
        db.execute(
            "DELETE FROM chat_typing WHERE user_id = ? AND channel_id = ?",
            (user_id_str, channel_id),
        )
    db.commit()
    return True


def get_typing_in_channel(channel_id):
    db = get_db()
    now = current_timestamp()
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_typing (
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                is_typing INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, channel_id),
                FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
                FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
            )
            """
        )
    except Exception:
        pass
    rows = db.execute(
        """
        SELECT t.user_id, t.updated_at
        FROM chat_typing t
        WHERE t.channel_id = ?
          AND t.is_typing = 1
          AND t.expires_at > ?
        ORDER BY t.updated_at DESC
        """,
        (channel_id, now),
    ).fetchall()
    return [{"userId": r["user_id"], "updatedAt": r["updated_at"]} for r in rows]


def cleanup_stale_typing():
    db = get_db()
    now = current_timestamp()
    try:
        db.execute("DELETE FROM chat_typing WHERE expires_at < ?", (now,))
        db.commit()
    except Exception:
        pass


# --- Read Receipts & Unread ---
def mark_channel_read(user_id, channel_id):
    db = get_db()
    user_id_str = str(user_id)
    now = current_timestamp()

    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_read_receipts (
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                last_read_at TEXT NOT NULL,
                last_message_id TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, channel_id),
                FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
                FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
            )
            """
        )
    except Exception:
        pass

    last_msg = db.execute(
        "SELECT id FROM chat_messages WHERE channel_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        (channel_id,),
    ).fetchone()
    last_msg_id = last_msg["id"] if last_msg else None

    db.execute(
        """
        INSERT INTO chat_read_receipts (user_id, channel_id, last_read_at, last_message_id, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, channel_id) DO UPDATE SET
            last_read_at = excluded.last_read_at,
            last_message_id = excluded.last_message_id,
            updated_at = excluded.updated_at
        """,
        (user_id_str, channel_id, now, last_msg_id, now),
    )
    db.commit()
    return {"lastReadAt": now, "lastMessageId": last_msg_id}


def get_channel_read_state(channel_id):
    db = get_db()
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_read_receipts (
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                last_read_at TEXT NOT NULL,
                last_message_id TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, channel_id),
                FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
                FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
            )
            """
        )
    except Exception:
        pass
    rows = db.execute(
        "SELECT user_id, last_read_at, last_message_id, updated_at FROM chat_read_receipts WHERE channel_id = ?",
        (channel_id,),
    ).fetchall()
    return [
        {
            "userId": r["user_id"],
            "lastReadAt": r["last_read_at"],
            "lastMessageId": r["last_message_id"],
            "updatedAt": r["updated_at"],
        }
        for r in rows
    ]


def get_unread_counts_for_user(user_id):
    db = get_db()
    user_id_str = str(user_id)

    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_read_receipts (
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                last_read_at TEXT NOT NULL,
                last_message_id TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, channel_id),
                FOREIGN KEY (user_id) REFERENCES chat_users(id) ON DELETE CASCADE,
                FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
            )
            """
        )
    except Exception:
        pass

    memberships = db.execute(
        "SELECT channel_id FROM chat_channel_members WHERE user_id = ?",
        (user_id_str,),
    ).fetchall()

    result = {}
    for m in memberships:
        cid = m["channel_id"]
        receipt = db.execute(
            "SELECT last_read_at FROM chat_read_receipts WHERE user_id = ? AND channel_id = ?",
            (user_id_str, cid),
        ).fetchone()
        if receipt and receipt["last_read_at"]:
            count = db.execute(
                "SELECT COUNT(*) AS c FROM chat_messages WHERE channel_id = ? AND created_at > ? AND author_id != ?",
                (cid, receipt["last_read_at"], user_id_str),
            ).fetchone()["c"]
        else:
            count = db.execute(
                "SELECT COUNT(*) AS c FROM chat_messages WHERE channel_id = ? AND author_id != ?",
                (cid, user_id_str),
            ).fetchone()["c"]
        result[cid] = int(count or 0)

    return result
