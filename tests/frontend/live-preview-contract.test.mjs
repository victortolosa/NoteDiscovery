import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

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

test('shared editor commands load before the Alpine application', async () => {
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    const commands = html.indexOf('/static/editor-commands.js');
    const app = html.indexOf('/static/app.js');
    assert.ok(commands >= 0);
    assert.ok(app > commands);
});

test('Split remains a Classic-only view', async () => {
    const app = await readFile(new URL('frontend/app.js', root), 'utf8');
    const html = await readFile(new URL('frontend/index.html', root), 'utf8');
    assert.match(html, /x-show="editorMode === 'classic'"\s+@click="viewMode = 'split'"/);
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
