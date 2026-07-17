import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { TaskList } from '@lezer/markdown';
import {
    drawSelection,
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

/**
 * Create the experimental CodeMirror editor behind a small application adapter.
 * Code outside this module should not manipulate EditorView directly.
 */
export function createLivePreviewEditor({ parent, content = '', onChange = () => {} }) {
    if (!(parent instanceof HTMLElement)) {
        throw new Error('Live Preview requires a valid parent element.');
    }

    let applyingExternalContent = false;

    const createState = (doc) => (
        EditorState.create({
            doc,
            extensions: [
                history(),
                markdown({ extensions: [TaskList] }),
                livePreviewDecorations,
                drawSelection(),
                highlightActiveLine(),
                EditorView.lineWrapping,
                keymap.of([...defaultKeymap, ...historyKeymap]),
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

    const view = new EditorView({
        parent,
        state: createState(content),
    });

    return {
        destroy() {
            view.destroy();
        },

        getContent() {
            return view.state.doc.toString();
        },

        setContent(markdown) {
            const nextContent = String(markdown ?? '');
            if (nextContent === view.state.doc.toString()) return;

            applyingExternalContent = true;
            try {
                // Application-driven replacements represent note loads,
                // conflict reloads, or editor-mode transfers. A fresh state
                // prevents undo history from crossing those boundaries.
                view.setState(createState(nextContent));
            } finally {
                applyingExternalContent = false;
            }
        },

        focus() {
            view.focus();
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
    };
}
