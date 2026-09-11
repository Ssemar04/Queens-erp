#!/usr/bin/env python3
"""
Test suite for chat functionality
Verifies that all members can send and receive messages
"""

import json
import sys
from flask import Flask
from services.database import init_db, get_db
from routes.chat_routes import chat_bp
from services.chat_service import (
    ensure_chat_users_for_accounts,
    ensure_default_chat_channels,
    ensure_all_users_in_general_channel,
    get_chat_users,
    get_chat_channels,
    get_channel_messages,
    create_chat_message,
)

# Setup test app
app = Flask(__name__)
app.register_blueprint(chat_bp)
app.config['DATABASE'] = ':memory:'

def setup_test_db():
    """Initialize test database"""
    with app.app_context():
        init_db()
        
        # Insert test users directly
        db = get_db()
        test_users = [
            ("user1", "Alice", "manager", "from-emerald-500 to-teal-600"),
            ("user2", "Bob", "staff", "from-sky-500 to-cyan-600"),
            ("user3", "Charlie", "staff", "from-violet-500 to-fuchsia-600"),
        ]
        
        for user_id, name, role, color in test_users:
            db.execute(
                """
                INSERT OR IGNORE INTO chat_users (id, name, role, color, online)
                VALUES (?, ?, ?, ?, 1)
                """,
                (user_id, name, role, color)
            )
        
        # Ensure default channels
        ensure_default_chat_channels(db)
        # Add all users to general channel
        ensure_all_users_in_general_channel(db)
        db.commit()

def test_users_exist():
    """Test that chat users were created"""
    with app.app_context():
        users = get_chat_users()
        print(f"✓ Found {len(users)} chat users")
        for u in users:
            print(f"  - {u['name']} ({u['role']})")
        assert len(users) >= 3, "Expected at least 3 users"

def test_general_channel_exists():
    """Test that general channel exists"""
    with app.app_context():
        channels = get_chat_channels()
        general = next((c for c in channels if c['id'] == 'general'), None)
        assert general is not None, "General channel not found"
        print(f"✓ General channel exists")

def test_users_in_general_channel():
    """Test that all users are members of general channel"""
    with app.app_context():
        db = get_db()
        members = db.execute(
            "SELECT user_id FROM chat_channel_members WHERE channel_id = 'general'"
        ).fetchall()
        print(f"✓ {len(members)} users in general channel")
        assert len(members) >= 3, "Expected at least 3 users in general channel"

def test_send_message():
    """Test that users can send messages"""
    with app.app_context():
        msg = create_chat_message({
            "channel_id": "general",
            "author_id": "user1",
            "body": "Hello from Alice!",
            "mentions": json.dumps([]),
            "attachments": json.dumps([]),
            "reactions": json.dumps([]),
        })
        print(f"✓ Message sent by user1: {msg['body']}")
        assert msg['body'] == "Hello from Alice!"
        assert msg['author_id'] == "user1"
        assert msg['channel_id'] == "general"

def test_all_members_can_send():
    """Test that all members can send messages"""
    with app.app_context():
        for user_id, name in [("user1", "Alice"), ("user2", "Bob"), ("user3", "Charlie")]:
            msg = create_chat_message({
                "channel_id": "general",
                "author_id": user_id,
                "body": f"Message from {name}",
                "mentions": json.dumps([]),
                "attachments": json.dumps([]),
                "reactions": json.dumps([]),
            })
            print(f"✓ {name} sent message")
            assert msg['author_id'] == user_id

def test_receive_messages():
    """Test that messages can be retrieved"""
    with app.app_context():
        # Send a few messages
        for i in range(3):
            create_chat_message({
                "channel_id": "general",
                "author_id": f"user{(i % 3) + 1}",
                "body": f"Test message {i+1}",
                "mentions": json.dumps([]),
                "attachments": json.dumps([]),
                "reactions": json.dumps([]),
            })
        
        # Retrieve messages
        messages = get_channel_messages("general")
        print(f"✓ Retrieved {len(messages)} messages from general channel")
        assert len(messages) >= 3, "Expected at least 3 messages"

def test_message_ordering():
    """Test that messages are returned in chronological order"""
    with app.app_context():
        messages = get_channel_messages("general")
        if len(messages) > 1:
            for i in range(len(messages) - 1):
                assert messages[i]['created_at'] <= messages[i+1]['created_at'], \
                    "Messages not in chronological order"
            print(f"✓ Messages are in correct chronological order")

def test_http_send_message():
    """Test sending message via HTTP API"""
    with app.test_client() as client:
        payload = {
            "channelId": "general",
            "authorId": "user1",
            "body": "HTTP test message",
            "mentions": [],
            "attachments": [],
        }
        response = client.post('/api/chat/messages', 
                              json=payload,
                              content_type='application/json')
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.data}"
        data = json.loads(response.data)
        print(f"✓ HTTP message created: {data['body']}")

def test_http_get_messages():
    """Test retrieving messages via HTTP API"""
    with app.test_client() as client:
        response = client.get('/api/chat/channels/general/messages')
        assert response.status_code == 200
        messages = json.loads(response.data)
        print(f"✓ HTTP retrieved {len(messages)} messages")

def test_http_get_users():
    """Test retrieving users via HTTP API"""
    with app.test_client() as client:
        response = client.get('/api/chat/users')
        assert response.status_code == 200
        users = json.loads(response.data)
        print(f"✓ HTTP retrieved {len(users)} users")

def main():
    """Run all tests"""
    print("=" * 60)
    print("Chat Functionality Tests")
    print("=" * 60)
    
    setup_test_db()
    
    tests = [
        test_users_exist,
        test_general_channel_exists,
        test_users_in_general_channel,
        test_send_message,
        test_all_members_can_send,
        test_receive_messages,
        test_message_ordering,
        test_http_send_message,
        test_http_get_messages,
        test_http_get_users,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            print(f"\n▶ {test.__name__}: {test.__doc__}")
            test()
            passed += 1
        except Exception as e:
            print(f"✗ {test.__name__} FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
