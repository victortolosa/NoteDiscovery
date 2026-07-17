# Live preview MVP progress

## Current status

- Status: deployed to `origin/custom` as an opt-in experiment
- Branch: `custom`
- Original base: `custom` at `8317241`
- Upstream integrated: `0cb11ae` (version 0.28.3)
- Initial deployed feature commit: `9e09a80`
- Current session: initial custom-branch rollout complete
- Next session: collect daily-use feedback, then complete the remaining parity gates
- Direction: keep Classic as the default and Live Preview available through the
  Settings toggle
- Last updated: 2026-07-17

See [LIVE_PREVIEW_MVP_PLAN.md](LIVE_PREVIEW_MVP_PLAN.md) for scope, architecture,
acceptance criteria, and the go/no-go checkpoint.

See [LIVE_PREVIEW_PARITY_PLAN.md](LIVE_PREVIEW_PARITY_PLAN.md) for the work after
the evaluation gate.

## Scope guard

The current objective is to close the evaluation, then restore existing editor
workflows. Do not add more live-preview syntax during parity work. Headings,
emphasis, inline code, lists, links, and tasks are the frozen presentation
baseline; all other Markdown remains editable source.

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

- [x] Parse Markdown with the CodeMirror language tree.
- [x] Decorate headings.
- [x] Decorate bold and italic text.
- [x] Decorate inline code.
- [x] Hide eligible delimiters outside the active region.
- [x] Reveal syntax on the active line.
- [x] Reveal syntax intersecting selections.
- [x] Map styling to existing CSS variables.
- [x] Check light and dark themes.
- [x] Record verification results.
- [x] Commit Session 3.

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

### Session 5: shared commands and writing mechanics

- [x] Extract editor-independent Markdown commands.
- [x] Enable the full formatting toolbar in Live Preview.
- [x] Route Classic and Live Preview shortcuts through the shared commands.
- [x] Restore list, quote, ordered-list, and task continuation on Enter.
- [x] Restore Tab and Shift+Tab without overriding focus navigation when disabled.
- [x] Add `Cmd/Ctrl+Enter` task toggling.
- [x] Add unit and disposable-browser coverage.

### Session 6: search and navigation

- [x] Render sidebar search matches as CodeMirror decorations.
- [x] Restore F3 and Shift+F3 current-match movement.
- [x] Restore search context when a note or editor surface opens.
- [ ] Move outline navigation to exact source offsets.
- [ ] Verify backlink and history focus behavior.
- [ ] Restore wikilink insertion and deliberate link activation.

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
| 2026-07-17 | Session 3 | In-app browser | Heading, emphasis, and inline-code decorations | Pass | Typography applied from Markdown syntax-tree nodes |
| 2026-07-17 | Session 3 | In-app browser | Active-line and selected-range reveal | Pass | Markers revealed immediately; selecting all exposed all supported source syntax |
| 2026-07-17 | Session 3 | Browser clipboard | Copy source | Pass | Copied text matched complete Markdown, including delimiters and final newline |
| 2026-07-17 | Session 3 | Light and dark themes | Existing theme-token mapping | Pass | Editor and inline code updated without editor-specific theme configuration |
| 2026-07-17 | Session 3 | Malformed, unsupported, Unicode, and RTL fixtures | Source fallback | Pass | Tables, Mermaid, math, HTML, unclosed syntax, RTL text, and emoji remained source |
| 2026-07-17 | Session 3 | 67,001-character fixture | Editing and virtualization | Pass | Fill completed in 136 ms; 33 DOM lines represented 3,201 source lines |
| 2026-07-17 | Session 3 | Filesystem comparison | Untouched fixture preservation | Pass | All seven untouched fixture copies remained byte-for-byte identical |
| 2026-07-17 | Session 3 extension | Nested ordered and unordered lists | Structure and styling | Pass | Markers remained visible and used the active theme accent |
| 2026-07-17 | Session 3 extension | Direct, reference, and automatic links | Readable-label rendering | Pass | Destination syntax hid outside the active region; copied source remained complete |
| 2026-07-17 | Session 3 extension | Task checkboxes | Click, autosave, and source round-trip | Pass | `[ ]`, `[x]`, and `[X]` toggled through transactions; toggling back restored exact bytes |
| 2026-07-17 | Session 3 extension | Wikilink fixture | Source fallback | Pass | `[[folder/note\|Readable label]]` remained untouched source |
| 2026-07-17 | `6565e4e` | Git merge | Upstream 0.28.3 integration | Pass | Resolved app, index, runner, and environment-documentation conflicts; retained custom tabs, favorites, drag/drop, and theme behavior |
| 2026-07-17 | Stabilization | Frontend checks | Unit tests and minified build | Pass | Six tests passed; all dependencies exact; lazy bundle built successfully |
| 2026-07-17 | Stabilization | In-app browser on port 8001 | Persisted Live Preview mount | Pass | Note opening mounted exactly one CodeMirror editor with no line-number gutter |
| 2026-07-17 | Stabilization | Disposable vault on port 8002 | View transitions | Pass | Live Preview remained mounted once across view transitions before Split was removed from its experimental UI |
| 2026-07-17 | Session 5 | Frontend checks | Shared command unit tests and minified build | Pass | Fourteen tests passed; toolbar, indentation, task, table, and continuation commands are editor-independent |
| 2026-07-17 | Session 5/6 | Disposable vault on port 8002 | Live and Classic editor smoke checks | Pass | Toolbar and shortcut formatting, Enter continuation, keyboard task toggle, search highlighting, F3 movement, and Classic fallback passed |
| 2026-07-17 | Presentation cues | Disposable vault on port 8002 | Preview-only syntax styling | Pass | Frontmatter, tables, fences, display math, blockquotes, HTML, images, and wikilinks received non-document cues; fixture bytes remained identical |
| 2026-07-17 | `9e09a80` | GitHub `origin/custom` | Fast-forward deployment | Pass | Local and remote `custom` matched; Classic remained the default and Live Preview remained opt-in through Settings |
| 2026-07-17 | `18804a2` | GitHub Actions and repository docs | Custom update workflow | Pass | Recorded `/opt/stacks/notediscovery/compose.yml`, the manual pull/recreate command, verification steps, and rollback procedure |

