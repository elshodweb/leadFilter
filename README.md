# LeadFilter Backend 🚀

Multi-tenant AI-powered lead qualification backend built with **NestJS**, **MongoDB**, **OpenAI**, and **Socket.IO WebSockets**.

---

## 📚 Documentation Links
- **[Living AI Changelog & Architectural Decisions](AI_README.md)**
- **[Complete WebSocket Event & REST API Reference](src/docs/WEBSOCKET_API.md)**
- **Interactive Swagger UI**: `http://localhost:3000/api`

---

## 🌟 Key Features
- **Multi-Tenant Architecture**: Complete data isolation between organizations.
- **Role-Based Auth (JWT)**: Access (15m) + Refresh (7d) tokens, bcrypt hashing, `ADMIN` role access guard.
- **WebSocket-First Design**: Real-time chats, messages, and lead streams via Socket.IO.
- **Conversational AI Lead Extraction**: Natural qualification via OpenAI structured outputs (`gpt-4.1-mini`).
- **Configurable Per-Organization Knowledge**:
  - `Lead Questions`: Information to collect before converting a customer into a Lead.
  - `Company Information`: Business profile, working hours, and pricing rules.
  - `Additional Information`: FAQs, visa/travel policies, and custom constraints.
- **Instagram Graph API Webhook**: Ingestion and automated processing for Instagram Direct Messages.

---

## 🛠️ Quick Start

### 1. Environment Setup
Fill in `.env`:
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1-mini
MONGODB_URI=mongodb://admin:password123@localhost:27017/lead_filter?authSource=admin
MONGODB_DB_NAME=lead_filter
PORT=3000

JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Instagram integration (optional)
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
INSTAGRAM_VERIFY_TOKEN=...
```

### 2. Install & Run
```bash
# Install dependencies
npm install

# Start development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 3. Open API Documentation
Visit `http://localhost:3000/api` in your browser.

---

## 👤 Default Seeded Admin Credentials
On initial startup (or via `npm run seed`), the system creates a default Organization (`Air Ticket Tour`) with complete tourism Knowledge items and a default Admin User:

| Property | Value |
|---|---|
| **Email** | `admin@airticket.uz` |
| **Password** | `Password123!` |
| **Role** | `ADMIN` |
| **Organization** | `Air Ticket Tour` |

Run manual seeder anytime:
```bash
npm run seed
```
