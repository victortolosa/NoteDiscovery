# Live preview MVP progress

## Current status

- Status: Session 2 complete
- Branch: `feature/live-preview`
- Base: `custom` at `8317241`
- Current session: Session 2 — editing and persistence
- Next session: Session 3 — live-preview behavior
- Decision: pending
- Last updated: 2026-07-17

See [LIVE_PREVIEW_MVP_PLAN.md](LIVE_PREVIEW_MVP_PLAN.md) for scope, architecture,
acceptance criteria, and the go/no-go checkpoint.

## Scope guard

The current objective is to evaluate editing feel and technical viability. Do
not expand the MVP into full editor parity before Session 4 records a go
decision.

## Session checklist

### Session 1: build and mounting foundation

- [x] Add `package.json` and `package-lock.json`.
- [x] Add the reproducible frontend build command.
- [x] Add a readable Live Preview source module.
- [x] Generate a separate browser bundle.
- [x] Update the Docker build.
- [x] Add the Classic/Live Preview preference.
- [x] Dynamically mount and destroy CodeMirror.
- [x] Verify Classic startup and behavior.
- [x] Verify mode switching without content loss.
- [x] Record verification results.
- [x] Commit Session 1.

### Session 2: editing and persistence

- [x] Make CodeMirror authoritative while mounted.
- [x] Mirror document changes into `noteContent`.
- [x] Integrate autosave.
- [x] Integrate manual save.
- [x] Handle note switching.
- [x] Preserve stale-file conflict detection.
- [x] Add basic undo and redo.
- [x] Add source-preservation checks.
- [x] Record verification results.
- [x] Commit Session 2.

### Session 3: live-preview behavior

- [ ] Parse Markdown with the CodeMirror language tree.
- [ ] Decorate headings.
- [ ] Decorate bold and italic text.
- [ ] Decorate inline code.
- [ ] Hide eligible delimiters outside the active region.
- [ ] Reveal syntax on the active line.
- [ ] Reveal syntax intersecting selections.
- [ ] Map styling to existing CSS variables.
- [ ] Check light and dark themes.
- [ ] Record verification results and commit.

### Session 4: evaluation and decision

- [ ] Run all disposable fixtures.
- [ ] Verify byte-for-byte preservation of untouched source.
- [ ] Test Safari and Chrome on macOS.
- [ ] Test Safari on iPhone.
- [ ] Record cursor and selection observations.
- [ ] Record layout-shift observations.
- [ ] Record performance observations.
- [ ] Compare against Classic and full Preview.
- [ ] Record a go, revise, or stop decision.

## Verification record

| Date | Commit | Environment | Check | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-17 | `8317241` | Local repository | Clean branch created from `custom` | Pass | No implementation changes yet |
| 2026-07-17 | Session 1 | Node 25.2.0 | Locked development and minified builds | Pass | 590 KB development bundle; 277 KB minified bundle |
| 2026-07-17 | Session 1 | Local Uvicorn | Startup, health endpoint, and generated module serving | Pass | Module served as JavaScript from `/static/dist/live-preview.js` |
| 2026-07-17 | Session 1 | In-app browser | Classic default, Live Preview mount, and return to Classic | Pass | Existing note content remained `test`; real vault content was not edited |
| 2026-07-17 | Session 1 | Docker | Image build | Not run | Docker daemon was unavailable; Dockerfile build commands passed independently |
| 2026-07-17 | Session 2 | Disposable vault on port 8002 | Autosave and manual save | Pass | Saved Markdown matched the expected source, including final newline |
| 2026-07-17 | Session 2 | In-app browser | CodeMirror undo and redo | Pass | Keyboard history worked without invoking Classic history |
| 2026-07-17 | Session 2 | In-app browser | Immediate note switch | Pass | Pending edit saved before navigation; undo did not cross the note boundary |
| 2026-07-17 | Session 2 | API and in-app browser | External file conflict and reload | Pass | Local source remained until confirmation; reload reset CodeMirror history |
| 2026-07-17 | Session 2 | Filesystem comparison | Untouched fixture preservation | Pass | All five untouched fixture copies remained byte-for-byte identical |

## Decisions

### 2026-07-17: use a time-boxed vertical prototype

Decision: validate basic editing and live-preview feel before migrating complete
textarea parity.

Reason: cursor behavior, syntax reveal, layout movement, and iPhone selection are
the highest-risk assumptions. Testing them after full parity would spend too
much effort before validating the core experience.

### 2026-07-17: retain Classic throughout the MVP

Decision: Live Preview remains optional and locally selected.

