import { syntaxTree } from '@codemirror/language';
import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
} from '@codemirror/view';

const headingPattern = /^(?:ATX|Setext)Heading([1-6])$/;

const strongDecoration = Decoration.mark({ class: 'cm-live-strong' });
const emphasisDecoration = Decoration.mark({ class: 'cm-live-emphasis' });
const strikethroughDecoration = Decoration.mark({ class: 'cm-live-strikethrough' });
const inlineCodeDecoration = Decoration.mark({ class: 'cm-live-inline-code' });
const linkDecoration = Decoration.mark({ class: 'cm-live-link' });
const listMarkDecoration = Decoration.mark({ class: 'cm-live-list-mark' });
const completedTaskDecoration = Decoration.mark({ class: 'cm-live-task-complete' });
const previewOnlyLineDecoration = Decoration.line({ class: 'cm-live-preview-only-line' });
const previewOnlyInlineDecoration = Decoration.mark({ class: 'cm-live-preview-only-inline' });
const hiddenSyntaxDecoration = Decoration.replace({});
const hiddenLineDecoration = Decoration.line({ class: 'cm-live-hidden-line' });

const previewOnlyBlockNames = new Set([
    'HTMLBlock',
    'Table',
]);

class HorizontalRuleWidget extends WidgetType {
    toDOM() {
        const rule = document.createElement('span');
        rule.className = 'cm-live-horizontal-rule';
        rule.setAttribute('role', 'separator');
        return rule;
    }
}

class CheckboxWidget extends WidgetType {
    constructor(from, checked, labels) {
        super();
        this.from = from;
        this.checked = checked;
        this.labels = labels;
    }

    eq(other) {
        return other.from === this.from
            && other.checked === this.checked
            && other.labels.taskComplete === this.labels.taskComplete
            && other.labels.taskIncomplete === this.labels.taskIncomplete;
    }

