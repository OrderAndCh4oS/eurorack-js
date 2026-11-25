import { beforeAll, describe, expect, it } from 'vitest';
import { RackHost } from '../../src/js/app/rack-host.js';
import { AudioWorkletEngine } from '../../src/js/audio/worklet-engine.js';

let Processor;
beforeAll(async () => {
    globalThis.sampleRate = 48000;
    globalThis.currentTime = 0;
    globalThis.AudioWorkletProcessor = class { port = {}; };
    globalThis.registerProcessor = (_name, processor) => { Processor = processor; };
    await import('../../src/js/audio/worklet/processor.js');
});

const asset = (channel, value) => ({
    type: 'load-sample', channel, name: channel + '.wav', sampleRate: 48000,
    pcm: new Int16Array(128).fill(value)
});

async function createRack({ asyncPort = false } = {}) {
    let processor;
    const host = await new RackHost({ audioEngineFactory: async options => {
        const engine = new AudioWorkletEngine(options);
        processor = new Processor();
        const deliver = (to, message, transfer = []) => {
            const copy = structuredClone(message, { transfer });
            if (asyncPort) setTimeout(() => to(copy), 0);
            else to(copy);
        };
        engine.node = {
            port: { postMessage: (message, transfer) => deliver(copy => processor.handleMessage(copy), message, transfer) },
            disconnect() {}
        };
        processor.port.postMessage = message => deliver(copy => engine.handleMessage(copy), message);
        return engine;
    } }).init();
    const module = host.addModule('slice-sampler', { id: 'cuts' });
    return { host, module, worklet: () => processor };
}

describe('local sampler media', () => {
    it('imports when stopped and playing, retains both channels across restart, and exports only settings', async () => {
        const { host, module, worklet } = await createRack();
        const pcmA = asset('A', 12123);
        await host.applyRuntimeCommand('cuts', pcmA, [pcmA.pcm.buffer]);
        host.setParam('cuts', 'sourceA', 1);
        expect(module.instance.samplerInfo.A.name).toBe('A.wav');
        await host.startAudio({ sampleRate: 48000 });
        const pcmB = asset('B', -23456);
        await host.applyRuntimeCommand('cuts', pcmB, [pcmB.pcm.buffer]);
        expect(pcmB.pcm.byteLength).toBe(0);
        host.setParam('cuts', 'sourceB', 1);
        expect(worklet().modules.cuts.instance.samplerInfo.B.name).toBe('B.wav');
        const bad = { ...asset('A', 0), sampleRate: 0 };
        await expect(host.applyRuntimeCommand('cuts', bad)).rejects.toThrow();
        await host.stopAudio();
        expect(module.runtimeState.A.pcm[0]).toBe(12123);
        expect(module.runtimeState.B.pcm[0]).toBe(-23456);
        expect(module.instance.samplerInfo.B.name).toBe('B.wav');
        const json = JSON.stringify(host.serializePatch());
        expect(json).not.toMatch(/12123|23456|\.wav|runtimeState/);
        await host.startAudio({ sampleRate: 48000 });
        expect(worklet().modules.cuts.instance.snapshot().B.pcm[0]).toBe(-23456);
        await host.destroy();
    });

    it('rejects an obsolete panel and a stale worklet command before touching a replacement slot', async () => {
        const { host, module, worklet } = await createRack();
        await host.startAudio({ sampleRate: 48000 });
        const previousRevision = host.engine.activeRevision;
        await host.loadPatch(host.serializePatch());
        await expect(host.applyRuntimeCommand('cuts', asset('A', 100), [], module)).rejects.toThrow(/instance/);
        const replies = [];
        const processor = worklet();
        const deliver = processor.port.postMessage;
        processor.port.postMessage = message => { replies.push(message); deliver(message); };
        processor.handleMessage({ type: 'module-command', requestId: 10, revision: previousRevision,
            moduleId: 'cuts', moduleType: 'slice-sampler', command: asset('A', 100) });
        expect(replies.at(-1)).toMatchObject({ type: 'module-command-result', requestId: 10, error: expect.any(String) });
        expect(processor.modules.cuts.instance.snapshot().A).toBeFalsy();
        await host.destroy();
    });

    it('preserves manual cuts and source edits when an older display snapshot arrives late', async () => {
        const { host, module, worklet } = await createRack();
        await host.startAudio({ sampleRate: 48000 });
        const processor = worklet();
        const deliver = processor.port.postMessage;
        let previous;
        processor.port.postMessage = message => { previous = structuredClone(message); };
        processor.telemetryFrames = 48000;
        processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
        processor.port.postMessage = deliver;
        host.setParam('cuts', 'markersA', [0.5]);
        host.setParam('cuts', 'methodA', 2);
        host.setParam('cuts', 'sourceA', 1);
        deliver(previous);
        expect(module.params).toMatchObject({ markersA: [0.5], methodA: 2, sourceA: 1 });
        await host.syncTopology({ throwOnError: true });
        expect(processor.modules.cuts.instance.params).toMatchObject({ markersA: [0.5], methodA: 2, sourceA: 1 });
        await host.destroy();
    });

    it('keeps a just-committed local take through a cable edit and immediate stop before the next display tick', async () => {
        const { host, module, worklet } = await createRack();
        await host.startAudio({ sampleRate: 48000 });
        const processor = worklet();
        const audio = processor.modules.cuts.instance;
        const render = () => processor.process([], [[new Float32Array(128), new Float32Array(128)]]);
        render(); // Establish the released Record action, as on an already playing rack.
        for (const value of [1, 0, 1, 0]) {
            host.setParam('cuts', 'recordA', value);
            render();
        }
        expect(audio.params.sourceA).toBe(1);
        await host.syncTopology({ throwOnError: true });
        expect(audio.params.sourceA).toBe(1);
        await host.stopAudio();
        expect(module.params.sourceA).toBe(1);
        expect(module.instance.samplerInfo.A.name).toBe('Capture');
        await host.startAudio({ sampleRate: 48000 });
        expect(worklet().modules.cuts.instance.samplerInfo.A.name).toBe('Capture');
        await host.destroy();
    });

    it('orders a patch replacement before a concurrent stop and lets a stopped import follow the snapshot', async () => {
        const { host } = await createRack({ asyncPort: true });
        await host.startAudio({ sampleRate: 48000 });
        await host.applyRuntimeCommand('cuts', asset('A', 321));
        const replacement = host.loadPatch(host.serializePatch());
        const stopping = host.stopAudio();
        const loadB = host.applyRuntimeCommand('cuts', asset('B', 987));
        await Promise.all([replacement, stopping, loadB]);
        const state = host.state.getModule('cuts').runtimeState;
        expect(state.A).toBeFalsy();
        expect(state.B.pcm[0]).toBe(987);
        await host.destroy();
    });
});
