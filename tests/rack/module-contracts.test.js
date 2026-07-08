import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, MODULE_MANIFEST, MODULE_ORDER } from '../../src/js/rack/module-manifest.js';
import { registerModule } from '../../src/js/rack/registry.js';

const PORT_TYPES = ['audio', 'cv', 'gate', 'trigger', 'buffer'];

async function loadManifestDefinitions() {
    const entries = await Promise.all(MODULE_MANIFEST.map(async entry => ({
        entry,
        definition: (await entry.load()).default
    })));

    return entries;
}

function getControlParams(ui = {}) {
    return [
        ...(ui.knobs || []),
        ...(ui.switches || []),
        ...(ui.buttons || [])
    ].map(control => control.param);
}

describe('module contracts', () => {
    it('keeps the manifest as unique import/order metadata', () => {
        const ids = MODULE_MANIFEST.map(entry => entry.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(MODULE_ORDER).toEqual(ids);
        MODULE_MANIFEST.forEach(entry => {
            expect(entry).toEqual({
                id: expect.any(String),
                load: expect.any(Function)
            });
        });
    });

    it('loads modules whose self-contained metadata is valid', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ entry, definition }) => {
            expect(definition.id).toBe(entry.id);
            expect(CATEGORY_ORDER).toContain(definition.category);
        });
    });

    it('rejects module categories outside the shared taxonomy', () => {
        expect(() => registerModule({
            id: 'bad-category',
            name: 'Bad Category',
            hp: 2,
            color: 'module-color-one',
            category: 'modulator',
            createDSP: () => ({
                params: {},
                inputs: {},
                outputs: {},
                process() {}
            }),
            ui: {}
        })).toThrow('invalid category');
    });

    it('keeps UI params and ports aligned with DSP instances', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ definition }) => {
            const dsp = definition.createDSP({ sampleRate: 44100, bufferSize: 16 });
            const ui = definition.ui || {};

            getControlParams(ui).forEach(param => {
                expect(dsp.params, `${definition.id} missing params.${param}`).toHaveProperty(param);
            });

            (ui.inputs || []).forEach(input => {
                expect(PORT_TYPES, `${definition.id}.${input.port} has invalid input type`).toContain(input.type);
                expect(dsp.inputs, `${definition.id} missing inputs.${input.port}`).toHaveProperty(input.port);
            });

            (ui.outputs || []).forEach(output => {
                expect(PORT_TYPES, `${definition.id}.${output.port} has invalid output type`).toContain(output.type);
                expect(dsp.outputs, `${definition.id} missing outputs.${output.port}`).toHaveProperty(output.port);
            });
        });
    });

    it('uses unique UI port names per direction', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ definition }) => {
            const inputPorts = (definition.ui?.inputs || []).map(input => input.port);
            const outputPorts = (definition.ui?.outputs || []).map(output => output.port);

            expect(new Set(inputPorts).size, `${definition.id} has duplicate input ports`).toBe(inputPorts.length);
            expect(new Set(outputPorts).size, `${definition.id} has duplicate output ports`).toBe(outputPorts.length);
        });
    });
});
