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
  server pulls. **Pushing publishes a deployable image but does not restart the
  server.** Commit freely; push only when explicitly asked. Follow
  [documentation/CUSTOM_DEPLOYMENT.md](documentation/CUSTOM_DEPLOYMENT.md) to
  pull and recreate the service on `docker-i5`.
- `main`: tracks upstream. Upstream releases are tagged from `main`
  (`release.ps1` → tag → `docker-publish.yml`); that flow is upstream's, not ours.
- **Syncing upstream into `custom`**: take upstream by default; keep the fork's
  version only where upstream would remove a fork capability, keep that
  divergence small, and list the caveats. Current divergences (D1-D5) and the
  asset pipeline are recorded in
  [documentation/CUSTOM_DEPLOYMENT.md](documentation/CUSTOM_DEPLOYMENT.md); the
  v0.31.5 sync is logged in `documentation/UPSTREAM_SYNC_0.31.5_PLAN.md`.

## Repo map

| Path | What it is |
|------|------------|
| `backend/` | FastAPI app. `main.py` (~2.4k lines) has ALL routes; `utils.py` file ops + path validation; `export.py` standalone-HTML export; `share.py` public share tokens; `themes.py`, `favorites.py`, `plugins.py` |
| `frontend/` | Single-page app served directly by FastAPI: `app.js` (~11k lines, one Alpine.js component, no build step) + `editor-commands.js` + `editor-markdown-continue.js` + `index.html` + `login.html` + `sw.js` (caching service worker) |
| `frontend/src/` → `frontend/dist/` | Fork-only Live Preview editor (CodeMirror), bundled by esbuild via `npm run build:frontend`. `dist/` is gitignored |
| `frontend/vendor/` | Browser libraries (Alpine, marked, DOMPurify, highlight.js, MathJax, Mermaid, vis-network, qrcode, Tailwind), downloaded and hash-checked by `scripts/vendor_assets.py` from `scripts/vendor_lock.json`. Gitignored |
| `tests/frontend/` | Node test runner suite for the editor commands and Live Preview (`npm test`) |
| `mcp_server/` | Separate stdio MCP process; talks to the backend over HTTP (`client.py`). Tool defs in `tools.py`, protocol in `server.py` |
| `plugins/` | Python plugins (`Plugin` class + hooks). `note_stats.py` is the built-in example |
| `themes/` | 13 CSS themes. Filename = theme ID; required CSS variables listed in `documentation/THEMES.md` |
| `locales/` | 12 UI translations (`en-US.json` is the reference; keys must exist in every file you touch; `npm test` requires the Live Preview keys in every locale) |
| `documentation/` | The real docs (also mountable into the app as a notes folder) |
| `docs/` | ⚠️ NOT docs — the marketing website (GitHub Pages, notediscovery.com) |
| `data/` | The running vault (gitignored — real user notes, never commit) |
| `design/` | Design assets: screenshots and `notediscovery.pen` (use Pencil MCP tools, never Read/Grep the `.pen` file) |
| `config.yaml` | App config; env vars override (see `documentation/ENVIRONMENT_VARIABLES.md`) |
| `VERSION` | Single source of version (pyproject, `/api/config`, the service worker cache name and `?v=` asset URLs). `build-custom` stamps it as `<upstream>-custom.<run>` in CI — don't commit that suffix |

## Run & verify

```bash
python run.py              # downloads frontend/vendor/ on first start, then uvicorn --reload on :8000
npm ci && npm run build:frontend   # Live Preview bundle; rerun after changing frontend/src/
npm test                   # Node tests (editor commands, Live Preview contract, locales)
npm run check:frontend     # tests + minified Live Preview build
docker-compose up          # build from source (docker-compose.ghcr.yml = prebuilt image)
```

- `npm test` covers the editor and Live Preview only; there are no backend
  tests. Verify behaviour by running the app and exercising the feature, or
  via curl against the REST API. Swagger UI at `/api`.
- Point `NOTES_DIR` at a disposable folder when testing destructive changes.
- Auth is disabled by default locally, so all endpoints are open on :8000.
- MCP smoke test: `python -m mcp_server` (needs the app running; env
  `NOTEDISCOVERY_URL`, `NOTEDISCOVERY_API_KEY`).

## Conventions

- Python: PEP 8, type hints, docstrings on public functions. Errors returned
  to clients go through `safe_error_message()` — never leak paths/tracebacks
  unless `server.debug: true`.
- JS: modern ES6+, app logic lives in `frontend/app.js` (one Alpine.js
  `noteApp()` component). Match the existing style (top-level `CONFIG`, plain
  methods, no additional framework). Edit it unminified — the Dockerfile
  minifies at image build time; never commit or diff minified output.
- Browser libraries come only from `scripts/vendor_lock.json` (pinned version +
  SHA-256). Don't add CDN `<script>` tags or reintroduce npm bundles for them;
  npm is only for the Live Preview bundle.
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
- Caching: `frontend/sw.js` (upstream) precaches the app script and serves
  `/static/` cache-first, and `?v=`-addressed assets are sent as immutable for a
  year. Both are keyed on `VERSION`, so every deployed build needs a distinct
  version (CI handles this). When testing locally, hard-refresh or use DevTools
  → Application → "Update on reload".
- Keep the manifest links (`/manifest.json`) in `index.html` and `login.html`
  credentialed (`crossorigin="use-credentials"`) — the deployment sits behind
  Cloudflare Access.
- `.favorites.json` in the notes folder stores favorites, starred folders and
  small synced UI preferences (`backend/favorites.py`).
- Links between notes: wikilinks `[[note]]` / `[[note|text]]` /
  `[[note#heading]]` AND markdown `[text](note.md)`. Graph + backlinks parse
  both — new link features must handle both syntaxes.
- A live NoteDiscovery MCP server (`mcp__notediscovery__*` tools) may be
  connected in Claude sessions. Those tools operate on the **real running
  vault**, not fixtures — don't use them for testing destructive changes.
- Keyboard shortcuts differ from upstream on this branch (Quick Switcher is
  Cmd/Ctrl+K, insert link is Cmd/Ctrl+Shift+K). `documentation/FEATURES.md`
  reflects the fork; the source of truth is the keydown handler in
  `frontend/app.js` `init()`.

## When making changes

1. Feature/product behavior → check the relevant `documentation/*.md` first;
   update it if behavior changes.
2. Keep diffs small and dependency-free; niche features belong in `plugins/`.
3. Screenshot-worthy UI changes: verify in the browser (app on :8000), both a
   light and a dark theme.
