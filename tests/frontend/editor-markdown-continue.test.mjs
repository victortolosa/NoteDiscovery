import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../frontend/editor-markdown-continue.js');

const { tryEnter } = globalThis.EditorMarkdownContinue;
const enter = {
    key: 'Enter',
    defaultPrevented: false,
    isComposing: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
};

function atEnd(text) {
    return tryEnter(text, text.length, text.length, enter);
}

test('continues common Markdown block prefixes', () => {
    assert.deepEqual(atEnd('- item'), {
        handled: true,
        text: '- item\n- ',
        cursor: 9,
    });
    assert.equal(atEnd('4. item').text, '4. item\n5. ');
    assert.equal(atEnd('> quoted').text, '> quoted\n> ');
    assert.equal(atEnd('- [x] done').text, '- [x] done\n- [ ] ');
});

test('exits an empty list item', () => {
    assert.deepEqual(atEnd('before\n- '), {
        handled: true,
        text: 'before\n',
        cursor: 7,
    });
});

test('an empty nested item outdents before exiting the list', () => {
    assert.deepEqual(atEnd('- parent\n\t- '), {
        handled: true,
        text: '- parent\n- ',
        cursor: 11,
    });
    assert.deepEqual(atEnd('- parent\n    - '), {
        handled: true,
        text: '- parent\n- ',
        cursor: 11,
    });
});

test('does not continue inside fenced code or during composition', () => {
    assert.deepEqual(atEnd('```\n- code'), { handled: false });
    assert.deepEqual(
        tryEnter('- item', 6, 6, { ...enter, isComposing: true }),
        { handled: false }
    );
});
