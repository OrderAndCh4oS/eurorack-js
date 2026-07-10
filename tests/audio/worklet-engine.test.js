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

    it('forwards module events to the main-thread host', () => {
        const onModuleEvent = vi.fn();
        const engine = new AudioWorkletEngine({ onModuleEvent });
        const event = { type: 'recording-complete', buffersL: [] };

        engine.handleMessage({ type: 'module-event', moduleId: 'rec_1', event });

        expect(onModuleEvent).toHaveBeenCalledWith({ moduleId: 'rec_1', event });
    });
});
