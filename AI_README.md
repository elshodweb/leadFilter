# LeadFilter — AI Memory & Technical Reference

> This file is the **living memory** of all architectural decisions, domain models, algorithms, and change history for the LeadFilter NestJS backend.
> Every developer and future AI agent should read this first before making changes.

---

## 1. Project Overview

| Property | Value |
|---|---|
| **Framework** | NestJS (TypeScript) |
| **Database** | MongoDB with Mongoose |
| **Realtime** | WebSockets (Socket.IO via `@nestjs/websockets` & `@nestjs/platform-socket.io`) |
| **AI Engine** | OpenAI API (`gpt-4.1-mini` with JSON Structured Outputs) |
| **Authentication** | JWT (Access + Refresh tokens) with bcrypt password hashing |
| **Server Port** | `3000` (configurable via `PORT` environment variable) |
| **Swagger UI** | `http://localhost:3000/api` |
| **WebSocket URL** | `ws://localhost:3000` (Socket.IO) |

---

## 2. Domain & Data Models

```
Organization
├── Users (Admin / Operator / Manager / Owner)
├── Knowledge (Per-Organization AI Context)
│   ├── Lead Questions       → Required data fields AI must collect from client
│   ├── Company Information  → Company profile, hours, contacts, services, pricing
│   └── Additional Info      → FAQ, visa policies, terms, refund rules
├── Chats
│   └── Messages (Incoming from Customer, Outgoing AI Assistent / Human)
└── Leads (Created automatically once ALL Lead Questions are answered)
```

### Schemas

#### 🏢 Organization (`organizations`)
```typescript
{
  _id: ObjectId,
  name: string,
  status: 'ACTIVE' | 'INACTIVE',         // default: ACTIVE
  instagramAccessToken: string,         // required (Instagram Graph API access token)
  instagramBusinessAccountId: string,   // required (Instagram Business Account ID, indexed)
  instagramVerifyToken: string,         // required (Instagram Webhook verification token, indexed)
  instagramApiBaseUrl: string,          // default: 'https://graph.instagram.com'
  metaGraphApiVersion: string,          // default: 'v23.0'
  createdAt: Date,
  updatedAt: Date
}
```

#### 👤 User (`users`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,       // strictly bound to 1 organization
  fullName: string,
  email: string,                  // unique, lowercase
  password: string,               // bcrypt hashed (select: false)
  role: 'ADMIN' | 'OWNER' | 'OPERATOR' | 'MANAGER',  // default: ADMIN
  status: 'ACTIVE' | 'INACTIVE',  // default: ACTIVE
  refreshToken: string | null,    // hashed (select: false)
  createdAt: Date,
  updatedAt: Date
}
```

#### ❓ LeadQuestion (`leadquestions`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  title: string,                  // e.g. "Telefon raqami", "Sayohat manzili"
  description: string,            // AI instructions on how to ask and validate
  order: number,                  // sequencing priority
  createdAt: Date,
  updatedAt: Date
}
```

#### ℹ️ CompanyInformation (`companyinformations`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  title: string,                  // e.g. "Ish vaqti"
  description: string,            // e.g. "Dushanbadan shanbagacha 09:00 dan 19:00 gacha"
  createdAt: Date,
  updatedAt: Date
}
```

#### 📜 AdditionalInformation (`additionalinformations`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  title: string,                  // e.g. "Pasport muddati"
  description: string,            // e.g. "Pasport amal qilish muddati kamida 6 oy bo'lishi kerak"
  createdAt: Date,
  updatedAt: Date
}
```

