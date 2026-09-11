# Chat API Reference

## Base URL
```
/api/chat
```

## Authentication
All endpoints accept requests without explicit authentication. User identity is determined by the `authorId` or session context.

---

## Users Endpoints

### Get All Users
```
GET /users
```

**Response:** `200 OK`
```json
[
  {
    "id": "user-123",
    "name": "Alice Johnson",
    "role": "manager",
    "color": "from-emerald-500 to-teal-600",
    "online": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Get Single User
```
GET /users/:userId
```

**Response:** `200 OK` (same as above)

**Error:** `404 Not Found`
```json
{ "success": false, "message": "User not found" }
```

---

## Channels Endpoints

### Get All Channels
```
GET /channels
```

**Response:** `200 OK`
```json
[
  {
    "id": "general",
    "name": "General",
    "type": "group",
    "emoji": "💬",
    "description": "Company-wide chatroom",
    "memberIds": ["user-123", "user-456"],
    "pinnedMessageIds": [],
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### Get Single Channel
```
GET /channels/:channelId
```

**Response:** `200 OK` (channel object as above)

**Error:** `404 Not Found`

### Create Channel ⚠️ (Admin Only)
```
POST /channels
Content-Type: application/json

{
  "name": "Project Alpha",
  "type": "group",
  "emoji": "🚀",
  "description": "Project management channel",
  "memberIds": ["user-123", "user-456"]
}
```

**Response:** `201 Created`
```json
{
  "id": "proj-alpha-xyz",
  "name": "Project Alpha",
  "type": "group",
  "emoji": "🚀",
  "description": "Project management channel",
  "memberIds": ["user-123", "user-456"],
  "pinnedMessageIds": [],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Admin access required

### Update Channel ⚠️ (Admin Only)
```
PATCH /channels/:channelId
Content-Type: application/json

{
  "name": "Project Alpha Updated",
  "emoji": "🎯",
  "description": "Updated description"
}
```

**Response:** `200 OK` (updated channel object)

### Delete Channel ⚠️ (Admin Only)
```
DELETE /channels/:channelId
```

**Response:** `200 OK`
```json
{ "success": true, "message": "Channel deleted" }
```

**Note:** Cannot delete "general" channel

---

## Channel Members Endpoints

### Add Member ⚠️ (Admin Only)
```
POST /channels/:channelId/members
Content-Type: application/json

{
  "userId": "user-789"
}
```

**Response:** `200 OK` (updated channel object)

**Error:** `400 Bad Request` - User doesn't exist

### Remove Member ⚠️ (Admin Only)
```
DELETE /channels/:channelId/members/:userId
```

**Response:** `200 OK` (updated channel object)

**Note:** Cannot remove last user from "general" channel

---

## Messages Endpoints

### Get Channel Messages
```
GET /channels/:channelId/messages
```

**Response:** `200 OK`
```json
[
  {
    "id": "msg-123",
    "channelId": "general",
    "authorId": "user-123",
    "body": "Hello everyone!",
    "createdAt": "2024-01-15T10:30:00Z",
    "mentions": ["user-456"],
    "attachments": [
      {
        "id": "a123",
        "name": "report.pdf",
        "size": 245000,
        "type": "pdf"
      }
    ],
    "reactions": [
      {
        "emoji": "👍",
        "userIds": ["user-456", "user-789"]
      }
    ],
    "replyTo": null,
    "edited": false,
    "pinned": false
  }
]
```

### Send Message
```
POST /messages
Content-Type: application/json

{
  "channelId": "general",
  "authorId": "user-123",
  "body": "Hello everyone!",
  "mentions": ["user-456"],
  "attachments": [
    {
      "id": "a123",
      "name": "report.pdf",
      "size": 245000,
      "type": "pdf",
      "dataUrl": "data:application/pdf;base64,..."
    }
  ],
  "replyTo": "msg-456"
}
```

**Response:** `201 Created`
```json
{
  "id": "msg-123",
  "channelId": "general",
  "authorId": "user-123",
  "body": "Hello everyone!",
  "createdAt": "2024-01-15T10:30:00Z",
  "mentions": ["user-456"],
  "attachments": [...],
  "reactions": [],
  "replyTo": "msg-456",
  "edited": false,
  "pinned": false
}
```

**Errors:**
- `400 Bad Request` - Missing required fields or user not in channel
- `404 Not Found` - Channel not found

### Update Message
```
PATCH /messages/:messageId
Content-Type: application/json

{
  "body": "Updated message content",
  "pinned": true,
  "reactions": [
    { "emoji": "👍", "userIds": ["user-123"] },
    { "emoji": "❤️", "userIds": ["user-123", "user-456"] }
  ]
}
```

**Response:** `200 OK` (updated message object)

**Note:** Only message author can edit body; any user can update reactions/pinned status

### Delete Message
```
DELETE /messages/:messageId
```

**Response:** `200 OK`
```json
{ "success": true }
```

**Error:** `404 Not Found` - Message not found

---

## Data Types

### Message Attachment
```typescript
{
  id: string;              // Unique identifier
  name: string;            // File name
  size: number;            // Size in bytes
  type: "image" | "doc" | "pdf" | "audio" | "other";
  dataUrl?: string;        // Base64 data for images
}
```

### Reaction
```typescript
{
  emoji: string;           // Emoji character
  userIds: string[];       // Users who reacted
}
```

### Channel Types
```
- "group":      Visible to all, any member can post
- "dm":         Direct message between specific users
- "broadcast":  Admin posts only, members can react
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

---

## Example Flows

### 1. Send and Receive Messages
```python
# 1. Get all channels
GET /api/chat/channels

# 2. Get messages in general channel
GET /api/chat/channels/general/messages

# 3. Send a message
POST /api/chat/messages
{
  "channelId": "general",
  "authorId": "user-123",
  "body": "Hello!",
  "mentions": [],
  "attachments": []
}

# 4. Frontend polls every 2 seconds
GET /api/chat/channels/general/messages
# New messages appear here
```

### 2. React to Message
```python
# 1. Get current message
GET /api/chat/channels/general/messages

# 2. Add reaction
PATCH /api/chat/messages/msg-123
{
  "reactions": [
    { "emoji": "👍", "userIds": ["user-123"] }
  ]
}
```

### 3. Create Group Channel
```python
# Admin creates channel
POST /api/chat/channels
{
  "name": "Development Team",
  "type": "group",
  "emoji": "👨‍💻",
  "description": "Development team discussions",
  "memberIds": ["user-123", "user-456", "user-789"]
}

# Members can immediately start messaging
POST /api/chat/messages
{
  "channelId": "<returned_channel_id>",
  "authorId": "user-123",
  "body": "First message!"
}
```

---

## Rate Limiting
Currently no rate limiting implemented. Production deployments should add rate limiting per user/IP.

## Polling Strategy
Frontend polls messages every 2 seconds for each active channel. For real-time requirements, consider implementing WebSocket support.

## Database Constraints
- Message body is required (cannot be empty)
- Channel names are unique within context
- User IDs must exist before messaging
- General channel cannot be deleted or emptied
