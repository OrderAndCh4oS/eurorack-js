import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EurorackApp,
    PATCH_EXPORT_SCHEMA,
    PATCH_EXPORT_VERSION,
    createPatchExport,
    parseImportedPatchJson
} from '../../src/js/app/app.js';
import { createPatchUrlHash, parsePatchUrlHash } from '../../src/js/app/patch-format.js';
import { PATCH_STORAGE_KEY } from '../../src/js/config/constants.js';
import { moduleRegistry, registerModule } from '../../src/js/rack/registry.js';

const testModule = {
    id: 'filetest',
    name: 'File Test',
    hp: 4,
    color: '#555555',
    category: 'utility',
    createDSP() {
        return {
            params: { level: 0.5 },
            inputs: {},
            outputs: {},
            leds: {},
            process() {},
            reset() {}
        };
    },
    ui: {
        knobs: [{ id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0.5 }]
    }
};

function setupDOM() {
    document.body.innerHTML = `
        <button id="startButton"></button>
        <button id="clearCables"></button>
        <button id="copyPatch"></button>
        <button id="sharePatch"></button>
        <button id="exportPatch"></button>
        <button id="importPatch"></button>
        <input id="patchFileInput" type="file">
        <select id="patchSelect"><option value="">-- Select --</option></select>
        <button id="loadPatch"></button>
        <button id="deletePatch"></button>
        <input id="patchName" type="text">
        <button id="savePatch"></button>
        <button id="midiLearnBtn"></button>
        <button id="midiControllerBtn"></button>
        <button id="midiDrumControllerBtn"></button>
        <div id="rack-container">
            <div class="rack rack-row" id="rack-row-1"></div>
            <div class="rack rack-row" id="rack-row-2"></div>
            <div class="cable-hints"></div>
        </div>
        <svg id="cable-svg"></svg>
    `;
}

