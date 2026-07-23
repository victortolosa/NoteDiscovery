import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState, Text } from '@codemirror/state';
import { lineBoundedRanges } from '../../frontend/src/live-preview-decorations.js';
import { linkTargetAtPosition } from '../../frontend/src/live-preview.js';

const root = new URL('../../', import.meta.url);
const requiredEditorKeys = [
    'live_preview_mode_label',
    'classic_mode',
    'live_preview_mode',
    'live_preview_description',
    'live_preview_unavailable',
    'live_preview_loading',
    'live_preview_load_error',
    'live_preview_retry',
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

test('production frontend dependencies are self-hosted build artifacts', async () => {
    const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    const dockerfile = await readFile(new URL('Dockerfile', root), 'utf8');
    assert.doesNotMatch(html, /<(?:script|link)[^>]+https:\/\//);
    assert.doesNotMatch(html, /XMLHttpRequest/);
    assert.match(html, /\/static\/dist\/tailwind\.css/);
    assert.match(html, /\/static\/dist\/vendor\.js/);
    assert.match(packageJson.scripts['build:frontend:minify'], /build:vendor/);
    assert.match(dockerfile, /npm run build:frontend:minify/);
});

test('the generated bundle remains a lazy-loaded artifact', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(app, /import\('\/static\/dist\/live-preview\.js'\)/);
    assert.doesNotMatch(html, /<script[^>]+live-preview\.js/);
    assert.match(app, /import\('\/static\/dist\/mermaid-vendor\.js'\)/);
    assert.match(app, /import\('\/static\/dist\/vis-network-vendor\.js'\)/);
});

test('Live Preview failures distinguish missing bundles from runtime errors', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(app, /await this\.checkLivePreviewAvailability\(\)/);
    assert.match(app, /this\.livePreviewAvailable[\s\S]*live_preview_load_error[\s\S]*live_preview_unavailable/);
    assert.match(app, /async retryLivePreview\(\)/);
    assert.match(html, /@click="retryLivePreview\(\)"/);
    assert.match(html, /@click="setEditorMode\('classic'\)"/);
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

test('Live Preview resolves deliberate Markdown and wikilink activation targets', () => {
    const source = '[Label](note.md)\n[[Other Note|Other]]';
    const state = EditorState.create({
        doc: source,
        extensions: [markdown()],
    });
    assert.equal(linkTargetAtPosition(state, 2), 'note.md');
    assert.equal(linkTargetAtPosition(state, source.indexOf('Other Note') + 2), 'Other Note');
});

test('outline and quick-switcher navigation use Live Preview source positions', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    assert.match(app, /from: lineStarts\[lineIndex\]/);
    assert.match(app, /data-source-offset/);
    assert.match(app, /const charPos = Number\.isInteger\(heading\.from\)/);
    assert.match(app, /this\._livePreviewEditor\.getSelection\(\)\.from/);
    assert.match(app, /this\._livePreviewEditor\.replaceRange\(\{/);
    assert.match(app, /async navigateToBacklink\(backlinkPath\)/);
});

test('Split remains a Classic-only view', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(html, /x-if="editorMode === 'classic'">\s+<button\s+@click="viewMode = 'split'"/);
    assert.doesNotMatch(html, /x-show="editorMode === 'classic'"\s+@click="viewMode = 'split'"/);
    assert.match(app, /mode === 'live-preview' && this\.viewMode === 'split'/);
});

test('sticky heading navigation belongs only to full Preview mode', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.equal((html.match(/class="sticky-signpost sticky-signpost-preview"/g) || []).length, 1);
    assert.doesNotMatch(html, /sticky-signpost flex-shrink-0/);
    assert.match(app, /this\.viewMode !== 'preview'/);
    assert.match(app, /updateStickyHeadingFromPreview\(\)/);
    assert.match(app, /scrollToStickyHeading\(heading\)/);
});

test('the stale-content alert participates in editor layout', async () => {
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    const banner = html.match(/x-show="staleContent"\s+class="([^"]+)"/);
    assert.ok(banner, 'stale-content banner is present');
    assert.doesNotMatch(banner[1], /\babsolute\b/);
    assert.match(banner[1], /\bflex-shrink-0\b/);
    assert.match(html, /class="flex-1 flex flex-col relative"/);
});

test('external note changes auto-refresh only when the local note is pristine', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    assert.equal((app.match(/_savedContent: ''/g) || []).length, 1);
    assert.match(
        app,
        /acceptServerContentIfPristine\(serverContent, signature = ''\)[\s\S]*this\.noteContent !== this\._savedContent/
    );
    assert.match(app, /this\.replaceLivePreviewDocument\(serverContent, \{ resetHistory: true \}\)/);
    assert.match(app, /if \(this\.acceptServerContentIfPristine\(serverContent, responseSignature\)\) return/);
    assert.match(app, /if \(this\.acceptServerContentIfPristine\(data\.content, sig\)\) return/);
});

test('optional shortcut templates do not generate expected 404 requests', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    assert.match(app, /this\._hasCustomShortcutsTemplate = templates\.some/);
    assert.match(app, /if \(!this\._hasCustomShortcutsTemplate\) return/);
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
