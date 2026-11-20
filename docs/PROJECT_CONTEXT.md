# Project Context — Proppy

Generated from a repository scan of `/Users/clement/Desktop/openclaw/prop`. Dependency folders, caches, generated outputs, binary assets, local databases, and secrets were intentionally excluded from documentation extraction.

## Purpose

Marketplace MVP for browsing rentals, enquiries, listing properties, web/mobile experiences, admin flows, and background work from one monorepo.

## Stack

- Node.js 22+
- npm workspaces
- Next.js 16 App Router
- React 19
- Tailwind v4
- Expo SDK 56/react-native-web
- PostgreSQL 16 + PostGIS
- Drizzle ORM
- MinIO
- Mailpit
- Vitest
- ESLint
- TypeScript strict

## Important paths

- `apps/web` is the Next.js web app and API route surface on :3100.
- `apps/mobile` is the Expo Router app/web target on :3101.
- `apps/worker` runs background expiry/email/SLA/saved-search ticks on :3102.
- `packages/db` owns Drizzle schema, migrations, and seeds.
- `packages/shared` owns schemas, scam detection, OTP, MyInfo mock, SSRF guard, and shared API client.
- `packages/ui` contains shared design tokens/components.
- `packages/validation` contains shared validation utilities.
- `packages/config` contains shared TS/ESLint config.
- `docker-compose.yml` starts Postgres/PostGIS, MinIO, and Mailpit.

## Constraints and safety boundaries

- Keep web cookies and mobile Bearer JWT flows compatible when changing API auth.
- Schema changes require migration/seed updates and docs updates.
- Do not commit real secrets from `.env`.

## Related docs

- `CLAUDE.md` — short agent entrypoint.
- `docs/DEVELOPMENT_WORKFLOW.md` — setup and day-to-day workflow.
- `docs/TESTING_AND_VALIDATION.md` — gates that prove changes work.
- `docs/DOCUMENTATION_POLICY.md` — documentation definition of done.
