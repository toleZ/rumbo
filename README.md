# Rumbo

**An all-in-one personal productivity workspace: tasks, notes, habits, calendar, a focus timer and an AI assistant in a single web app.**

Full-stack TypeScript project, designed and built solo. Pre-launch, with a beta signup flow in place. The product is Spanish-first and fully translated to English.

## The problem

People who care about staying organized end up spreading their day across several tools: one for notes, one for tasks, one for habits, plus a calendar. Every switch costs attention, and nothing connects.

Rumbo puts those pieces in one coherent workspace that works the moment you open it. There is nothing to configure and no templates to browse: open it in the morning, close it at night.

## Features

- **Tasks** — multiple boards with a drag-and-drop kanban view and a list view. Tasks have priorities, scheduled and due dates, subtasks, labels, comments and reminders.
- **Notes** — rich-text editor with nested folders.
- **Habits** — yes/no and measurable habits (with a target and unit), flexible schedules (daily, specific weekdays, N times per week, every X days, N times per month), and exceptions for days off.
- **Calendar** — daily, weekly and monthly views. Connect Google Calendar to see your events and push tasks to it, manually or with auto-sync.
- **Today** — one screen with what is due, today's habits and upcoming reminders.
- **Focus tools** — Pomodoro timer with configurable work and break lengths, ambient sounds, and Spotify playback inside the app.
- **AI assistant** — a streaming chat that acts on your workspace through tool calls: it can list, create, update, move and delete tasks, manage subtasks, labels and reminders, and add comments.
- **Accounts** — registration with email verification codes, password reset, and "remember me" sessions.
- **Everywhere** — Spanish and English, light and dark themes, responsive layouts for mobile and tablet, reduced-motion support.

## Tech stack

| Layer | Tech |
|---|---|
| Language | TypeScript across client, server and shared code |
| Frontend | React 19, Vite, Tailwind CSS v4, Zustand, TanStack Query, React Router, react-i18next, Motion |
| Editor and interaction | Tiptap (rich text), dnd-kit (drag and drop) |
| Backend | Fastify 5, tRPC 11, Prisma 6 |
| Database | PostgreSQL 18 |
| Validation | Zod schemas in a shared package |
| Auth | Custom JWT access tokens, rotating refresh tokens in httpOnly cookies, bcrypt |
| Integrations | Google Calendar and Spotify (OAuth 2.0 with PKCE), OpenRouter for the AI model |
| Tooling | pnpm workspaces, Docker Compose, Mailpit for local email |

## Architecture

```
React client ──tRPC──▶ Router ──▶ Use case ──▶ Repository interface ──▶ Prisma ──▶ PostgreSQL
                                     │
                                     └──▶ Port ──▶ Spotify / Google Calendar / AI model
```

- **Monorepo with one source of validation truth.** `packages/shared` holds the Zod schemas and the domain types. The server validates tRPC input with those schemas, and client and server import the same entity types, so the two cannot drift apart.
- **Clean, layered server.** tRPC routers stay thin and delegate to use-case classes. Use cases depend on repository interfaces, and Prisma only appears in the infrastructure layer that implements them. External services sit behind ports, so they can be swapped without touching business logic.
- **End-to-end type safety.** tRPC carries server types to the client with no code generation step.
- **Typed domain errors.** Use cases throw errors such as `NotFoundError` or `ConflictError`; a single tRPC middleware maps them to HTTP status codes and keeps unexpected errors from leaking internals.
- **Authentication built from scratch.** 15-minute access tokens, refresh tokens that rotate on every use, one-time email codes with attempt limits, and rate limiting on the API.
- **Secure third-party connections.** OAuth flows use PKCE with the state kept in an encrypted httpOnly cookie, and provider tokens are stored encrypted with AES-256-GCM.
- **Multi-tenant by design.** Every repository query is scoped to the authenticated user.
- **Streaming AI.** Assistant replies are sent over Server-Sent Events from a dedicated Fastify route, with tool calls executed through the same user-scoped repositories as the rest of the API.
- **Client organized by feature.** Each area has its own folder, a lazily loaded page with a matching skeleton, and its own Zustand store. Colors and motion come from a shared set of design tokens.
- **Platform abstraction.** Session storage, OAuth launching and notification scheduling go through interfaces, which prepares the client for a native mobile shell.

## Project structure

```
packages/
├── shared/                  Zod schemas and shared types
├── server/
│   ├── prisma/              Schema, migrations and seed data
│   └── src/
│       ├── router/          tRPC routers (one per feature)
│       ├── application/     Use cases and ports
│       ├── domain/          Repository interfaces and domain errors
│       ├── infrastructure/  Prisma repositories, Spotify, Google, AI and crypto adapters
│       └── auth/, email/    JWT and session helpers, email templates
└── client/
    └── src/
        ├── components/      One folder per feature, plus shared UI primitives
        ├── stores/          One Zustand store per feature
        ├── pages/           Landing, auth and marketing pages
        ├── lib/             tRPC client, platform adapters, motion presets
        └── locales/         es.json and en.json
```

## Run locally

**Prerequisites:** Node 20.19+ (or 22.12+), pnpm, Docker

```bash
# 1. Start Postgres and Mailpit
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Set up the server environment
cp packages/server/.env.example packages/server/.env

# 4. Create the database schema and load demo data
pnpm db:migrate
pnpm db:seed

# 5. Start client and server
pnpm dev
```

Then open **http://127.0.0.1:5173** and sign in with the seeded demo account:

```
demo@rumbo.app / demo1234
```

| Service | URL |
|---|---|
| Client | http://127.0.0.1:5173 |
| Server | http://localhost:4000 |
| Mailpit inbox (verification and reset emails) | http://localhost:8025 |
| PostgreSQL | `localhost:5434` |

Use `127.0.0.1` rather than `localhost` for the client: Spotify does not accept `localhost` as an OAuth redirect host.

The core app runs with the defaults. The AI assistant, Spotify and Google Calendar are optional and each need their own keys in `packages/server/.env` (see `.env.example`).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run client and server in parallel |
| `pnpm dev:client` | Frontend only |
| `pnpm dev:server` | Backend only |
| `pnpm build` | Typecheck and build all packages |
| `pnpm --filter @rumbo/client lint` | Lint the client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

## Status

Rumbo is in active development ahead of a public beta. There is no automated test suite or CI pipeline yet; correctness currently relies on TypeScript, shared schemas and linting. The platform abstraction layer is the groundwork for a future native mobile shell.

## Author

**Juan Cruz Toloy** — [github.com/toleZ](https://github.com/toleZ)
