import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EurorackApp,
    PATCH_EXPORT_SCHEMA,
    PATCH_EXPORT_VERSION,
    parseImportedPatchJson
} from '../../src/js/app/app.js';
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
        <div id="rack-row-1"></div>
        <div id="rack-row-2"></div>
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
            modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
            params: { filetest_1: { level: 0.75 } },
            cables: [],
            midiMappings: {}
        }), { suggestedName: 'Lead Patch.json' });

        expect(imported.type).toBe('single');
        expect(imported.names).toEqual(['Lead Patch']);
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
                    modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
                    params: { filetest_1: { level: 0.8 } },
                    cables: [],
                    midiMappings: {}
                }
            }
        }));

        expect(imported.type).toBe('single');
        expect(imported.names).toEqual(['Versioned Patch']);
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

    it('parses a patch collection and normalizes legacy state', () => {
        const imported = parseImportedPatchJson(JSON.stringify({
            Legacy: {
                name: 'Legacy',
                state: {
                    modules: [{ type: 'filetest', instanceId: 'filetest', row: 1 }],
                    knobs: { filetest: { level: 0.25 } },
                    cables: []
                }
            }
        }));

        expect(imported.type).toBe('collection');
        expect(imported.patches.Legacy.factory).toBe(false);
        expect(imported.patches.Legacy.state).toMatchObject({
            version: 2,
            modules: [{ id: 'filetest', type: 'filetest', row: 1, index: 0 }],
            params: { filetest: { level: 0.25 } }
        });
    });

    it('imports and loads a single patch JSON into the rack', () => {
        const app = new EurorackApp(document);
        app.cacheElements();

        const result = app.importPatchJson(JSON.stringify({
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
            params: { filetest_1: { level: 0.9 } },
            cables: [],
            midiMappings: {}
        }), { suggestedName: 'Imported.json' });

        const saved = JSON.parse(localStorage.getItem(PATCH_STORAGE_KEY));
        expect(result).toMatchObject({ importedCount: 1, loadedName: 'Imported', type: 'single' });
        expect(saved.Imported.state.params.filetest_1.level).toBe(0.9);
        expect(app.state.getModule('filetest_1').params.level).toBe(0.9);
        expect(document.getElementById('patchSelect').value).toBe('');
    });

    it('exports the current rack as a named JSON download', async () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.state.addModule('filetest', moduleRegistry, { id: 'filetest_1', params: { level: 0.6 } });
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
        expect(exported.patch.state.params.filetest_1.level).toBe(0.6);
        expect(clickSpy).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patch');
    });
});
