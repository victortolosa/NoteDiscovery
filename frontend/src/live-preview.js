import {
    Compartment,
    EditorState,
    StateEffect,
    StateField,
    Transaction,
} from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import {
    HighlightStyle,
    LanguageDescription,
    StreamLanguage,
    syntaxTree,
    syntaxHighlighting,
} from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { tags } from '@lezer/highlight';
import { Autolink, Strikethrough, Table, TaskList } from '@lezer/markdown';
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

const codeLanguages = [
    LanguageDescription.of({
        name: 'JavaScript',
        alias: ['js', 'jsx'],
        extensions: ['js', 'mjs', 'cjs', 'jsx'],
        support: javascript({ jsx: true }),
    }),
    LanguageDescription.of({
        name: 'TypeScript',
        alias: ['ts', 'tsx'],
        extensions: ['ts', 'tsx'],
        support: javascript({ jsx: true, typescript: true }),
    }),
    LanguageDescription.of({
        name: 'Python',
        alias: ['py'],
        extensions: ['py'],
        support: python(),
    }),
    LanguageDescription.of({
        name: 'JSON',
        alias: ['jsonc'],
        extensions: ['json', 'jsonc'],
        support: json(),
    }),
    LanguageDescription.of({
        name: 'Shell',
        alias: ['bash', 'sh', 'zsh', 'shell'],
        extensions: ['sh', 'bash', 'zsh'],
        support: StreamLanguage.define(shell),
    }),
];

const codeHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: 'color-mix(in srgb, var(--accent-primary) 45%, var(--text-primary))', fontWeight: '600' },
    { tag: [tags.string, tags.special(tags.string)], color: 'color-mix(in srgb, var(--success-color, #2e8b57) 50%, var(--text-primary))' },
    { tag: [tags.number, tags.bool, tags.null], color: 'color-mix(in srgb, var(--warning-color, #b7791f) 55%, var(--text-primary))' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--text-secondary)', fontStyle: 'italic' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'color-mix(in srgb, var(--accent-primary) 45%, var(--text-primary))' },
    { tag: [tags.typeName, tags.className], color: 'color-mix(in srgb, var(--accent-primary) 35%, var(--text-primary))' },
    { tag: [tags.operator, tags.punctuation], color: 'var(--text-secondary)' },
]);

// Built once per module load. Both allocate: the language support builds a
// parser, and EditorView.theme() injects a fresh stylesheet with its own
// generated class. Rebuilding them per document — createState() runs on every
// note switch — leaked a stylesheet each time.
const markdownLanguage = markdown({
    codeLanguages,
    extensions: [Table, TaskList, Strikethrough, Autolink],
});

