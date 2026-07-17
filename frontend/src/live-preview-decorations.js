import { syntaxTree } from '@codemirror/language';
import {
    Decoration,
    EditorView,
    ViewPlugin,
} from '@codemirror/view';

const headingPattern = /^ATXHeading([1-6])$/;

const strongDecoration = Decoration.mark({ class: 'cm-live-strong' });
const emphasisDecoration = Decoration.mark({ class: 'cm-live-emphasis' });
const inlineCodeDecoration = Decoration.mark({ class: 'cm-live-inline-code' });
const hiddenSyntaxDecoration = Decoration.replace({});

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
            && from <= context.selectionTo
            && to >= context.selectionFrom;
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
