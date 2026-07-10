import { beforeAll, describe, expect, it, vi } from 'vitest';
import customModulesPatch from '../../src/js/config/patches/test-custom-modules.js';

let Processor;

beforeAll(async () => {
    globalThis.sampleRate = 48000;
    globalThis.currentTime = 0;
    globalThis.AudioWorkletProcessor = class {
        constructor() {
            this.port = { postMessage: vi.fn(), onmessage: null };
        }
    };
    globalThis.registerProcessor = (_name, implementation) => {
        Processor = implementation;
    };
    await import('../../src/js/audio/worklet/processor.js');
});

describe('Eurorack AudioWorkletProcessor', () => {
    it('renders a core VCO through the stereo output sink', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [
                    { id: 'vco_1', type: 'vco', pluginId: 'core', params: { coarse: 0.3 }, order: 0, rackOrder: 0 },
                    { id: 'out_1', type: 'out', pluginId: 'core', params: { volume: 0.8 }, order: 1, rackOrder: 1 }
                ],
                cables: [
                    { fromModule: 'vco_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'L' },
                    { fromModule: 'vco_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'R' }
                ]
            }
        });
        const outputs = [[new Float32Array(128), new Float32Array(128)]];

        expect(processor.process([], outputs)).toBe(true);
        expect(outputs[0][0].some(sample => sample !== 0)).toBe(true);
        expect(outputs[0][0]).toEqual(outputs[0][1]);
    });

    it('restores declared normals when a cable is removed', () => {
        const processor = new Processor();
        const modules = [
            { id: 'lfo_1', type: 'lfo', pluginId: 'core', params: {}, order: 0, rackOrder: 0 },
            { id: 'vca_1', type: 'vca', pluginId: 'core', params: {}, order: 1, rackOrder: 1 }
        ];
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules,
                cables: [{ fromModule: 'lfo_1', fromPort: 'primary', toModule: 'vca_1', toPort: 'ch1CV' }]
            }
        });
        processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
        expect(processor.modules.vca_1.instance.inputs.ch1CV.every(value => value === 5)).toBe(false);

        processor.handleMessage({
            type: 'topology',
            topology: { revision: 2, plugins: { core: 1 }, modules, cables: [] }
        });

        expect(processor.modules.vca_1.instance.inputs.ch1CV.every(value => value === 5)).toBe(true);
    });

    it('transfers completed recorder data to the main thread as a module event', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [
                    { id: 'rec_1', type: 'rec', pluginId: 'core', params: {}, order: 0, rackOrder: 0 }
                ],
                cables: []
            }
        });
        const outputs = [[new Float32Array(128), new Float32Array(128)]];

        processor.handleMessage({ type: 'param', moduleId: 'rec_1', param: 'record', value: 1 });
        processor.process([], outputs);
        processor.handleMessage({ type: 'param', moduleId: 'rec_1', param: 'record', value: 0 });
        processor.process([], outputs);

        expect(processor.port.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'module-event',
                moduleId: 'rec_1',
                event: expect.objectContaining({ type: 'recording-complete', sampleRate: 48000 })
            }),
            expect.arrayContaining([expect.any(ArrayBuffer)])
        );
    });

    it('activates and processes the fully wired custom-modules diagnostic patch', () => {
        const processor = new Processor();
        const state = customModulesPatch.state;
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: state.plugins,
                modules: state.modules.map((module, order) => ({
                    ...module,
                    pluginId: 'core',
                    params: state.params[module.id] || {},
                    order,
                    rackOrder: order
                })),
                cables: state.cables
            }
        });

        expect(Object.keys(processor.modules)).toHaveLength(state.modules.length);
        expect(processor.port.postMessage).toHaveBeenCalledWith({ type: 'topology-active', revision: 1 });
        expect(processor.process([], [[new Float32Array(128), new Float32Array(128)]])).toBe(true);
        const diagnostics = processor.port.postMessage.mock.calls
            .map(([message]) => message)
            .filter(message => message.type === 'host-error' || message.type === 'module-error');
        expect(diagnostics).toEqual([]);
    });
});