## Decisions

### 2026-07-17: deploy as an opt-in custom feature

Decision: fast-forward `custom` to `9e09a80` and push the Live Preview work to
`origin/custom` without changing the default editor.

Reason: desktop editing, persistence, shared formatting commands, search,
conflict handling, source preservation, and Classic fallback passed the local
release checks. Safari, iPhone, attachments, and the remaining navigation and
lifecycle parity work are not complete, so removing Classic or making Live
Preview the default would be premature.

### 2026-07-17: keep Split Classic-only during the experiment

Decision: hide Split while Live Preview is active. Selecting Live Preview from
an existing Split layout moves to Edit. Preview remains available as the full
rendered view.

Reason: Live Preview already provides formatted context while editing. Removing
the simultaneous rendered pane reduces integration surface and avoids coupling
the experiment to split-scroll synchronization. Classic retains all three view
modes unchanged.

### 2026-07-17: stabilize against upstream before parity features

Decision: integrate upstream 0.28.3 and resolve the code-review findings before
starting toolbar, attachment, or navigation parity.

Completed:

- Replaced the experiment's duplicate `NOTES_DIR` work with upstream's version.
- Kept CodeMirror focus and scrolling behind the adapter.
- Routed Split synchronization and saved scroll positions through the active
  editor rather than the hidden textarea.
- Added transactional document and range replacement boundaries.
- Disabled the Live Preview option when its generated bundle is unavailable.
- Localized settings, loading, error, editor, and task-widget labels in every
  shipped locale.
- Locked `html-minifier-terser` in the package manifest and Docker build.
- Added frontend contract and Markdown continuation tests.

Reason: building parity on the stale 0.27.2 integration would have compounded
known conflicts with upstream editor shortcuts, media handling, resizing, and
vault indexing changes.

### 2026-07-17: freeze presentation syntax for parity work

Decision: proceed with planning for full application parity while keeping the
current Markdown presentation set unchanged.

Reason: the current preview already demonstrates the intended editing model.
The higher-value next work is restoring toolbar, keyboard, navigation,
attachment, layout, and lifecycle behavior. Additional rendered syntax can be
evaluated later from daily-use evidence.

Session 4 remains a release-quality evaluation gate rather than being treated
as complete without Safari and iPhone results.

### 2026-07-17: preserve Edit, Split, and Preview as independent view modes

Decision: Live Preview changes only the editor used by the editable pane. The
existing Edit, Split, and Preview choices and the rendered Preview pane remain
unchanged. Classic remains selectable as a fallback.

Reason: keeping editor type separate from view layout limits the patch's blast
radius, preserves the full renderer as a correctness reference, and makes the
feature reversible without disrupting established workflows.

Superseded in part by the later decision to keep Split Classic-only while Live
Preview remains experimental. Edit and Preview are still independent of editor
implementation.

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

### 2026-07-17: preview-only syntax cues

#### Objective

Make source that receives additional formatting in Preview distinguishable from
syntax rendered directly in Live Preview.

#### Completed

- Added a restrained tertiary background and accent rail to preview-only block
  constructs.
- Covered frontmatter, tables, fenced code and Mermaid, display math,
  blockquotes and callouts, HTML blocks, and horizontal rules.
- Added dotted cues for Markdown images and wikilinks.
- Kept visual cues outside the document and limited line decorations to visible
  ranges.
- Kept fenced-code markers visible instead of treating them as inline-code
  delimiters.

#### Verification

- Seventeen frontend tests and the minified bundle build passed.
- Dark-theme visual inspection passed after reducing the initial background
  strength.
- Copied source was 301 bytes, matching the fixture exactly.
- Untouched disposable fixtures remained byte-for-byte identical.

#### Issues

- Inline math remains plain source; block display math receives the cue.

#### Next step

