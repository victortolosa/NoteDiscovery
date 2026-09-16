# Upstream Sync Plan: `custom` → upstream v0.31.5

Brings the fork's `custom` branch from its last upstream merge (v0.28.3, `0cb11ae`)
up to `gamosoft/NoteDiscovery` v0.31.5 (`fe9f47b`): 109 upstream commits against 48
fork commits.

Work happens on `sync/upstream-0.31.5`, one merge commit per phase. `custom` only
moves after the final phase passes. `git rerere` is enabled so resolutions can be
replayed if a phase has to be redone.

## Why phased

A trial merge of `upstream/main` straight into `custom` produces 43 conflict hunks
across 6 files. Merging at intermediate upstream checkpoints spreads them out:

| Checkpoint | Cumulative hunks | New in phase |
|---|---|---|
| v0.28.4 (`999d21f`) | 1 | 1 |
| v0.29.1 (`7ed86d3`) | 16 | 15 |
| v0.30.1 (`836a1a2`) | 25 | 9 |
| mobile navigation, PR #283 (`b8a25fc`) | 28 | 3 |
| v0.31.1 (`84f9c26`) | 37 | 9 |
| v0.31.5 (`fe9f47b`) | 43 | 6 |

Conflicting files: `frontend/app.js`, `frontend/index.html`, `frontend/login.html`,
`frontend/sw.js`, `backend/main.py`, `run.py`.

## Resolution policy: upstream unless it removes a fork capability

Decided 2026-09-16 after phase 1. **Take upstream by default.** Keep the fork's
version only where upstream would remove something the fork can do today, and keep
that divergence as small as possible. Fork-only features upstream has no equivalent
for (CodeMirror Live Preview, tabs and tab cache, favorites/starred folders, homepage
redesign, markdown upload dialog) are kept with minimal glue. Each phase lists its
caveats.

### Agreed divergences from upstream

| # | Divergence | Why | Phase |
|---|---|---|---|
| D1 | `crossorigin="use-credentials"` on the manifest link; fork `pwa-icon-180.png` apple-touch-icon | PWA install behind Cloudflare Access; iOS ignores SVG touch icons | 2 |
| D2 | `.md` files dropped on the editor open the fork's upload dialog (target: current note's folder); media drops use upstream | Keeps overwrite/rename/skip conflict handling | 2 |
| D3 | `loadNote` keeps prefetch + tab cache (adopts upstream `closeMediaViewer()`) | Upstream has no tab/prefetch cache | 4 |
| D4 | Wikilink display text defaults to the last path segment | `[[folder/note]]` reads as "note" | 5 |
| D5 | Fork backlinks layout (one control per reference) + upstream `:title` path tooltip | Per-line navigation, no nested buttons | 6 |

Mitigation adopted instead of a divergence: the fork CI writes a unique `VERSION`
per build so upstream's caching service worker cannot serve a stale `app.js`.

## Standing decision: upstream asset pipeline for the app UI

- Libraries (Alpine, marked, DOMPurify, highlight.js, MathJax, Mermaid, vis-network,
  qrcode, Tailwind) load from upstream's `/static/vendor/` via
  `scripts/vendor_assets.py`, exactly as upstream's `index.html` does.
- The fork's npm/esbuild build is reduced to what upstream lacks: the Live Preview
  bundle (`/static/dist/live-preview.js`) plus editor tests. `vendor.js`,
  `mermaid-vendor.js`, `vis-network-vendor.js` and the Tailwind CSS build stop being
  referenced (removed in phase 3).
- `backend/export.py` print preview/export uses `/static/vendor/` too, so there is a
  single source of library versions.

Caveats:
- Tailwind runs as upstream's in-browser runtime script instead of a prebuilt CSS
  file: slightly slower first paint. `tailwind.config.cjs` has no theme extensions,
  so no styles are lost.
- Translations load with upstream's synchronous XHR before Alpine starts, replacing
  the fork's async loader in `vendor.js`.

## Standing caveat: service worker and Cloudflare Access

Taking upstream means taking its caching service worker and root `/manifest.json`.

