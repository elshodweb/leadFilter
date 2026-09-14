# LeadFilter

Backend for qualifying leads from Instagram conversations. It stores chats and messages, collects answers to an organization's lead questions, and lets an operator take over a conversation.

The [Next.js frontend](https://github.com/elshodweb/filter-leads) is maintained separately.

## How it works

An Instagram webhook starts the message flow. The backend saves the message, loads the organization's knowledge and conversation history, and requests a structured response from OpenAI. Collected answers update the chat and its lead. Socket.IO events deliver updates to the operator interface.

NestJS handles HTTP and WebSocket endpoints. MongoDB stores organizations, users, conversations, and leads. Services coordinate the workflow; repositories contain database queries. Instagram and OpenAI calls are in separate modules.

`ADMIN` is a global platform role, not an organization administrator. Other roles are scoped to their organization where those endpoints are available. Creating another administrator through `POST /auth/register` requires an existing administrator's access token.

## Local development

Use Node.js 22 and a local MongoDB instance.

```sh
npm ci
cp .env.example .env
```

Set `MONGODB_URI` for your local database. Generate two separate values with `openssl rand -hex 32` and use them for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Set `OPENAI_API_KEY` to use generated replies.

```sh
npm run start:dev
```

The default port is 3000. Swagger is at `http://localhost:3000/api`. The [WebSocket reference](src/docs/WEBSOCKET_API.md) lists event payloads.

For a disposable local database, `SEED_DEMO_DATA=true` creates sample data on startup. Its demo login is `admin@airticket.uz` / `Password123!`. Do not use demo data or credentials for a deployed environment. The demo seeder is blocked when `NODE_ENV=production`.

## Checks

```sh
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

The tests cover refresh-token reuse, concurrent refresh attempts, disabled accounts, message access across organizations, administrator-only provisioning, and safe error responses. HTTP tests run a small Nest application with an in-memory user repository; they do not require MongoDB or make external API calls. WebSocket handlers are tested directly.

## Deployment notes

The existing Compose file binds host port 3003 to container port 3003. Set `PORT=3003` in its `.env`. MongoDB is configured separately; Compose does not provision it.

Before upgrading an existing deployment, read [the authentication transition and remaining limitations](docs/operations.md). Passing these tests does not verify delivery to Instagram or concurrent writes against a real database.
