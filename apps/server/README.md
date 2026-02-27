# JSONROCK — Server (Backend)

Express + Socket.io backend for JSONROCK: REST API for shared JSON/text, file upload, and real-time collaboration rooms.

---

## Features

- **REST API** — Create, read, update, and unlock shared documents by slug
- **File upload** — Accept JSON files (≤2MB); validate and create a share link
- **Socket.io** — Room-based real-time sync (`code-change` events) with rate limiting
- **MongoDB** — Document store with TTL index (e.g. 30-day expiry for shares)
- **Validation** — Joi schemas on all share endpoints
- **Security** — Password hashing for private links; ownership not required for creation

---

## Tech stack

- [Node.js](https://nodejs.org/) ≥ 24  
- [Express 5](https://expressjs.com/), [Socket.io](https://socket.io/)  
- [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)  
- [Joi](https://joi.dev/) (validation), [Winston](https://github.com/winstonjs/winston) (logging), [Multer](https://github.com/expressjs/multer) (upload)  

---

## Prerequisites

- Node.js ≥ 24  
- pnpm ≥ 10  
- MongoDB (local or [Atlas](https://www.mongodb.com/cloud/atlas))

---

## Getting started

### 1. Environment variables

Create `apps/server/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/jsonrock
PORT=3005
```

### 2. Run from monorepo root (recommended)

```bash
# From jsonrock/
pnpm install
pnpm run dev:server
```

### 3. Run from this directory

```bash
cd apps/server
pnpm install
pnpm run dev
```

API: [http://localhost:3005](http://localhost:3005). Socket.io path: `/api/socket/io`.

---

## API reference

Base path: `/api` (e.g. `http://localhost:3005/api`).

### Share (CRUD + unlock)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/share` | Create a share. Body: `json`, `mode`, `isPrivate`, `accessType`, `password`, `type`, optional `slug`. Returns `{ slug, mode, type, isPrivate, accessType }`. |
| `GET`  | `/share/:slug` | Get metadata (and data if not private). Returns `{ type, data?, slug, isPrivate, accessType, mode }`. For private, `data` is null until unlocked. |
| `POST` | `/share/:slug` | Unlock with password. Body: `{ password }`. Returns same shape as GET with `data` populated. |
| `PUT`  | `/share/:slug` | Update share. Body: `json`, `mode`, `isPrivate`, `accessType`, `password`, `type`. Validates ownership/permissions. |

### Upload

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Upload a JSON file (form field `file`). Max 2MB. Returns `{ slug }`. |

### Raw fetch

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/:slug` | Get raw content (parsed JSON or plain text). For private shares, use query `?password=...`. |

---

## Socket.io

- **Path:** `/api/socket/io`  
- **Events (client → server):**  
  - `join-room` — payload: `slug` (string)  
  - `leave-room` — payload: `slug`  
  - `code-change` — payload: `{ slug, newCode }` (rate-limited; broadcast to room excluding sender)  
- **Events (server → client):**  
  - `code-change` — payload: `newCode` (string)  
  - `error` — e.g. rate limit message  

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `PORT` | No | 3005 | HTTP server port |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start with nodemon (watch) |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run start` | Run `node dist/index.js` |
| `pnpm run lint` | Run ESLint |
| `pnpm run lint:fix` | ESLint with auto-fix |
| `pnpm run format` | Prettier format |

---

## Data model (MongoDB)

Collection: `share_links`.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | string | Unique URL-safe id |
| `type` | enum | `json` \| `text` |
| `json` | string | Content (JSON string or plain text) |
| `mode` | enum | `visualize` \| `tree` \| `formatter` |
| `isPrivate` | boolean | Requires password to view |
| `accessType` | enum | `editor` \| `viewer` |
| `passwordHash` | string? | Hashed password when `isPrivate` |
| `createdAt` / `updatedAt` | date | Timestamps; TTL index on `createdAt` (e.g. 30 days) |

---

## Project layout

```
apps/server/
├── src/
│   ├── index.ts          # Express + Socket.io server, DB connect
│   ├── config/           # Logger
│   ├── controllers/      # share.controller
│   ├── db/               # MongoDB connection
│   ├── enums/            # Mode, AccessType, ShareType
│   ├── middleware/        # 404, error handler
│   ├── models/           # ShareLink (Mongoose)
│   ├── routes/           # share.routes
│   ├── services/         # share.service
│   ├── utils/            # multer, slug, validator
│   └── validators/       # Joi schemas
├── package.json
└── tsconfig.json
```

---

## Related docs

- [Monorepo root README](../../README.md) — Install, scripts, env for the whole repo  
- [Web app README](../web/README.md) — Frontend and how it uses this API  
