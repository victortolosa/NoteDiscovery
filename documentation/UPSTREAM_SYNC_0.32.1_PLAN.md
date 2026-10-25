# Upstream Sync: `custom` → upstream v0.32.1

Brings `custom` from upstream v0.31.5 (`fe9f47b`) to v0.32.1 (`95df961`): 11
upstream commits. Done on `sync/upstream-0.32.1` in one merge commit, with the
fork follow-ups as separate commits. Same policy as the
[v0.31.5 sync](UPSTREAM_SYNC_0.31.5_PLAN.md): take upstream unless it removes a
fork capability.

## What upstream brought

- Native MCP endpoint at `/mcp` (Streamable HTTP, `backend/mcp_http.py`). Off by
  default; `MCP_ENABLED=true` turns it on, and with auth enabled it also needs
  an API key.
- Homepage list view (card/list toggle) and a name filter for the current folder.
- `frontend/markdown-preview.css`: preview styles shared by the app and
  share/export pages, moved out of `index.html`.
- Fixes: shared links being removed, export of non-ASCII notes, `#` rejected in
  filenames, case-insensitive duplicate checks (`notePathTaken`,
  `folderPathTaken`), note paths encoded with `encodeVaultPath`.

## Conflicts and resolutions

14 hunks in 5 files.

| File | Hunk | Resolution |
|---|---|---|
| `backend/main.py` | imports | Fork `favorites` import + upstream `export`/`mcp_http` imports |
| `locales/en-US.json`, `en-GB.json` | homepage keys | Upstream `view_cards`/`view_list`; fork-only `folders_heading`/`files_heading` dropped |
| `frontend/app.js` | `FORBIDDEN_CHARS`, homepage state and filter methods, `notePathTaken`, folder rename check, `goToHomepageFolder` | Upstream |
| `frontend/app.js` | `loadNote` (D3) | Fork prefetch/tab cache; its fetch uses `encodeVaultPath` |
| `frontend/app.js` | note rename | Both: fork `_updateTabPath`, then upstream's autosave flush |
| `frontend/index.html` | `<style>` | Upstream (preview CSS removed, `.homepage-list*` added). Fork's Obsidian default-theme scripts and critical CSS kept; `.table-wrapper` moved to `markdown-preview.css` |
| `frontend/index.html` | homepage header and body | Upstream's page, taken verbatim |

## Fork follow-ups

- Fork-only note fetches (prefetch, tab revalidation, upload dialog, rename)
  now use `encodeVaultPath`, so `#` and non-ASCII names work there too.
- The `.md` upload dialog (D2) flags conflicts with `notePathTaken`, matching
  upstream's case-insensitive create/import.
- `markdown-preview.css` font sizes multiply by `--font-scale`, so preview mode
  follows the font size setting. Share/export pages never set the variable.
- New divergence **D7**: a star next to delete on homepage cards and list rows.

## Caveats

- The fork's homepage redesign (Folders grid + Files list, folder `⋯` menu) is
  gone; upstream's page replaces it. Its folder-star action lives on as D7. The
  page also brings back upstream's app-name heading and tagline.
- Stars, like upstream's delete buttons, are hidden below the `sm` breakpoint.
- `/mcp` is disabled until configured.
