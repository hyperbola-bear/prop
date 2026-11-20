# Documentation Policy

Documentation is part of the definition of done for this project.

## Required after development work

After any code, configuration, deployment, schema, API, or workflow change:

1. Update `CLAUDE.md` if agent-facing commands, constraints, or architecture changed.
2. Update the relevant docs under `docs/` when behavior, setup, validation, operations, or data models changed.
3. Update `README.md` when user-facing setup or common commands changed.
4. If a new subsystem is added, create a focused doc for it instead of overloading `CLAUDE.md`.
5. Run the relevant validation gates listed in `docs/TESTING_AND_VALIDATION.md`.

## Style

- Keep docs specific and verifiable: include exact paths, exact commands, and expected outcomes.
- Prefer small focused docs over one large catch-all file.
- Do not document secrets or copy private credentials into markdown.
- When documenting a remote/VPS workflow, distinguish local commands from remote `ssh openclaw` commands.
