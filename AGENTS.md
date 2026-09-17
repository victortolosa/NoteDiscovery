# AGENTS.md

AI agent instructions for this repository live in [CLAUDE.md](CLAUDE.md)
(single source of truth — repo map, branch/deploy model, conventions, gotchas).
Read that file before making changes.

Quick facts if you read nothing else:

- Working branch is `custom`; **pushing to it deploys** (ghcr image build).
  Commit locally, don't push unless asked.
- `npm test` covers the editor and Live Preview; there are no backend tests.
  Verify by running `python run.py` and exercising the app on
  http://localhost:8000 (Swagger at `/api`).
- Syncing upstream: take upstream unless it removes a fork feature; see
  CLAUDE.md and `documentation/CUSTOM_DEPLOYMENT.md`.
- `docs/` is the marketing website; real docs are in `documentation/`.
- `data/` is a real, gitignored notes vault — never commit or clobber it.
