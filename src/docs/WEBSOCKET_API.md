# LeadFilter — WebSocket API Reference

> **Transport**: Socket.IO v4  
> **URL**: `ws://localhost:3000`  
> **Namespace**: `/` (default)

---

## Connection

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('error', (err) => {
  console.error('WS Error:', err);
});
```

---

## Room System

You must join a room to receive targeted broadcasts.

| Room | Description |
|------|-------------|
| `org:{organizationId}` | All events for an organization |
| `chat:{chatId}` | All events for a specific chat |

```js
// Join org room (do this on dashboard load)
socket.emit('join:org', { organizationId: 'org_123' });

// Join specific chat room (do this when opening a chat)
socket.emit('join:chat', { chatId: 'chat_abc' });
```

---

## Client → Server Events

### `join:org`
Join an organization room.

```json
// Emit payload
{ "organizationId": "68030abc..." }

// Response (ack)
{ "event": "joined", "data": "org:68030abc..." }
```

---

### `join:chat`
Join a specific chat room.

```json
// Emit payload
{ "chatId": "68030def..." }

// Response (ack)
{ "event": "joined", "data": "chat:68030def..." }
```

---

### `chat:list`
Get paginated list of chats for an organization.

```json
// Emit payload
{
  "organizationId": "68030abc...",
  "status": "AI_PROCESSING",    // optional: "AI_PROCESSING" | "RETURNED_HUMAN"
  "page": 1,
  "limit": 20
}

