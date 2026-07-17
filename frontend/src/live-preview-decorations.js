import { syntaxTree } from '@codemirror/language';
import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
} from '@codemirror/view';

const headingPattern = /^ATXHeading([1-6])$/;

const strongDecoration = Decoration.mark({ class: 'cm-live-strong' });
const emphasisDecoration = Decoration.mark({ class: 'cm-live-emphasis' });
const inlineCodeDecoration = Decoration.mark({ class: 'cm-live-inline-code' });
const linkDecoration = Decoration.mark({ class: 'cm-live-link' });
const listMarkDecoration = Decoration.mark({ class: 'cm-live-list-mark' });
const completedTaskDecoration = Decoration.mark({ class: 'cm-live-task-complete' });
const hiddenSyntaxDecoration = Decoration.replace({});

class CheckboxWidget extends WidgetType {
    constructor(from, checked) {
        super();
        this.from = from;
        this.checked = checked;
    }

    eq(other) {
        return other.from === this.from && other.checked === this.checked;
    }

    toDOM(view) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.checked;
        checkbox.className = 'cm-live-checkbox';
        checkbox.setAttribute(
            'aria-label',
            this.checked ? 'Mark task incomplete' : 'Mark task complete'
        );
        checkbox.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const marker = view.state.sliceDoc(this.from, this.from + 3);
            if (!/^\[[ xX]\]$/.test(marker)) return;

            view.dispatch({
                changes: {
                    from: this.from + 1,
                    to: this.from + 2,
                    insert: this.checked ? ' ' : 'x',
                },
            });
        });
        return checkbox;
    }

    ignoreEvent() {
        return true;
    }
}

function directChildren(node) {
    const children = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
        children.push(child);
    }
    return children;
}

function supportedLink(node) {
    if (!node || node.name !== 'Link') return false;
    return directChildren(node).some((child) => (
        child.name === 'URL' || child.name === 'LinkLabel'
    ));
}

function selectionContexts(state) {
    return state.selection.ranges.map((range) => {
        const headLine = state.doc.lineAt(range.head);
        const anchorLine = state.doc.lineAt(range.anchor);

        return {
            lineFrom: Math.min(headLine.from, anchorLine.from),
            lineTo: Math.max(headLine.to, anchorLine.to),
            selectionFrom: range.from,
            selectionTo: range.to,
            selectionEmpty: range.empty,
        };
    });
}

function isActiveRange(from, to, contexts) {
    return contexts.some((context) => {
        const intersectsActiveLines = from <= context.lineTo && to >= context.lineFrom;
        const intersectsSelection = !context.selectionEmpty
            && from < context.selectionTo
            && to > context.selectionFrom;
        return intersectsActiveLines || intersectsSelection;
    });
}

function syntaxRange(node, state) {
    if (node.name !== 'HeaderMark') return { from: node.from, to: node.to };

    // Hide the separating space with the heading marker so inactive headings
    // align with ordinary prose. It immediately reappears on the active line.
    const followingCharacter = state.sliceDoc(node.to, node.to + 1);
    return {
        from: node.from,
        to: followingCharacter === ' ' ? node.to + 1 : node.to,
    };
}

