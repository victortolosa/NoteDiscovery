import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../frontend/app.js', import.meta.url), 'utf8');
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, headers: { get: () => null } });
const tick = () => new Promise(resolve => setImmediate(resolve));

function editor() {
    const storage = new Map();
    const requests = [];
    const errors = [];
    const timers = new Map();
    const context = vm.createContext({
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        window: { dispatchEvent: e => errors.push(e), history: { pushState() {}, replaceState() {} } },
        document: { title: '', activeElement: null },
        CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
        console: { error() {} }, Blob, URL, URLSearchParams,
        setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame: () => {},
        fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
    });
    vm.runInContext(source, context);
    const app = vm.runInContext('noteApp()', context);
    Object.assign(app, {
        currentNote: 'A.md', currentNoteName: 'A', noteContent: 'edit one', _savedContent: 'disk', _noteBaseHash: 'hash-disk',
        notes: [{ path: 'A.md' }, { path: 'B.md' }], openTabs: [{ path: 'A.md' }],
        loadTagsDebounced() {}, parseTagsFromContent: () => [], buildFolderTree() {},
        $nextTick() {}, captureEditorCaret: () => null, replaceLivePreviewDocument() {},
        extractOutline() {}, parseMetadata() {}, toast() {}, t: x => x,
        closeMediaViewer() {}, expandFolderForNote() {}, _restoreNoteScroll() {},
        loadSharedNotePaths: async () => {},
    });
    return { app, requests, errors, storage, timers };
}

const posted = request => JSON.parse(request.options.body);

test('only submitted text is acknowledged, with later edits drained in order', async () => {
    const { app, requests } = editor();
    const saved = app.saveNote();
    app.noteContent = 'edit two';
    assert.equal(app.acceptServerContentIfPristine('external', '', 'hash-external'), false);
    requests[0].resolve(response({ hash: 'hash-one' }));
    await tick();
    assert.equal(app._savedContent, 'edit one');
    assert.equal(app.lastSaved, false);
    assert.equal(requests.length, 2);
    assert.deepEqual(posted(requests[1]), { content: 'edit two', base_hash: 'hash-one' });
    requests[1].resolve(response({ hash: 'hash-two' }));
    assert.equal(await saved, true);
    assert.equal(app._savedContent, 'edit two');
    assert.equal(app._noteBaseHash, 'hash-two');
    assert.equal(app.isSaving, false);
});

test('overlapping save callers wait for the same ordered writes', async () => {
    const { app, requests } = editor();
    const first = app.saveNote();
    app.noteContent = 'latest';
    const second = app.saveNote();
    const navigation = app.flushNoteSave();
    assert.equal(requests.length, 1);
    requests[0].resolve(response({ hash: 'one' }));
    await tick();
    assert.equal(requests.length, 2);
    requests[1].resolve(response({ hash: 'two' }));
    assert.deepEqual(await Promise.all([first, second, navigation]), [true, true, true]);
});

test('an acknowledgment cannot mark another note or a reopened session saved', async () => {
    for (const reopened of [false, true]) {
        const { app, requests } = editor();
        const pending = app.saveNote();
        app.currentNote = reopened ? 'A.md' : 'B.md';
        app._noteSession++;
        app.noteContent = 'unsent'; app._savedContent = 'other disk'; app._noteBaseHash = 'other hash';
        requests[0].resolve(response({ hash: 'old response' }));
        assert.equal(await pending, false);
        assert.equal(app._savedContent, 'other disk');
        assert.equal(app._noteBaseHash, 'other hash');
        assert.equal(app.lastSaved, false);
    }
});

test('failed saves keep the editor and active tab open, and allow explicit retry', async () => {
    const { app, requests, errors } = editor();
    const close = app.closeTab(0);
    requests[0].resolve(response({}, 500));
    await close;
    assert.equal(app.currentNote, 'A.md');
    assert.equal(app.noteContent, 'edit one');
    assert.equal(app._savedContent, 'disk');
    assert.equal(app.openTabs.length, 1);
    assert.equal(app._savePromise, null);
    assert.equal(requests.length, 1); // No uncontrolled retry loop.
    assert.equal(errors.length, 1);
    const retry = app.saveNote();
    requests[1].resolve(response({ hash: 'retried' }));
    assert.equal(await retry, true);
});

