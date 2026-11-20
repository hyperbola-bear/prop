# Testing and Validation — Proppy

Use these checks to prove changes before calling work complete. Choose the smallest set that fully covers the changed area, and run the full gate before handoff/release-sensitive work.

## Primary gates

- Run `npm run test` for workspace Vitest suites.
- Run `npm run lint` and keep zero warnings.
- Run `npm run typecheck` for strict TypeScript across workspaces.
- Run `npm run build` before production-sensitive changes.
- After infra/db changes, run `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`, and curl `http://localhost:3100/api/health` plus `http://localhost:3101/api/health`.
- For worker changes, run `npm run worker:start` and verify expected ticks/effects.

## General validation expectations

- Prefer tests that reproduce the bug or cover the new behavior before implementation.
- For UI changes, perform a manual smoke test in addition to unit/build gates.
- For API/schema changes, test both success and failure paths.
- For deployment or OpenClaw/VPS changes, verify the actual runtime state with process/service checks and curl probes.
- Record any new validation workflow in this document so future agents can repeat it.
