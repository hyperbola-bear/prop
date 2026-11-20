# Development Workflow — Proppy

## Setup and common commands

Run commands from the project root unless a command explicitly changes directory.

- `npm install`
- `cp .env.example .env`
- `docker compose up -d`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run dev`
- `npm run worker:start`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Implementation workflow

1. Read `CLAUDE.md`, this workflow, and the relevant existing source/docs before editing.
2. State assumptions and success criteria for the change.
3. Prefer the smallest design that satisfies the requirement.
4. Edit surgically and match existing style.
5. Update or add tests with the change when behavior changes.
6. Run the relevant gates from `docs/TESTING_AND_VALIDATION.md`.
7. Update documentation before considering the work complete.

## Documentation workflow

- Use `CLAUDE.md` only for high-signal agent instructions and links.
- Put architecture/background details in `docs/PROJECT_CONTEXT.md` or a focused subsystem doc.
- Put setup and command changes in this file and `README.md` when user-facing.
- Put validation changes in `docs/TESTING_AND_VALIDATION.md`.
- For large new topics, create `docs/<topic>.md` and add a link from `CLAUDE.md` or the relevant focused doc.
