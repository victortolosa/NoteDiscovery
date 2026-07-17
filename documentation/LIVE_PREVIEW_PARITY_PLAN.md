# Live Preview parity plan

## Goal

Make Live Preview a dependable alternative to Classic for NoteDiscovery's
existing editing workflows without expanding the current Markdown presentation
scope.

Live Preview will continue to present only:

- ATX headings.
- Bold and italic emphasis.
- Inline code.
- Ordered and unordered lists.
- Direct, reference, and automatic links.
- Task checkboxes.

All other Markdown remains visible, editable source. Full parity does not mean
full rendered-preview parity.

## Product direction

- Preserve Edit, Split, and Preview for Classic; offer Edit and Preview when
  Live Preview is active.
- Treat Classic and Live Preview as choices for the editable pane only.
- Keep the existing rendered Preview pane unchanged in Split and Preview modes.
- Keep Classic available throughout the work.
- Keep Live Preview opt-in until the parity and browser gates pass.
- Preserve plain Markdown as the only stored representation.
- Reuse existing application behavior instead of creating a parallel editor
  feature set.
- Add CodeMirror-specific behavior behind the editor adapter.
- Defer new presentation syntax until after parity is stable and used in daily
  work.

## Conservative compatibility model

The application has two independent choices. They must not be collapsed into a
single mode system:

| View mode | Editable pane | Existing rendered Preview pane |
| --- | --- | --- |
| Edit | Classic or Live Preview | Hidden |
| Split | Classic only | Visible and unchanged |
| Preview | Hidden | Visible and unchanged |

Live Preview replaces only the textarea surface in Edit. It does not replace the
existing Markdown renderer or alter Preview mode. Split remains a Classic-only
layout during the experiment.

Compatibility rules:

- Existing view-mode persistence and Edit, Split, and Preview buttons remain for
  Classic.
- Selecting Live Preview while Split is active changes the view to Edit.
- Changing view mode must not change editor type.
- Entering Preview may unmount or hide Live Preview, but must retain unsaved
  content, selection, and scroll state for a safe return.
- Classic Split continues to use the established rendered Preview as the source
  of truth for complete Markdown rendering.
- Features can remain Classic-only temporarily while being migrated, provided
  the UI clearly disables or explains them in Live Preview.
- No shared implementation replaces a proven Classic path until both paths have
  source-equivalence and regression coverage.

## Definition of parity

Live Preview has parity when selecting it does not remove an existing writing,
navigation, attachment, layout, or recovery workflow that applies to Markdown
notes.

Parity does not require identical internals or identical visual behavior. A
CodeMirror-native interaction is preferable when it produces the same user
outcome and preserves source.

## Non-goals

- Rendering additional Markdown constructs.
- Reproducing the full read-only Preview renderer inside CodeMirror.
- Making links behave like a web page on an ordinary click while editing.
- Removing Classic or its syntax overlay.
- Replacing or rewriting the rendered Preview and Split panes.
- Refactoring unrelated application state.
- Adding collaborative editing, Vim mode, autocomplete, linting, or a general
  extension API.
- Changing the note file format or backend save contract.

## Architecture

### Upstream integration boundary

Before each parity session, compare the branch with current `upstream/main`.
Integrate upstream changes before extending any overlapping editor behavior.

Expected low-conflict ownership:

- CodeMirror implementation stays under `frontend/src/`.
- Generated `frontend/dist/` assets remain ignored and reproducible.
- Markdown command tests stay under `tests/frontend/`.
- Application integration in `frontend/app.js` uses the adapter rather than
  CodeMirror DOM selectors.

Expected conflict hotspots:

- Settings and editor markup in `frontend/index.html`.
- Keyboard, note lifecycle, search, scroll, paste, and attachment paths in
  `frontend/app.js`.
- The first Docker build stage.
- Locale files when upstream adds or reorganizes editor strings.

When upstream implements the same supporting capability, prefer upstream's
version and remove the branch-local duplicate. The `NOTES_DIR` override is the
first example: it began as experiment infrastructure and was replaced by the
upstream implementation during the `0.28.3` integration.

### Editor adapter boundary

Application code should request editor outcomes through one adapter rather than
branching between textarea and CodeMirror throughout `app.js`.

Extend the adapter only as parity work requires:

```javascript
mount(parent, content, options)
destroy()
getContent()
setContent(markdown, options)
focus()
getSelection()
setSelection(from, to, options)
replaceSelections(transform, options)
runCommand(command, options)
getScrollPosition()
setScrollPosition(position)
scrollToPosition(position, options)
getCoordinatesAtPosition(position)
```

The adapter should expose product operations, not the CodeMirror view object.
Document changes, selection changes, and compound formatting actions should be
dispatched as transactions so history, selection mapping, autosave, and
decorations observe one consistent update.

### Command layer

Move editor mutations into shared, source-based commands. A command receives
the current document and selection ranges and returns changes plus resulting
selections. Classic can apply the result to the textarea; Live Preview can apply
it in a CodeMirror transaction.