#### 💬 Chat (`chats`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  channel: 'INSTAGRAM' | 'TELEGRAM' | 'WHATSAPP',
  externalChatId: string,         // e.g. Instagram sender ID
  externalUserId: string,
  status: 'COLD' | 'WARM' | 'HOT',      // default: 'COLD'
  ai_enabled: boolean,                 // default: true (AI ON / OFF)
  collectedData: [                      // Array of collected lead question items
    {
      id: string,                       // Lead question ID
      title: string,                    // Lead question title (e.g. "Mijoz telefon raqami")
      value: string | null              // Collected value or null if not yet answered
    }
  ],
  lastMessage: {
    text: string,
    sentTime: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### ✉️ Message (`messages`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  chatId: ObjectId,
  externalMessageId?: string,
  direction: 'INCOMING' | 'OUTGOING',
  senderType: 'CUSTOMER' | 'ASSISTENT' | 'HUMAN',
  type: 'TEXT',
  content: string,
  status: 'RECEIVED' | 'SENT' | 'FAILED',
  sentAt: Date,
  createdAt: Date
}
```

#### 🎯 Lead (`leads`)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  chatId: ObjectId,               // unique 1:1 relation to the qualifying Chat
  status: 'NEW' | 'IN_PROGRESS' | 'WON' | 'LOST', // default: NEW
  order: number,                  // 1-based order position within the status column
  data: Record<string, any>,      // complete map of all LeadQuestions answers
  createdAt: Date,
  updatedAt: Date
}
```

---

## 3. Core Algorithms

### 🤖 AI Processing & Lead Qualification Pipeline
When a customer sends a message (e.g. from Instagram webhook or WebSocket):

```
Incoming Customer Message
           ↓
1. ChatsService.handleIncomingMessage()
   - Find or create Chat by (organizationId + externalChatId)
   - If newly created → emit 'chat.new' (broadcasts 'chat:new' to org room)
2. Save Message (direction: INCOMING, senderType: CUSTOMER)
   - Emit 'message.new' (broadcasts to chat room and org room)
3. Update Chat.lastMessage (text, sentTime)
4. Check Chat.status:
   - If 'RETURNED_HUMAN' → Skip AI, notify human operator, return immediately.
5. Load Organization Knowledge:
   - LeadQuestions, CompanyInformation, AdditionalInformation
6. Load last 20 messages for conversational history
7. Call OpenAI with structured JSON output:
   - Context: Company Information + Additional Rules + Lead Questions + Collected Data
   - Response: { reply: string, collectedData: Record<string, any>, isComplete: boolean }
8. Save AI Message (direction: OUTGOING, senderType: ASSISTENT)
   - Emit 'message.ai' (broadcasts to chat room and org room)
9. Operator Handover & AI Disabling Check:
   - If AI returned handoverToOperator: true (or customer explicitly asks for human operator):
     - Operator Request ("оператор", "менеджер", "человек", "operatorga ulang"): AI acknowledges and sets ai_enabled = false.
     - Difficult/Complex/Serious Off-Topic Question: AI politely transfers to manager and sets ai_enabled = false.
     - Light Joke / Humor / Friendly Banter: AI continues chatting with charm/wit and keeps ai_enabled = true.
10. Update Chat.collectedData with new extracted values, status (COLD/WARM/HOT), and ai_enabled
11. If isComplete === true (all LeadQuestions have non-null answers):
    - Check if Lead already exists for this chatId
    - If not, create Lead (status: 'NEW', order: nextOrder, data: collectedData)
    - Emit 'lead.new' (broadcasts 'lead:new' to org room)
```

### 📋 Jira-Style Kanban Board Lead Reordering Algorithm
1. **Creation**:
   - When a new lead is created with `status: 'NEW'`, it automatically gets `order = nextOrder` within that status column.
2. **Reordering within the Same Status Column (`PATCH /leads/:id` or WebSocket `lead:update`)**:
   - User drags a card from `oldOrder` to `targetOrder` within the same column:
     - **Moving UP** (`targetOrder < oldOrder`): Cards in `[targetOrder, oldOrder - 1]` shift `+1` (`{ $inc: { order: 1 } }`).
     - **Moving DOWN** (`targetOrder > oldOrder`): Cards in `[oldOrder + 1, targetOrder]` shift `-1` (`{ $inc: { order: -1 } }`).
     - Target lead is assigned `order = targetOrder`.
3. **Moving Across Status Columns (e.g. from `NEW` to `IN_PROGRESS`)**:
   - User drags a card to a new status column at `targetOrder`:
     - **Source Column**: All subsequent cards with `order > oldOrder` shift `-1` (`{ $inc: { order: -1 } }`) to close the gap.
     - **Destination Column**: All cards with `order >= targetOrder` shift `+1` (`{ $inc: { order: 1 } }`) to make room.
     - Target lead is assigned `status = newStatus` and `order = targetOrder`.