- **High: stale app after deploy.** The fork removed this worker in `d8ae6f7` because
  its cache name is keyed off `VERSION`, which does not change between fork builds,
  so browsers served a stale `app.js` against a new `index.html` (blank sidebar).
  Upstream's `?v=__APP_VERSION__` has the same key. Mitigation without touching
  upstream code: have the fork's CI write a unique `VERSION` per build
  (e.g. `0.31.5-custom.<run number>`).
- **Medium: PWA install behind Cloudflare Access.** Upstream's
  `<link rel="manifest">` has no `crossorigin="use-credentials"`, so the manifest
  request is redirected to the Access login. Resolved by divergence D1.

---

## Phase 0: Setup

- [x] Branch `sync/upstream-0.31.5` from `origin/custom` (no upstream tracking, so a
      bare `git push` cannot hit `custom`).
- [x] `git config rerere.enabled true`
- [x] Record baseline: `npm run check:frontend` passes (42/42 tests, minified build).
      Backend smoke test (throwaway vault, key routes + every `/static` asset in
      `index.html`) passes.
- [ ] Docker build: Docker is not installed on the dev machine; covered by the GHCR
      workflow in phase 7 unless run elsewhere first.
- [ ] Manual browser check of Live Preview, tabs, favorites, uploads, sharing.

## Phase 1: up to v0.28.4 (1 hunk)

