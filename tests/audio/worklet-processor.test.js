import { beforeAll, describe, expect, it, vi } from 'vitest';
import customModulesPatch from '../../src/js/config/patches/test-custom-modules.js';
import { FACTORY_PATCHES } from '../../src/js/config/factory-patches.js';

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

    it('shares sample-offset MIDI notes across every module consumer', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [
                    { id: 'mono', type: 'midi-cv', pluginId: 'core', params: {}, order: 0, rackOrder: 0 },
                    { id: 'poly', type: 'midi-4', pluginId: 'core', params: {}, order: 1, rackOrder: 1 }
                ],
                cables: []
            }
        });
        processor.handleMessage({ type: 'midi', data: [0x90, 72, 100], audioTime: 64 / 48000 });

        processor.process([], [[new Float32Array(128), new Float32Array(128)]]);

        expect(processor.modules.mono.instance.outputs.pitch[63]).toBe(0);
        expect(processor.modules.mono.instance.outputs.pitch[64]).toBe(1);
        expect(processor.modules.poly.instance.outputs.pitch1[63]).toBe(0);
        expect(processor.modules.poly.instance.outputs.pitch1[64]).toBe(1);
    });

    it('applies MIDI transport at its sample offset', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [{ id: 'clock', type: 'midi-clk', pluginId: 'core', params: {}, order: 0, rackOrder: 0 }],
                cables: []
            }
        });
        processor.handleMessage({ type: 'midi', data: [0xfa], audioTime: 32 / 48000 });

        processor.process([], [[new Float32Array(128), new Float32Array(128)]]);

        expect(processor.modules.clock.instance.outputs.run[31]).toBe(0);
        expect(processor.modules.clock.instance.outputs.run[32]).toBe(10);
        expect(processor.modules.clock.instance.outputs.reset[32]).toBe(10);
    });

    it('reports bounded opt-in block and module profiling percentiles', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [{ id: 'vco', type: 'vco', pluginId: 'core', params: {}, order: 0, rackOrder: 0 }],
                cables: []
            }
        });
        processor.handleMessage({ type: 'profiling', enabled: true, reset: true });
        for (let index = 0; index < 4; index++) {
            processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
        }
        processor.handleMessage({ type: 'profiling-report', requestId: 7 });

        expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'profiling-report',
            requestId: 7,
            report: expect.objectContaining({
                deadlineMs: expect.any(Number),
                blocks: expect.objectContaining({ samples: 4 }),
                modules: expect.objectContaining({
                    vco: expect.objectContaining({ samples: 4, p99: expect.any(Number) })
                })
            })
        }));
    });

    it('rejects undeclared parameter messages', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [{ id: 'vco_1', type: 'vco', pluginId: 'core', params: {}, order: 0, rackOrder: 0 }],
                cables: []
            }
        });

        processor.handleMessage({ type: 'param', moduleId: 'vco_1', param: 'missing', value: 0.5 });

        expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'host-error',
            message: expect.stringContaining('has no parameter')
        }));
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

    it('activates every synth voice demo and produces stereo audio', () => {
        const demos = Object.values(FACTORY_PATCHES)
            .filter(patch => patch.name.startsWith('Demo - Synth Voice'));

        demos.forEach((patch, revision) => {
            const processor = new Processor();
            const state = patch.state;
            processor.handleMessage({
                type: 'topology',
                topology: {
                    revision: revision + 1,
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

            let leftActive = false;
            let rightActive = false;
            let firstActiveBlock = -1;
            let peak = 0;
            const minimumBlocks = patch.name === 'Demo - Synth Voice 12 - Dynamic Generative' ? 300 : 0;
            for (let block = 0; block < 1000 && (block < minimumBlocks || !leftActive || !rightActive); block += 1) {
                const outputs = [[new Float32Array(128), new Float32Array(128)]];
                processor.process([], outputs);
                const leftPeak = Math.max(...outputs[0][0].map(Math.abs));
                const rightPeak = Math.max(...outputs[0][1].map(Math.abs));
                if (firstActiveBlock < 0 && Math.max(leftPeak, rightPeak) > 1e-6) firstActiveBlock = block;
                leftActive ||= leftPeak > 1e-6;
                rightActive ||= rightPeak > 1e-6;
                peak = Math.max(peak, leftPeak, rightPeak);
            }

            expect(leftActive, `${patch.name} left output stayed silent`).toBe(true);
            expect(rightActive, `${patch.name} right output stayed silent`).toBe(true);
            if (patch.name === 'Demo - Synth Voice 12 - Dynamic Generative') {
                expect(firstActiveBlock, 'generative voice starts too slowly').toBeLessThan(150);
                expect(peak, 'generative voice output is too quiet').toBeGreaterThan(0.1);
            }
            const diagnostics = processor.port.postMessage.mock.calls
                .map(([message]) => message)
                .filter(message => message.type === 'host-error' || message.type === 'module-error');
            expect(diagnostics, `${patch.name} emitted worklet diagnostics`).toEqual([]);
        });
    });

});
