import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildDocs, renderRackHome } from './build-docs.mjs';
import { rackShell } from '../server/rack-page.js';
import { validateAudioAnalysisAssets } from './audio-analysis-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../dist/', import.meta.url));
await validateAudioAnalysisAssets({root});
// Keep native module, worker and AudioWorklet URLs intact. Only third-party
// browser dependencies need bundling; the instrument remains plain ES modules.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('../src/', import.meta.url), out, { recursive: true });
// Preview regeneration must work when the demo source has changed but its
// committed image manifest is stale. Normal builds keep that validation strict.
if (process.argv.includes('--instrument-only')) {
    await cp(`${out}/index.html`, `${out}/patches.html`);
} else {
    const socialCards = await buildDocs({ root, out });
    const shell = await rackShell();
    await writeFile(`${out}/index.html`, renderRackHome(shell, socialCards['/']));
    await writeFile(`${out}/patches.html`, shell);
}
await build({
    stdin: {
        contents: "export { createAuthClient } from 'better-auth/client'; export { ulid } from 'ulid'; export { toBlob, toPng } from 'html-to-image';",
        resolveDir: root,
        sourcefile: 'cloud-vendor.js'
    },
    outfile: `${out}/vendor/cloud.js`,
    bundle: true, format: 'esm', platform: 'browser', target: ['es2022'],
    minify: true, sourcemap: false, legalComments: 'eof'
});
// Bundle the evaluator's entire dependency graph into a disposable opaque-origin
// iframe. Blob workers inherit the creator's CSP: no network or external scripts.
const worker = await build({
    entryPoints: [`${root}/src/js/patch-script/evaluator-worker.js`],
    bundle: true, format: 'iife', platform: 'browser', target: ['es2022'],
    write: false, minify: true, legalComments: 'none'
});
const sandbox = await build({
    entryPoints: [`${root}/src/js/patch-script/evaluator-sandbox.js`],
    bundle: true, format: 'iife', platform: 'browser', target: ['es2022'],
    define: { __PATCH_WORKER_SOURCE__: JSON.stringify(worker.outputFiles[0].text) },
    write: false, minify: true, legalComments: 'none'
});
const policy = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'";
const sandboxScript = sandbox.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
await writeFile(`${out}/patch-script-sandbox.html`, `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>Patch evaluator</title></head><body><script>${sandboxScript}</script></body></html>`);
console.log('Built Eurorack into dist/');