4. **Deletion (`DELETE /leads/:id` or WebSocket `lead:delete`)**:
   - When a lead at `deletedOrder` in `status` is deleted, all cards in that status with `order > deletedOrder` shift `-1` to eliminate gaps in the sequence.

### 🔄 Lead Questions Auto-Counter & Swipe Reordering Algorithm
1. **Creation (`POST /organizations/:orgId/lead-questions`)**:
   - `order` is **not** provided by the client in `create`.
   - The system automatically counts/determines the highest current `order` in the organization and assigns `order = highest + 1` (1, 2, 3, ...).
2. **Swipe Reordering (`PATCH /organizations/:orgId/lead-questions/:id`)**:
   - The client passes `{ order: newOrder }`.
   - **Moving Down** (`newOrder < oldOrder`, e.g. item 5 moved to 3):
     - Shifts all questions with `order >= newOrder && order < oldOrder` by `+1` (`$inc: { order: 1 }`).
     - Target question gets `order = newOrder`.
     - *Example*: `[1:a, 2:b, 3:c, 4:d, 5:e]` -> moving `e` to `3` produces `[1:a, 2:b, 3:e, 4:c, 5:d]`.
   - **Moving Up** (`newOrder > oldOrder`, e.g. item 2 moved to 4):
     - Shifts all questions with `order > oldOrder && order <= newOrder` by `-1` (`$inc: { order: -1 }`).
     - Target question gets `order = newOrder`.
     - *Example*: `[1:a, 2:b, 3:c, 4:d, 5:e]` -> moving `b` to `4` produces `[1:a, 2:c, 3:d, 4:b, 5:e]`.
3. **Deletion Gap Cleanup (`DELETE /organizations/:orgId/lead-questions/:id`)**:
   - When question at `deletedOrder` is deleted, all questions with `order > deletedOrder` are shifted by `-1` (`$inc: { order: -1 }`), guaranteeing no gaps in sequence.

### 🔒 Authentication & Admin Management Algorithm
1. **Public Routes**: Marked with `@Public()` (`POST /auth/register`, `POST /auth/login`, `GET|POST /webhook/instagram`).
2. **Protected Routes**: Handled globally by `JwtAuthGuard` and `RolesGuard`.
3. **Admin Privileges**:
   - `ADMIN` is the system administrator role with full management access across all organizations and APIs.
   - An Admin can manage any organization (`GET /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`, `DELETE /organizations/:id`, `POST /organizations`) or manage their primary organization via `/organizations/my`.
   - An Admin can manage Knowledge items (Lead Questions, Company Info, Additional Info) across any organization.
   - An Admin can view and manage Leads for any organization (or their own default organization).
4. **WebSocket Authentication (`WsJwtGuard`)**:
   - Token sent in `socket.handshake.auth.token`.
   - Verified on connection and every message event.

---

