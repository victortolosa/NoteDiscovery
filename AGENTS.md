# AGENTS.md

AI agent instructions for this repository live in [CLAUDE.md](CLAUDE.md)
(single source of truth — repo map, branch/deploy model, conventions, gotchas).
Read that file before making changes.

Quick facts if you read nothing else:

- Working branch is `custom`; **pushing to it deploys** (ghcr image build).
  Commit locally, don't push unless asked.
- No test suite — verify by running `python run.py` and exercising the app
  on http://localhost:8000 (Swagger at `/api`).
- `docs/` is the marketing website; real docs are in `documentation/`.
- `data/` is a real, gitignored notes vault — never commit or clobber it.
