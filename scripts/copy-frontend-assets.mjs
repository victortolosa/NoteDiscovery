import { cp, copyFile, mkdir } from 'node:fs/promises';

const output = new URL('../frontend/dist/', import.meta.url);

await mkdir(output, { recursive: true });
await copyFile(
    new URL('../node_modules/highlight.js/styles/github.min.css', import.meta.url),
    new URL('highlight-github.css', output)
);
await copyFile(
    new URL('../node_modules/highlight.js/styles/github-dark.min.css', import.meta.url),
    new URL('highlight-github-dark.css', output)
);
await copyFile(
    new URL('../node_modules/mathjax/es5/tex-mml-chtml.js', import.meta.url),
    new URL('mathjax.js', output)
);
await cp(
    new URL('../node_modules/mathjax/es5/output/chtml/fonts/', import.meta.url),
    new URL('output/chtml/fonts/', output),
    { recursive: true }
);
