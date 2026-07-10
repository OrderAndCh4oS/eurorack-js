import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_ORDER, MODULE_MANIFEST, MODULE_ORDER } from '../../src/js/rack/module-manifest.js';
import { CORE_MODULE_DEFINITIONS } from '../../src/js/rack/core-definitions.js';
import { PluginRegistry } from '../../src/js/rack/registry.js';
import { SIGNAL_TYPES, getModulePorts } from '../../src/js/rack/module-contract.js';
import { getNestedValue } from '../../src/js/utils/nested-access.js';
import { cleanupRenderedModule, renderModule } from '../../src/js/ui/renderer.js';

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
        ...(ui.buttons || []),
        ...(ui.actions || [])
    ].map(control => control.param);
}

describe('module contracts', () => {
    beforeEach(() => {
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn(() => ({ width: 10 })),
            setLineDash: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
            putImageData: vi.fn(),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
        }));
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

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

    it('keeps the statically imported worklet bundle aligned with the core manifest', () => {
        expect(CORE_MODULE_DEFINITIONS.map(definition => definition.id)).toEqual(MODULE_ORDER);
    });

    it('loads modules whose self-contained metadata is valid', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ entry, definition }) => {
            expect(definition.id).toBe(entry.id);
            expect(CATEGORY_ORDER).toContain(definition.category);
            if (definition.render) {
                expect(definition.telemetry, `${definition.id} custom telemetry`).toEqual(expect.objectContaining({
                    fields: expect.any(Array),
                    methods: expect.any(Array)
                }));
            }
        });
    });

    it('rejects module categories outside the shared taxonomy', async () => {
        const registry = new PluginRegistry({ blockSize: 16 });
        await expect(registry.registerPlugin({
            id: 'bad-plugin',
            name: 'Bad Plugin',
            version: '1.0.0',
            apiVersion: 1,
            patchVersion: 1,
            workletUrl: 'test://bad-worklet.js',
            modules: [{ definition: {
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
            }}]
        })).rejects.toThrow('invalid category');
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
                expect(SIGNAL_TYPES, `${definition.id}.${input.port} has invalid input signal`).toContain(input.signal);
                expect(dsp.inputs, `${definition.id} missing inputs.${input.port}`).toHaveProperty(input.port);
            });

            (ui.outputs || []).forEach(output => {
                expect(SIGNAL_TYPES, `${definition.id}.${output.port} has invalid output signal`).toContain(output.signal);
                expect(dsp.outputs, `${definition.id} missing outputs.${output.port}`).toHaveProperty(output.port);
            });
        });
    });

    it('declares finite voltage contracts and stable block buffers', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ definition }) => {
            const dsp = definition.createDSP({ sampleRate: 44100, bufferSize: 16 });
            const inputRefs = new Map();
            const outputRefs = new Map();
            getModulePorts(definition, 'input').forEach(port => {
                const buffer = getNestedValue(dsp.inputs, port.port);
                inputRefs.set(port.port, buffer);
                expect(port.voltage.normal, `${definition.id}.${port.port} normal`).toBeTypeOf('number');
                expect(buffer.every(value => value === port.voltage.normal), `${definition.id}.${port.port} initial normal`).toBe(true);
            });
            getModulePorts(definition, 'output').forEach(port => outputRefs.set(port.port, getNestedValue(dsp.outputs, port.port)));

            dsp.process();

            inputRefs.forEach((buffer, port) => expect(getNestedValue(dsp.inputs, port), `${definition.id}.${port} input identity`).toBe(buffer));
            outputRefs.forEach((buffer, port) => {
                expect(getNestedValue(dsp.outputs, port), `${definition.id}.${port} output identity`).toBe(buffer);
                expect(buffer.every(Number.isFinite), `${definition.id}.${port} finite output`).toBe(true);
            });
        });
    });

    it('keeps rendered params and ports aligned with UI contracts', async () => {
        const entries = await loadManifestDefinitions();

        entries.forEach(({ definition }) => {
            const dsp = definition.createDSP({ sampleRate: 44100, bufferSize: 16 });
            const panel = renderModule(definition, `${definition.id}_contract`, {
                dsp,
                getModule: () => ({ instance: dsp, params: dsp.params }),
                onParamChange: vi.fn()
            });
            document.body.appendChild(panel);

            const ui = definition.ui || {};
            const declaredParams = new Set(getControlParams(ui));
            const registeredParams = new Set(panel.__eurorackParamControls?.keys?.() || []);
            const renderedParams = new Set([
                ...[...panel.querySelectorAll('[data-param]')].map(el => el.dataset.param).filter(Boolean),
                ...registeredParams
            ]);

            renderedParams.forEach(param => {
                expect(declaredParams.has(param), `${definition.id} renders undeclared param ${param}`).toBe(true);
            });

            declaredParams.forEach(param => {
                expect(renderedParams.has(param), `${definition.id} declares unrendered param ${param}`).toBe(true);
            });

            const inputPorts = new Set((ui.inputs || []).map(input => input.port));
            const outputPorts = new Set((ui.outputs || []).map(output => output.port));
            panel.querySelectorAll('.jack').forEach(jack => {
                const ports = jack.dataset.dir === 'output' ? outputPorts : inputPorts;
                expect(
                    ports.has(jack.dataset.port),
                    `${definition.id} renders undeclared ${jack.dataset.dir} port ${jack.dataset.port}`
                ).toBe(true);
            });

            cleanupRenderedModule(panel);
            panel.remove();
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
