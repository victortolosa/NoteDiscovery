import {
    Compartment,
    EditorState,
    StateEffect,
    StateField,
    Transaction,
} from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table, TaskList } from '@lezer/markdown';
import {
    drawSelection,
    Decoration,
    EditorView,
    highlightActiveLine,
    keymap,
} from '@codemirror/view';
import {
    defaultKeymap,
    history,
    historyKeymap,
} from '@codemirror/commands';
import { livePreviewDecorations } from './live-preview-decorations.js';

const setSearch = StateEffect.define();

const buildSearchState = (doc, query, requestedIndex = 0) => {
    const searchQuery = String(query ?? '').trim();
    const matches = [];
    const decorations = [];

    if (searchQuery) {
        const source = doc.toString();
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(escapedQuery, 'giu');
        let match;
        while ((match = pattern.exec(source)) !== null) {
            matches.push({ from: match.index, to: match.index + match[0].length });
        }
    }

    const activeIndex = matches.length
        ? Math.max(0, Math.min(Number(requestedIndex) || 0, matches.length - 1))
        : -1;
    matches.forEach((match, index) => {
        decorations.push(Decoration.mark({
            class: index === activeIndex
                ? 'cm-live-search-match cm-live-search-match-active'
                : 'cm-live-search-match',
        }).range(match.from, match.to));
    });

    return {
        query: searchQuery,
        matches,
        activeIndex,
        decorations: Decoration.set(decorations, true),
    };
};

const searchField = StateField.define({
    create: (state) => buildSearchState(state.doc, ''),
    update(value, transaction) {
        let query = value.query;
        let activeIndex = value.activeIndex;
        for (const effect of transaction.effects) {
            if (effect.is(setSearch)) {
                query = effect.value.query;
                activeIndex = effect.value.activeIndex;
            }
        }
        if (transaction.docChanged || query !== value.query || activeIndex !== value.activeIndex) {
            return buildSearchState(transaction.state.doc, query, activeIndex);
        }
        return value;
    },
    provide: (field) => EditorView.decorations.from(field, value => value.decorations),
});

/**
 * Create the experimental CodeMirror editor behind a small application adapter.
 * Code outside this module should not manipulate EditorView directly.
 */
