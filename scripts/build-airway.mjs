import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AIRWAY_ROOT as root, AIRWAY_ASSETS, AIRWAY_COMMIT, airwayInputs, airwayManifest, sha256, validateAirwayAssets } from './airway-assets.mjs';

const crate = join(root, 'wasm/airway');
const assets = join(root, AIRWAY_ASSETS);
const cargo = (...args) => execFileSync('cargo', args, { cwd: crate, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const source = await airwayInputs(root);
cargo('build', '--release', '--locked', '--target', 'wasm32-unknown-unknown');
const metadata = JSON.parse(cargo('metadata', '--locked', '--offline', '--format-version', '1', '--filter-platform', 'wasm32-unknown-unknown'));
const wasm = await readFile(join(metadata.target_directory, 'wasm32-unknown-unknown/release/eurorack_airway.wasm'));
const wasmFile = `airway-${sha256(wasm)}.wasm`;
const javascript = `// Generated from CHIMERA ${AIRWAY_COMMIT}. See LICENSES.txt.\n// Embedded to avoid fetch, atob and browser-only APIs in AudioWorklet DSP.\nexport const AIRWAY_WASM_BASE64 = '${wasm.toString('base64')}';\n`;
const moduleFile = `airway-${sha256(javascript)}.js`;
const notices = ['Airway — CHIMERA and locked Rust dependency license notices', `CHIMERA source: https://github.com/jamesondh/chimera-vocal-synth/tree/${AIRWAY_COMMIT}`, 'Build-only dependencies are included for completeness.'];
for (const pkg of metadata.packages.filter(pkg => pkg.name !== 'eurorack-airway').sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = dirname(pkg.manifest_path);
    const names = (await readdir(directory)).filter(name => /^(LICENSE|LICENCE|COPYING)(?:[.\-_].*)?$/i.test(name));
    if (pkg.license_file && !names.includes(pkg.license_file)) names.push(pkg.license_file);
    const texts = [];
    for (const name of names.sort()) {
        try { texts.push(`${name}\n${await readFile(join(directory, name), 'utf8')}`); }
        catch (error) { if (error.code !== 'EISDIR') throw error; }
    }
    if (!texts.length) throw new Error(`No license text for ${pkg.name} ${pkg.version}. Review before shipping.`);
    notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${pkg.license || 'See license text'}\n${pkg.repository || ''}\n\n${texts.join('\n\n')}`);
}
if ((await airwayInputs(root)).version !== source.version) throw new Error('Airway sources changed during compilation. Build again.');
const contents = new Map([[moduleFile, javascript], [wasmFile, wasm], ['LICENSES.txt', `${notices.join('\n')}\n`]]);
const files = [...contents].map(([name, data]) => ({ name, bytes: Buffer.byteLength(data), sha256: sha256(data) }));
const manifest = { schemaVersion: 1, upstreamCommit: AIRWAY_COMMIT, ...source, moduleFile, wasmFile,
    toolchain: { rustc: execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim() }, files };
await mkdir(assets, { recursive: true });
for (const [name, data] of contents) await writeFile(join(assets, name), data);
await writeFile(join(assets, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(assets, 'manifest.js'), airwayManifest(source.version, moduleFile));
await validateAirwayAssets({ root });
for (const name of await readdir(assets)) {
    if (/^airway-[a-f0-9]{64}\.(?:wasm|js)$/.test(name) && !contents.has(name)) await rm(join(assets, name));
}
console.log(`Built Airway: ${wasm.byteLength} WASM bytes, ${Buffer.byteLength(javascript)} embedded JS bytes. Source ${source.version.slice(0, 12)}.`);
