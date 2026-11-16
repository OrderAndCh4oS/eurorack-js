import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioWorkletEngine } from '../../src/js/audio/worklet-engine.js';

class MockAudioWorkletNode {
    constructor() {
        this.port = { postMessage: vi.fn(), onmessage: null };
        this.connect = vi.fn();
        this.disconnect = vi.fn();
    }
}

afterEach(() => {
    delete globalThis.AudioWorkletNode;
    vi.useRealTimers();
});

describe('AudioWorkletEngine output capture', () => {
    function runningEngine(options = {}) {
        const audioCtx = Object.assign(new EventTarget(), {sampleRate: 48000, state: 'running'});
        const engine = new AudioWorkletEngine({audioCtx, requestTimeoutMs: 25, ...options});
        engine.node = new MockAudioWorkletNode();
        engine.revision = 3;
        engine.activeRevision = 3;
        engine.start();
        return engine;
    }

    function request(engine) {
        return engine.node.port.postMessage.mock.calls.find(([message]) => message.type === 'capture-output');
    }

    it('transfers owned stereo buffers and resolves only the matching complete revision', async () => {
        const engine = runningEngine();
        const pending = engine.captureOutput({durationSeconds: 257 / 48000});
        const [message, transfer] = request(engine);
        expect(message).toMatchObject({frames: 257, revision: 3});
        expect(message.left).toBeInstanceOf(Float32Array);
        expect(message.right).toHaveLength(257);
        expect(transfer).toEqual([message.left.buffer, message.right.buffer]);
        expect(transfer[0]).not.toBe(transfer[1]);
        const settled = vi.fn();
        pending.then(settled);
        engine.handleMessage({type: 'output-capture', requestId: message.requestId + 1});
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();
        message.left[256] = 0.25;
        const result = {left: message.left, right: message.right, sampleRate: 48000, frames: 257, revision: 3, startTimeSeconds: 12.5};
        engine.handleMessage({type: 'output-capture', requestId: message.requestId, ...result});
        await expect(pending).resolves.toEqual(result);
        expect(engine.pendingOutputCapture).toBeNull();
    });

    it.each([0, -1, NaN, Infinity, 10.001, '2', null])('rejects invalid duration %s without allocating or posting', async durationSeconds => {
        const engine = runningEngine();
        await expect(engine.captureOutput({durationSeconds})).rejects.toMatchObject({code: 'invalid-input'});
        expect(engine.node.port.postMessage).not.toHaveBeenCalled();
    });

    it.each([0, 192001, Infinity, NaN])('rejects unsupported sample rate %s', async sampleRate => {
        const engine = runningEngine();
        engine.audioCtx.sampleRate = sampleRate;
        await expect(engine.captureOutput({durationSeconds: 1})).rejects.toMatchObject({code: 'invalid-input'});
    });

    it('requires running audio and an acknowledged topology', async () => {
        await expect(new AudioWorkletEngine().captureOutput()).rejects.toMatchObject({code: 'audio-not-running'});
        const engine = runningEngine();
        engine.audioCtx.state = 'suspended';
        await expect(engine.captureOutput()).rejects.toMatchObject({code: 'audio-not-running'});
        engine.audioCtx.state = 'running';
        engine.running = false;
        await expect(engine.captureOutput()).rejects.toMatchObject({code: 'audio-not-running'});
        engine.running = true;
        engine.activeRevision = 2;
        await expect(engine.captureOutput()).rejects.toMatchObject({code: 'rack-changed'});
    });

    it('rejects overlapping captures, cancels on abort, and ignores a late reply', async () => {
        const engine = runningEngine();
        const controller = new AbortController();
        const pending = engine.captureOutput({durationSeconds: 1, signal: controller.signal});
        const rejected = pending.catch(error => error);
        const [first] = request(engine);
        await expect(engine.captureOutput({durationSeconds: 1})).rejects.toMatchObject({code: 'busy'});
        controller.abort();
        expect(await rejected).toMatchObject({name: 'AbortError'});
        expect(engine.node.port.postMessage).toHaveBeenCalledWith({type: 'cancel-output-capture', requestId: first.requestId});
        expect(engine.pendingOutputCapture).toBeNull();
        const next = engine.captureOutput({durationSeconds: 1});
        const nextRejected = next.catch(error => error);
        engine.handleMessage({type: 'output-capture', requestId: first.requestId});
        expect(engine.pendingOutputCapture).not.toBeNull();
        engine.stop();
        expect((await nextRejected).message).toContain('stopped');
    });

    it('handles a pre-aborted signal without posting or starting audio', async () => {
        const engine = runningEngine();
        const controller = new AbortController(); controller.abort();
        await expect(engine.captureOutput({signal: controller.signal})).rejects.toMatchObject({name: 'AbortError'});
        expect(engine.node.port.postMessage).not.toHaveBeenCalled();
    });

    it('allows the full capture duration before timing out and cancels processor ownership', async () => {
        vi.useFakeTimers();
        const engine = runningEngine();
        const pending = engine.captureOutput({durationSeconds: 1});
        const rejected = pending.catch(error => error);
        await vi.advanceTimersByTimeAsync(1000);
        expect(engine.pendingOutputCapture).not.toBeNull();
        await vi.advanceTimersByTimeAsync(5000);
        expect(await rejected).toMatchObject({code: 'capture-timeout'});
        expect(engine.pendingOutputCapture).toBeNull();
        expect(engine.node.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'cancel-output-capture'}));
    });

    it('cancels on a topology change before posting the new topology', async () => {
        const engine = runningEngine({registry: {getModuleOrder: () => 0, getPluginForModule: () => 'core'}});
        const capture = engine.captureOutput({durationSeconds: 1}).catch(error => error);
        const topology = engine.setPatchState({plugins: {core: 1}, modules: [], params: {}, cables: []});
        expect(await capture).toMatchObject({code: 'rack-changed'});
        await vi.waitFor(() => expect(engine.pendingTopologies.size).toBe(1));
        const messages = engine.node.port.postMessage.mock.calls.map(([message]) => message.type);
        expect(messages).toEqual(['capture-output', 'cancel-output-capture', 'topology']);
        engine.handleMessage({type: 'topology-active', revision: 4});
        await topology;
        expect(engine.activeRevision).toBe(4);
    });

    it('cancels on AudioContext suspension and releases the state listener', async () => {
        const engine = runningEngine();
        const remove = vi.spyOn(engine.audioCtx, 'removeEventListener');
        const pending = engine.captureOutput({durationSeconds: 1}).catch(error => error);
        engine.audioCtx.state = 'suspended';
        engine.audioCtx.dispatchEvent(new Event('statechange'));
        expect(await pending).toMatchObject({code: 'audio-not-running'});
        expect(remove).toHaveBeenCalledWith('statechange', expect.any(Function));
        expect(engine.pendingOutputCapture).toBeNull();
    });

    it('rejects malformed complete replies and worklet capture errors', async () => {
        const engine = runningEngine();
        const pending = engine.captureOutput({durationSeconds: 1}).catch(error => error);
        const [message] = request(engine);
        engine.handleMessage({type: 'output-capture', requestId: message.requestId,
            left: new Float32Array(2), right: new Float32Array(2), frames: 2, revision: 3, sampleRate: 48000});
        expect(await pending).toMatchObject({code: 'capture-failed'});
        const next = engine.captureOutput({durationSeconds: 1}).catch(error => error);
        const requestId = engine.pendingOutputCapture.requestId;
        engine.handleMessage({type: 'output-capture-error', requestId, code: 'rack-changed', message: 'The rack changed.'});
        expect(await next).toMatchObject({code: 'rack-changed'});
        expect(engine.pendingOutputCapture).toBeNull();
    });

    it('rejects and cancels capture when the audio host fails', async () => {
        const engine = runningEngine();
        const pending = engine.captureOutput().catch(error => error);
        engine.rejectPendingRequests(new Error('Processor failed'));
        expect((await pending).message).toBe('Processor failed');
        expect(engine.pendingOutputCapture).toBeNull();
    });

    it('accepts the maximum capture size and rejects failure to transfer without leaking a pending request', async () => {
        const engine = runningEngine();
        engine.audioCtx.sampleRate = 192000;
        engine.node.port.postMessage.mockImplementation(message => {
            if (message.type === 'capture-output') {
                expect(message.frames).toBe(1920000);
                expect(message.left.byteLength + message.right.byteLength).toBe(15360000);
                throw new Error('Transfer failed');
            }
        });
        await expect(engine.captureOutput({durationSeconds: 10})).rejects.toThrow('Transfer failed');
        expect(engine.pendingOutputCapture).toBeNull();
    });

    it('does not keep the abort listener after a successful capture', async () => {
        const engine = runningEngine();
        const controller = new AbortController();
        const remove = vi.spyOn(controller.signal, 'removeEventListener');
        const pending = engine.captureOutput({durationSeconds: 1 / 48000, signal: controller.signal});
        const [message] = request(engine);
        engine.handleMessage({...message, type: 'output-capture', sampleRate: 48000, startTimeSeconds: 0});
        await pending;
        expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
        const calls = engine.node.port.postMessage.mock.calls.length;
        controller.abort();
        expect(engine.node.port.postMessage).toHaveBeenCalledTimes(calls);
    });

    it('rejects capture immediately after a fatal processor error', async () => {
        globalThis.AudioWorkletNode = MockAudioWorkletNode;
        const engine = runningEngine();
        engine.audioCtx.audioWorklet = {addModule: vi.fn(async () => {})};
        engine.audioCtx.destination = {};
        await engine.init();
        const pending = engine.captureOutput({durationSeconds: 1}).catch(error => error);
        engine.node.onprocessorerror();
        expect((await pending).message).toContain('stopped unexpectedly');
        expect(engine.pendingOutputCapture).toBeNull();
        await expect(engine.captureOutput()).rejects.toMatchObject({code: 'audio-not-running'});
    });
});

