import Alpine from 'alpinejs';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import http from 'highlight.js/lib/languages/http';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import { marked } from 'marked';
import qrcode from 'qrcode-generator';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('http', http);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('python', python);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('yaml', yaml);

window.Alpine = Alpine;
window.DOMPurify = DOMPurify;
window.hljs = hljs;
window.marked = marked;
window.qrcode = qrcode;

async function loadTranslations() {
    const preferredLocale = localStorage.getItem('locale') || 'en-US';
    for (const locale of [...new Set([preferredLocale, 'en-US'])]) {
        try {
            const response = await fetch(`/api/locales/${locale}`);
            if (!response.ok) continue;
            window.__preloadedTranslations = await response.json();
            if (locale !== preferredLocale) localStorage.setItem('locale', locale);
            return;
        } catch (_) {
            // Try the fallback locale.
        }
    }
    window.__preloadedTranslations = {};
}

loadTranslations()
    .catch(() => {
        window.__preloadedTranslations = {};
    })
    .finally(() => Alpine.start());
