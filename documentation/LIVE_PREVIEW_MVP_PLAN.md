# Live preview MVP plan

## Purpose

Determine whether a CodeMirror 6 live-preview editor feels sufficiently better
than the classic textarea to justify a full implementation.

This is a time-boxed prototype, not a commitment to replace the existing
editor.

## Branch and deployment boundary

- Work on `feature/live-preview`, created from `custom` at `8317241`.
- Keep `custom` unchanged during the experiment.
- Do not push or deploy unless explicitly requested.
- Keep Classic as the default editor.
- Do not use notes from `data/` for development fixtures or destructive tests.

## MVP scope

### Include

- A locked Node package manifest and reproducible editor build.
- A separately generated CodeMirror bundle.
- A local Editor mode preference with Classic and Live Preview options.
- CodeMirror mounting and cleanup when editor modes change.
- Loading and switching notes.
- Editing and autosaving through the existing save path.
- Manual save.
- Exact Markdown as the stored source.
- Basic keyboard undo and redo.
- Headings.
- Bold and italic text.
- Inline code.
- Ordered and unordered list markers.
- Direct, reference, and automatic links.
- Interactive task checkboxes backed by Markdown source.
- Active-line and selected-range syntax reveal.
- Styling through existing theme variables.
- Focused testing on macOS and iPhone Safari.

### Exclude

- Full textarea feature parity.
- Wikilink navigation.
- Inline image previews.
- Blockquotes and horizontal-rule presentation.
- Search-result and outline navigation integration.
- Drag-and-drop or attachment insertion.
- Custom toolbar migration beyond what is needed to exercise the prototype.
- Tables, Mermaid, math, HTML, callouts, and plugin syntax.
- Removing or restructuring classic-editor code.
- Making Live Preview the default.

Unsupported Markdown remains visible as source text.

## Architecture constraints

### State ownership

While CodeMirror is mounted, its document is the authoritative editable state.
The adapter mirrors document changes into Alpine `noteContent` so existing save
and stale-content behavior can continue to operate.

External content changes must enter CodeMirror through the adapter. Application
code must not manipulate CodeMirror directly.

### Editor adapter

The MVP adapter should expose only the operations the spike needs:

```javascript
mount(parent, content, options)
destroy()
getContent()
setContent(markdown)
focus()
getSelection()
setSelection(from, to)
getScrollPosition()
setScrollPosition(position)
```

Additional operations belong in later parity work, not speculative MVP code.

### Build behavior

- Pin direct CodeMirror and build dependencies in `package-lock.json`.
- Build live preview as a separate browser module.
- Load that module only when Live Preview is selected.
- Use the same build command locally and in Docker.
- Document the one-time local build requirement.
- Do not commit minified source in place of readable source files.

### Presentation behavior

- Use the Markdown syntax tree, not regular expressions, to identify supported
  syntax.
- Apply typography with mark and line decorations.
- Hide only eligible delimiter ranges.
- Reveal supported syntax on the active line.
- Reveal syntax intersecting any selection.
- Preserve underlying Markdown without presentation characters or conversions.
- Use atomic ranges only for hidden delimiters where cursor behavior benefits.

## Sessions

### Session 1: build and mounting foundation

Deliverables:

- Add the Node package manifest and build script.
- Add the Live Preview module entry point.
- Add the editor-mode preference, defaulting to Classic.
- Dynamically load, mount, and destroy a plain CodeMirror editor.
- Keep the classic textarea path unchanged.
- Confirm `python run.py` still starts in Classic mode.
- Confirm the Docker build generates and serves the editor bundle.

Exit criteria:

- A note can be opened in both modes.
- Switching modes does not lose content.
- Reloading preserves the selected mode.
- Classic mode behaves as it did before the branch.

Local development commands:

```bash
npm install
npm run build:frontend
.venv/bin/python run.py
```

Run the build again after changing files under `frontend/src/`, the Tailwind
configuration, or production dependency versions. The generated
`frontend/dist/` directory is intentionally ignored by Git.

### Session 2: editing and persistence

Deliverables:

- Synchronize CodeMirror transactions to `noteContent`.
- Integrate existing autosave and manual save behavior.
- Handle note switching and programmatic content replacement.
- Add basic undo and redo.
- Preserve the existing stale-file conflict path.
- Prevent feedback loops between CodeMirror and Alpine state.

Exit criteria:

- Editing and saving a disposable note preserves exact Markdown.
- Rapid note switching does not cross-contaminate content.
- An external content change is detected rather than silently overwritten.
- Undo and redo operate on the CodeMirror history without double application.

### Session 3: live-preview behavior

Deliverables:

- Add Markdown language parsing.
- Style headings, bold, italic, and inline code.
- Style ordered and unordered lists and supported Markdown links.
- Render source-backed task-checkbox widgets outside the active region.
- Hide supported delimiters outside the active region.
- Reveal syntax on the active line and across selections.
- Map appearance to existing CSS variables.

Exit criteria:

- Cursor movement and selection remain predictable.
- Copying selected content returns Markdown source.
- Unsupported syntax remains editable source text.
- Switching themes updates the editor without a second theme system.
- Long lines and moderately long notes remain responsive.

### Session 4: evaluation and decision

Deliverables:

- Exercise the fixture set on macOS Safari and Chrome.
- Exercise core editing on iPhone Safari.
- Record defects and subjective editing observations.
- Compare the experience with Classic and full Preview.
- Make a documented go, revise, or stop decision.

Exit criteria:

- No source corruption is observed.
- Known cursor, selection, layout, and mobile issues are documented.
- The decision checkpoint below has an explicit outcome.

## MVP fixtures

Create fixtures outside `data/` covering:

```text
basic-prose.md
headings-and-emphasis.md
inline-code.md
unsupported-constructs.md
unicode-and-rtl.md
malformed-markdown.md
large-document.md
```

For each source-preservation check:

1. Copy the fixture into a disposable notes directory.
2. Start NoteDiscovery against that directory.
3. Open and edit the note in Live Preview.
4. Save it.
5. Compare the saved Markdown with the expected result.
6. Confirm untouched syntax remains byte-for-byte unchanged.

## Evaluation criteria

Score each area as pass, concern, or fail:

- Ordinary prose entry is more comfortable than Classic.
- Formatting is easier to read without obscuring source control.
- Cursor movement is predictable around hidden delimiters.
- Text selection, copy, paste, and undo are trustworthy.
- Syntax reveal does not cause unacceptable layout movement.
- macOS editing is consistently comfortable.
- iPhone editing is usable enough to retain as an opt-in mode.
- Source Markdown remains exact and recoverable.
- The adapter boundary appears maintainable for later parity work.
- Runtime and bundle costs are proportionate to the improvement.

## Decision checkpoint

### Go

Proceed to full parity only if the prototype materially improves daily writing,
preserves source reliably, and has no fundamental cursor or mobile flaw.

### Revise

Allow one narrowly defined follow-up experiment when a specific implementation
change is likely to resolve the primary concern.

### Stop

Stop and remove the experiment if the benefit is marginal, source integrity is
uncertain, or cursor and mobile problems appear structural.

Time already invested is not a reason to proceed.

## Work after a go decision

Full parity and interactive elements are defined in
[LIVE_PREVIEW_PARITY_PLAN.md](LIVE_PREVIEW_PARITY_PLAN.md). The current
presentation syntax is frozen during parity work; unsupported Markdown remains
editable source.