describe('AudioWorkletEngine', () => {
    it('requires AudioWorklet support', async () => {
        const engine = new AudioWorkletEngine({ audioCtx: {} });
        await expect(engine.init()).rejects.toThrow('secure context');
    });

    it('loads required plugin worklets and posts versioned topologies', async () => {
        globalThis.AudioWorkletNode = MockAudioWorkletNode;
        const addModule = vi.fn(() => Promise.resolve());
        const registry = {
            getPlugin: vi.fn(() => ({ manifest: { workletUrl: 'https://example.test/plugin.js' } })),
            getPluginForModule: vi.fn(() => 'plugin'),
            getModuleOrder: vi.fn(() => 4)
        };
        const engine = new AudioWorkletEngine({
            audioCtx: { audioWorklet: { addModule }, destination: {} },
            registry
        });
        await engine.init();
        const activation = engine.setPatchState({
            version: 3,
            plugins: { plugin: 1 },
            modules: [{ id: 'module_1', type: 'module', row: 1, index: 0 }],
            params: { module_1: { level: 0.5 } },
            cables: []
        });

        await vi.waitFor(() => expect(engine.node.port.postMessage).toHaveBeenCalled());
        expect(addModule).toHaveBeenCalledTimes(2);
        expect(engine.node.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'topology',
            topology: expect.objectContaining({ revision: 1 })
        }));
        engine.handleMessage({ type: 'topology-active', revision: 1 });
        await expect(activation).resolves.toBe(1);
    });

    it('rejects topology activation when the processor rejects that revision', async () => {
        globalThis.AudioWorkletNode = MockAudioWorkletNode;
        const engine = new AudioWorkletEngine({
            audioCtx: { audioWorklet: { addModule: vi.fn(() => Promise.resolve()) }, destination: {} },
            registry: { getModuleOrder: () => 0, getPluginForModule: () => 'core' }
        });
        await engine.init();
        const activation = engine.setPatchState({ plugins: { core: 1 }, modules: [], params: {}, cables: [] });
        await vi.waitFor(() => expect(engine.node.port.postMessage).toHaveBeenCalled());
        engine.handleMessage({ type: 'host-error', revision: 1, message: 'Invalid graph' });

        await expect(activation).rejects.toThrow('Invalid graph');
    });

    it('times out topology and runtime-state requests', async () => {
        vi.useFakeTimers();
        globalThis.AudioWorkletNode = MockAudioWorkletNode;
        const engine = new AudioWorkletEngine({
            audioCtx: { audioWorklet: { addModule: vi.fn(() => Promise.resolve()) }, destination: {} },
            registry: { getModuleOrder: () => 0, getPluginForModule: () => 'core' },
            requestTimeoutMs: 25
        });
        await engine.init();

        const topology = engine.setPatchState({ plugins: { core: 1 }, modules: [], params: {}, cables: [] });
        const topologyResult = topology.catch(error => error);
        await Promise.resolve();
        await Promise.resolve();
        expect(engine.pendingTopologies.size).toBe(1);
        const runtime = engine.captureRuntimeStates();
        const runtimeResult = runtime.catch(error => error);
        await vi.advanceTimersByTimeAsync(25);

        expect((await topologyResult).message).toContain('topology revision 1');
        expect((await runtimeResult).message).toContain('runtime state request 1');
        expect(engine.pendingTopologies.size).toBe(0);
        expect(engine.pendingRuntimeRequests.size).toBe(0);
    });

    it('rejects and clears all pending requests when stopped', async () => {
        globalThis.AudioWorkletNode = MockAudioWorkletNode;
        const engine = new AudioWorkletEngine({
            audioCtx: { audioWorklet: { addModule: vi.fn(() => Promise.resolve()) }, destination: {} },
            registry: { getModuleOrder: () => 0, getPluginForModule: () => 'core' }
        });
        await engine.init();
        const topology = engine.setPatchState({ plugins: { core: 1 }, modules: [], params: {}, cables: [] });
        const topologyResult = topology.catch(error => error);
        await vi.waitFor(() => expect(engine.pendingTopologies.size).toBe(1));
        const runtime = engine.captureRuntimeStates();
        const runtimeResult = runtime.catch(error => error);

        engine.stop();

        expect((await topologyResult).message).toContain('stopped before request completion');
        expect((await runtimeResult).message).toContain('stopped before request completion');
        expect(engine.pendingTopologies.size).toBe(0);
        expect(engine.pendingRuntimeRequests.size).toBe(0);
    });

    it('forwards module events to the main-thread host', () => {
        const onModuleEvent = vi.fn();
        const engine = new AudioWorkletEngine({ onModuleEvent });
        const event = { type: 'recording-complete', buffersL: [] };

        engine.handleMessage({ type: 'module-event', moduleId: 'rec_1', event });

        expect(onModuleEvent).toHaveBeenCalledWith({ moduleId: 'rec_1', event });
    });

    it('maps MIDI received timestamps onto AudioContext time', () => {
        const engine = new AudioWorkletEngine({ audioCtx: { currentTime: 4 } });
        engine.node = { port: { postMessage: vi.fn() } };
        const now = performance.now();

        engine.sendMidi(Uint8Array.from([0x90, 60, 100]), now + 25);

        expect(engine.node.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'midi',
            data: [0x90, 60, 100],
            audioTime: expect.closeTo(4.025, 2)
        }));
    });

    it('requests opt-in profiling reports', async () => {
        const engine = new AudioWorkletEngine({ requestTimeoutMs: 100 });
        engine.node = { port: { postMessage: vi.fn() } };
        engine.setProfiling(true, { reset: true });
        const pending = engine.requestProfilingReport();
        const request = engine.node.port.postMessage.mock.calls.at(-1)[0];
        const report = { deadlineMs: 2.67, blocks: { samples: 10 }, modules: {} };
        engine.handleMessage({ type: 'profiling-report', requestId: request.requestId, report });

        await expect(pending).resolves.toEqual(report);
        expect(engine.node.port.postMessage).toHaveBeenCalledWith({
            type: 'profiling', enabled: true, reset: true
        });
    });
});
