# Chatroom Quick Reference Guide

## For Users 👥

### Sending Messages
1. **Navigate to Chatroom** → Click on "Chatroom" in the left sidebar
2. **Select Channel** → Choose "general" or any group channel
3. **Type Message** → Click in the message box and type your message
4. **Features While Typing:**
   - Type `@` to mention someone
   - Click 😊 icon to add emoji reactions
   - Click 📎 icon to attach files
   - Press Shift+Enter for new line
5. **Send** → Click Send button or press Enter

### Reading Messages
- All messages appear instantly in the channel
- Messages show sender name, role, and timestamp
- Messages are grouped by sender for clean display

### Interacting with Messages
- **React** → Hover over a message and click 😊 to add emoji reactions
- **Reply** → Hover over a message and click to reply (creates threaded conversation)
- **Mention** → Use `@name` to notify someone specific
- **Pin** → Admin or message author can pin important messages

## For Administrators 👨‍💼

### Create New Channel
1. Click the **+** button in the chat sidebar
2. Enter channel name and select type:
   - **Group** - Open team channel
   - **Broadcast** - Admin-only posting channel
   - **DM** - Direct message with specific users
3. Add members and set description
4. Click "Create"

### Manage Channels
- **Edit** - Click ⚙️ in channel header to update name, emoji, description
- **Add Members** - Click on channel name to see members panel
- **Remove Members** - Click the remove button next to member name
- **Delete Channel** - Use the edit dialog (cannot delete general channel)

### Permissions
- ✅ Any member can send messages
- ✅ Any member can react to messages
- ✅ Only message author can edit/delete own messages
- 🔒 Only admins can create/delete channels
- 🔒 Only admins can manage channel members
- 🔒 General channel cannot be deleted

## System Architecture 🏗️

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                     │
│  - Chat Store (manages users, channels, messages)       │
│  - Real-time polling (2s interval)                      │
│  - Message composer & list components                   │
└────────────────┬──────────────────────────────────────┘
                 │ HTTP API Calls
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Flask + SQLite)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Chat Routes (/api/chat/*)                        │  │
│  │  - Users, Channels, Messages endpoints           │  │
│  │  - Access validation                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Chat Service                                     │  │
│  │  - User management                               │  │
│  │  - Channel operations                            │  │
│  │  - Message CRUD + reactions                      │  │
│  │  - Member access control                         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SQLite Database                                  │  │
│  │  - chat_users                                    │  │
│  │  - chat_channels                                 │  │
│  │  - chat_channel_members (access control)         │  │
│  │  - chat_messages (with metadata)                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Common Use Cases 📋

### Scenario 1: New User Joins Company
```
1. User account created in system
2. Chat user automatically created
3. User auto-added to "general" channel
4. User can immediately see and send messages
5. Messages appear for all other members within 2 seconds
```

### Scenario 2: Admin Creates Project Channel
```
1. Admin clicks + in chat sidebar
2. Creates "project-alpha" channel
3. Selects project members
4. Members automatically see channel in sidebar
5. All can send messages immediately
```

### Scenario 3: Member Reacts to Message
```
1. User hovers over a message
2. Clicks emoji button
3. Selects reaction emoji
4. Reaction appears immediately
5. Other users see it in next polling cycle (≤2s)
```

## Troubleshooting 🔧

| Issue | Solution |
|-------|----------|
| Don't see messages | Refresh page or wait for next polling cycle |
| Can't send message | Ensure you're a member of the channel |
| Message not appearing for others | Wait up to 2 seconds for polling update |
| Can't create channel | You need admin permissions |
| Can't delete channel | General channel cannot be deleted |
| Can't see members | Click Info icon in channel header |

## Tips & Tricks 💡

- Use `@mention` to get someone's attention
- Pin important messages for easy reference
- Reply to messages to keep conversations organized
- Use emoji reactions for quick feedback (👍 ❤️ 🎉)
- Group channels are visible to all team members
- DMs are private between members only

---

**Need help?** Contact your system administrator or check the documentation.
