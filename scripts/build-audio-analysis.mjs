import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { AUDIO_ANALYSIS_ROOT as root, AUDIO_ANALYSIS_ASSETS, audioAnalysisInputs, audioAnalysisModuleManifest, sha256, validateAudioAnalysisAssets } from './audio-analysis-assets.mjs';

const crate = join(root, 'wasm/audio-analysis');
const assets = join(root, AUDIO_ANALYSIS_ASSETS);
const cargo = (...args) => execFileSync('cargo', args, {cwd: crate, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']});
const bindingVersion = /name = "wasm-bindgen"\nversion = "([^"]+)"/.exec(await readFile(join(crate, 'Cargo.lock'), 'utf8'))?.[1];
if (!bindingVersion) throw new Error('The locked wasm-bindgen dependency is missing.');
const installedBindingVersion = execFileSync('wasm-bindgen', ['--version'], {encoding: 'utf8'}).trim();
if (installedBindingVersion !== `wasm-bindgen ${bindingVersion}`) throw new Error(`Install matching bindings: cargo install wasm-bindgen-cli --version ${bindingVersion} --locked`);
const source = await audioAnalysisInputs(root);

// Scalar WASM is the baseline: no browser SIMD or shared-memory requirement.
// --locked pins dependency resolution; generated assets are committed for Vercel.
cargo('build', '--release', '--locked', '--target', 'wasm32-unknown-unknown');
const metadata = JSON.parse(cargo('metadata', '--locked', '--offline', '--format-version', '1', '--filter-platform', 'wasm32-unknown-unknown'));
const temporary = await mkdtemp(join(tmpdir(), 'eurorack-audio-analysis-'));
try {
    execFileSync('wasm-bindgen', [join(metadata.target_directory, 'wasm32-unknown-unknown/release/eurorack_audio_analysis.wasm'), '--target', 'web', '--no-typescript', '--out-dir', temporary, '--out-name', 'audio_analysis'], {cwd: crate, stdio: 'inherit'});
    const wasm = await readFile(join(temporary, 'audio_analysis_bg.wasm'));
    if (!WebAssembly.Module.exports(new WebAssembly.Module(wasm)).some(item => item.name === 'analyze' && item.kind === 'function')) throw new Error('The Rust kernel does not export analyze.');
    const wasmFile = `audio-analysis-${sha256(wasm)}.wasm`;
    const javascript = (await readFile(join(temporary, 'audio_analysis.js'), 'utf8')).replaceAll('audio_analysis_bg.wasm', wasmFile);
    const moduleFile = `audio-analysis-${sha256(javascript)}.js`;
    const notices = ['Eurorack audio analysis — dependency license notices', 'Generated from the locked Cargo dependency graph. Build-only dependencies are included for completeness.'];
    for (const pkg of metadata.packages.filter(pkg => pkg.name !== 'eurorack-audio-analysis').sort((a, b) => a.name.localeCompare(b.name))) {
        const packageDirectory = dirname(pkg.manifest_path);
        const candidates = (await readdir(packageDirectory)).filter(name => /^(LICENSE|LICENCE|COPYING)(?:[.\-_].*)?$/i.test(name));
        if (pkg.license_file && !candidates.includes(pkg.license_file)) candidates.push(pkg.license_file);
        const texts = [];
        for (const name of candidates.sort()) {
            try { texts.push(`${name}\n${await readFile(join(packageDirectory, name), 'utf8')}`); }
            catch (error) { if (error.code !== 'EISDIR') throw error; }
        }
        if (!texts.length && ['dasp_frame', 'dasp_sample'].includes(pkg.name) && pkg.version === '0.11.0') {
            // These crates omit licenses from their tarballs. Both offer MIT OR
            // Apache-2.0; include MIT from their published .cargo_vcs_info commits.
            const commit = pkg.name === 'dasp_frame' ? '221b81038c528bf3fc364a8ab5cc4b2e52f7dbfc' : '97c3bb9b2363c0b46ac1633858bf1054fd02a980';
            texts.push(`MIT license source: https://github.com/RustAudio/dasp/blob/${commit}/LICENSE-MIT\n${await readFile(join(root, 'scripts/audio-analysis-licenses/dasp-0.11.0-MIT.txt'), 'utf8')}`);
        }
        if (!texts.length) throw new Error(`No license text found for ${pkg.name} ${pkg.version}; review its license before shipping.`);
        notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${pkg.license || 'See license text'}\n${pkg.repository || ''}\n\n${texts.join('\n\n')}`);
    }
    if ((await audioAnalysisInputs(root)).version !== source.version) throw new Error('Audio analysis sources changed during compilation. Run the build again.');
    const contents = new Map([[moduleFile, javascript], [wasmFile, wasm], ['LICENSES.txt', `${notices.join('\n')}\n`]]);
    const files = [...contents].map(([name, value]) => ({name, bytes: Buffer.byteLength(value), sha256: sha256(value)}));
    const manifest = {schemaVersion: 1, ...source, moduleFile, wasmFile,
        toolchain: {rustc: execFileSync('rustc', ['--version'], {encoding: 'utf8'}).trim(), wasmBindgen: bindingVersion}, files};
    await mkdir(assets, {recursive: true});
    for (const [name, content] of contents) await writeFile(join(assets, name), content);
    await writeFile(join(assets, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(assets, 'manifest.js'), audioAnalysisModuleManifest(source.version, moduleFile));
    await validateAudioAnalysisAssets({root});
    // Only retire content-addressed outputs generated by this script.
    for (const name of await readdir(assets)) {
        if (/^audio-analysis-[a-f0-9]{64}\.(?:js|wasm)$/.test(name) && !contents.has(name)) await rm(join(assets, name));
    }
    console.log(`Built audio analysis: ${wasm.byteLength} bytes WASM; ${Buffer.byteLength(javascript)} bytes JS. Source ${source.version.slice(0, 12)}.`);
} finally { await rm(temporary, {recursive: true, force: true}); }