    toDOM(view) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.checked;
        checkbox.className = 'cm-live-checkbox';
        checkbox.setAttribute(
            'aria-label',
            this.checked ? this.labels.taskIncomplete : this.labels.taskComplete
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

export function lineBoundedRanges(doc, from, to) {
    const ranges = [];
    let cursor = from;

    while (cursor < to) {
        const line = doc.lineAt(cursor);
        const lineTo = Math.min(to, line.to);
        if (cursor < lineTo) {
            ranges.push({ from: cursor, to: lineTo });
        }
        if (lineTo >= to || line.number >= doc.lines) break;
        cursor = doc.line(line.number + 1).from;
    }

    return ranges;
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

function findPreviewOnlySourceRanges(source) {
    const ranges = [];
    const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);
    if (frontmatter) {
        ranges.push({ from: 0, to: frontmatter[0].length });
    }
    const displayMathPatterns = [
        /^[ \t]*\$\$[ \t]*\r?\n[\s\S]*?^[ \t]*\$\$[ \t]*$/gm,
        /^[ \t]*\\\[[ \t]*\r?\n[\s\S]*?^[ \t]*\\\][ \t]*$/gm,
    ];
    for (const pattern of displayMathPatterns) {
        let match;
        while ((match = pattern.exec(source)) !== null) {
            ranges.push({ from: match.index, to: match.index + match[0].length });
        }
    }
    return ranges;
}

function buildDecorations(view, labels, sourceRanges = []) {
    const decorations = [];
    const atomicRanges = [];
    const contexts = selectionContexts(view.state);
    const tree = syntaxTree(view.state);
    const addHiddenRange = (from, to) => {
        if (from >= to) return;
        for (const range of lineBoundedRanges(view.state.doc, from, to)) {
            const hiddenRange = hiddenSyntaxDecoration.range(range.from, range.to);
            decorations.push(hiddenRange);
            atomicRanges.push(hiddenRange);
        }
    };
    const previewOnlyBlocks = new Set();
    const previewOnlyLineStarts = new Set();
    const previewOnlyCoveredRanges = [...sourceRanges];
    const decoratedLines = new Set();
    const decoratedListLines = new Set();
    const addLineClass = (lineFrom, className) => {
        const key = `${lineFrom}:${className}`;
        if (decoratedLines.has(key)) return;
        decoratedLines.add(key);
        decorations.push(Decoration.line({ class: className }).range(lineFrom));
    };
    const addListLine = (line, markerClass, markerWidth) => {
        if (decoratedListLines.has(line.from)) return;
        decoratedListLines.add(line.from);
        const leadingWhitespace = /^\s*/.exec(line.text)?.[0] || '';
        let indentation = 0;
        for (const character of leadingWhitespace) {
            indentation += character === '\t' ? 1 : 0.25;
        }
        const hangingIndent = indentation + markerWidth;
        decorations.push(Decoration.line({
            class: `cm-live-list-line ${markerClass}`.trim(),
            attributes: {
                style: `--cm-live-list-hang: ${hangingIndent}em; --cm-live-list-hang-negative: -${hangingIndent}em`,
            },
        }).range(line.from));
    };
    const addPreviewOnlyBlock = (from, to) => {
        const firstLine = view.state.doc.lineAt(from);
        const lastLine = view.state.doc.lineAt(Math.max(from, to - 1));
        const blockKey = `${firstLine.from}:${lastLine.to}`;
        if (previewOnlyBlocks.has(blockKey)) return;
        previewOnlyBlocks.add(blockKey);
        for (const visible of view.visibleRanges) {
            if (visible.from > lastLine.to || visible.to < firstLine.from) continue;
            const visibleFirstLine = view.state.doc.lineAt(Math.max(from, visible.from)).number;
            const visibleLastLine = view.state.doc.lineAt(Math.min(to, visible.to)).number;
            for (let lineNumber = visibleFirstLine; lineNumber <= visibleLastLine; lineNumber++) {
                const lineFrom = view.state.doc.line(lineNumber).from;
                if (previewOnlyLineStarts.has(lineFrom)) continue;
                previewOnlyLineStarts.add(lineFrom);
                decorations.push(previewOnlyLineDecoration.range(lineFrom));
            }
        }
    };

    for (const range of sourceRanges) {
        if (!view.visibleRanges.some((visible) => (
            visible.from <= range.to && visible.to >= range.from
        ))) continue;
        let syntaxNode = tree.resolve(range.from, 1);
        let insideCode = false;
        while (syntaxNode) {
            if (syntaxNode.name === 'FencedCode' || syntaxNode.name === 'InlineCode') {
                insideCode = true;
                break;
            }
            syntaxNode = syntaxNode.parent;
        }
        if (!insideCode) addPreviewOnlyBlock(range.from, range.to);
    }

    for (const visible of view.visibleRanges) {
        tree.iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (previewOnlyBlockNames.has(node.name)) {
                    const covered = previewOnlyCoveredRanges.some((range) => (
                        node.from >= range.from && node.to <= range.to
                    ));
                    if (!covered) addPreviewOnlyBlock(node.from, node.to);

                    if (node.name === 'Table') {
                        const firstLine = view.state.doc.lineAt(node.from).number;
                        const lastLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
                        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
                            addLineClass(view.state.doc.line(lineNumber).from, 'cm-live-table-line');
                        }
                    }
                }

                const headingMatch = headingPattern.exec(node.name);
                if (headingMatch) {
                    const line = view.state.doc.lineAt(node.from);
                    decorations.push(
                        Decoration.line({ class: `cm-live-heading cm-live-heading-${headingMatch[1]}` })
                            .range(line.from)
                    );
                    return;
                }

                if (node.name === 'Blockquote') {
                    const firstLine = view.state.doc.lineAt(node.from).number;
                    const lastLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
                    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
                        addLineClass(view.state.doc.line(lineNumber).from, 'cm-live-blockquote-line');
                    }
                    return;
                }

                if (node.name === 'FencedCode') {
                    const firstLine = view.state.doc.lineAt(node.from).number;
                    const lastLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
                    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
                        const line = view.state.doc.line(lineNumber);
                        addLineClass(line.from, 'cm-live-code-line');
                        if (lineNumber === firstLine) addLineClass(line.from, 'cm-live-code-first-line');
                        if (lineNumber === lastLine) addLineClass(line.from, 'cm-live-code-last-line');
                    }
                    return;
                }

