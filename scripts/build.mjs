import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../dist/', import.meta.url));
// Keep native module, worker and AudioWorklet URLs intact. Only third-party
// browser dependencies need bundling; the instrument remains plain ES modules.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('../src/', import.meta.url), out, { recursive: true });
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
console.log('Built Eurorack into dist/');
