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

## Standing decision: keep both frontend asset pipelines

- The fork's npm/esbuild bundle (`/static/dist/`) remains the app UI's source.
- Upstream's `scripts/vendor_assets.py` (`/static/vendor/`) is **also kept**, because
  `backend/export.py` print preview/export now loads highlight.js, marked, DOMPurify,
  MathJax and Mermaid from `/static/vendor/` as classic scripts, which the ESM
  bundles cannot replace.
- The auto-merged `Dockerfile` already runs both stages; accept it.
- Cost: larger image. Benefit: working offline exports and far fewer recurring
  conflicts in `export.py`, `run.py` and `main.py` on future syncs.

---

## Phase 0: Setup

- [x] Branch `sync/upstream-0.31.5` from `origin/custom` (no upstream tracking, so a
      bare `git push` cannot hit `custom`).
- [x] `git config rerere.enabled true`
- [ ] Record baseline: `npm run check:frontend`; Docker build; manual check of Live
      Preview, tabs, favorites, uploads, sharing.

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

- Take upstream's hunks, so editor drops use upstream handling.
- In the fork's `onUploadDragEnter`, return early when the drag target is inside the
  editor, so the overlay only handles drops elsewhere. `onUploadDrop` already ignores
  `e.defaultPrevented`, so no double import.

**Scroll sync** (editor handler, preview handler, restore, frame cancellation,
Mermaid anchor, anchor helpers). Upstream anchors measure a mirrored `<textarea>`,
which is wrong for CodeMirror.

- Take upstream's structure: frame cancellation, `smartScrollSync` branch,
  `{editorPct}` storage shape.
- Replace direct `editor.scrollTop` reads/writes with `getActiveEditorScrollMetrics()`
  / `setActiveEditorScrollPercentage()`.
- Gate anchor sync with `this.smartScrollSync && this.editorMode !== 'live-preview'`;
  Live Preview uses percentage sync.
- Anchor helper methods and Mermaid `data-source-line` preservation: take verbatim.

**Manifest/branding** (`main.py`, `index.html` head, `login.html`)

- `main.py`: take upstream's `APP_NAME` helpers; keep the fork's legacy-SW comment.
- `<link rel="manifest">`: use upstream's `/manifest.json` (app name injected) but
  **keep `crossorigin="use-credentials"`** for Cloudflare Access. Keep the fork's
  `pwa-icon-180.png` apple-touch-icon.

Verify: `npm test`; scroll sync in textarea and Live Preview, toggle on/off; drop
`.md` on editor vs. sidebar; `APP_NAME` override.

## Phase 3: up to v0.30.1 (9 hunks)

Brings: vendored assets, caching service worker, clickable preview checkboxes.

| Hunk | Resolution |
|---|---|
| `index.html` head library tags (2) | **Keep fork** (`/static/dist/tailwind.css`, dist highlight theme). Do not add `/static/vendor` tags or the synchronous translation preload. |
| `index.html` bottom scripts | **Keep fork** (editor-commands, `dist/vendor.js`, upload overlay/modal). Adopt `?v=__APP_VERSION__` on the classic script tags. **Drop** SW registration. |
| `app.js` highlight theme paths | **Keep fork** (`/static/dist/highlight-github*.css`). |
| `app.js` preview click / task toggling | **Take upstream** (additive). Point the preview's `@click` at `handlePreviewClick`. |
| `sw.js`, `main.py` `/sw.js` route | **Keep fork** self-unregistering worker; taking upstream's token-replace line is harmless. |
| `main.py` `_check_vendored_assets` | **Take upstream** (fork `index.html` references no vendor paths, so it logs "0 present"). |
| `run.py` | **Take upstream** `ensure_frontend_assets()`; exports need `/static/vendor`. |

Verify: tick and Ctrl+click checkboxes in both editor modes. The fork's
`$watch('noteContent')` calls `replaceDocument()`, so **confirm Live Preview undo
survives a tick**; if not, pass `resetHistory: false` for preview-originated edits.
Print preview/export work; no SW errors in console.

## Phase 4: CORS fix + mobile navigation (3 hunks)

Brings: CORS credentials/wildcard fix (clean), mobile options navigation, lazy
Mermaid, immutable caching of versioned static assets.

| Hunk | Resolution |
|---|---|
| `app.js` Mermaid (2) | **Take upstream `loadMermaid()` / `window.mermaidReady`**, import `/static/dist/mermaid-vendor.js` instead. Drop fork's inline `_mermaidModulePromise`. |
| `app.js` `loadNote` | **Keep fork** (prefetch → tab cache → fetch). In its 404 branch use `this.closeMediaViewer()`. |
| `app.js` `closeMediaViewer()` | **Take upstream** (additive). |

Verify: Mermaid note + theme switch; 404 note; mobile nav; tab cache.

## Phase 5: up to v0.31.1 (9 hunks)

Brings: plugin hook contract, `note_stats` fixes, absolute wikilink hrefs, open-task
search plugin, partial-word search.

| Hunk | Resolution |
|---|---|
| Lookup build (`setFirst`, `urlPath`) | **Take upstream**: map values are URL paths, not `true`. |
| `resolveWikiLink` / `wikiLinkExists` | **Take upstream** (both); grep fork code for lookups relying on `=== true`. |
| Wikilink rendering (2) | **Merge**: fork's `defaultLinkText` + upstream `resolvedPath`/`hrefTarget`. |
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
| `index.html` backlinks | **Keep fork layout**, add `:title="bl.path"` to the note-name button. |

Then confirm the security fix survived: compare `git show 9d3ff3c -- frontend/index.html`
against the merged file. Add fork-only locale keys to `locales/pl-PL.json` or accept
the en-US fallback.

Verify: create/rename share slug, QR code, share URL behind proxy, archive endpoint,
logout then Back.

## Phase 7: Finish

- [ ] `npm run check:frontend`, Docker build and run; startup log has no vendored-asset
      warning.
- [ ] Note the dual pipeline in `documentation/CUSTOM_DEPLOYMENT.md`.
- [ ] Merge `sync/upstream-0.31.5` into `custom`, push, let GHCR build.
- [ ] Fast-forward `main` to `upstream/main`.

## Progress log

| Phase | Status | Notes |
|---|---|---|
| 0 | in progress | |
| 1 | pending | |
| 2 | pending | |
| 3 | pending | |
| 4 | pending | |
| 5 | pending | |
| 6 | pending | |
| 7 | pending | |
