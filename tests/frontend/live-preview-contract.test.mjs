import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { Text } from '@codemirror/state';
import { lineBoundedRanges } from '../../frontend/src/live-preview-decorations.js';

const root = new URL('../../', import.meta.url);
const requiredEditorKeys = [
    'live_preview_mode_label',
    'classic_mode',
    'live_preview_mode',
    'live_preview_description',
    'live_preview_unavailable',
    'live_preview_loading',
    'live_preview_load_error',
    'live_preview_aria',
    'live_preview_task_complete',
    'live_preview_task_incomplete',
];

test('every locale contains the Live Preview strings', async () => {
    const localeDirectory = new URL('locales/', root);
    const localeFiles = (await readdir(localeDirectory)).filter((name) => name.endsWith('.json'));
    assert.ok(localeFiles.length > 1);

    for (const filename of localeFiles) {
        const locale = JSON.parse(await readFile(new URL(filename, localeDirectory), 'utf8'));
        for (const key of requiredEditorKeys) {
            assert.equal(typeof locale.editor?.[key], 'string', `${filename}: editor.${key}`);
            assert.ok(locale.editor[key].length > 0, `${filename}: editor.${key} is empty`);
        }
    }
});

test('frontend build dependencies are exact versions', async () => {
    const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
    const versions = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    for (const [name, version] of Object.entries(versions)) {
        assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must use an exact version`);
    }
    assert.equal(packageJson.devDependencies['html-minifier-terser'], '7.2.0');
});

test('the generated bundle remains a lazy-loaded artifact', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(app, /import\('\/static\/dist\/live-preview\.js'\)/);
    assert.doesNotMatch(html, /<script[^>]+live-preview\.js/);
});

test('hidden Live Preview syntax ranges never replace line breaks', () => {
    const doc = Text.of(['[text](', 'url', ')']);
    assert.deepEqual(lineBoundedRanges(doc, 6, doc.length), [
        { from: 6, to: 7 },
        { from: 8, to: 11 },
        { from: 12, to: 13 },
    ]);
});

test('shared editor commands load before the Alpine application', async () => {
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    const commands = html.indexOf('/static/editor-commands.js');
    const app = html.indexOf('/static/app.js');
    assert.ok(commands >= 0);
    assert.ok(app > commands);
});

test('toolbar formatting reads authoritative content and selection from Live Preview', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    assert.match(app, /content: this\._livePreviewEditor\.getContent\(\)/);
    assert.match(app, /selection: this\._livePreviewEditor\.getSelection\(\)/);
    assert.match(app, /const context = this\.getActiveEditorContext\(\);/);
    assert.match(app, /EditorCommands\.format\(\s*context\.content,\s*context\.selection,/);
});

test('Split remains a Classic-only view', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(html, /x-if="editorMode === 'classic'">\s+<button\s+@click="viewMode = 'split'"/);
    assert.doesNotMatch(html, /x-show="editorMode === 'classic'"\s+@click="viewMode = 'split'"/);
    assert.match(app, /mode === 'live-preview' && this\.viewMode === 'split'/);
});

test('the stale-content alert participates in editor layout', async () => {
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    const banner = html.match(/x-show="staleContent"\s+class="([^"]+)"/);
    assert.ok(banner, 'stale-content banner is present');
    assert.doesNotMatch(banner[1], /\babsolute\b/);
    assert.match(banner[1], /\bflex-shrink-0\b/);
    assert.match(html, /class="flex-1 flex flex-col relative"/);
});

test('the Live Preview cursor uses the active theme text color', async () => {
    const source = await readFile(new URL('frontend/src/live-preview.js', root), 'utf8');
    assert.match(source, /'\.cm-cursor, \.cm-dropCursor'/);
    assert.match(source, /borderLeftColor: 'var\(--text-primary\)'/);
});

test('Live Preview selections contrast with styled and source text', async () => {
    const source = await readFile(new URL('frontend/src/live-preview.js', root), 'utf8');
    assert.match(source, /'\.cm-content \.cm-line\.cm-line::selection/);
    assert.match(source, /color: 'var\(--bg-primary\) !important'/);
    assert.match(source, /var\(--accent-primary\) 70%/);
});

test('Live Preview Markdown features use non-document decorations', async () => {
    const editor = await readFile(new URL('frontend/src/live-preview.js', root), 'utf8');
    const decorations = await readFile(
        new URL('frontend/src/live-preview-decorations.js', root),
        'utf8'
    );
    assert.match(editor, /extensions: \[Table, TaskList, Strikethrough, Autolink\]/);
    assert.match(editor, /codeLanguages,/);
    assert.match(editor, /syntaxHighlighting\(codeHighlightStyle\)/);
    assert.match(decorations, /class: 'cm-live-preview-only-line'/);
    assert.match(decorations, /class: 'cm-live-preview-only-inline'/);
    assert.doesNotMatch(decorations, /PreviewOnlyBadge/);
    assert.match(decorations, /'Table'/);
    assert.match(decorations, /'cm-live-table-line'/);
    assert.match(editor, /'\.cm-live-table-line'/);
    assert.match(editor, /fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'/);
    assert.match(decorations, /node\.name === 'Blockquote'/);
    assert.match(decorations, /node\.name === 'FencedCode'/);
    assert.match(decorations, /node\.name === 'HorizontalRule'/);
    assert.match(decorations, /node\.name === 'Strikethrough'/);
    assert.match(decorations, /\(\?:ATX\|Setext\)Heading/);
    assert.match(decorations, /--cm-live-list-hang:/);
    assert.match(editor, /paddingLeft: 'var\(--cm-live-list-hang, 1em\)'/);
});