const livePreviewTheme = EditorView.theme({
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
        // Horizontally: 22px + the 2px line padding below lands text 24px from
        // both inner edges, matching the classic textarea and the preview pane.
        padding: '1rem calc(1.5rem - 2px)',
    },
    // CodeMirror's own line padding is asymmetric (6px left, 2px right), which
    // read as the text block sitting off-centre. Even it up; the rules for list
    // and blockquote lines below still override padding-left.
    '.cm-line': {
        padding: '0 2px',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--text-primary)',
    },
    '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 55%, transparent)',
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
    '.cm-live-strikethrough': {
        textDecoration: 'line-through',
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
        color: 'color-mix(in srgb, var(--accent-primary) 45%, var(--text-primary))',
        textDecoration: 'underline',
        textUnderlineOffset: '0.15em',
    },
    '.cm-live-list-mark': {
        color: 'var(--accent-primary)',
        fontWeight: '700',
    },
    '.cm-live-list-line': {
        // The hanging indent is added to the line padding above, not substituted
        // for it, so the marker starts on the same column as body text.
        paddingLeft: 'calc(2px + var(--cm-live-list-hang, 1em))',
        textIndent: 'var(--cm-live-list-hang-negative, -1em)',
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
    '.cm-live-blockquote-line': {
        color: 'var(--text-secondary)',
        borderLeft: '3px solid var(--accent-primary)',
        paddingLeft: '0.75em',
    },
    '.cm-live-code-line': {
        backgroundColor: 'var(--bg-tertiary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm-live-code-first-line': {
        borderTopLeftRadius: '0.3rem',
        borderTopRightRadius: '0.3rem',
    },
    '.cm-live-code-last-line': {
        borderBottomLeftRadius: '0.3rem',
        borderBottomRightRadius: '0.3rem',
    },
    '.cm-live-hidden-line': {
        display: 'none',
    },
    '.cm-live-horizontal-rule': {
        display: 'inline-block',
        width: '100%',
        height: '1px',
        margin: '0.8em 0',
        backgroundColor: 'var(--border-primary)',
        verticalAlign: 'middle',
    },
    '.cm-live-preview-only-line': {
        backgroundColor: 'var(--bg-tertiary)',
        boxShadow: 'inset 2px 0 0 var(--accent-primary)',
    },
    '.cm-live-table-line': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm-live-preview-only-inline': {
        textDecoration: 'underline dotted var(--accent-primary)',
        textUnderlineOffset: '0.2em',
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
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 70%, var(--text-primary)) !important',
    },
    '.cm-content .cm-line.cm-line::selection, .cm-content .cm-line.cm-line *::selection': {
        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 70%, var(--text-primary)) !important',
        color: 'var(--bg-primary) !important',
    },
});

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

export function linkTargetAtPosition(state, position) {
    const line = state.doc.lineAt(position);
    const wikilinkPattern = /\[\[([^\]\n|]+)(?:\|[^\]\n]+)?\]\]/g;
    let wikilink;
    while ((wikilink = wikilinkPattern.exec(line.text)) !== null) {
        const from = line.from + wikilink.index;
        const to = from + wikilink[0].length;
        if (position >= from && position <= to) return wikilink[1].trim();
    }

    let node = syntaxTree(state).resolveInner(position, -1);
    while (node && !['Link', 'Autolink'].includes(node.name)) node = node.parent;
    if (!node) return '';

    const url = node.getChild('URL');
    if (!url) return '';
    return state.sliceDoc(url.from, url.to).replace(/^<|>$/g, '');
}

/**
 * Create the experimental CodeMirror editor behind a small application adapter.
 * Code outside this module should not manipulate EditorView directly.
 */
export function createLivePreviewEditor({
    parent,
    content = '',
    labels = {},
    onChange = () => {},
    onOpenLink = () => false,
    onSourceCommand = () => null,
}) {
    if (!(parent instanceof HTMLElement)) {
        throw new Error('Live Preview requires a valid parent element.');
    }

    let applyingExternalContent = false;
    const scrollListeners = new Set();
    const decorationsCompartment = new Compartment();
    let editorLabels = labels;
    const activateLink = (targetView, position = targetView.state.selection.main.head) => {
        const target = linkTargetAtPosition(targetView.state, position);
        return target ? onOpenLink(target) !== false : false;
    };

    const createState = (doc) => (
        EditorState.create({
            doc,
            extensions: [
                history(),
                markdownLanguage,
                syntaxHighlighting(codeHighlightStyle),
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
                    {
                        key: 'Mod-Shift-Enter',
                        run: (view) => activateLink(view),
                    },
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),
                EditorView.domEventHandlers({
                    mousedown(event, targetView) {
                        if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
                        const position = targetView.posAtCoords({
                            x: event.clientX,
                            y: event.clientY,
                        });
                        if (position === null || !activateLink(targetView, position)) return false;
                        event.preventDefault();
                        return true;
                    },
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !applyingExternalContent) {
                        onChange(update.state.doc.toString());
                    }
                }),
                livePreviewTheme,
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
        if (!result?.changed) return Boolean(result?.handled);
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