// Response (ack)
{
  "items": [ /* Chat[] */ ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

---

### `chat:get`
Get a single chat by ID.

```json
// Emit payload
{ "chatId": "68030def..." }

// Response (ack)
{ /* Chat object */ }
```

---

### `chat:update`
Update a chat (e.g., return to human agent).

```json
// Emit payload
{
  "chatId": "68030def...",
  "dto": {
    "status": "RETURNED_HUMAN"
  }
}

// Response (ack)
{ /* Updated Chat object */ }
```

---

### `messages:list`
Get paginated messages for a chat.

```json
// Emit payload
{
  "chatId": "68030def...",
  "page": 1,
  "limit": 50
}

// Response (ack)
{
  "items": [ /* Message[] */ ],
  "total": 120,
  "page": 1,
  "limit": 50,
  "totalPages": 3,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

---

### `message:send`
Human agent sends a message into a chat (the organization ID is extracted automatically from your JWT auth token).

```json
// Emit payload
{
  "chatId": "68030def...",
  "content": "Salom! Qanday yordam bera olaman?"
}

// Response (ack)
{ /* Saved Message object */ }
```

---

### `lead:list`
Get paginated leads for an organization.

```json
// Emit payload
{
  "organizationId": "68030abc...",
  "status": "NEW",     // optional: "NEW" | "IN_PROGRESS" | "WON" | "LOST"
  "page": 1,
  "limit": 20
}

// Response (ack)
{
  "items": [ /* Lead[] */ ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPrevPage": false
}
```

---

### `lead:get`
Get a single lead by ID.

```json
// Emit payload
{ "leadId": "68030xyz..." }

// Response (ack)
{ /* Lead object */ }
```

---

### `lead:update`
Update a lead's status or data.

```json
// Emit payload
{
  "leadId": "68030xyz...",
  "dto": {
    "status": "IN_PROGRESS",
    "data": { "phone": "+998901234567" }
  }
}

// Response (ack)
{ /* Updated Lead object */ }
```

---

### `org:get`
Get organization details.

```json
// Emit payload
{ "organizationId": "68030abc..." }

// Response (ack)
{ /* Organization object */ }
```

---

### `knowledge:get`
Get all AI knowledge context for an organization.

```json
// Emit payload
{ "organizationId": "68030abc..." }

// Response (ack)
{
  "leadQuestions": [ /* LeadQuestion[] */ ],
  "companyInfo": [ /* CompanyInformation[] */ ],
  "additionalInfo": [ /* AdditionalInformation[] */ ]
}
```

---

## Server → Client Events

These are broadcast automatically. You receive them if you are in the relevant room.

### `chat:new`
Fired when a new chat is created (first message from a new customer).

- **Room**: `org:{organizationId}`

```json
{
  "_id": "68030def...",
  "organizationId": "68030abc...",
  "channel": "INSTAGRAM",
  "externalChatId": "instagram_user_123",
  "externalUserId": "instagram_user_123",
  "status": "AI_PROCESSING",
  "collectedData": {},
  "lastMessage": { "text": "Salom", "sentTime": "2026-08-18T10:10:00.000Z" },
  "createdAt": "2026-08-18T10:00:00.000Z",
  "updatedAt": "2026-08-18T10:10:00.000Z"
}
```

---

### `chat:updated`
Fired when a chat receives a new message (incoming customer, AI reply, or human message), changes status, or collects new data.

- **Room**: `org:{organizationId}`
- **Usage**: Use this event to automatically move the updated chat to the top of your chat list (`index 0`) in real time, as `updatedAt` and `lastMessage` are updated.

```json
{
  "_id": "68030def...",
  "organizationId": "68030abc...",
  "channel": "INSTAGRAM",
  "externalChatId": "instagram_user_123",
  "externalUserId": "instagram_user_123",
  "status": "AI_PROCESSING",
  "collectedData": { "destination": "Turkiya" },
  "lastMessage": {
    "text": "Turkiyaga turlar 1200$ dan boshlanadi. Qaysi sana uchun qiziqasiz?",
    "sentTime": "2026-08-18T10:10:02.000Z"
  },
  "createdAt": "2026-08-18T10:00:00.000Z",
  "updatedAt": "2026-08-18T10:10:02.000Z"
}
```

---

### `message:new`
Fired when any new customer message arrives or when a human agent sends a message.

- **Rooms**: `org:{organizationId}`, `chat:{chatId}`

```json
{
  "_id": "msg_123...",
  "organizationId": "68030abc...",
  "chatId": "68030def...",
  "direction": "INCOMING",
  "senderType": "CUSTOMER",
  "type": "TEXT",
  "content": "Turkiyaga tur narxi qancha?",
  "status": "RECEIVED",
  "sentAt": "2026-08-18T10:10:00.000Z",
  "createdAt": "2026-08-18T10:10:01.000Z"
}
```

---

### `message:ai`
Fired when the AI assistant generates and saves a reply.

- **Rooms**: `org:{organizationId}`, `chat:{chatId}`

```json
{
  "_id": "msg_456...",
  "organizationId": "68030abc...",
  "chatId": "68030def...",
  "direction": "OUTGOING",
  "senderType": "ASSISTENT",
  "type": "TEXT",
  "content": "Turkiyaga turlar 1200$ dan boshlanadi. Qaysi sana uchun qiziqasiz?",
  "status": "SENT",
  "sentAt": "2026-08-18T10:10:02.000Z"
}
```

---

### `lead:new`
Fired when a new lead is automatically generated upon completing all AI questions.

- **Room**: `org:{organizationId}`

```json
{
  "_id": "lead_abc...",
  "organizationId": "68030abc...",
  "chatId": "68030def...",
  "status": "NEW",
  "data": {
    "fullName": "Ali Valiyev",
    "phone": "+998901234567",
    "destination": "Turkiya",
    "travelDate": "2026-09-15",
    "budget": 1200
  },
  "createdAt": "2026-08-18T10:15:00.000Z",
  "updatedAt": "2026-08-18T10:15:00.000Z"
}
```

---

### `lead:updated`
Fired when a lead status or collected data is updated (via REST `PATCH /leads/:id` or WebSocket `lead:update`).

- **Room**: `org:{organizationId}`

```json
{
  "_id": "lead_abc...",
  "organizationId": "68030abc...",
  "chatId": "68030def...",
  "status": "IN_PROGRESS",
  "data": {
    "fullName": "Ali Valiyev",
    "phone": "+998901234567",
    "destination": "Turkiya"
  },
  "createdAt": "2026-08-18T10:15:00.000Z",
  "updatedAt": "2026-08-18T10:20:00.000Z"
}
```

---

### `org:updated`
Fired when an organization is updated.

- **Room**: `org:{organizationId}`

```json
{ /* Updated Organization object */ }
```

---

### `knowledge:updated`
Fired when knowledge items change.

- **Room**: `org:{organizationId}`

```json
{ /* Updated knowledge payload */ }
```

---

### `error`
Fired on validation or server errors.

```json
{
  "statusCode": 400,
  "data": null,
  "error": "Validation failed: chatId must be a string"
}
```

---

## Full Frontend Real-Time Example

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_ACCESS_TOKEN' },
  transports: ['websocket'],
});

const ORG_ID = 'your-organization-id';
let chatList = [];
let leadList = [];
let currentChatMessages = [];

// 1. Connect and join organization room
socket.on('connect', () => {
  console.log('Connected to LeadFilter Real-Time WS');
  socket.emit('join:org', { organizationId: ORG_ID });
});

// 2. Fetch initial chats (ordered with latest message on top)
socket.emit('chat:list', { organizationId: ORG_ID, page: 1, limit: 20 }, (res) => {
  chatList = res.items || [];
  console.log('Initial Chats:', chatList);
});

// 3. Fetch initial leads
socket.emit('lead:list', { organizationId: ORG_ID, page: 1, limit: 20 }, (res) => {
  leadList = res.items || [];
  console.log('Initial Leads:', leadList);
});

// 4. Real-time Chat Updates & Dynamic List Reordering (Top of List)
socket.on('chat:new', (newChat) => {
  // Prepend new chat to the very top
  chatList = [newChat, ...chatList.filter((c) => c._id !== newChat._id)];
  console.log('New chat received, moved to top:', newChat);
});

socket.on('chat:updated', (updatedChat) => {
  // Move updated chat with latest message to top of list
  chatList = [updatedChat, ...chatList.filter((c) => c._id !== updatedChat._id)];
  console.log('Chat updated, bumped to top:', updatedChat);
});

// 5. Real-time Messages
socket.on('message:new', (msg) => {
  console.log('New incoming/human message:', msg);
  currentChatMessages.push(msg);
});

socket.on('message:ai', (msg) => {
  console.log('New AI reply:', msg);
  currentChatMessages.push(msg);
});

// 6. Real-time Leads
socket.on('lead:new', (newLead) => {
  leadList = [newLead, ...leadList];
  console.log('New Lead created in real-time!', newLead);
});

socket.on('lead:updated', (updatedLead) => {
  leadList = leadList.map((l) => (l._id === updatedLead._id ? updatedLead : l));
  console.log('Lead updated in real-time:', updatedLead);
});

// 7. Sending a message from operator
function sendOperatorMessage(chatId, content) {
  socket.emit('message:send', { chatId, content }, (sentMessage) => {
    console.log('Message sent:', sentMessage);
  });
}
```

---

## Authentication for WebSocket

All WebSocket connections require a valid JWT access token. Pass it during the handshake:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'YOUR_ACCESS_TOKEN_HERE',
  },
});
```

If the token is missing or invalid, the connection is rejected with a `WsException`.

**Token refresh for long-lived WS sessions:**
Listen for an `error` event with `code: 401` and re-connect with a fresh access token obtained from `POST /auth/refresh`.

---

## Auth REST Endpoints (not WebSocket)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | Public | Register new Org + Admin User |
| POST | `/auth/login` | Public | Login → tokens |
| POST | `/auth/refresh` | Refresh token | Get new token pair |
| POST | `/auth/logout` | Bearer | Logout |
| GET | `/auth/me` | Bearer | Current user info |
| GET | `/organizations/my` | Bearer + ADMIN | Current user's organization |
| PATCH | `/organizations/my` | Bearer + ADMIN | Update current user's organization |
| POST | `/users` | Bearer + ADMIN | Create user in org |
| GET | `/users` | Bearer + ADMIN | List org users |
| GET | `/users/:id` | Bearer + ADMIN | Get user |
| PATCH | `/users/:id` | Bearer + ADMIN | Update user |
| DELETE | `/users/:id` | Bearer + ADMIN | Delete user |
| POST | `/organizations/:orgId/lead-questions` | Bearer + ADMIN | Add lead question (org scoped) |
| GET | `/organizations/:orgId/lead-questions` | Bearer + ADMIN | List lead questions (org scoped) |
| POST | `/organizations/:orgId/company-information` | Bearer + ADMIN | Add company info (org scoped) |
| GET | `/organizations/:orgId/company-information` | Bearer + ADMIN | List company info (org scoped) |
| POST | `/organizations/:orgId/additional-information` | Bearer + ADMIN | Add additional info (org scoped) |
| GET | `/organizations/:orgId/additional-information` | Bearer + ADMIN | List additional info (org scoped) |
| GET | `/leads` | Bearer + ADMIN | List leads for authenticated org |
| GET | `/leads/:id` | Bearer + ADMIN | Get lead by ID (org scoped) |
| PATCH | `/leads/:id` | Bearer + ADMIN | Update lead (org scoped) |
| GET | `/webhook/instagram` | Public | Instagram webhook verification |
| POST | `/webhook/instagram` | Public | Instagram incoming message receiver |