function buildDecorations(view) {
    const decorations = [];
    const atomicRanges = [];
    const contexts = selectionContexts(view.state);
    const tree = syntaxTree(view.state);
    const addHiddenRange = (from, to) => {
        if (from >= to) return;
        const hiddenRange = hiddenSyntaxDecoration.range(from, to);
        decorations.push(hiddenRange);
        atomicRanges.push(hiddenRange);
    };

    for (const visible of view.visibleRanges) {
        tree.iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                const headingMatch = headingPattern.exec(node.name);
                if (headingMatch) {
                    const line = view.state.doc.lineAt(node.from);
                    decorations.push(
                        Decoration.line({ class: `cm-live-heading cm-live-heading-${headingMatch[1]}` })
                            .range(line.from)
                    );
                    return;
                }

                if (node.name === 'StrongEmphasis') {
                    decorations.push(strongDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'Emphasis') {
                    decorations.push(emphasisDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'InlineCode') {
                    decorations.push(inlineCodeDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'ListMark') {
                    const listItem = node.node.parent;
                    const task = listItem?.getChild('Task');
                    if (task && !isActiveRange(task.from, task.to, contexts)) {
                        addHiddenRange(node.from, node.to);
                    } else {
                        decorations.push(listMarkDecoration.range(node.from, node.to));
                    }
                    return;
                }

                if (node.name === 'Task') {
                    const marker = node.node.getChild('TaskMarker');
                    if (marker && /^\[[xX]\]$/.test(view.state.sliceDoc(marker.from, marker.to))) {
                        decorations.push(completedTaskDecoration.range(marker.to, node.to));
                    }
                    return;
                }

                if (node.name === 'TaskMarker') {
                    const task = node.node.parent;
                    if (isActiveRange(task?.from ?? node.from, task?.to ?? node.to, contexts)) return;

                    const checked = /^\[[xX]\]$/.test(view.state.sliceDoc(node.from, node.to));
                    const checkboxRange = Decoration.replace({
                        widget: new CheckboxWidget(node.from, checked),
                    }).range(node.from, node.to);
                    decorations.push(checkboxRange);
                    atomicRanges.push(checkboxRange);
                    return;
                }

                if (node.name === 'Link') {
                    if (!supportedLink(node.node)) return;
                    const children = directChildren(node.node);
                    const marks = children.filter((child) => child.name === 'LinkMark');
                    if (marks.length >= 2 && marks[0].to <= marks[1].from) {
                        decorations.push(linkDecoration.range(marks[0].to, marks[1].from));
                    }

                    if (isActiveRange(node.from, node.to, contexts)) return;
                    if (marks.length >= 2) {
                        addHiddenRange(marks[0].from, marks[0].to);
                        addHiddenRange(marks[1].from, marks[1].to);
                    }

                    const url = children.find((child) => child.name === 'URL');
                    const label = children.find((child) => child.name === 'LinkLabel');
                    if (url && marks.length >= 4) {
                        addHiddenRange(marks[2].from, marks[marks.length - 1].to);
                    } else if (label) {
                        addHiddenRange(label.from, label.to);
                    }
                    return;
                }

                if (node.name === 'Autolink') {
                    const children = directChildren(node.node);
                    const url = children.find((child) => child.name === 'URL');
                    if (url) decorations.push(linkDecoration.range(url.from, url.to));
                    if (!isActiveRange(node.from, node.to, contexts)) {
                        for (const mark of children.filter((child) => child.name === 'LinkMark')) {
                            addHiddenRange(mark.from, mark.to);
                        }
                    }
                    return;
                }

                if (!['HeaderMark', 'EmphasisMark', 'CodeMark'].includes(node.name)) return;

                const parent = node.node.parent;
                const activeFrom = parent?.from ?? node.from;
                const activeTo = parent?.to ?? node.to;
                if (isActiveRange(activeFrom, activeTo, contexts)) return;

                const range = syntaxRange(node, view.state);
                const hiddenRange = hiddenSyntaxDecoration.range(range.from, range.to);
                decorations.push(hiddenRange);
                atomicRanges.push(hiddenRange);
            },
        });
    }

    return {
        decorations: Decoration.set(decorations, true),
        atomicRanges: Decoration.set(atomicRanges, true),
    };
}

export const livePreviewDecorations = ViewPlugin.fromClass(
    class {
        constructor(view) {
            const built = buildDecorations(view);
            this.decorations = built.decorations;
            this.atomicRanges = built.atomicRanges;
        }

        update(update) {
            if (update.docChanged || update.selectionSet || update.viewportChanged) {
                const built = buildDecorations(update.view);
                this.decorations = built.decorations;
                this.atomicRanges = built.atomicRanges;
            }
        }
    },
    {
        decorations: (plugin) => plugin.decorations,
        provide: (plugin) => EditorView.atomicRanges.of((view) => (
            view.plugin(plugin)?.atomicRanges ?? Decoration.none
        )),
    }
);
