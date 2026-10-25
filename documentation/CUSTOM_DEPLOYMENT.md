# Custom deployment

## Server location

- Host: `docker-i5`
- Compose directory: `/opt/stacks/notediscovery`
- Compose file: `/opt/stacks/notediscovery/compose.yml`
- Compose service: `notediscovery`
- Container: `notediscovery`
- Image: `ghcr.io/victortolosa/notediscovery:latest`

## Update the server

Pushes to `custom` build and publish the image. They do not restart the server.
After the `build-custom` GitHub Actions run succeeds, connect to `docker-i5` and
run:

```bash
cd /opt/stacks/notediscovery
docker compose pull notediscovery
docker compose up -d --force-recreate notediscovery
```

## Verify the update

```bash
cd /opt/stacks/notediscovery
docker compose ps notediscovery
docker inspect notediscovery --format '{{.Config.Image}}'
docker exec notediscovery sh -c \
  'test -f /app/frontend/dist/live-preview.js &&
   test -f /app/frontend/vendor/alpinejs/cdn.min.js &&
   test -f /app/frontend/vendor/mermaid/mermaid.esm.min.mjs' \
  && echo "Frontend assets installed"
docker logs --tail 50 notediscovery   # expect "Vendored browser libraries: N present"
```

The expected image is:

```text
ghcr.io/victortolosa/notediscovery:latest
```

After the container is healthy, hard-refresh the browser with `Cmd+Shift+R` or
`Ctrl+Shift+R`. The app registers a caching service worker; each build has its
own `VERSION`, so a normal reload picks up new files after that.

## One-command update

Use this only after the GitHub Actions build succeeds:

```bash
cd /opt/stacks/notediscovery && docker compose pull notediscovery && docker compose up -d --force-recreate notediscovery
```

## Roll back

Every custom build is also tagged with its Git commit. To roll back, change the
image in `/opt/stacks/notediscovery/compose.yml` from `latest` to the required
commit SHA, then recreate the service:

```bash
cd /opt/stacks/notediscovery
docker compose pull notediscovery
docker compose up -d --force-recreate notediscovery
```

## Staying in sync with upstream

Rule for merging `gamosoft/NoteDiscovery`: take upstream by default; keep the
fork's version only where upstream would remove a capability, and keep that
divergence small. The last sync (v0.32.1) is documented in
`documentation/UPSTREAM_SYNC_0.32.1_PLAN.md`; the larger v0.31.5 one in
`documentation/UPSTREAM_SYNC_0.31.5_PLAN.md`.

### Frontend assets

- Browser libraries come from upstream's `/static/vendor/`, downloaded and
  hash-checked by `scripts/vendor_assets.py` (the Dockerfile's vendor stage; run
  it once locally, or let `python run.py` do it).
- The npm build only produces the fork's Live Preview bundle
  (`frontend/dist/live-preview.js`): `npm run check:frontend`.
- `build-custom` stamps `VERSION` as `<upstream>-custom.<run number>`. Upstream's
  service worker cache and the immutable `?v=` asset URLs are keyed on it, so
  without a unique version browsers keep serving an old `app.js`.

### Intentional divergences from upstream

Expect conflicts around these on future syncs.

| # | Where | What the fork keeps |
|---|---|---|
| D1 | `frontend/index.html`, `frontend/login.html` head | `crossorigin="use-credentials"` on the manifest link (Cloudflare Access) and PNG app icons |
| D2 | `onEditorDrop`, `onUploadDragEnter`, `handleFileUploadDrop` in `frontend/app.js` | `.md` files dropped on the editor open the upload dialog (overwrite/rename/skip) targeting the open note's folder |
| D3 | `loadNote` in `frontend/app.js` | Prefetch and tab caches (network fetch uses upstream's `encodeVaultPath`) |
| D4 | Wikilink rendering in `frontend/app.js` | Default link text is the last path segment |
| D5 | Backlinks panel in `frontend/index.html` | One control per reference, no nested buttons |
| D6 | `scripts/vendor_assets.py`, `scripts/vendor_lock.json`, `backend/export.py`, `documentation/THIRD_PARTY.md` | DOMPurify 3.4.15 instead of upstream's 3.0.8 (sanitizer bypass fixes). On future syncs keep whichever version is newer |
| D7 | Homepage cards and list rows in `frontend/index.html` (`.homepage-star`) | A star next to delete: favorites for notes, starred folders for folders. The fork's own homepage redesign was retired for upstream's page in the v0.32.1 sync; this is the remaining glue |
| D8 | Theme bootstrap in `frontend/index.html`, `frontend/login.html`, `frontend/app.js`, `backend/main.py`, `config.yaml` | Saved/configured theme loaded as an early stylesheet (`?raw=true`); Obsidian is the configuration default. Preserve request ordering and failure handling when syncing theme code |

Fork-only glue with no upstream equivalent: Smart scroll sync is limited to the
classic editor (Live Preview uses percentage sync), and Live Preview applies
outside edits as a minimal change (`minimalReplacement`).

### Save and path mutation behavior

The fork sends revision hashes with editor saves, including cached tab loads,
and reuses its conflict banner when the server rejects a stale write. Saves are
serialized and acknowledge the submitted content. Navigation waits for pending
saves and stays in the editor on failure. Rename and move wait for the server
before changing local paths; typing during the operation is saved afterward.
Preserve this integration when syncing upstream save or navigation changes.

### Plugin settings migration

Plugin state now lives in `/app/data/.plugin-config.json`, on the existing notes
mount. No write permission on `/app/plugins` is required. Before recreating an
older container, preserve its settings if a legacy file exists:

```bash
docker exec notediscovery sh -c '
  if test -f /app/plugins/plugin_config.json && ! test -e /app/data/.plugin-config.json; then
    cp /app/plugins/plugin_config.json /app/data/.plugin-config.json
  fi'
```

Then pull and recreate the service normally. The app also imports the legacy
file automatically when it is still available, such as a mounted plugins folder.