Collect daily-use feedback on cue density before adding more syntax categories.

### 2026-07-17: shared commands and search integration

#### Objective

Integrate the first five editor-parity surfaces without expanding rendered
Markdown syntax.

#### Completed

- Made the existing formatting toolbar available in Live Preview.
- Added a pure source-command layer shared by Classic and Live Preview.
- Routed formatting shortcuts, Enter continuation, indentation, and keyboard
  task toggling through transactional edits.
- Added CodeMirror search decorations and current-match navigation while
  retaining NoteDiscovery's sidebar search system.
- Re-applied search state after note loads, content updates, editor mounting,
  and Edit/Preview transitions.

#### Verification

- `npm run check:frontend`: passed with fourteen tests and a 501 KB minified
  lazy bundle.
- `node --check frontend/app.js`: passed.
- `git diff --check`: passed.
- Disposable browser checks passed for Live Preview and Classic formatting,
  list continuation, task toggling, search highlighting, and F3 navigation.

#### Issues

- Session 6 outline, backlink, wikilink, and deliberate link activation work
  remains.
- The pre-existing `stickyHeading` and `stickySubHeading` Alpine errors remain
  unchanged.

#### Next step

Complete the remaining Session 6 navigation paths, unless the outstanding
Safari and iPhone Session 4 evaluation is prioritized first.

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

### 2026-07-17: basic live-preview behavior

#### Objective

Determine whether syntax-tree-driven formatting and delimiter reveal can provide
a readable editor without compromising Markdown source or cursor behavior.

#### Completed

- Added locked Markdown language and parser dependencies.
- Added syntax-tree decorations for ATX headings, strong emphasis, emphasis,
  and inline code.
- Added replacement decorations for heading, emphasis, and code delimiters.
- Added atomic ranges for hidden delimiters.
- Revealed syntax on every active line and across non-empty selections.
- Limited decoration work to CodeMirror's visible ranges.
- Styled supported constructs with existing NoteDiscovery theme variables.

#### Verification

- Inactive heading and inline delimiters hid while their source remained intact.
- Moving the cursor to a heading immediately revealed its complete marker.
- Selecting the document revealed every supported delimiter.
- Copying the selection returned the exact Markdown source and final newline.
- Heading sizes and weights matched their levels.
- Bold, italic, combined emphasis, and multi-backtick inline code rendered.
- Light and dark themes updated editor and inline-code colors from shared tokens.
- Unsupported constructs remained visible source.
- Malformed Markdown, Arabic, Hebrew, other Unicode, and emoji copied intact.
- A 67,001-character, 3,201-line fixture filled in 136 ms in the test browser;
  CodeMirror kept only 33 lines in the DOM.
- The large fixture autosaved all 67,001 characters.
- Seven untouched fixture copies remained byte-for-byte identical.
- Development and minified bundles, npm audit, JavaScript syntax, and
  `git diff --check` passed.

#### Issues

- The minified Live Preview bundle increased from about 277 KB to 503 KB after
  adding the Markdown parser. This is acceptable for the prototype because it
  remains lazy-loaded, but it belongs in the Session 4 evaluation.
- iPhone Safari has not yet been tested.
- Full Docker image verification still requires a running Docker daemon.

#### Next step

Evaluate ordinary writing, cursor movement, layout shifts, browser behavior,
and iPhone Safari before making the go, revise, or stop decision.

### 2026-07-17: lists, links, and task checkboxes

#### Objective

Extend the successful syntax-tree prototype with common structured writing
elements requested after the initial Session 3 review.

#### Completed

- Enabled Lezer's task-list parser extension.
- Styled ordered and unordered list markers without hiding their structure.
- Collapsed direct links and explicit reference links to readable labels.
- Styled autolinks while preserving their visible URL.
- Added accessible checkbox widgets that update `[ ]`, `[x]`, and `[X]`
  markers through CodeMirror transactions.
- Hid task-list bullets and checkbox source outside the active region.
- Revealed complete link and task syntax on active lines and selections.
- Added completed-task styling and a dedicated fixture.
- Left wikilinks as source to avoid partial interpretation by the standard
  Markdown parser.

#### Verification

- Nested bullet and ordered markers remained visible and correctly indented.
- List markers inherited the current theme accent.
- Direct-link destinations and titles hid without leaving stray punctuation.
- Reference-link labels collapsed while their definitions remained source.
- Autolink URLs remained readable.
- Selecting all revealed complete link and task Markdown.
- Copying returned direct links, task markers, and wikilinks unchanged.
- Clicking an open checkbox saved `[x]`; clicking it again restored `[ ]`.
- Completed task text used line-through styling.
- All disposable fixture files remained byte-for-byte identical after the
  checkbox round-trip.
- The minified lazy bundle remained approximately 505 KB.

#### Issues

- Link navigation is not interactive yet; links are presentation-only in the
  editable surface.
- Wikilink rendering and navigation require a NoteDiscovery-specific parser
  extension and remain out of this focused change.

#### Next step

Continue with Session 4 evaluation before adding more syntax or editor parity.

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