Reason: this isolates experimental behavior and provides an immediate fallback.

## Open questions

- Should the experimental preference appear in Settings immediately, or remain
  behind a temporary development control during the first mounting work?
- What exact device and iOS version will be used for Session 4?

Resolve questions only when they block the next session. Avoid designing later
parity work during the MVP.

## Known risks

- The current editor is coupled to formatting, toolbar, outline, search,
  drag-and-drop, paste, scrolling, and stale-content behavior.
- Competing CodeMirror and Alpine histories could cause duplicate undo actions.
- Hidden delimiters can create surprising cursor or selection movement.
- Decoration changes can cause visible line reflow.
- iOS editing behavior may determine whether Live Preview remains desktop-only.
- Adding a Node build changes the repository's previously build-free frontend
  development workflow.

## Session log

### 2026-07-17: build and mounting foundation

#### Objective

Add a reproducible, opt-in CodeMirror foundation without changing the Classic
editor path.

#### Completed

- Added locked direct dependencies for CodeMirror state, view, and commands.
- Added readable adapter source and generated separate ESM bundle commands.
- Ignored generated bundles and Node dependencies.
- Updated Docker to use `npm ci` and build the minified editor module.
- Added a persisted Editor mode setting with Classic as the default.
- Added lazy CodeMirror loading, mounting, content mirroring, and destruction.
- Kept the Classic textarea, handlers, overlay, and toolbar intact.
- Allowed CodeMirror to own keyboard undo and redo while it has focus.
- Added local build instructions to the MVP plan.

#### Verification

- `npm run build:live-preview`: passed.
- `npm run build:live-preview:minify`: passed.
- `npm audit --omit=dev`: passed with zero vulnerabilities.
- `node --check frontend/app.js`: passed.
- `git diff --check`: passed.
- `.venv/bin/python run.py` and `/health`: passed.
- Browser selection, lazy mount, note-content transfer, destroy, and Classic
  restoration: passed without editing the real vault.
- Docker image build: not run because the local Docker daemon was unavailable.

#### Issues

- Browser reload exposed pre-existing Alpine errors for undefined
  `stickyHeading` and `stickySubHeading`; the same missing state exists on
  `custom` and was not added to this patch.
- Disposable note editing remains for Session 2 so verification does not touch
  the real `data/` vault.

#### Next step

Create a disposable fixture-vault workflow, then verify CodeMirror edits,
autosave, manual save, note switching, and history ownership in Session 2.

### 2026-07-17: editing and persistence

#### Objective

Verify that CodeMirror can own editing state while continuing to use the
application's save and conflict workflows without touching the real vault.

#### Completed

- Added a `NOTES_DIR` runtime override and documented its safe use.
- Added seven source fixtures and disposable-vault instructions.
- Reset CodeMirror state and history for application-driven content changes.
- Prevented live edits from entering the Classic textarea history.
- Reset Classic history when content transfers back from Live Preview.
- Hid Classic undo and redo controls while Live Preview is active.
- Added Live Preview focus handling for newly created notes.
- Kept autosave, manual save, outline, metadata, statistics, and conflict
  processing on the existing application path.

#### Verification

- Autosave persisted exact expected Markdown and its final newline.
- Manual save persisted immediately through `Cmd+S`.
- CodeMirror keyboard undo and redo restored the correct source.
- An immediate note switch flushed the pending edit before navigation.
- Undo after a note switch did not restore content from the previous note.
- An API-side external change produced the existing conflict banner without
  replacing local editor content.
- Reloading the external version updated CodeMirror and reset its history.
- Untouched disposable fixtures remained byte-for-byte identical.
- Local servers on ports 8001 and 8002 remained healthy.
- JavaScript syntax, Python compilation, bundle build, and `git diff --check`
  passed.

#### Issues

- A full Docker image build remains unverified because the local daemon is not
  running.
- The Session 3 decorations still need explicit RTL and malformed-Markdown
  testing; Session 2 verified only source preservation for those fixtures.

#### Next step

Add the Markdown parser and implement heading, emphasis, and inline-code
decorations with active-line and selection-based syntax reveal.

### Resolved questions

- `frontend/dist/` is generated locally and ignored by Git.
- Session 1 uses only direct CodeMirror state, view, and commands packages.
- The experimental preference is visible in Settings and clearly labeled.

Add one entry per working session using this structure:

```markdown
### YYYY-MM-DD: session title

#### Objective

Short description.

#### Completed

- Concrete result.

#### Verification

- Command or manual check and result.

#### Issues

- Defect, uncertainty, or `None`.

#### Next step

Single recommended continuation point.
```