export function createLivePreviewEditor({
    parent,
    content = '',
    labels = {},
    onChange = () => {},
    onSourceCommand = () => null,
}) {
    if (!(parent instanceof HTMLElement)) {
        throw new Error('Live Preview requires a valid parent element.');
    }

    let applyingExternalContent = false;
    const scrollListeners = new Set();
    const decorationsCompartment = new Compartment();
    let editorLabels = labels;

    const createState = (doc) => (
        EditorState.create({
            doc,
            extensions: [
                history(),
                markdown({ extensions: [Table, TaskList] }),
                decorationsCompartment.of(livePreviewDecorations(editorLabels)),
                searchField,
                drawSelection(),
                highlightActiveLine(),
                EditorView.lineWrapping,
                keymap.of([
                    {
                        key: 'Enter',
                        run: (view) => runSourceCommand(view, 'enter'),
                    },
                    {
                        key: 'Tab',
                        run: (view) => runSourceCommand(view, 'tab', { shiftKey: false }),
                    },
                    {
                        key: 'Shift-Tab',
                        run: (view) => runSourceCommand(view, 'tab', { shiftKey: true }),
                    },
                    {
                        key: 'Mod-Enter',
                        run: (view) => runSourceCommand(view, 'toggleTask'),
                    },
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !applyingExternalContent) {
                        onChange(update.state.doc.toString());
                    }
                }),
                EditorView.theme({
                    '&': {
                        height: '100%',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                    },
                    '.cm-scroller': {
                        fontFamily: 'inherit',
                        fontSize: 'calc(1rem * var(--font-scale, 1))',
                        lineHeight: '1.6',
                        overflow: 'auto',
                    },
                    '.cm-content': {
                        caretColor: 'var(--text-primary)',
                        padding: '1rem',
                    },
                    '.cm-cursor, .cm-dropCursor': {
                        borderLeftColor: 'var(--text-primary)',
                    },
                    '.cm-activeLine': {
                        backgroundColor: 'var(--bg-tertiary)',
                    },
                    '.cm-live-heading': {
                        fontWeight: '700',
                        lineHeight: '1.3',
                    },
                    '.cm-live-heading-1': {
                        fontSize: '1.75em',
                    },
                    '.cm-live-heading-2': {
                        fontSize: '1.5em',
                    },
                    '.cm-live-heading-3': {
                        fontSize: '1.3em',
                    },
                    '.cm-live-heading-4': {
                        fontSize: '1.15em',
                    },
                    '.cm-live-heading-5, .cm-live-heading-6': {
                        fontSize: '1em',
                    },
                    '.cm-live-strong': {
                        fontWeight: '700',
                    },
                    '.cm-live-emphasis': {
                        fontStyle: 'italic',
                    },
                    '.cm-live-inline-code': {
                        padding: '0.08em 0.25em',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '0.25rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '0.9em',
                    },
                    '.cm-live-link': {
                        color: 'var(--accent-primary)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '0.15em',
                    },
                    '.cm-live-list-mark': {
                        color: 'var(--accent-primary)',
                        fontWeight: '700',
                    },
                    '.cm-live-checkbox': {
                        width: '1em',
                        height: '1em',
                        margin: '0 0.35em 0 0',
                        verticalAlign: '-0.1em',
                        accentColor: 'var(--accent-primary)',
                        cursor: 'pointer',
                    },
                    '.cm-live-task-complete': {
                        color: 'var(--text-tertiary)',
                        textDecoration: 'line-through',
                    },
                    '.cm-live-preview-only-line': {
                        backgroundColor: 'var(--bg-tertiary)',
                        boxShadow: 'inset 2px 0 0 var(--accent-primary)',
                    },
                    '.cm-live-preview-only-inline': {
                        textDecoration: 'underline dotted var(--accent-primary)',
                        textUnderlineOffset: '0.2em',
                    },
                    '.cm-live-preview-only-badge': {
                        display: 'inline-block',
                        marginLeft: '0.65rem',
                        padding: '0.05rem 0.35rem',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: '999px',
                        color: 'var(--accent-primary)',
                        fontFamily: 'inherit',
                        fontSize: '0.65em',
                        fontWeight: '600',
                        lineHeight: '1.35',
                        verticalAlign: '0.1em',
                        userSelect: 'none',
                    },
                    '.cm-live-search-match': {
                        backgroundColor: 'var(--accent-light)',
                        borderRadius: '0.15rem',
                    },
                    '.cm-live-search-match-active': {
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--bg-primary)',
                    },
                    '&.cm-focused': {
                        outline: 'none',
                    },
                    '&.cm-focused .cm-selectionBackground, ::selection': {
                        backgroundColor: 'var(--accent-light)',
                    },
                }),
            ],
        })
    );

    const runSourceCommand = (targetView, command, options = {}) => {
        const selection = targetView.state.selection.main;
        const result = onSourceCommand(command, {
            content: targetView.state.doc.toString(),
            selection: { from: selection.from, to: selection.to },
            ...options,
        });
        if (!result?.changed) return false;
        targetView.dispatch({
            changes: result.change,
            selection: {
                anchor: result.selection.from,
                head: result.selection.to,
            },
            annotations: Transaction.userEvent.of('input.complete'),
            scrollIntoView: true,
        });
        return true;
    };

    const view = new EditorView({
        parent,
        state: createState(content),
    });
    const handleScroll = () => {
        const metrics = {
            top: view.scrollDOM.scrollTop,
            left: view.scrollDOM.scrollLeft,
            scrollHeight: view.scrollDOM.scrollHeight,
            scrollWidth: view.scrollDOM.scrollWidth,
            clientHeight: view.scrollDOM.clientHeight,
            clientWidth: view.scrollDOM.clientWidth,
        };
        for (const listener of scrollListeners) listener(metrics);
    };
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

    return {
        destroy() {
            view.scrollDOM.removeEventListener('scroll', handleScroll);
            scrollListeners.clear();
            view.destroy();
        },

        getContent() {
            return view.state.doc.toString();
        },

        replaceDocument(markdown, { resetHistory = true } = {}) {
            const nextContent = String(markdown ?? '');
            if (nextContent === view.state.doc.toString()) return;

            applyingExternalContent = true;
            try {
                if (resetHistory) {
                    // Note loads and conflict reloads must not share history
                    // with the document that was previously mounted.
                    view.setState(createState(nextContent));
                } else {
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: nextContent },
                        annotations: Transaction.userEvent.of('input'),
                    });
                }
            } finally {
                applyingExternalContent = false;
            }
        },

        // Backward-compatible name for application-driven note replacement.
        setContent(markdown) {
            this.replaceDocument(markdown, { resetHistory: true });
        },

        replaceRange({ from, to = from, insert = '', selection = null, userEvent = 'input' }) {
            const docLength = view.state.doc.length;
            const safeFrom = Math.max(0, Math.min(Number(from) || 0, docLength));
            const safeTo = Math.max(safeFrom, Math.min(Number(to) || safeFrom, docLength));
            const transaction = {
                changes: { from: safeFrom, to: safeTo, insert: String(insert) },
                scrollIntoView: true,
            };
            if (selection) {
                transaction.selection = {
                    anchor: selection.anchor,
                    head: selection.head ?? selection.anchor,
                };
            }
            if (userEvent) {
                transaction.annotations = Transaction.userEvent.of(userEvent);
            }
            view.dispatch(transaction);
        },

        focus() {
            view.focus();
        },

        hasFocus() {
            return view.hasFocus;
        },

        setSearch(query, activeIndex = 0, { focus = false } = {}) {
            view.dispatch({ effects: setSearch.of({ query, activeIndex }) });
            const state = view.state.field(searchField);
            const match = state.matches[state.activeIndex];
            if (match) {
                view.dispatch({
                    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
                });
            }
            if (focus) view.focus();
            return { total: state.matches.length, activeIndex: state.activeIndex };
        },

        clearSearch() {
            view.dispatch({ effects: setSearch.of({ query: '', activeIndex: -1 }) });
        },

        setLabels(nextLabels = {}) {
            editorLabels = nextLabels;
            view.dispatch({
                effects: decorationsCompartment.reconfigure(livePreviewDecorations(editorLabels)),
            });
        },

        getSelection() {
            const { from, to } = view.state.selection.main;
            return { from, to };
        },

        setSelection(from, to = from) {
            view.dispatch({
                selection: { anchor: from, head: to },
                scrollIntoView: true,
            });
        },

        getScrollPosition() {
            return {
                top: view.scrollDOM.scrollTop,
                left: view.scrollDOM.scrollLeft,
            };
        },

        setScrollPosition({ top = 0, left = 0 } = {}) {
            view.scrollDOM.scrollTo({ top, left });
        },

        getScrollMetrics() {
            return {
                top: view.scrollDOM.scrollTop,
                left: view.scrollDOM.scrollLeft,
                scrollHeight: view.scrollDOM.scrollHeight,
                scrollWidth: view.scrollDOM.scrollWidth,
                clientHeight: view.scrollDOM.clientHeight,
                clientWidth: view.scrollDOM.clientWidth,
            };
        },

        setScrollPercentage(percentage) {
            const normalized = Math.max(0, Math.min(Number(percentage) || 0, 1));
            const scrollableHeight = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
            view.scrollDOM.scrollTop = normalized * Math.max(0, scrollableHeight);
        },

        onScroll(listener) {
            if (typeof listener !== 'function') return () => {};
            scrollListeners.add(listener);
            return () => scrollListeners.delete(listener);
        },
    };
}
