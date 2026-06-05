# Proppy

Singapore-first property marketplace MVP — browse rentals, enquire with agents, list properties, and manage everything from a single monorepo.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 16 App Router, Tailwind v4 CSS-first, TypeScript |
| Mobile | Expo SDK 56 + react-native-web (Expo Web target on :3101) |
| API | Next.js Route Handlers (shared surface for web cookies + mobile Bearer JWT) |
| Database | PostgreSQL 16 + PostGIS 3.4 (Drizzle ORM) |
| Storage | MinIO S3-compatible (photo uploads, presigned POST) |
| Mail | Mailpit SMTP (local dev inbox on :8025) |
| Worker | Node.js background process (listing expiry, email queue, SLA tracking, saved-search alerts) |
| Testing | Vitest, ESLint, TypeScript strict, agent-browser (E2E) |

## Architecture

```
apps/web      → Next.js on :3100 (pages + API routes + cookie auth)
apps/mobile   → Expo Router on :3101 (Expo Web; shares API client + schemas)
apps/worker   → Background ticks on :3102 (expiry, email, SLA, saved-search alerts)
packages/db   → Drizzle schema, migrations, seed
packages/shared → Zod schemas, scam detection, OTP, MyInfo mock, SSRF guard, API client
packages/ui   → Shared Tailwind + design tokens
packages/validation → Shared validation utilities
packages/config → Shared tsconfig + ESLint config
```

All apps share a single Postgres+PostGIS database, a single MinIO bucket, and the same API surface served by `apps/web` route handlers.

## Prerequisites

- Node.js 22+
- Docker Desktop (or Docker Engine + Docker Compose)
- npm 10+

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd prop
npm install

# 2. Configure environment
cp .env.example .env   # defaults work for local dev

# 3. Start infrastructure
docker compose up -d    # postgres (:5432), minio (:9000/:9001), mailpit (:1025/:8025)

# 4. Initialize database
npm run db:migrate
npm run db:seed         # creates 7 users, 20 listings, CEA/MRT fixtures

# 5. Start dev servers
npm run dev             # web :3100 + mobile :3101
npm run worker:start    # worker :3102 (in a separate terminal)

# 6. Verify
curl http://localhost:3100/api/health   # {status:"ok",db:"ok",storage:"ok",mail:"ok"}
curl http://localhost:3101/api/health   # {status:"ok"}
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start web (:3100) + mobile (:3101) concurrently |
| `npm run build` | Production build all workspaces |
| `npm run test` | Vitest across all workspaces |
| `npm run lint` | ESLint with zero warnings |
| `npm run typecheck` | TypeScript strict check all workspaces |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Insert development fixtures (idempotent) |
| `npm run db:reset` | Drop + recreate + migrate + seed |
| `npm run worker:start` | Start background worker on :3102 |

## Environment Variables

See `.env.example` for the full list. Key variables:

- `DATABASE_URL` — Postgres connection string
- `AUTH_SECRET` / `JWT_SECRET` — Session/JWT signing keys
- `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` — MinIO config
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` — Mailpit SMTP

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| proppy-postgres | 5432 | Postgres 16 + PostGIS 3.4 |
| proppy-minio | 9000 (API) / 9001 (Console) | S3-compatible photo storage |
| proppy-mailpit | 1025 (SMTP) / 8025 (Web) | Dev email inbox |

## Features

- **Browse & Search** — Filtered listings with FTS, geo-radius (MRT), sort, keyset pagination, map view (Leaflet + OneMap)
- **Auth** — Email/phone signup with OTP verification, MyInfo mock for locals, CEA registration lookup for agents, jose HS256 JWT cookies
- **Listings** — 7-step wizard (HDB/condo/room), photo upload via presigned S3 POST, agent on-behalf-of flow, pause/refresh/delist
- **Favorites & Saved Searches** — Toggle favorites, save search filters, email alerts on new matches (5-min worker tick)
- **Messaging** — Enquiry conversations, chat thread polling, scam detection scoring (deposit-before-viewing, crypto, offsite payment), 60/min rate limit, 24h SLA tracking
- **Agents & Admin** — Public agent profiles with P50/P90 response times, verified/unverified reviews, seller property verification, admin queues for verifications + reports
- **PDPA** — Soft-delete cascade (user + owned listings), login denied after deletion
- **Resilience** — SIGINT/SIGTERM signal forwarding, idempotent seed, health watchdog (503 on DB down), stack restart < 60s

## Project Structure

```
prop/
├── apps/
│   ├── web/          # Next.js 16 App Router (pages, API routes, auth)
│   ├── mobile/       # Expo SDK 56 (shared screens + testIDs)
│   └── worker/       # Background ticks (expiry, email, SLA, alerts)
├── packages/
│   ├── db/           # Drizzle schema, migrations, seed data
│   ├── shared/       # Zod schemas, API client, scam detection, OTP, MyInfo, SSRF guard
│   ├── ui/           # Tailwind theme + shared components
│   ├── validation/   # Shared validation utilities
│   └── config/       # Shared tsconfig + ESLint
├── docker-compose.yml
├── turbo.json
└── package.json      # npm workspaces root
```