function readBlobText(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

describe('patch file JSON import/export', () => {
    let alertSpy;

    beforeAll(() => {
        registerModule(testModule);
    });

    beforeEach(() => {
        setupDOM();
        localStorage.clear();
        window.history.replaceState(null, '', '/');
        alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        alertSpy.mockRestore();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('parses raw patch state from a JSON file as a named single patch', () => {
        const imported = parseImportedPatchJson(JSON.stringify({
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 3, index: 0 }],
            params: { filetest_1: { level: 0.75 } },
            cables: [],
            midiMappings: {}
        }), { suggestedName: 'Lead Patch.json' });

        expect(imported.type).toBe('single');
        expect(imported.names).toEqual(['Lead Patch']);
        expect(imported.patches['Lead Patch'].state.modules[0].row).toBe(3);
        expect(imported.patches['Lead Patch'].state.params.filetest_1.level).toBe(0.75);
    });

    it('parses versioned patch exports', () => {
        const imported = parseImportedPatchJson(JSON.stringify({
            schema: PATCH_EXPORT_SCHEMA,
            version: PATCH_EXPORT_VERSION,
            patchVersion: 2,
            exportedAt: '2026-07-02T00:00:00.000Z',
            patch: {
                name: 'Versioned Patch',
                factory: false,
                state: {
                    version: 2,
                    modules: [{ id: 'filetest_1', type: 'filetest', row: 3, index: 0 }],
                    params: { filetest_1: { level: 0.8 } },
                    cables: [],
                    midiMappings: {}
                }
            }
        }));

        expect(imported.type).toBe('single');
        expect(imported.names).toEqual(['Versioned Patch']);
        expect(imported.patches['Versioned Patch'].state.modules[0].row).toBe(3);
        expect(imported.patches['Versioned Patch'].state.params.filetest_1.level).toBe(0.8);
    });

    it('rejects newer patch export versions', () => {
        expect(() => parseImportedPatchJson(JSON.stringify({
            schema: PATCH_EXPORT_SCHEMA,
            version: PATCH_EXPORT_VERSION + 1,
            patch: {
                name: 'Future Patch',
                state: { version: 2, modules: [], params: {}, cables: [], midiMappings: {} }
            }
        }))).toThrow(`Unsupported patch export version: ${PATCH_EXPORT_VERSION + 1}`);
    });

    it('rejects patch collections with unsupported state shape', () => {
        expect(() => parseImportedPatchJson(JSON.stringify({
            Legacy: {
                name: 'Legacy',
                state: {
                    modules: [{ type: 'filetest', instanceId: 'filetest', row: 1 }],
                    knobs: { filetest: { level: 0.25 } },
                    cables: []
                }
            }
        }))).toThrow('Patch JSON must contain a patch or patch collection');
    });

    it('imports and loads a single patch JSON with dynamic rows into the rack', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();

        const result = await app.importPatchJson(JSON.stringify({
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 3, index: 0 }],
            params: { filetest_1: { level: 0.9 } },
            cables: [],
            midiMappings: {}
        }), { suggestedName: 'Imported.json' });

        const saved = JSON.parse(localStorage.getItem(PATCH_STORAGE_KEY));
        const sharedPatch = await parsePatchUrlHash(window.location.hash, { moduleRegistry });

        expect(result).toMatchObject({ importedCount: 1, loadedName: 'Imported', type: 'single' });
        expect(saved.Imported.state.params.filetest_1.level).toBe(0.9);
        expect(sharedPatch.name).toBe('Imported');
        expect(sharedPatch.state.params.filetest_1.level).toBe(0.9);
        expect(app.state.getModule('filetest_1').params.level).toBe(0.9);
        expect(app.state.getModule('filetest_1').row).toBe(3);
        expect(document.getElementById('rack-row-3')).not.toBeNull();
        expect(document.getElementById('module-filetest_1').parentNode.id).toBe('rack-row-3');
        expect(document.getElementById('patchSelect').value).toBe('');
    });

    it('saves and reloads dynamic rows through the patch dropdown loader', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addRow();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 3,
            params: { level: 0.7 }
        });
        app.initPatchBank();

        expect(await app.savePatch('Three Rows')).toBe(true);
        app.state.clear();
        app.rerenderRack();

        const select = document.getElementById('patchSelect');
        select.value = 'Three Rows';
        expect(await app.loadPatch('Three Rows')).toBe(true);

        expect(app.state.getRowNumbers()).toEqual([1, 2, 3]);
        expect(app.state.getModule('filetest_1').row).toBe(3);
        expect(app.state.getModule('filetest_1').params.level).toBe(0.7);
        expect(document.getElementById('rack-row-3')).not.toBeNull();
        expect(document.getElementById('module-filetest_1').parentNode.id).toBe('rack-row-3');
    });

    it('updates the URL hash when saving a patch', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 1,
            params: { level: 0.64 }
        });

        expect(await app.savePatch('Share Me')).toBe(true);

        const saved = JSON.parse(localStorage.getItem(PATCH_STORAGE_KEY));
        const sharedPatch = await parsePatchUrlHash(window.location.hash, { moduleRegistry });
        expect(saved['Share Me'].state).toMatchObject({
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
            params: { filetest_1: { level: 0.64 } },
            cables: [],
            midiMappings: {}
        });
        expect(saved['Share Me'].state.knobs).toBeUndefined();
        expect(window.location.hash).toMatch(/^#patch=/);
        expect(sharedPatch.name).toBe('Share Me');
        expect(sharedPatch.state.params.filetest_1.level).toBe(0.64);
    });

    it('updates the URL hash when loading a patch from the dropdown', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 1,
            params: { level: 0.31 }
        });
        await app.savePatch('Saved Patch');
        window.history.replaceState(null, '', '/');

        expect(await app.loadPatch('Saved Patch')).toBe(true);

        const sharedPatch = await parsePatchUrlHash(window.location.hash, { moduleRegistry });
        expect(sharedPatch.name).toBe('Saved Patch');
        expect(sharedPatch.state.params.filetest_1.level).toBe(0.31);
    });

    it('loads a shared patch URL hash into the rack', async () => {
        const sharedState = {
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 2, index: 0 }],
            params: { filetest_1: { level: 0.22 } },
            cables: [],
            midiMappings: {}
        };
        window.history.replaceState(null, '', `/#${await createPatchUrlHash(
            { name: 'URL Patch', state: sharedState },
            { moduleRegistry }
        )}`);

        const app = new EurorackApp(document);
        app.cacheElements();

        expect(await app.loadPatchFromUrlHash()).toBe(true);
        expect(app.state.getModule('filetest_1').row).toBe(2);
        expect(app.state.getModule('filetest_1').params.level).toBe(0.22);
        expect(document.getElementById('patchName').value).toBe('URL Patch');
        expect(document.getElementById('module-filetest_1').parentNode.id).toBe('rack-row-2');
    });

    it('copies a share URL with the current patch encoded in the hash', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 1,
            params: { level: 0.77 }
        });
        document.getElementById('patchName').value = 'Clipboard Patch';

        const writeText = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        expect(await app.sharePatchUrl()).toBe(true);

        const copiedUrl = writeText.mock.calls[0][0];
        const parsed = new URL(copiedUrl);
        const sharedPatch = await parsePatchUrlHash(parsed.hash, { moduleRegistry });
        expect(parsed.hash).toMatch(/^#patch=/);
        expect(window.location.hash).toBe(parsed.hash);
        expect(sharedPatch.name).toBe('Clipboard Patch');
        expect(sharedPatch.state.version).toBe(2);
        expect(sharedPatch.state.params.filetest_1.level).toBe(0.77);
        expect(sharedPatch.state.knobs).toBeUndefined();
    });

    it('copies the current patch as canonical v2 state JSON', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 1,
            params: { level: 0.66 }
        });

        const writeText = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        app.copyPatchToClipboard();
        await Promise.resolve();

        const copied = JSON.parse(writeText.mock.calls[0][0]);
        expect(copied).toMatchObject({
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
            params: { filetest_1: { level: 0.66 } },
            cables: [],
            midiMappings: {}
        });
        expect(copied.knobs).toBeUndefined();
        expect(copied.switches).toBeUndefined();
        expect(copied.buttons).toBeUndefined();
    });

    it('exports the current rack as a named JSON download', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addRow();
        app.state.addModule('filetest', moduleRegistry, {
            id: 'filetest_1',
            row: 3,
            params: { level: 0.6 }
        });
        document.getElementById('patchName').value = 'Bass Lead';

        const downloads = [];
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
            downloads.push(this.download);
        });
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:patch')
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn()
        });

        app.exportCurrentPatchToFile();

        const exportedBlob = URL.createObjectURL.mock.calls[0][0];
        const exported = JSON.parse(await readBlobText(exportedBlob));

        expect(downloads).toEqual(['bass-lead.json']);
        expect(exported.schema).toBe(PATCH_EXPORT_SCHEMA);
        expect(exported.version).toBe(PATCH_EXPORT_VERSION);
        expect(exported.patchVersion).toBe(2);
        expect(exported.patch.name).toBe('Bass Lead');
        expect(exported.patch.factory).toBe(false);
        expect(exported.patch.state.modules).toEqual([
            { id: 'filetest_1', type: 'filetest', row: 3, index: 0 }
        ]);
        expect(exported.patch.state.params.filetest_1.level).toBe(0.6);
        expect(exported.patch.state.knobs).toBeUndefined();
        expect(exported.patch.state.switches).toBeUndefined();
        expect(exported.patch.state.buttons).toBeUndefined();
        expect(clickSpy).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patch');
    });

    it('rejects unsupported patch records before export wrapping', () => {
        expect(() => createPatchExport({
            name: 'Legacy Export',
            factory: false,
            state: {
                modules: [{ type: 'filetest', instanceId: 'filetest', row: 1 }],
                knobs: { filetest: { level: 0.42 } },
                switches: {},
                buttons: {},
                cables: []
            }
        }, { exportedAt: '2026-07-09T00:00:00.000Z' })).toThrow('Unsupported patch state version: missing');
    });
});