## 4. REST API Endpoint Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new Organization + initial Admin User |
| `POST` | `/auth/login` | Public | Login with email & password |
| `POST` | `/auth/refresh` | Refresh Token | Issue new access & refresh tokens |
| `POST` | `/auth/logout` | Bearer | Invalidate refresh token |
| `GET` | `/auth/me` | Bearer | Get current authenticated user profile |
| `GET` | `/organizations/my` | Bearer + ADMIN | Get current user's organization profile |
| `PATCH` | `/organizations/my` | Bearer + ADMIN | Update current user's organization profile |
| `POST` | `/users` | Bearer + ADMIN | Create a user within the organization |
| `GET` | `/users` | Bearer + ADMIN | List all users in the organization |
| `GET` | `/users/:id` | Bearer + ADMIN | Get user details |
| `PATCH` | `/users/:id` | Bearer + ADMIN | Update user |
| `DELETE` | `/users/:id` | Bearer + ADMIN | Delete user |
| `POST` | `/organizations/:orgId/lead-questions` | Bearer + ADMIN | Add a lead question |
| `GET` | `/organizations/:orgId/lead-questions` | Bearer + ADMIN | List lead questions |
| `PATCH` | `/organizations/:orgId/lead-questions/:id` | Bearer + ADMIN | Update lead question |
| `DELETE` | `/organizations/:orgId/lead-questions/:id` | Bearer + ADMIN | Delete lead question |
| `POST` | `/organizations/:orgId/company-information` | Bearer + ADMIN | Add company information item |
| `GET` | `/organizations/:orgId/company-information` | Bearer + ADMIN | List company information items |
| `PATCH` | `/organizations/:orgId/company-information/:id` | Bearer + ADMIN | Update company information item |
| `DELETE` | `/organizations/:orgId/company-information/:id` | Bearer + ADMIN | Delete company information item |
| `POST` | `/organizations/:orgId/additional-information` | Bearer + ADMIN | Add additional information item |
| `GET` | `/organizations/:orgId/additional-information` | Bearer + ADMIN | List additional information items |
| `PATCH` | `/organizations/:orgId/additional-information/:id` | Bearer + ADMIN | Update additional information item |
| `DELETE` | `/organizations/:orgId/additional-information/:id` | Bearer + ADMIN | Delete additional information item |
| `GET` | `/leads` | Bearer + ADMIN | List leads for current organization |
| `GET` | `/leads/:id` | Bearer + ADMIN | Get lead by ID |
| `PATCH` | `/leads/:id` | Bearer + ADMIN | Update lead status, order or data |
| `DELETE` | `/leads/:id` | Bearer + ADMIN | Delete lead |
| `GET` | `/analytics/kpi` | Bearer | Get AI KPI metrics, operator time saved, and cost saved (supports `organizationId`, `startDate`, `endDate`) |
| `GET` | `/analytics` | Bearer | Alias to get KPI metrics |
| `GET` | `/analytics/organization/:orgId` | Bearer | Get KPI metrics for specific organization |
| `GET` | `/webhook/instagram` | Public | Instagram Meta webhook verification |
| `POST` | `/webhook/instagram` | Public | Instagram incoming message ingestion |

---

## 5. WebSocket Event Reference (Socket.IO)

### Client → Server Events
- `join:org` (`{ organizationId }`): Join room `org:{organizationId}`.
- `join:chat` (`{ chatId }`): Join room `chat:{chatId}`.
- `chat:list` (`ListChatsDto`): Fetch paginated chats.
- `chat:get` (`{ chatId }`): Fetch single chat.
- `chat:update` (`{ chatId, dto: UpdateChatDto }`): Update chat status.
- `chat:delete` (`{ chatId }`): Delete chat and all messages.
- `messages:list` (`ListMessagesDto`): Fetch chat message history.
- `message:send` (`SendMessageDto`): Send a message as a human operator.
- `lead:list` (`ListLeadsDto`): Fetch paginated leads.
- `lead:get` (`{ leadId }`): Fetch single lead.
- `lead:update` (`{ leadId, dto: UpdateLeadDto }`): Update lead status, order (Jira Kanban drag & drop), or data.
- `lead:delete` (`{ leadId }`): Delete lead.
- `org:get` (`{ organizationId }`): Fetch organization info.
- `knowledge:get` (`{ organizationId }`): Fetch all AI knowledge context.

### Server → Client Broadcasts
- `chat:new`: New chat started (`org:{organizationId}`).
- `chat:updated`: Chat status changed (`org:{organizationId}`).
- `chat:deleted`: Chat deleted (`org:{organizationId}`).
- `message:new`: Customer incoming or operator outgoing message (`chat:{chatId}`, `org:{organizationId}`).
- `message:ai`: AI assistant reply (`chat:{chatId}`, `org:{organizationId}`).
- `lead:new`: Lead completed and created (`org:{organizationId}`).
- `lead:updated`: Lead updated or reordered (`org:{organizationId}`).
- `lead:deleted`: Lead deleted (`org:{organizationId}`).
- `org:updated`: Organization profile updated (`org:{organizationId}`).
- `knowledge:updated`: Knowledge items updated (`org:{organizationId}`).
- `error`: Error notification with message and code.

---

## 6. Environment Variables