                if (node.name === 'HorizontalRule') {
                    if (isActiveRange(node.from, node.to, contexts)) return;
                    const range = Decoration.replace({
                        widget: new HorizontalRuleWidget(),
                    }).range(node.from, node.to);
                    decorations.push(range);
                    atomicRanges.push(range);
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

                if (node.name === 'Strikethrough') {
                    decorations.push(strikethroughDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'InlineCode') {
                    decorations.push(inlineCodeDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'Image') {
                    decorations.push(previewOnlyInlineDecoration.range(node.from, node.to));
                    return;
                }

                if (node.name === 'ListMark') {
                    const line = view.state.doc.lineAt(node.from);
                    const listItem = node.node.parent;
                    const task = listItem?.getChild('Task');
                    const marker = view.state.sliceDoc(node.from, node.to);
                    if (task) {
                        addListLine(line, 'cm-live-task-line', 1.6);
                    } else if (/^\d/.test(marker)) {
                        addListLine(line, 'cm-live-ordered-line', 1.3);
                    } else {
                        addListLine(line, '', 1);
                    }
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
                        widget: new CheckboxWidget(node.from, checked, labels),
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

                if (node.name === 'URL' && ![
                    'Link',
                    'Autolink',
                ].includes(node.node.parent?.name)) {
                    decorations.push(linkDecoration.range(node.from, node.to));
                    return;
                }

                if (![
                    'HeaderMark',
                    'EmphasisMark',
                    'StrikethroughMark',
                    'CodeMark',
                    'QuoteMark',
                ].includes(node.name)) return;

                const parent = node.node.parent;
                if (node.name === 'CodeMark' && parent?.name !== 'InlineCode') return;
                const activeFrom = parent?.from ?? node.from;
                const activeTo = parent?.to ?? node.to;
                if (isActiveRange(activeFrom, activeTo, contexts)) return;

                const range = syntaxRange(node, view.state);
                if (node.name === 'HeaderMark' && parent?.name.startsWith('SetextHeading')) {
                    decorations.push(hiddenLineDecoration.range(view.state.doc.lineAt(node.from).from));
                }
                const hiddenRange = hiddenSyntaxDecoration.range(range.from, range.to);
                decorations.push(hiddenRange);
                atomicRanges.push(hiddenRange);
            },
        });
    }

    const decoratedWikilinkLines = new Set();
    for (const visible of view.visibleRanges) {
        const firstLine = view.state.doc.lineAt(visible.from).number;
        const lastLine = view.state.doc.lineAt(visible.to).number;
        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
            if (decoratedWikilinkLines.has(lineNumber)) continue;
            decoratedWikilinkLines.add(lineNumber);
            const line = view.state.doc.line(lineNumber);
            const pattern = /!?\[\[[^\]\n]+\]\]/g;
            let match;
            while ((match = pattern.exec(line.text)) !== null) {
                const from = line.from + match.index;
                let syntaxNode = tree.resolve(from, 1);
                let insideCode = false;
                while (syntaxNode) {
                    if (syntaxNode.name === 'FencedCode' || syntaxNode.name === 'InlineCode') {
                        insideCode = true;
                        break;
                    }
                    syntaxNode = syntaxNode.parent;
                }
                if (!insideCode) {
                    decorations.push(previewOnlyInlineDecoration.range(from, from + match[0].length));
                }
            }
        }
    }

    return {
        decorations: Decoration.set(decorations, true),
        atomicRanges: Decoration.set(atomicRanges, true),
    };
}

export function livePreviewDecorations(labels = {}) {
    const resolvedLabels = {
        taskComplete: labels.taskComplete || 'Mark task complete',
        taskIncomplete: labels.taskIncomplete || 'Mark task incomplete',
    };

    return ViewPlugin.fromClass(
        class {
            constructor(view) {
                this.sourceRanges = findPreviewOnlySourceRanges(view.state.doc.toString());
                const built = buildDecorations(view, resolvedLabels, this.sourceRanges);
                this.decorations = built.decorations;
                this.atomicRanges = built.atomicRanges;
            }

            update(update) {
                if (update.docChanged || update.selectionSet || update.viewportChanged) {
                    if (update.docChanged) {
                        this.sourceRanges = findPreviewOnlySourceRanges(update.state.doc.toString());
                    }
                    const built = buildDecorations(update.view, resolvedLabels, this.sourceRanges);
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
}