Brings: sibling-note link fix (#262), default theme env vars, `.md` drag-and-drop
(backend/locales), docker-compose sync.

| Hunk | Resolution |
|---|---|
| `app.js` `handleInternalLink` note lookup | **Take upstream**: adds resolve-relative-to-current-note and stem-name matching. |

Verify: `[x](sibling.md)` inside a subfolder note opens the right note.

## Phase 2: up to v0.29.1 (15 hunks)

Brings: anchor-based scroll sync (feature toggle), `APP_NAME`, OS-file drag-and-drop,
SEO, share-link scheme fix.

**Drag-and-drop** (`externalDragActive`, `onEditorDragOver`, `onEditorDrop`, file
filter). Upstream imports `.md` dropped on the editor as sibling notes; the fork has a
window-level overlay with a conflict modal.

- Take upstream's hunks (external-drag state, media drop handling).
- D2: `.md` files dropped on the editor go to the fork's upload dialog targeting the
  current note's folder instead of upstream's direct import.
- The fork's window overlay stays for drops outside the editor.

**Scroll sync** (editor handler, preview handler, restore, frame cancellation,
Mermaid anchor, anchor helpers). Upstream anchors measure a mirrored `<textarea>`,
which is wrong for CodeMirror.

- Take upstream's handlers verbatim for the textarea editor.
- Glue for Live Preview only: when `editorMode === 'live-preview'`, route through
  `getActiveEditorScrollMetrics()` / `setActiveEditorScrollPercentage()` with
  percentage sync, since upstream's anchors measure a mirrored `<textarea>`.
- Caveat: Smart scroll sync has no effect in Live Preview mode.

**Manifest/branding** (`main.py`, `index.html` head, `login.html`)

- Take upstream: `APP_NAME` helpers and the root `/manifest.json` (app name injected).
- D1: keep `crossorigin="use-credentials"` and the fork's PNG apple-touch-icon.

Verify: `npm test`; scroll sync in textarea and Live Preview, toggle on/off; drop
`.md` on editor vs. sidebar; `APP_NAME` override.

## Phase 3: up to v0.30.1 (9 hunks)

Brings: vendored assets, caching service worker, clickable preview checkboxes.

| Hunk | Resolution |
|---|---|
| `index.html` head library tags (2) | **Take upstream** (`/static/vendor/*`, Tailwind runtime, sync translation preload). |
| `index.html` bottom scripts | **Take upstream** (`?v=` script tags, SW registration) and keep fork-only tags: `editor-commands.js`, upload overlay/modal. Drop `dist/vendor.js`. |
| `app.js` highlight theme paths | **Take upstream** (`/static/vendor/highlight.js/styles/*`). Also repoint fork-only `dist/mathjax.js` and `dist/vis-network-vendor.js` loaders to upstream's vendor copies. |
| `app.js` preview click / task toggling | **Take upstream** (additive). |
| `sw.js`, `main.py` `/sw.js` route | **Take upstream** caching worker. |
| `main.py` `_check_vendored_assets` | **Take upstream**. |
| `run.py` | **Take upstream** `ensure_frontend_assets()`. |
| Build cleanup | Remove `frontend/src/vendor.js`, `mermaid-vendor.js`, `vis-network-vendor.js`, Tailwind build and their npm deps/scripts; keep `build:live-preview` and tests. Simplify the `Dockerfile` minifier stage accordingly. |

Verify: tick and Ctrl+click checkboxes in both editor modes. The fork's
`$watch('noteContent')` calls `replaceDocument()`, so **confirm Live Preview undo
survives a tick**; if not, pass `resetHistory: false` for preview-originated edits.
Print preview/export work; no SW errors in console.

## Phase 4: CORS fix + mobile navigation (3 hunks)

Brings: CORS credentials/wildcard fix (clean), mobile options navigation, lazy
Mermaid, immutable caching of versioned static assets.

| Hunk | Resolution |
|---|---|
| `app.js` Mermaid (2) | **Take upstream** `loadMermaid()` verbatim (`/static/vendor/mermaid/`). |
| `app.js` `loadNote` | **D3: keep fork** (prefetch → tab cache → fetch). In its 404 branch use `this.closeMediaViewer()`. |
| `app.js` `closeMediaViewer()` | **Take upstream** (additive). |

Verify: Mermaid note + theme switch; 404 note; mobile nav; tab cache.

## Phase 5: up to v0.31.1 (9 hunks)

Brings: plugin hook contract, `note_stats` fixes, absolute wikilink hrefs, open-task
search plugin, partial-word search.

| Hunk | Resolution |
|---|---|
| Lookup build (`setFirst`, `urlPath`) | **Take upstream**: map values are URL paths, not `true`. |
| `resolveWikiLink` / `wikiLinkExists` | **Take upstream** (both); grep fork code for lookups relying on `=== true`. |
| Wikilink rendering (2) | **D4**: upstream `resolvedPath`/`hrefTarget` + fork's `defaultLinkText`. |
| `handleInternalLink` leading-slash strip | **Take upstream**. |
| Stats link / inline-code counts | **Take upstream** (bug fixes). |

Verify: wikilinks from nested notes, `#heading` anchors, create-from-broken-link,
stats panel, plugins load.

## Phase 6: up to v0.31.5 (6 hunks)

Brings: custom share slugs, `SHARE_PUBLIC_ORIGIN`, archive API, XSS/post-logout
fixes, nested list styling, search path tooltip.

| Hunk | Resolution |
|---|---|
| Top-level constants | **Keep both** (`FOLDER_COLOR_PALETTE` + `SLUG_TRANSLITERATIONS`). |
| Share modal (4) | **Take upstream** (additive). |
| Stats task counting | **Take upstream** (`_scanTaskLines`). |
| `index.html` backlinks | **D5: keep fork layout**, add upstream's `:title="bl.path"`. |

Then confirm the security fix survived: compare `git show 9d3ff3c -- frontend/index.html`
against the merged file. Add fork-only locale keys to `locales/pl-PL.json` or accept
the en-US fallback.

Verify: create/rename share slug, QR code, share URL behind proxy, archive endpoint,
logout then Back.

## Phase 7: Finish

- [ ] `npm run check:frontend`, Docker build and run; startup log has no vendored-asset
      warning.
- [ ] CI: write a unique `VERSION` per build in `.github/workflows/build-custom.yml`.
- [ ] Document divergences D1-D5 and the asset pipeline in
      `documentation/CUSTOM_DEPLOYMENT.md`.
- [ ] Merge `sync/upstream-0.31.5` into `custom`, push, let GHCR build.
- [ ] Fast-forward `main` to `upstream/main`.

## Progress log

| Phase | Status | Notes |
|---|---|---|
| 0 | done | Baseline green. Smoke venv uses unpinned deps (Python 3.14 cannot build pinned pyyaml 6.0.1). |
| 1 | done | 1 hunk, took upstream. Sibling/stem link resolution verified against a mini vault; tests, build, smoke green. |
| 2 | pending | |
| 3 | pending | |
| 4 | pending | |
| 5 | pending | |
| 6 | pending | |
| 7 | pending | |