| Variable | Description | Required | Example |
|---|---|---|---|
| `PORT` | Server HTTP/WS Port | Yes | `3000` |
| `MONGODB_URI` | MongoDB Connection URI | Yes | `mongodb://admin:password123@localhost:27017/lead_filter?authSource=admin` |
| `MONGODB_DB_NAME` | MongoDB Database Name | Yes | `lead_filter` |
| `OPENAI_API_KEY` | OpenAI API Key | Yes | `sk-proj-...` |
| `OPENAI_MODEL` | OpenAI Model Name | Yes | `gpt-4o-mini` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | Yes | `your_access_secret` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | Yes | `your_refresh_secret` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | No (default `15m`) | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | No (default `7d`) | `7d` |

> [!NOTE]
> Instagram integration settings (`instagramAccessToken`, `instagramBusinessAccountId`, `instagramVerifyToken`, `instagramApiBaseUrl`, `metaGraphApiVersion`) are stored per-organization in MongoDB and configured during Organization creation / registration.

---

## 7. Default Seeded Admin Credentials & Knowledge Base

When the application runs for the first time (or via `npm run seed`), the database is automatically seeded with a full tourism company setup:

### 👤 Default Admin User
| Field | Value |
|---|---|
| **Full Name** | `Ali Valiyev` |
| **Email** | `admin@airticket.uz` |
| **Password** | `Password123!` |
| **Role** | `ADMIN` |
| **Status** | `ACTIVE` |
| **Organization** | `Air Ticket Tour` |

### ❓ Seeded Lead Questions
1. `order: 1` — **Telefon raqami**: "Mijozdan bog'lanish uchun telefon raqamini so'rang."
2. `order: 2` — **Mijozning to'liq ismi**: "Mijozdan unga qanday murojaat qilish mumkinligini (ism-familiyasini) so'rang."
3. `order: 3` — **Sayohat manzili**: "Mijoz qaysi davlat yoki shaharga sayohat qilmoqchi ekanligini aniqlang."
4. `order: 4` — **Sayohat sanasi**: "Mijoz taxminan qachon sayohat qilishni rejalashtirayotganini so'rang."
5. `order: 5` — **Budjet**: "Mijozning bitta kishi yoki oila uchun mo'ljallangan taxminiy budjetini aniqlang."

### 🛠️ Running the Seeder Manually
```bash
npm run seed
```

---

## 8. Unified Response Format & Universal Pagination

### 📦 Standard Success Response Envelope
All HTTP 2xx controller responses are automatically wrapped by the global `TransformInterceptor`:
```json
{
  "statusCode": 200,
  "data": { ... },
  "error": null
}
```

### 🚨 Standard Error Response Envelope
All HTTP 4xx / 5xx exceptions and runtime errors are caught and formatted by the global `HttpExceptionFilter`:
```json
{
  "statusCode": 400,
  "data": null,
  "error": "Validation failed: ..."
}
```

---

## 9. 2-Way Instagram Direct Integration & Operator Echoes

### 🔄 End-to-End Pipeline
1. **Incoming Customer Message**:
   - Meta Webhook sends `POST /webhook/instagram` with `is_echo: false`.
   - `WebhookController` routes to `ChatsService.handleIncomingMessage`.
   - Customer message saved to DB, `message.new` and `chat.updated` broadcasted to WebSockets.
   - OpenAI generates assistant reply and updates `collectedData`.
   - **`InstagramService.sendTextMessage` delivers the AI reply directly to customer's Instagram Direct!**
   - If all questions are completed, Lead is created automatically.

2. **Operator Replies from Instagram Mobile App / Meta Suite (Echo Messages)**:
   - Meta Webhook sends `POST /webhook/instagram` with `is_echo: true`.
   - `WebhookController` routes to `ChatsService.handleEchoMessage`.
   - Message saved as `senderType: 'HUMAN'`.
   - Chat status switched to `RETURNED_HUMAN` (AI stops automated replies so human can take over).
   - Real-time `message.new` and `chat.updated` emitted to web platform dashboard.

3. **Operator Replies from Web Platform Dashboard**:
   - Operator sends `message:send` via Socket.IO.
   - `ChatsService` saves human message and **`InstagramService.sendTextMessage` delivers the operator's message to customer's Instagram Direct!**