Use this layer for:

- Inline formatting and links.
- Block formatting.
- List and task creation.
- Table insertion and prettification.
- Image and attachment insertion.
- Wikilink insertion.

CodeMirror-native commands may handle generic cursor movement, history, and
indentation where their behavior matches NoteDiscovery. Product-specific
Markdown behavior remains explicit and testable outside the editor DOM.

### Editor lifecycle state

Store selection and scroll state by note path and editor mode. Restore them only
after the target note is mounted and measured. Clear obsolete state when a tab
closes or a note is deleted or renamed.

Programmatic document replacement must explicitly choose whether to preserve or
reset history, selection, and scroll. Note switches and external reloads reset
history; formatting and attachment insertion do not.

### Search and navigation

Keep NoteDiscovery's sidebar search as the product search system. Map matches to
CodeMirror decorations and selections rather than introducing CodeMirror's
separate search panel.

Outline, search, backlink, and wikilink navigation should resolve a source
offset, call the adapter's navigation method, reveal the target, and focus the
editor. Avoid line-height estimates in Live Preview because decorated headings
have variable heights.

### Decorations and accessibility

- Continue calculating live-preview decorations only for visible ranges.
- Do not manipulate CodeMirror's content DOM directly.
- Keep hidden delimiter ranges atomic.
- Ensure widgets have keyboard-accessible equivalents; clicking a checkbox
  cannot be the only way to toggle a task.
- Preserve source visibility for the active line and selections.
- Respect reduced motion, text scaling, bidirectional text, high contrast, and
  existing theme tokens.

## Work sessions

### Session 4: evaluation and baseline decision

Purpose: close the prototype evaluation before building on it.

Deliverables:

- Complete the existing desktop fixture checks in Safari and Chrome.
- Test ordinary editing and selection on iPhone Safari.
- Record cursor, selection, layout-shift, and performance findings.
- Record the decision to proceed, revise, or stop.
- Freeze the supported presentation syntax listed in this plan.

Exit criteria:

- No source corruption is observed.
- No structural mobile or cursor defect blocks continued work.
- Any accepted limitations have an owner and later gate.

### Session 5: shared commands and writing mechanics

Purpose: restore the complete day-to-day writing surface.

Deliverables:

- Extract source-based formatting commands from textarea-specific code.
- Restore toolbar commands in Live Preview: bold, italic, strikethrough,
  heading, link, image, inline code, code block, quote, bullet list, numbered
  list, checkbox, table insertion, and table prettification.
- Restore the corresponding keyboard shortcuts.
- Implement Enter continuation and empty-item exit for blockquotes, bullets,
  ordered lists, and tasks.
- Implement Tab and Shift+Tab indentation without trapping keyboard-only users.
- Preserve multi-line and multi-selection behavior where supported.
- Add a keyboard command for toggling the task at the cursor.

Exit criteria:

- Every Classic formatting control produces equivalent Markdown and selection
  placement in Live Preview.
- Each compound edit is one undo step.
- Enter, Tab, Shift+Tab, undo, redo, copy, cut, paste, and composition input are
  predictable on desktop and mobile.
- Unsupported presentation syntax remains editable source after insertion.

### Session 6: search, outline, and link navigation

Purpose: make application navigation editor-independent.

Deliverables:

- Render sidebar search matches as CodeMirror decorations.
- Restore current-match movement with F3 and Shift+F3.
- Scroll outline selections to exact source positions.
- Restore search-result context when a note opens.
- Restore backlink and history navigation focus behavior.
- Support the existing wikilink insertion flow.
- Add deliberate modifier-click or keyboard activation for internal Markdown
  links and wikilinks, with broken-link feedback.
- Leave ordinary click available for caret placement.

Exit criteria:

- Search, outline, backlinks, internal links, and browser history land on the
  correct note and source position.
- Navigation never saves decoration text or changes link source.
- Link activation is discoverable and keyboard accessible.

### Session 7: paste, drag, drop, and attachments

Purpose: restore content-ingestion workflows.

Deliverables:

- Route image clipboard paste through the existing upload path.
- Restore file and image drop insertion at the actual CodeMirror drop position.
- Restore note and folder drag-to-editor link insertion.
- Preserve existing attachment naming, path safety, progress, and error UI.
- Keep text and rich-text paste behavior source-safe.
- Define deterministic selection and undo behavior after asynchronous uploads.

Exit criteria:

- Clipboard images, dropped files, and dragged note links produce the same
  source and backend artifacts as Classic.
- Failed uploads do not leave misleading Markdown or overwrite the selection.
- Successful insertion is undoable without deleting the uploaded file.

### Session 8: tabs, layout, and lifecycle polish

Purpose: make Live Preview stable across the whole application shell.

Deliverables:

- Restore per-note cursor and scroll positions across note tabs and mode changes.
- Support readable line length, Zen mode, sidebar resizing, and window resizing.
- Verify Edit, Split, and Preview with Classic, plus Edit and Preview with Live
  Preview selected.
- Preserve the existing rendered Preview implementation and split-pane resizing.
- Keep metadata, statistics, save state, stale-file conflict, and note switching
  synchronized.
- Handle note rename, move, delete, external reload, and tab closure cleanly.
- Refine mobile viewport, software-keyboard, toolbar, selection, and scroll
  behavior.
- Confirm editor cleanup does not retain listeners or stale views.

Exit criteria:

- Returning to a tab restores a useful position without unexpected jumps.
- Layout controls work in light and dark themes at desktop and mobile widths.
- The five supported editor/view combinations retain content, view choice, and
  useful positions across transitions and reloads.
- Repeated switching, resizing, and opening notes does not duplicate handlers or
  progressively increase retained editor instances.

### Session 9: regression, accessibility, and compatibility

Purpose: establish release confidence.

Deliverables:

- Add unit tests for shared source commands and adapter state transitions.
- Add browser smoke coverage using a disposable notes directory.
- Test source fixtures, malformed Markdown, Unicode, RTL, input-method
  composition, long lines, and large notes.
- Test keyboard-only operation, screen-reader labels, focus order, zoom, reduced
  motion, and high-contrast behavior.
- Test current Safari and Chrome on macOS and Safari on supported iPhone sizes.
- Run the full Classic regression checklist.
- Verify production and Docker builds and record lazy-bundle size.

Exit criteria:

- Source-preservation checks pass byte-for-byte.
- No critical or high-severity parity defect remains.
- Classic has no regression attributable to the shared command extraction.
- Known browser limitations are documented and acceptable.

### Session 10: rollout and integration

Purpose: ship without removing the fallback.

Deliverables:

- Replace the experimental label only after the release gates pass.
- Add translated UI strings for all supported locales.
- Update user documentation and local build documentation.
- Rebase or merge the latest upstream changes and resolve editor conflicts.
- Stage the branch without changing the default editor.
- Collect a period of daily-use feedback before considering a default change.

Exit criteria:

- The branch integrates cleanly with current upstream and the custom branch.
- Live Preview remains reversible through Settings.
- Deployment and rollback steps are documented.
- Making Live Preview the default is a separate explicit decision.

## Priority and sequencing

Sessions are ordered by dependency. Session 5 creates the command boundary used
by Sessions 6 and 7. Session 8 should follow functional parity so lifecycle work
is tested against real commands and navigation. Session 9 is a release gate, not
a cleanup session to compress or skip.

If the work must be reduced, cut in this order:

1. Defer link activation while retaining insertion and visible source.
2. Defer per-note scroll restoration while preserving safe note switching.
3. Limit Live Preview to desktop if iPhone editing remains unreliable.

Do not cut source preservation, autosave/conflict behavior, keyboard access,
Classic fallback, or attachment safety.

## Release gates

### Functional gate

- All existing formatting commands are usable.
- Search, outline, note switching, and attachments work.
- Autosave, manual save, undo, redo, and stale-file recovery remain trustworthy.
- Edit, Split, and Preview retain their existing Classic roles; Live Preview
  exposes Edit and Preview only.

### Integrity gate

- Untouched source remains byte-for-byte identical.
- Editor-only state never enters note files.
- Async operations cannot insert content into the wrong note.

### Experience gate

- Cursor and selection behavior are predictable around hidden syntax.
- Layout shifts do not interfere with ordinary writing.
- Desktop daily use is more comfortable than Classic.
- Mobile is either usable or explicitly excluded from the first release.

### Maintainability gate

- Application code uses the adapter and shared commands instead of accumulating
  mode checks.
- New dependencies are pinned and justified.
- Generated bundles remain uncommitted and reproducible.
- Classic can be removed later without rewriting product commands, but its
  removal is not part of this plan.
- The rendered Preview path remains independent of CodeMirror and available as a
  stable correctness reference.
- A trial merge with current upstream has no unexplained conflict, and every
  resolved conflict is recorded in the progress log.

## Deferred enhancements

Reconsider only after parity has shipped and daily use identifies a clear need:

- Additional live-preview syntax, including strikethrough, blockquotes,
  horizontal rules, fenced code, tables, images, and wikilink presentation.
- Inline image previews.
- Rich link cards or hover previews.
- CodeMirror's own search panel or multi-cursor UI.
- Autocomplete, linting, Vim bindings, collaborative editing, and plugin-defined
  editor extensions.
- Removing Classic or changing the default editor.

## Technical references

- [CodeMirror system guide](https://codemirror.net/docs/guide/)
- [CodeMirror reference manual](https://codemirror.net/docs/ref/)
- [CodeMirror document-change example](https://codemirror.net/examples/change/)
- [CodeMirror decoration example](https://codemirror.net/examples/decoration/)
- [CodeMirror split-view example](https://codemirror.net/examples/split/)