test('home navigation waits for a save and retains edits on network failure', async () => {
    const { app, requests } = editor();
    const home = app.goHome();
    assert.equal(app.currentNote, 'A.md');
    requests[0].reject(new Error('offline'));
    await home;
    assert.equal(app.currentNote, 'A.md');
    assert.equal(app.noteContent, 'edit one');
});

test('409 preserves local text, fetches fresh remote content and blocks further saves', async () => {
    const { app, requests, storage } = editor();
    const saving = app.saveNote();
    requests[0].resolve(response({ hash: 'remote' }, 409));
    await tick();
    assert.equal(requests[1].options, undefined);
    requests[1].resolve(response({ content: 'external edit', hash: 'remote' }));
    assert.equal(await saving, false);
    assert.equal(app.noteContent, 'edit one');
    assert.equal(app._savedContent, 'disk');
    assert.equal(app.staleContent, true);
    assert.equal(app.staleServerContent, 'external edit');
    assert.equal(app._staleServerHash, 'remote');
    assert.equal(storage.has('tabContent:A.md'), false);
    assert.equal(await app.flushNoteSave(), false);
    assert.equal(requests.length, 2);
    app.reloadFromServer();
    assert.equal(app.noteContent, 'external edit');
    assert.equal(app._noteBaseHash, 'remote');
    assert.equal(await app.saveNote(), true);
    assert.equal(requests.length, 2);
});

test('overwrite uses the displayed remote revision, so another change can still conflict', async () => {
    const { app, requests } = editor();
    app.staleContent = true; app.staleServerContent = 'remote'; app._staleServerHash = 'hash-remote';
    app.keepMyVersion();
    assert.deepEqual(posted(requests[0]), { content: 'edit one', base_hash: 'hash-remote' });
    requests[0].resolve(response({ hash: 'hash-local' }));
    await app._savePromise;
});

test('tab caches pair content with revisions and reject legacy entries', () => {
    const { app, storage } = editor();
    storage.set('tabContent:A.md', JSON.stringify({ content: 'legacy', ts: Date.now() }));
    assert.equal(app._loadTabCache('A.md'), null);
    app._saveTabCache('A.md', { content: 'cached', hash: 'revision' });
    const cache = app._loadTabCache('A.md');
    assert.equal(cache.content, 'cached'); assert.equal(cache.hash, 'revision');
});

test('a stale poll started before a save cannot refresh the acknowledged document', async () => {
    const { app, requests } = editor();
    app.noteContent = app._savedContent;
    const poll = app.checkNoteStale();
    app.noteContent = 'new typing';
    const saving = app.saveNote();
    requests[1].resolve(response({ hash: 'new-hash' }));
    await saving;
    requests[0].resolve(response({ content: 'old snapshot', hash: 'old-hash' }));
    await poll;
    assert.equal(app.noteContent, 'new typing');
    assert.equal(app._noteBaseHash, 'new-hash');
    assert.equal(app.staleContent, false);
});

test('path changes wait for saves and hold new typing until the destination exists', async () => {
    const { app, requests } = editor();
    const moving = app.mutateNotePath('/api/notes/move', 'A.md', 'renamed.md', () => { app.currentNote = 'renamed.md'; });
    assert.equal(requests.length, 1);
    requests[0].resolve(response({ hash: 'saved' }));
    await tick();
    assert.equal(requests[1].url, '/api/notes/move');
    app.noteContent = 'typing during move';
    assert.equal(await app.saveNote(), false);
    assert.equal(requests.length, 2);
    requests[1].resolve(response({ success: true }));
    await tick();
    assert.equal(requests[2].url, '/api/notes/renamed.md');
    assert.equal(posted(requests[2]).base_hash, 'saved');
    requests[2].resolve(response({ hash: 'after-move' }));
    assert.equal(await moving, true);
    assert.equal(app._savedContent, 'typing during move');
});

