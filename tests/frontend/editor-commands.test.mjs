import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../frontend/editor-commands.js');

const commands = globalThis.EditorCommands;

test('inline wrappers preserve edge whitespace and select the content', () => {
    const result = commands.format('one house  two', { from: 3, to: 11 }, 'bold');
    assert.equal(result.text, 'one **house**  two');
    assert.deepEqual(result.selection, { from: 6, to: 11 });
});

test('links replace the selection and select the URL placeholder', () => {
    const result = commands.format('visit home', { from: 6, to: 10 }, 'link');
    assert.equal(result.text, 'visit [home](url)');
    assert.equal(result.text.slice(result.selection.from, result.selection.to), 'url');
});

test('line formats support multiline numbered and task lists', () => {
    const numbered = commands.format('alpha\nbeta', { from: 0, to: 10 }, 'numbered');
    assert.equal(numbered.text, '1. alpha\n2. beta');
    assert.equal(commands.format('', { from: 0, to: 0 }, 'checkbox').text, '- [ ] task');
});

test('table insertion and prettification are editor-independent', () => {
    const inserted = commands.format('intro', { from: 5, to: 5 }, 'table');
    assert.match(inserted.text, /^intro\n\n\| Header 1/);
    const source = '| A|Long |\n|---|:---:|\n|x| y|\n';
    const pretty = commands.format(source, { from: 3, to: 3 }, 'prettify-table');
    assert.equal(pretty.text, '| A   | Long |\n| --- | :--: |\n| x   | y    |\n');
});

test('Tab indents selections and Shift-Tab reverses them', () => {
    const indented = commands.indent('one\ntwo', { from: 0, to: 7 }, false, true);
    assert.equal(indented.text, '\tone\n\ttwo');
    const outdented = commands.indent(indented.text, indented.selection, true, true);
    assert.equal(outdented.text, 'one\ntwo');
    assert.deepEqual(commands.indent('text', { from: 0, to: 0 }, false, false), { changed: false });
});

test('task toggling and full-text diffs emit one source replacement', () => {
    const toggled = commands.toggleTask('- [ ] todo', { from: 8, to: 8 });
    assert.equal(toggled.text, '- [x] todo');
    assert.deepEqual(toggled.change, { from: 3, to: 4, insert: 'x' });

    const diff = commands.fromFullText('- item', '- item\n- ', { from: 9, to: 9 });
    assert.deepEqual(diff.change, { from: 6, to: 6, insert: '\n- ' });
});
