# Tark-Vitark

A real-time debate platform. Users register, schedule and host debate rooms, register for a
side (for / against), and argue live over WebSockets with persisted chat history. Built as a
MERN + Socket.IO application.

- **Frontend:** React (Vite), React Router, Tailwind CSS, Socket.IO client — deployed on Vercel
- **Backend:** Node/Express 5, MongoDB (Mongoose), Socket.IO, JWT auth — deployed on Render

> The payment module is a work in progress and is intentionally excluded from the current scope.

---

## Architecture

```
┌────────────────────┐        HTTPS (cookies)         ┌────────────────────┐
│   React (Vite)     │  ───────────────────────────▶  │   Express 5 API    │
│   Vercel           │        WebSocket (JWT)         │   Render           │
│                    │  ◀───────────────────────────  │                    │
│  - AuthContext     │                                │  - REST + Socket.IO│
│  - axios (refresh) │                                │  - JWT (httpOnly)  │
└────────────────────┘                                └─────────┬──────────┘
                                                                │
                                                       ┌────────▼─────────┐
                                                       │   MongoDB Atlas  │
                                                       └──────────────────┘
```

- **Auth** uses short-lived access tokens + rotating refresh tokens, both stored in `httpOnly`
  cookies. The client silently refreshes on a 401 and retries the original request.
- **Real-time chat** authenticates every socket connection against the JWT (cookie or handshake),
  so identity can never be spoofed by the client. Messages persist to MongoDB and are broadcast
  to the room.
- **Layering:** `routes → validation (Zod) → controllers → models`, with shared `ApiError` /
  `ApiResponse` / `asyncHandler` utilities and a global error handler.

---

## Getting started (local, ~10 minutes)

### Prerequisites
- Node.js 20+
- A MongoDB instance (local `mongod`, Docker, or an Atlas connection string)

### 1. Backend

```bash
cd Backend
cp .env.example .env        # then fill in the values (see the table below)
npm install
npm run dev                 # http://localhost:8000
```

### 2. Frontend

```bash
cd Frontend
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env.local
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173, register an account, and you're in.

---

## Environment variables

### Backend (`Backend/.env`)

| Variable                 | Required | Description                                             |
|--------------------------|----------|---------------------------------------------------------|
| `PORT`                   | no       | Server port (default `8000`)                            |
| `NODE_ENV`               | no       | `development` \| `test` \| `production`                 |
| `MONGODB_URI`            | **yes**  | Mongo connection string, **without** a trailing db name |
| `CORS_ORIGIN`            | no       | Comma-separated allowed origins (default localhost:5173)|
| `ACCESS_TOKEN_SECRET`    | **yes**  | Secret for signing access tokens                        |
| `ACCESS_TOKEN_EXPIRY`    | no       | e.g. `1d` (default `1d`)                                |
| `REFRESH_TOKEN_SECRET`   | **yes**  | Secret for signing refresh tokens                       |
| `REFRESH_TOKEN_EXPIRY`   | no       | e.g. `10d` (default `10d`)                              |
| `CLOUDINARY_*`           | no       | Cloudinary creds for avatar uploads (optional)          |

The server validates these at boot and exits with a clear message if a required one is missing.

### Frontend (`Frontend/.env.local`)

| Variable              | Required | Description                                    |
|-----------------------|----------|------------------------------------------------|
| `VITE_API_BASE_URL`   | **yes**  | Base URL of the API, including `/api/v1`       |

---

## Scripts

| Location | Command            | What it does                          |
|----------|--------------------|---------------------------------------|
| Backend  | `npm run dev`      | Start API with nodemon                |
| Backend  | `npm test`         | Vitest + Supertest + in-memory Mongo  |
| Backend  | `npm run lint`     | ESLint                                |
| Frontend | `npm run dev`      | Vite dev server                       |
| Frontend | `npm run build`    | Production build                      |
| Frontend | `npm test`         | Vitest + React Testing Library        |
| Frontend | `npm run lint`     | ESLint                                |

---

## Testing

- **Backend:** integration tests (Supertest) for the full auth lifecycle, debate creation and
  registration, chat-history authorization, plus Socket.IO auth + message round-trip, and unit
  tests for the JWT middleware. Runs against an ephemeral in-memory MongoDB.
- **Frontend:** React Testing Library specs for the login flow and protected-route behavior.

Both suites run in CI (GitHub Actions) on every push and pull request.

---

## API overview

All routes are prefixed with `/api/v1`. Auth is via `httpOnly` cookies.

| Method | Path                              | Auth | Description                     |
|--------|-----------------------------------|------|---------------------------------|
| POST   | `/users/register`                 | –    | Create an account               |
| POST   | `/users/login`                    | –    | Log in (sets cookies)           |
| POST   | `/users/refresh`                  | –    | Rotate tokens                   |
| POST   | `/users/logout`                   | ✓    | Log out                         |
| GET    | `/users/current`                  | ✓    | Current user                    |
| GET    | `/debates/active`                 | –    | Ongoing debates                 |
| GET    | `/debates/upcoming`               | –    | Scheduled debates               |
| POST   | `/debates/create`                 | ✓    | Host a debate                   |
| POST   | `/debates/register`               | ✓    | Register for a debate (stance)  |
| GET    | `/debates/:id`                    | ✓    | Debate details                  |
| GET    | `/messages/:debateId`             | ✓    | Chat history (participants only)|

**Socket.IO events:** `joinRoom`, `sendMessage` → server broadcasts `receiveMessage`,
`roomUpdate`, `error`.