test('failed path changes retain the source and save keystrokes there', async () => {
    const { app, requests } = editor();
    app.noteContent = app._savedContent;
    const moving = app.mutateNotePath('/api/notes/move', 'A.md', 'other.md', () => { throw new Error('must not apply'); });
    await tick();
    app.noteContent = 'keep this';
    requests[0].resolve(response({ detail: 'destination exists' }, 409));
    await tick();
    assert.equal(app.currentNote, 'A.md');
    assert.equal(requests[1].url, '/api/notes/A.md');
    requests[1].resolve(response({ hash: 'kept' }));
    assert.equal(await moving, false);
    assert.equal(app._savedContent, 'keep this');
});

test('navigation drains an in-flight save and typing made while the destination loads', async () => {
    const { app, requests, errors } = editor();
    const saving = app.saveNote();
    const navigation = app.loadNote('B.md');
    assert.equal(requests.length, 1);
    requests[0].resolve(response({ hash: 'first-save' }));
    await saving;
    await tick();
    assert.equal(requests[1].url, '/api/notes/B.md');
    assert.equal(app.currentNote, 'A.md');
    app.noteContent = 'typed during navigation';
    requests[1].resolve(response({ content: 'B disk', hash: 'B-hash' }));
    await tick();
    assert.equal(requests[2].url, '/api/notes/A.md');
    assert.equal(posted(requests[2]).content, 'typed during navigation');
    requests[2].resolve(response({ hash: 'last-save' }));
    await navigation;
    assert.equal(app.currentNote, 'B.md');
    assert.equal(app.noteContent, 'B disk');
    assert.equal(app._noteBaseHash, 'B-hash');
    assert.equal(errors.length, 0);
});

test('a failed navigation save never fetches or displays the target', async () => {
    const { app, requests } = editor();
    const navigation = app.loadNote('B.md');
    requests[0].resolve(response({}, 500));
    assert.equal(await navigation, false);
    assert.equal(requests.length, 1);
    assert.equal(app.currentNote, 'A.md');
    assert.equal(app.noteContent, 'edit one');
});

test('out-of-order navigation responses cannot replace the most recently chosen note', async () => {
    const { app, requests } = editor();
    app.noteContent = app._savedContent;
    const first = app.loadNote('B.md');
    await tick();
    const second = app.loadNote('C.md');
    await tick();
    requests[1].resolve(response({ content: 'C content', hash: 'C-hash' }));
    await second;
    requests[0].resolve(response({ content: 'B content', hash: 'B-hash' }));
    await first;
    assert.equal(app.currentNote, 'C.md');
    assert.equal(app.noteContent, 'C content');
    assert.equal(app._noteBaseHash, 'C-hash');
});

test('missing-note background checks cannot remove an editor with unsaved content', () => {
    const { app } = editor();
    app._forgetMissingNote('A.md');
    assert.equal(app.currentNote, 'A.md');
    assert.equal(app.noteContent, 'edit one');
    assert.equal(app.openTabs.length, 1);
});

test('cached tab loads retain their own revision for subsequent saves', async () => {
    const { app, requests, errors } = editor();
    app.noteContent = app._savedContent;
    app._saveTabCache('B.md', { content: 'cached B', hash: 'B-old-hash' });
    await app.loadNote('B.md');
    assert.equal(app._noteBaseHash, 'B-old-hash');
    requests[0].resolve(response({ content: 'cached B', hash: 'B-old-hash' }));
    await tick();
    app.noteContent = 'B local typing';
    const saving = app.saveNote();
    assert.equal(posted(requests[1]).base_hash, 'B-old-hash');
    requests[1].resolve(response({ hash: 'B-new-hash' }));
    await saving;
    assert.equal(app._loadTabCache('B.md').hash, 'B-new-hash');
    assert.equal(errors.length, 0);
});

test('reloading the active note cannot roll back a save completed during its fetch', async () => {
    const { app, requests } = editor();
    app.noteContent = app._savedContent;
    const reload = app.loadNote('A.md');
    await tick();
    app.noteContent = 'newly saved typing';
    const saving = app.saveNote();
    requests[1].resolve(response({ hash: 'latest-hash' }));
    await saving;
    requests[0].resolve(response({ content: 'disk', hash: 'hash-disk' }));
    assert.equal(await reload, false);
    assert.equal(app.noteContent, 'newly saved typing');
    assert.equal(app._noteBaseHash, 'latest-hash');
    assert.equal(app.loadingNote, false);
});
