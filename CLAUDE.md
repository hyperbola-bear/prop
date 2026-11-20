# CLAUDE.md — Proppy

Agent-facing project guide. Keep this file short; deeper details live in focused docs referenced below.

## Project

- **Name:** Proppy
- **Type:** Singapore-first property marketplace monorepo
- **Root:** `/Users/clement/Desktop/openclaw/prop`
- **Purpose:** Marketplace MVP for browsing rentals, enquiries, listing properties, web/mobile experiences, admin flows, and background work from one monorepo.

## Read first

- `docs/PROJECT_CONTEXT.md` — architecture, important paths, constraints, and repo scan notes.
- `docs/DEVELOPMENT_WORKFLOW.md` — setup, common commands, implementation workflow, and style guidance.
- `docs/TESTING_AND_VALIDATION.md` — required verification gates and smoke tests.
- `docs/DOCUMENTATION_POLICY.md` — documentation update expectations after development work.

## Applicable saved memory

- OpenClaw VPS context applies: remote host is reachable via `ssh openclaw`; browser OAuth must account for headless operation.
- Use rigorous independent validation for OpenClaw/Hermes work: verify locally and remotely as applicable, not just via agent self-report.
- After development work, update the relevant project documentation.
- Apply Karpathy-style rules: state assumptions, keep changes simple and surgical, and verify against explicit success criteria.

## Non-negotiable working rules

1. Think before coding: surface assumptions, ambiguity, and tradeoffs before editing.
2. Keep changes minimal: no speculative features, broad refactors, or unrelated cleanup.
3. Make surgical edits: every changed line should trace back to the task.
4. Clean up only orphans/dead code introduced by the current change unless asked otherwise.
5. Define success criteria and run the relevant checks in `docs/TESTING_AND_VALIDATION.md`.
6. Update documentation after development work; if a topic becomes large, create or update a focused doc under `docs/` and reference it here.

## Quick commands

- `npm install`
- `cp .env.example .env`
- `docker compose up -d`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run dev`
- `npm run worker:start`
- `npm run test`

## Project-specific constraints

- Keep web cookies and mobile Bearer JWT flows compatible when changing API auth.
- Schema changes require migration/seed updates and docs updates.
- Do not commit real secrets from `.env`.
