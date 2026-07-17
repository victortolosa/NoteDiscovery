/**
 * Pure Markdown source commands shared by Classic and Live Preview.
 * Each command returns a single replacement and the selection in the new doc.
 */
(function (global) {
    'use strict';

    function normalizeSelection(text, selection = {}) {
        const length = text.length;
        const from = Math.max(0, Math.min(Number(selection.from) || 0, length));
        const to = Math.max(from, Math.min(Number(selection.to) || from, length));
        return { from, to };
    }

    function replacement(text, from, to, insert, selectionFrom, selectionTo = selectionFrom) {
        return {
            changed: true,
            change: { from, to, insert },
            selection: { from: selectionFrom, to: selectionTo },
            text: text.slice(0, from) + insert + text.slice(to),
        };
    }

    function wrap(text, selection, before, after, placeholder) {
        const { from, to } = normalizeSelection(text, selection);
        const selected = text.slice(from, to);
        const inline = !before.includes('\n') && !after.includes('\n');
        let leading = '';
        let trailing = '';
        let core = selected;
        if (inline && selected) {
            const match = selected.match(/^(\s*)([\s\S]*?)(\s*)$/);
            leading = match[1];
            core = match[2];
            trailing = match[3];
        }
        const value = core || placeholder;
        const insert = leading + before + value + after + trailing;
        const selectedFrom = from + leading.length + before.length;
        return replacement(text, from, to, insert, selectedFrom, selectedFrom + value.length);
    }

    function linePrefix(text, selection, prefix, placeholder) {
        const { from, to } = normalizeSelection(text, selection);
        const selected = text.slice(from, to);
        const needsNewline = from > 0 && text[from - 1] !== '\n';
        const leadingNewline = needsNewline ? '\n' : '';
        let body;
        if (selected) {
            body = selected.split('\n').map((line, index) => (
                prefix === '1. ' ? `${index + 1}. ${line}` : prefix + line
            )).join('\n');
        } else {
            body = prefix + placeholder;
        }
        const insert = leadingNewline + body;
        const selectedFrom = from + leadingNewline.length + prefix.length;
        const selectedTo = selected
            ? from + insert.length
            : selectedFrom + placeholder.length;
        return replacement(text, from, to, insert, selected ? from + leadingNewline.length : selectedFrom, selectedTo);
    }

    function link(text, selection) {
        const { from, to } = normalizeSelection(text, selection);
        const label = text.slice(from, to) || 'link text';
        const insert = `[${label}](url)`;
        const urlFrom = from + label.length + 3;
        return replacement(text, from, to, insert, urlFrom, urlFrom + 3);
    }

    function table(text, selection) {
        const { from } = normalizeSelection(text, selection);
        const tableSource = '| Header 1 | Header 2 | Header 3 |\n'
            + '|----------|----------|----------|\n'
            + '| Cell 1   | Cell 2   | Cell 3   |\n'
            + '| Cell 4   | Cell 5   | Cell 6   |\n';
        const prefix = from > 0 && text[from - 1] !== '\n' ? '\n\n' : '';
        const insert = prefix + tableSource;
        const headerFrom = from + prefix.length + 2;
        return replacement(text, from, from, insert, headerFrom, headerFrom + 8);
    }

    function prettifyTable(text, selection) {
        const { from, to } = normalizeSelection(text, selection);
        let tableStart;
        let tableEnd;
        const selected = text.slice(from, to);

        if (to > from && selected.includes('\n')) {
            tableStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
            tableEnd = to;
            if (text[tableEnd - 1] === '\n') tableEnd--;
            while (tableEnd < text.length && text[tableEnd] !== '\n') tableEnd++;
            if (text[tableEnd] === '\n') tableEnd++;
        } else {
            const lines = text.split('\n');
            const offsets = [];
            let offset = 0;
            for (const line of lines) {
                offsets.push(offset);
                offset += line.length + 1;
            }
            let lineIndex = lines.length - 1;
            for (let index = 0; index < lines.length; index++) {
                if (offsets[index] + lines[index].length >= from) {
                    lineIndex = index;
                    break;
                }
            }
            const isTableLine = (line) => line.trim().startsWith('|');
            if (!isTableLine(lines[lineIndex])) return { changed: false, error: 'not-in-table' };
            let first = lineIndex;
            let last = lineIndex;
            while (first > 0 && isTableLine(lines[first - 1])) first--;
            while (last < lines.length - 1 && isTableLine(lines[last + 1])) last++;
            tableStart = offsets[first];
            const lastEnd = offsets[last] + lines[last].length;
            tableEnd = text[lastEnd] === '\n' ? lastEnd + 1 : lastEnd;
        }

        const lines = text.slice(tableStart, tableEnd).split('\n').filter((line) => line.trim());
        if (lines.length < 2 || !lines[0].trim().startsWith('|')) {
            return { changed: false, error: 'not-in-table' };
        }
        const cells = (line) => {
            const trimmed = line.trim();
            const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
            const value = inner.endsWith('|') ? inner.slice(0, -1) : inner;
            return value.split('|').map((cell) => cell.trim());
        };
        const isSeparator = (line) => {
            const value = line.trim();
            return value.startsWith('|') && /^[|:\-\s]+$/.test(value) && value.includes('-');
        };
        const separatorIndex = lines.findIndex(isSeparator);
        const rows = lines.map(cells);
        const columnCount = Math.max(...rows.map((row) => row.length));
        const alignments = Array.from({ length: columnCount }, (_, index) => {
            const cell = separatorIndex >= 0 ? (rows[separatorIndex][index] || '') : '';
            if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
            if (cell.endsWith(':')) return 'right';
            return 'left';
        });
        const widths = Array(columnCount).fill(3);
        rows.forEach((row, rowIndex) => {
            if (rowIndex === separatorIndex) return;
            row.forEach((cell, column) => {
                if (column < columnCount) widths[column] = Math.max(widths[column], cell.length);
            });
        });
        const renderRow = (row) => '|'
            + Array.from({ length: columnCount }, (_, column) => ` ${(row[column] || '').padEnd(widths[column])} `).join('|')
            + '|';
        const renderSeparator = () => '|'
            + alignments.map((alignment, column) => {
                const width = widths[column];
                let value = '-'.repeat(width);
                if (alignment === 'center') value = `:${'-'.repeat(Math.max(1, width - 2))}:`;
                if (alignment === 'right') value = `${'-'.repeat(Math.max(1, width - 1))}:`;
                return ` ${value} `;
            }).join('|')
            + '|';
        const output = lines.map((_, index) => (
            index === separatorIndex ? renderSeparator() : renderRow(rows[index])
        ));
        if (separatorIndex < 0) output.splice(1, 0, renderSeparator());
        const insert = output.join('\n') + '\n';
        return replacement(text, tableStart, tableEnd, insert, tableStart, tableStart + insert.length);
    }

    function indent(text, selection, shiftKey, enabled) {
        if (!enabled) return { changed: false };
        const { from, to } = normalizeSelection(text, selection);
        if (!shiftKey) {
            if (to > from && text.slice(from, to).includes('\n')) {
                const blockStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
                let blockEnd = text.indexOf('\n', to);
                if (blockEnd === -1) blockEnd = text.length;
                const block = text.slice(blockStart, blockEnd);
                const insert = block.split('\n').map((line) => `\t${line}`).join('\n');
                const selectedLines = block.split('\n').length;
                return replacement(
                    text,
                    blockStart,
                    blockEnd,
                    insert,
                    from + 1,
                    to + selectedLines
                );
            }
            return replacement(text, from, to, '\t', from + 1);
        }
        const blockStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
        let blockEnd = text.indexOf('\n', to);
        if (blockEnd === -1) blockEnd = text.length;
        const block = text.slice(blockStart, blockEnd);
        const lines = block.split('\n');
        let removedBeforeFrom = 0;
        let removedTotal = 0;
        let offset = blockStart;
        const out = lines.map((line) => {
            const match = line.match(/^(\t| {1,4})/);
            const removed = match ? match[0].length : 0;
            if (offset + removed <= from) removedBeforeFrom += removed;
            removedTotal += removed;
            offset += line.length + 1;
            return line.slice(removed);
        });
        if (!removedTotal) return { changed: false };
        const insert = out.join('\n');
        const nextFrom = Math.max(blockStart, from - removedBeforeFrom);
        const nextTo = Math.max(nextFrom, to - removedTotal);
        return replacement(text, blockStart, blockEnd, insert, nextFrom, nextTo);
    }

    function fromFullText(text, nextText, selection) {
        if (text === nextText) return { changed: false };
        let from = 0;
        while (from < text.length && from < nextText.length && text[from] === nextText[from]) from++;
        let oldTo = text.length;
        let newTo = nextText.length;
        while (oldTo > from && newTo > from && text[oldTo - 1] === nextText[newTo - 1]) {
            oldTo--;
            newTo--;
        }
        return replacement(text, from, oldTo, nextText.slice(from, newTo), selection.from, selection.to);
    }

    function toggleTask(text, selection) {
        const { from } = normalizeSelection(text, selection);
        const lineStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
        let lineEnd = text.indexOf('\n', from);
        if (lineEnd === -1) lineEnd = text.length;
        const line = text.slice(lineStart, lineEnd);
        const marker = line.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
        if (!marker) return { changed: false };
        const markerPosition = lineStart + marker[1].length + 1;
        const insert = marker[2] === ' ' ? 'x' : ' ';
        return replacement(text, markerPosition, markerPosition + 1, insert, from);
    }

    function format(text, selection, type) {
        const wraps = {
            bold: ['**', '**', 'bold'],
            italic: ['*', '*', 'italic'],
            strikethrough: ['~~', '~~', 'strikethrough'],
            code: ['`', '`', 'code'],
            image: ['![', '](image-url)', 'alt text'],
            codeblock: ['```\n', '\n```', 'code'],
        };
        if (wraps[type]) return wrap(text, selection, ...wraps[type]);
        if (type === 'heading') return linePrefix(text, selection, '## ', 'Heading');
        if (type === 'quote') return linePrefix(text, selection, '> ', 'quote');
        if (type === 'bullet') return linePrefix(text, selection, '- ', 'item');
        if (type === 'numbered') return linePrefix(text, selection, '1. ', 'item');
        if (type === 'checkbox') return linePrefix(text, selection, '- [ ] ', 'task');
        if (type === 'link') return link(text, selection);
        if (type === 'table') return table(text, selection);
        if (type === 'prettify-table') return prettifyTable(text, selection);
        return { changed: false };
    }

    global.EditorCommands = {
        format,
        fromFullText,
        indent,
        linePrefix,
        link,
        normalizeSelection,
        prettifyTable,
        table,
        toggleTask,
        wrap,
    };
})(typeof window !== 'undefined' ? window : globalThis);
