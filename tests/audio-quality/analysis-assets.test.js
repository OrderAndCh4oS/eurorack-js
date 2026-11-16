// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audioAnalysisInputs, audioAnalysisModuleManifest, sha256, validateAudioAnalysisAssets } from '../../scripts/audio-analysis-assets.mjs';

describe('audio analysis build artifacts', () => {
    let root;
    let assets;
    let manifest;
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'eurorack-analysis-assets-test-'));
        assets = join(root, 'src/wasm/audio-analysis');
        for (const directory of ['scripts/audio-analysis-licenses', 'wasm/audio-analysis/src', 'src/wasm/audio-analysis']) await mkdir(join(root, directory), {recursive: true});
        for (const [file, content] of [
            ['scripts/audio-analysis-assets.mjs', '// asset validation'],
            ['scripts/build-audio-analysis.mjs', '// compilation'],
            ['scripts/audio-analysis-licenses/dasp-0.11.0-MIT.txt', 'Fixture license'],
            ['wasm/audio-analysis/Cargo.toml', '[package]\nname = "fixture"\n'],
            ['wasm/audio-analysis/Cargo.lock', 'version = 4\n'],
            ['wasm/audio-analysis/src/lib.rs', 'pub fn analyze() {}\n']
        ]) await writeFile(join(root, file), content);
        const source = await audioAnalysisInputs(root);
        // Valid minimal module exporting an empty analyze() function.
        const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0,
            1, 4, 1, 96, 0, 0, 3, 2, 1, 0,
            7, 11, 1, 7, 97, 110, 97, 108, 121, 122, 101, 0, 0,
            10, 4, 1, 2, 0, 11]);
        const wasmFile = `audio-analysis-${sha256(wasm)}.wasm`;
        const js = `export const wasm = new URL('./${wasmFile}', import.meta.url);\n`;
        const moduleFile = `audio-analysis-${sha256(js)}.js`;
        const contents = new Map([[wasmFile, wasm], [moduleFile, js], ['LICENSES.txt', 'Fixture license']]);
        manifest = {schemaVersion: 1, ...source, moduleFile, wasmFile,
            files: [...contents].map(([name, bytes]) => ({name, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes)}))};
        for (const [name, bytes] of contents) await writeFile(join(assets, name), bytes);
        await writeFile(join(assets, 'manifest.js'), audioAnalysisModuleManifest(source.version, moduleFile));
        await writeFile(join(assets, 'artifact-manifest.json'), JSON.stringify(manifest));
    });
    afterEach(async () => { if (root) await rm(root, {recursive: true, force: true}); });

    it('verifies matching source and content-addressed outputs without invoking a Rust toolchain', async () => {
        expect(await validateAudioAnalysisAssets({root})).toEqual(manifest);
    });

    it('rejects stale Rust code even if the output file checksums still match', async () => {
        await writeFile(join(root, 'wasm/audio-analysis/src/lib.rs'), 'pub fn analyze() { panic!() }');
        await expect(validateAudioAnalysisAssets({root})).rejects.toThrow('Stale audio analysis assets');
    });

    it('rejects a changed dependency lock file', async () => {
        await writeFile(join(root, 'wasm/audio-analysis/Cargo.lock'), 'version = 4\n# changed dependency');
        await expect(validateAudioAnalysisAssets({root})).rejects.toThrow('Stale audio analysis assets');
    });

    it('rejects corrupted WASM bytes', async () => {
        await writeFile(join(assets, manifest.wasmFile), 'not the committed wasm');
        await expect(validateAudioAnalysisAssets({root})).rejects.toThrow('checksum mismatch');
    });

    it('rejects a loader that points at a different module', async () => {
        await writeFile(join(assets, 'manifest.js'), 'export const AUDIO_ANALYSIS = {moduleUrl: "https://example.test/code.js"};');
        await expect(validateAudioAnalysisAssets({root})).rejects.toThrow('loader manifest mismatch');
    });

    it('rejects arbitrary artifact paths', async () => {
        manifest.moduleFile = '../module.js';
        manifest.files[1].name = '../module.js';
        await writeFile(join(assets, 'artifact-manifest.json'), JSON.stringify(manifest));
        await expect(validateAudioAnalysisAssets({root})).rejects.toThrow('artifact names');
    });

    it('does not require native build output or test sources in Vercel build inputs', async () => {
        await mkdir(join(root, 'wasm/audio-analysis/target'), {recursive: true});
        await mkdir(join(root, 'wasm/audio-analysis/tests'), {recursive: true});
        await writeFile(join(root, 'wasm/audio-analysis/target/generated.rs'), 'not runtime source');
        await writeFile(join(root, 'wasm/audio-analysis/tests/fixtures.rs'), 'not runtime source');
        expect(await validateAudioAnalysisAssets({root})).toEqual(manifest);
    });
});
