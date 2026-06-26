# Rumbo

Personal productivity app with tasks, habits, notes, calendar, and a Pomodoro timer. Built for daily use — open in the morning, close at night. Spanish-first, dark mode included.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, tRPC client |
| Backend | Fastify, tRPC, Prisma ORM, JWT auth |
| Database | PostgreSQL 18 (Docker) |
| Monorepo | pnpm workspaces (`client`, `server`, `shared`) |
| Email (dev) | Mailpit |

## Run locally

**Prerequisites:** Node 18+, pnpm, Docker

```bash
# 1. Start Postgres + MailHog
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Set up server env
cp packages/server/.env.example packages/server/.env
# Edit DATABASE_URL if needed (default: postgresql://rumbo:rumbo@localhost:5432/rumbo)

# 4. Run migrations (and optional seed)
pnpm db:migrate
pnpm db:seed      # optional — creates demo@rumbo.app / demo1234

# 5. Start dev servers
pnpm dev
```

- Client → http://localhost:5173
- Server → http://localhost:4000
- Mailpit UI → http://localhost:8025

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run client + server in parallel |
| `pnpm dev:client` | Frontend only |
| `pnpm dev:server` | Backend only |
| `pnpm build` | Build all packages |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed with demo data |
| `pnpm db:studio` | Open Prisma Studio |
