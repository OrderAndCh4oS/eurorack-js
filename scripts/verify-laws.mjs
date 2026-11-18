import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const cwd = fileURLToPath(new URL('../laws/', import.meta.url));
const output = new URL('../src/js/rack/verified-laws.js', import.meta.url);
const scratch = await mkdtemp(join(tmpdir(), 'eurorack-laws-'));
function bend(args) {
    return execFileSync(process.env.BEND || 'bend', args, {
        cwd, env: { ...process.env, BEND_NO_TELEMETRY: '1' }, encoding: 'utf8'
    });
}

try {
    const verdict = bend(['PROOF.bend', '--verdict']).trim();
    console.log(verdict);
    if (!verdict.split(/\r?\n/).includes('ALL PROOFS CHECK')) throw new Error('BendTT did not accept the proofs');
    const generated = join(scratch, 'rack.mjs');
    bend(['Rack.bend', '-o', generated]);
    const bundle = await build({
        absWorkingDir: scratch, entryPoints: ['rack.mjs'], bundle: true, format: 'esm', platform: 'neutral',
        write: false, legalComments: 'none',
        banner: { js: '// Generated from laws/Rack.bend with Bend 2.0.40. Run npm run laws:generate to update.' }
    });
    const code = bundle.outputFiles[0].text;
    if (process.argv.includes('--write')) await writeFile(output, code);
    else if (code !== await readFile(output, 'utf8')) throw new Error('Stale verified-laws.js. Run npm run laws:generate.');
} finally {
    await rm(scratch, { recursive: true, force: true });
}
