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
    function outputCaptureFixture() {
        const processor = new Processor();
        processor.handleMessage({type: 'topology', topology: {revision: 1, plugins: {core: 1}, modules: [
            {id: 'first', type: 'out', pluginId: 'core', params: {volume: 0.5}, order: 0, rackOrder: 0},
            {id: 'second', type: 'out', pluginId: 'core', params: {volume: 1}, order: 1, rackOrder: 1}
        ], cables: []}});
        processor.graph.route = vi.fn();
        return processor;
    }

    function beginCapture(processor, frames = 257, overrides = {}) {
        const message = {type: 'capture-output', requestId: 21, frames, revision: 1,
            left: new Float32Array(frames), right: new Float32Array(frames), ...overrides};
        processor.handleMessage(message);
        return message;
    }

    it('delivers both edges of rapid Record presses in consecutive audio blocks', () => {
        const processor = new Processor();
        processor.handleMessage({ type: 'topology', topology: {
            revision: 1, plugins: { core: 1 }, cables: [],
            modules: [{ id: 'rec', type: 'cv-rec', pluginId: 'core', params: { mode: 1 }, order: 0, rackOrder: 0 }]
        } });
        const dsp = processor.modules.rec.instance;
        const output = [[new Float32Array(128), new Float32Array(128)]];
        const record = value => processor.handleMessage({ type: 'param', moduleId: 'rec', param: 'record', value });
        // Both presses and releases arrive before the next render quantum.
        // Repeated high MIDI values are one press.
        for (const value of [1, 1, 0, 1, 0]) record(value);
        const states = [];
        for (let block = 0; block < 5; block++) {
            processor.process([], output);
            states.push(dsp.transportState);
        }
        expect(states).toEqual([1, 1, 0, 0, 0]); // arm, hold, cancel, released
        expect(dsp.params.record).toBe(0);
    });

    it('captures contiguous final stereo frames after summing OUT volume and limiting, without changing playback', () => {
        const processor = outputCaptureFixture();
        const reference = outputCaptureFixture();
        const capture = beginCapture(processor);
        const renderedLeft = []; const renderedRight = [];
        const outputs = [[new Float32Array(128), new Float32Array(128)]];
        const referenceOutputs = [[new Float32Array(128), new Float32Array(128)]];
        for (let block = 0; block < 3; block++) {
            for (const target of [processor, reference]) {
                target.modules.first.instance.inputs.L.fill(block === 0 ? 5 : -5);
                target.modules.first.instance.inputs.R.fill(2.5);
                target.modules.second.instance.inputs.L.fill(block === 0 ? 5 : -5);
                target.modules.second.instance.inputs.R.fill(block / 2);
            }
            processor.process([], outputs);
            reference.process([], referenceOutputs);
            expect(outputs).toEqual(referenceOutputs);
            renderedLeft.push(...outputs[0][0]); renderedRight.push(...outputs[0][1]);
            if (block < 2) expect(processor.port.postMessage.mock.calls.some(([message]) => message.type === 'output-capture')).toBe(false);
        }
        const replies = processor.port.postMessage.mock.calls.filter(([message]) => message.type === 'output-capture');
        expect(replies).toHaveLength(1);
        const [reply, transfer] = replies[0];
        expect(reply).toMatchObject({requestId: 21, frames: 257, revision: 1, sampleRate: 48000, startTimeSeconds: 0});
        expect([...reply.left]).toEqual(renderedLeft.slice(0, 257));
        expect([...reply.right]).toEqual(renderedRight.slice(0, 257));
        expect(reply.left[127]).toBe(1);
        expect(reply.left[128]).toBe(-1);
        expect(reply.right[0]).toBe(0.25);
        expect(reply.right[256]).toBeCloseTo(0.45);
        expect(transfer).toEqual([capture.left.buffer, capture.right.buffer]);
        expect(transfer).not.toContain(outputs[0][0].buffer);
        expect(transfer).not.toContain(outputs[0][1].buffer);
        expect(processor.outputCapture).toBeNull();
        processor.process([], outputs);
        expect([...reply.left]).toEqual(renderedLeft.slice(0, 257));
    });

    it('rejects overlapping requests, supports matching cancellation, and ignores stale cancellation', () => {
        const processor = outputCaptureFixture();
        beginCapture(processor, 256);
        beginCapture(processor, 128, {requestId: 22});
        expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'output-capture-error', requestId: 22, code: 'busy'}));
        processor.handleMessage({type: 'cancel-output-capture', requestId: 22});
        expect(processor.outputCapture).not.toBeNull();
        processor.handleMessage({type: 'cancel-output-capture', requestId: 21});
        expect(processor.outputCapture).toBeNull();
        processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
        expect(processor.port.postMessage.mock.calls.some(([message]) => message.type === 'output-capture')).toBe(false);
    });

    it('cancels an active capture when topology is replaced and rejects stale revisions', () => {
        const processor = outputCaptureFixture();
        beginCapture(processor, 256);
        processor.handleMessage({type: 'topology', topology: {revision: 2, plugins: {}, modules: [], cables: []}});
        expect(processor.outputCapture).toBeNull();
        expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'output-capture-error', requestId: 21, code: 'rack-changed'}));
        beginCapture(processor, 128, {requestId: 23});
        expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'output-capture-error', requestId: 23, code: 'rack-changed'}));
    });

    it('rejects malformed buffers and enforces the frame cap inside the worklet', () => {
        const processor = outputCaptureFixture();
        const shared = new Float32Array(128);
        const cases = [
            {frames: 0}, {frames: 480001}, {frames: 1.5}, {frames: Infinity},
            {left: new Float32Array(127)}, {left: new Float64Array(128)},
            {left: shared, right: shared},
            {left: new Float32Array(new ArrayBuffer(1024), 0, 128)}
        ];
        for (const overrides of cases) {
            beginCapture(processor, 128, overrides);
            expect(processor.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type: 'output-capture-error', requestId: 21, code: 'invalid-input'}));
            expect(processor.outputCapture).toBeNull();
        }
    });

    it.each([8000, 44100, 48000, 96000, 192000])('reports the actual sample rate and start time at %s Hz', rate => {
        const previousRate = globalThis.sampleRate;
        const previousTime = globalThis.currentTime;
        globalThis.sampleRate = rate;
        globalThis.currentTime = 4.25;
        try {
            const processor = outputCaptureFixture();
            beginCapture(processor, 1);
            processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
            expect(processor.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'output-capture',
                sampleRate: rate, frames: 1, startTimeSeconds: 4.25}), expect.any(Array));
        } finally {
            globalThis.sampleRate = previousRate;
            globalThis.currentTime = previousTime;
        }
    });

    it('does not interrupt playback if transferring the completed capture fails', () => {
        const processor = outputCaptureFixture();
        beginCapture(processor, 1);
        processor.port.postMessage.mockImplementation(message => {
            if (message.type === 'output-capture') throw new Error('Message port closed');
        });
        const outputs = [[new Float32Array(128), new Float32Array(128)]];
        processor.modules.first.instance.inputs.L.fill(5);
        expect(processor.process([], outputs)).toBe(true);
        expect(outputs[0][0].every(sample => sample === 0.5)).toBe(true);
        expect(processor.outputCapture).toBeNull();
    });

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

    it('bounds output volume and contains non-finite sink samples', () => {
        const processor = new Processor();
        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 1,
                plugins: { core: 1 },
                modules: [
                    { id: 'out_1', type: 'out', pluginId: 'core', params: { volume: 1 }, order: 0, rackOrder: 0 }
                ],
                cables: []
            }
        });
        const sink = processor.modules.out_1.instance;
        sink.params.volume = Infinity;
        sink.inputs.L.set([5, NaN, -5]);
        sink.inputs.R.set([Infinity, 2.5, -2.5]);
        processor.graph.route = vi.fn();
        const outputs = [[new Float32Array(128), new Float32Array(128)]];

        processor.process([], outputs);

        expect(outputs[0][0].every(Number.isFinite)).toBe(true);
        expect(outputs[0][1].every(Number.isFinite)).toBe(true);
        expect(Math.max(...outputs[0][0].map(Math.abs))).toBeLessThanOrEqual(1);
        expect(Math.max(...outputs[0][1].map(Math.abs))).toBeLessThanOrEqual(1);
        expect(sink.leds.L).toBe(1);
        expect(sink.leds.R).toBe(0.5);
    });

    it('rewires Octo trunks atomically and switches normals only when the local lead changes', () => {
        const processor = new Processor();
        const modules = [
            ['dc', 'atten', { offset1: 1, offset2: 0 }], ['A', 'octo-send'], ['B', 'octo-send'],
            ['far', 'octo-receive'], ['target', 'mult'], ['vca', 'vca']
        ].map(([id, type, params = {}], order) => ({ id, type, params, order, rackOrder: order, pluginId: 'core' }));
        const wire = (fromModule, fromPort, toModule, toPort) => ({ fromModule, fromPort, toModule, toPort });
        const inputs = [
            wire('dc', 'out1', 'target', 'in1'), wire('dc', 'out1', 'A', 'in8'), wire('dc', 'out2', 'B', 'in8')
        ];
        const local = [wire('far', 'out8', 'target', 'in2'), wire('far', 'out8', 'vca', 'ch1CV')];
        const trunk = send => wire(send, 'link', 'far', 'link');
        const topology = (revision, cables, replace = false) => processor.handleMessage({
            type: 'topology', replace, topology: { revision, plugins: { core: 1 }, modules, cables }
        });
        const outputs = [[new Float32Array(128), new Float32Array(128)]];
        function render(voltage, cv = voltage) {
            processor.process([], outputs);
            expect(new Set(processor.modules.target.instance.outputs.out2a)).toEqual(new Set([voltage]));
            expect(new Set(processor.modules.vca.instance.inputs.ch1CV)).toEqual(new Set([cv]));
        }
        topology(1, inputs);
        const target = processor.modules.target.instance;
        const connected = vi.spyOn(target, 'onInputConnected');
        const disconnected = vi.spyOn(target, 'onInputDisconnected');
        const lane = processor.modules.far.instance.outputs.out8;
        const targetBuffer = target.inputs.in2;
        render(5);
        topology(2, [...inputs, ...local]);
        render(0);
        topology(3, [...inputs, ...local, trunk('A')]);
        render(5);
        topology(4, [...inputs, ...local, trunk('B')]);
        render(-5);
        const active = processor.graph;
        topology(5, [...inputs, ...local, wire('dc', 'out2', 'far', 'link')]);
        expect(processor.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'host-error', revision: 5 }));
        expect(processor.graph).toBe(active);
        expect(processor.lastTopology.revision).toBe(4);
        render(-5);
        topology(6, [...inputs, ...local]);
        render(0);
        expect(lane).toBe(processor.modules.far.instance.outputs.out8);
        expect(target.inputs.in2).toBe(targetBuffer);
        expect(connected.mock.calls).toEqual([['in2']]);
        expect(disconnected).not.toHaveBeenCalled();
        topology(7, inputs);
        render(5);
        expect(disconnected.mock.calls).toEqual([['in2']]);
        // Opening a saved patch creates new DSP instances already physically occupied.
        topology(8, [...inputs, ...local], true);
        expect(processor.modules.target.instance).not.toBe(target);
        render(0);
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

    it('notifies modules when an input cable is connected or disconnected', () => {
        const processor = new Processor();
        const modules = [
            { id: 'vco_1', type: 'vco', pluginId: 'core', params: {}, order: 0, rackOrder: 0 },
            { id: 'verb_1', type: 'verb', pluginId: 'core', params: {}, order: 1, rackOrder: 1 }
        ];
        processor.handleMessage({
            type: 'topology',
            topology: { revision: 1, plugins: { core: 1 }, modules, cables: [] }
        });
        const verb = processor.modules.verb_1.instance;
        const connected = vi.spyOn(verb, 'onInputConnected');
        const disconnected = vi.spyOn(verb, 'onInputDisconnected');

        processor.handleMessage({
            type: 'topology',
            topology: {
                revision: 2,
                plugins: { core: 1 },
                modules,
                cables: [
                    { fromModule: 'vco_1', fromPort: 'triangle', toModule: 'verb_1', toPort: 'audioR' }
                ]
            }
        });
        expect(connected).toHaveBeenCalledWith('audioR');

        processor.handleMessage({
            type: 'topology',
            topology: { revision: 3, plugins: { core: 1 }, modules, cables: [] }
        });
        expect(disconnected).toHaveBeenCalledWith('audioR');
    });

    it.each([
        // Module, normal source, switched jack, output, response to 5 V and 0 V.
        ['logic', 'andA', 'orA', 'or', 5, 0],
        ['logic', 'andB', 'orB', 'or', 5, 0],
        ['mult', 'in1', 'in2', 'out2a', 5, 0],
        ['cmp2', 'in1', 'in2', 'out2', 0, 10],
        ['cmp2', 'shiftCV1', 'shiftCV2', 'out2', 0, 10],
        ['cmp2', 'sizeCV1', 'sizeCV2', 'out2', 10, 0, { size2: 0 }]
    ])('%s switches from its %s normal to a cable on %s', (type, normal, jack, output, outputAt5V, outputAt0V, params = {}) => {
        const processor = new Processor();
        const modules = [
            { id: 'dc', type: 'atten', pluginId: 'core', params: { offset1: 1, offset2: 0.5 }, order: 0, rackOrder: 0 },
            { id: 'target', type, pluginId: 'core', params, order: 1, rackOrder: 1 }
        ];
        const cable = (fromPort, toPort) => ({ fromModule: 'dc', fromPort, toModule: 'target', toPort });
        const normalHigh = cable('out1', normal);
        const patchedZero = cable('out2', jack);
        const outputs = [[new Float32Array(128), new Float32Array(128)]];
        function checkBlock(revision, cables, expectedVoltage) {
            processor.handleMessage({ type: 'topology', topology: { revision, plugins: { core: 1 }, modules, cables } });
            expect(processor.port.postMessage).toHaveBeenCalledWith({ type: 'topology-active', revision });
            processor.process([], outputs);
            expect(new Set(processor.modules.target.instance.outputs[output])).toEqual(new Set([expectedVoltage]));
        }

        checkBlock(1, [cable('out1', jack)], outputAt5V);
        checkBlock(2, [normalHigh, patchedZero], outputAt0V);
        checkBlock(3, [normalHigh], outputAt5V);
        checkBlock(4, [normalHigh, patchedZero], outputAt0V);
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

    it('captures and restores both routed CV Recorder lanes inside the worklet', () => {
        const modules = [
            { id: 'joystick', type: 'joystick', pluginId: 'core', params: { x: -0.4, y: 0.6 }, order: 0, rackOrder: 0 },
            { id: 'clock1', type: 'clk', pluginId: 'core', params: { rate: 1 }, order: 1, rackOrder: 1 },
            { id: 'clock2', type: 'clk', pluginId: 'core', params: { rate: 0.6 }, order: 2, rackOrder: 2 },
            { id: 'recorder', type: 'cv-rec', pluginId: 'core', params: {}, order: 3, rackOrder: 3 }
        ];
        const cables = [
            { fromModule: 'joystick', fromPort: 'x', toModule: 'recorder', toPort: 'cv1In' },
            { fromModule: 'joystick', fromPort: 'y', toModule: 'recorder', toPort: 'cv2In' },
            { fromModule: 'clock1', fromPort: 'clock', toModule: 'recorder', toPort: 'gate1In' },
            { fromModule: 'clock2', fromPort: 'clock', toModule: 'recorder', toPort: 'gate2In' }
        ];
        const first = new Processor();
        first.handleMessage({
            type: 'topology',
            topology: { revision: 1, plugins: { core: 1 }, modules, cables }
        });
        const outputs = [[new Float32Array(128), new Float32Array(128)]];

        first.handleMessage({ type: 'param', moduleId: 'recorder', param: 'record', value: 1 });
        for (let block = 0; block < 20; block++) first.process([], outputs);
        first.handleMessage({ type: 'param', moduleId: 'recorder', param: 'record', value: 0 });
        first.process([], outputs);
        first.handleMessage({ type: 'param', moduleId: 'recorder', param: 'record', value: 1 });
        first.process([], outputs);
        first.handleMessage({ type: 'capture-runtime', requestId: 19 });

        const runtimeMessage = first.port.postMessage.mock.calls
            .map(([message]) => message)
            .find(message => message.type === 'runtime-state' && message.requestId === 19);
        const state = runtimeMessage.states.recorder;
        expect(state.recordedLength).toBeGreaterThan(2);
        expect(state.cv1.some(value => value < 0)).toBe(true);
        expect(state.cv1.every(value => value <= 0)).toBe(true);
        expect(state.cv2.some(value => value > 0)).toBe(true);
        expect(state.cv2.every(value => value >= 0)).toBe(true);
        expect(state.gate1).not.toEqual(state.gate2);
        expect(state.gate1.some(value => value === 1)).toBe(true);
        expect(state.gate2.some(value => value === 1)).toBe(true);

        const restored = new Processor();
        const restoredModules = modules.map(module => module.id === 'recorder'
            ? { ...module, params: { record: 0 }, runtimeState: state }
            : module);
        restored.handleMessage({
            type: 'topology',
            replace: true,
            topology: { revision: 2, plugins: { core: 1 }, modules: restoredModules, cables }
        });
        restored.process([], outputs);
        const restoredRecorder = restored.modules.recorder.instance;

        expect(restoredRecorder.getTransportInfo()).toMatchObject({
            memoryMode: state.recordedMode,
            memoryLength: state.recordedLength
        });
        expect(restoredRecorder.outputs.cv1Out.some(value => value !== 0)).toBe(true);
        expect(restoredRecorder.outputs.cv2Out.some(value => value !== 0)).toBe(true);
        expect(restoredRecorder.outputs.cv1Out.every(value => value <= 0)).toBe(true);
        expect(restoredRecorder.outputs.cv2Out.every(value => value >= 0)).toBe(true);
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

    it('rejects invalid settings on retained modules before updating any active parameters', () => {
        const processor = outputCaptureFixture();
        const old = processor.lastTopology;
        const updated = old.modules.map((spec, i) => ({ ...spec, params: { volume: i ? 2 : 0.125 } }));
        expect(() => processor.activateTopology({ ...old, revision: 2, modules: updated })).toThrow(/control settings/);
        expect(processor.lastTopology).toBe(old);
        expect(processor.modules.first.instance.params.volume).toBe(0.5);
        expect(processor.modules.second.instance.params.volume).toBe(1);
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
