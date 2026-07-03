# CLAUDE.md — AI collaboration guide

Context for AI assistants working in this repo. Human-facing docs live in
`documentation/` (features, API, plugins, themes, auth, MCP) — read those for
product behavior; this file covers what they don't: repo layout, workflows,
and gotchas.

## What this is

NoteDiscovery: a lightweight, self-hosted markdown note-taking app.
Notes are plain `.md` files under `data/` — **no database**. FastAPI backend,
vanilla-JS single-page frontend, optional MCP server for AI assistants.
Guiding philosophy (see CONTRIBUTING.md): lightweight, simple, minimal
dependencies, no over-engineering.

## This repo is a fork — branch model matters

- `origin` = victortolosa/NoteDiscovery (this fork), `upstream` = gamosoft/NoteDiscovery.
- **`custom`** (default working branch): personal patches on top of upstream.
  Every **push** to `custom` triggers `.github/workflows/build-custom.yml`,
  which builds and publishes the Docker image to ghcr.io that the deployment
  server pulls. **Pushing = deploying.** Commit freely; push only when
  explicitly asked.
- `main`: tracks upstream. Upstream releases are tagged from `main`
  (`release.ps1` → tag → `docker-publish.yml`); that flow is upstream's, not ours.

## Repo map

| Path | What it is |
|------|------------|
| `backend/` | FastAPI app. `main.py` (~2k lines) has ALL routes; `utils.py` file ops + path validation; `export.py` standalone-HTML export; `share.py` public share tokens; `themes.py`, `favorites.py`, `plugins.py` |
| `frontend/` | Single-page app: `app.js` (~8.7k lines, one file, no framework, no build step) + `index.html` + `login.html`. Served directly by FastAPI |
| `mcp_server/` | Separate stdio MCP process; talks to the backend over HTTP (`client.py`). Tool defs in `tools.py`, protocol in `server.py` |
| `plugins/` | Python plugins (`Plugin` class + hooks). `note_stats.py` is the built-in example |
| `themes/` | 13 CSS themes. Filename = theme ID; required CSS variables listed in `documentation/THEMES.md` |
| `locales/` | 11 UI translations (`en-US.json` is the reference; keys must exist in every file you touch) |
| `documentation/` | The real docs (also mountable into the app as a notes folder) |
| `docs/` | ⚠️ NOT docs — the marketing website (GitHub Pages, notediscovery.com) |
| `data/` | The running vault (gitignored — real user notes, never commit) |
| `design/` | Untracked scratch design assets (`.pen` file — use Pencil MCP tools, never Read/Grep it) |
| `config.yaml` | App config; env vars override (see `documentation/ENVIRONMENT_VARIABLES.md`) |
| `VERSION` | Single source of version (read by pyproject + `/api/stats`) |

## Run & verify

```bash
python run.py            # uvicorn backend.main:app --reload on :8000
docker-compose up        # build from source (docker-compose.ghcr.yml = prebuilt image)
```

- **There is no test suite.** Verify by running the app and exercising the
  feature, or via curl against the REST API. Swagger UI at `/api`.
- Auth is disabled by default locally, so all endpoints are open on :8000.
- MCP smoke test: `python -m mcp_server` (needs the app running; env
  `NOTEDISCOVERY_URL`, `NOTEDISCOVERY_API_KEY`).

## Conventions

- Python: PEP 8, type hints, docstrings on public functions. Errors returned
  to clients go through `safe_error_message()` — never leak paths/tracebacks
  unless `server.debug: true`.
- JS: modern ES6+, everything lives in `frontend/app.js`. Match the existing
  style (top-level `CONFIG`, plain functions, no framework). Edit it
  unminified — the Dockerfile minifies at image build time; never commit or
  diff minified output.
- Routes: add API endpoints to `api_router` in `backend/main.py` (it applies
  `require_auth`). Only deliberately-public routes (login, `/share/{token}`,
  `/api/themes/{id}`, `/health`) bypass it — think before adding another.
- New user-facing UI strings need keys in `locales/en-US.json` (and ideally
  all locales). Fallback is whole-file (missing locale → en-US); a key missing
  from a loaded locale renders as the raw key string.
- New theme CSS variables must be added to **all** files in `themes/`.
- Rate limiting exists via slowapi and is mostly gated behind `DEMO_MODE`.

## Gotchas

- **Path safety**: every endpoint that takes a path must stay inside the
  notes dir — use the existing validation helpers in `backend/utils.py`
  (directory-traversal checks). Same pattern for media.
- `PUT /api/media/{path}` intentionally only accepts in-place updates of
  `drawing-*.png` files and checks PNG magic bytes. Don't loosen it.
- Underscore-prefixed folders are system folders: `_attachments` (media),
  `_templates` (note templates). `.share-tokens.json` in the data dir stores
  share tokens.
- PWA was deliberately removed: `frontend/sw.js` is a self-unregistering
  stub and `manifest.json` is vestigial. Don't reintroduce service-worker
  caching.
- Links between notes: wikilinks `[[note]]` / `[[note|text]]` /
  `[[note#heading]]` AND markdown `[text](note.md)`. Graph + backlinks parse
  both — new link features must handle both syntaxes.
- A live NoteDiscovery MCP server (`mcp__notediscovery__*` tools) may be
  connected in Claude sessions. Those tools operate on the **real running
  vault**, not fixtures — don't use them for testing destructive changes.
- Keyboard shortcuts have drifted from upstream docs on this branch (e.g.
  Quick Switcher is Cmd/Ctrl+K here). Check `frontend/app.js` and recent
  commits on `custom` before trusting `documentation/FEATURES.md` tables.

## When making changes

1. Feature/product behavior → check the relevant `documentation/*.md` first;
   update it if behavior changes.
2. Keep diffs small and dependency-free; niche features belong in `plugins/`.
3. Screenshot-worthy UI changes: verify in the browser (app on :8000), both a
   light and a dark theme.
