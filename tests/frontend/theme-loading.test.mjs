import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = name => readFileSync(new URL('../../' + name, import.meta.url), 'utf8');
const appSource = read('frontend/app.js');
const config = { defaultTheme: 'obsidian', themes: ['light', 'dark', 'obsidian', 'custom-theme'] };

function bootstrap(page, saved, blocked = false) {
    const html = read('frontend/' + page);
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('__THEME_BOOTSTRAP__'));
    assert.ok(script);
    const attrs = {};
    const stylesheet = { dataset: {} };
    vm.runInNewContext(script.replace('__THEME_BOOTSTRAP__', JSON.stringify(config)), {
        document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } }, getElementById: () => stylesheet },
        localStorage: { getItem: () => { if (blocked) throw new Error('blocked'); return saved; } },
    });
    return { html, attrs, stylesheet };
}

for (const page of ['index.html', 'login.html']) {
    test(`${page} selects saved themes before the body, with no theme XHR`, () => {
        for (const id of config.themes) {
            const { html, attrs, stylesheet } = bootstrap(page, id);
            assert.equal(attrs['data-theme'], id);
            assert.equal(stylesheet.dataset.theme, id);
            assert.ok(stylesheet.href.startsWith(`/api/themes/${id}?raw=true&v=`));
            assert.ok(html.indexOf('id="initial-theme"') < html.indexOf('<body'));
        }
    });
    test(`${page} falls back safely for unavailable storage or removed themes`, () => {
        for (const [saved, blocked] of [[null, false], ['removed', false], ['../../invalid', false], ['light', true]]) {
            assert.equal(bootstrap(page, saved, blocked).attrs['data-theme'], 'obsidian');
        }
    });
}

function themeApp(initial = null) {
    const elements = new Map();
    if (initial) elements.set('initial-theme', { ...initial, remove() { elements.delete('initial-theme'); } });
    const attrs = { 'data-theme': initial?.dataset.theme || 'obsidian' };
    const storage = new Map();
    const requests = [];
    const context = vm.createContext({
        window: {},
        localStorage: { getItem: () => null, setItem: (k, v) => storage.set(k, v) },
        document: {
            getElementById: id => elements.get(id),
            createElement: () => ({}), head: { appendChild: element => elements.set(element.id, element) },
            documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k] },
            querySelector: () => null,
        },
        fetch: url => new Promise(resolve => requests.push({ url, resolve })),
        console: { error() {} }, setTimeout() {},
    });
    vm.runInContext(appSource, context);
    const app = vm.runInContext('noteApp()', context);
    return { app, attrs, elements, storage, requests };
}
const cssResponse = (css, ok = true) => ({ ok, json: async () => ({ css }) });

test('initialization reuses the early stylesheet without fetching its CSS again', async () => {
    const { app, requests, attrs } = themeApp({ dataset: { theme: 'light' }, sheet: {} });
    await app.initTheme();
    assert.equal(requests.length, 0);
    assert.equal(app.currentTheme, 'light');
    assert.equal(attrs['data-theme'], 'light');
});

test('switching themes replaces the initial sheet only after valid CSS arrives', async () => {
    const { app, requests, elements, attrs, storage } = themeApp({ dataset: { theme: 'obsidian' }, sheet: {} });
    const changing = app.setTheme('light');
    assert.ok(elements.has('initial-theme'));
    assert.equal(attrs['data-theme'], 'obsidian');
    requests[0].resolve(cssResponse(':root[data-theme="light"] { --bg-primary: white; }'));
    await changing;
    assert.equal(elements.has('initial-theme'), false);
    assert.ok(elements.get('dynamic-theme').textContent.includes('white'));
    assert.equal(attrs['data-theme'], 'light');
    assert.equal(storage.get('noteDiscoveryTheme'), 'light');
});

test('rapid theme choices cannot apply or persist an older response', async () => {
    const { app, requests, elements, attrs, storage } = themeApp();
    const first = app.setTheme('light');
    const second = app.setTheme('dark');
    requests[1].resolve(cssResponse('dark css'));
    await second;
    requests[0].resolve(cssResponse('light css'));
    await first;
    assert.equal(attrs['data-theme'], 'dark');
    assert.equal(elements.get('dynamic-theme').textContent, 'dark css');
    assert.equal(app.currentTheme, 'dark');
    assert.equal(storage.get('noteDiscoveryTheme'), 'dark');
});

test('failed theme changes preserve the displayed theme and stored preference', async () => {
    const { app, requests, elements, attrs, storage } = themeApp({ dataset: { theme: 'obsidian' }, sheet: {} });
    app.currentTheme = 'missing'; // The settings select updates x-model first.
    const changing = app.setTheme('missing');
    requests[0].resolve(cssResponse('', false));
    await changing;
    assert.equal(app.currentTheme, 'obsidian');
    assert.equal(attrs['data-theme'], 'obsidian');
    assert.ok(elements.has('initial-theme'));
    assert.equal(storage.has('noteDiscoveryTheme'), false);
});
