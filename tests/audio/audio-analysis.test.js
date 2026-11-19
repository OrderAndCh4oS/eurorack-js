import {afterEach, describe, expect, it, vi} from 'vitest';
import {createAudioAnalysis} from '../../src/js/audio/audio-analysis.js';

function fixture({ready = true, capture, result = {schemaVersion: 1, levels: {}}} = {}) {
    const listeners = new Set();
    const context = new EventTarget(); context.state = 'running'; context.currentTime = 12;
    let revision = 7;
    const workers = [];
    class Worker {
        constructor() { workers.push(this); this.terminate = vi.fn(); if (ready) queueMicrotask(() => this.onmessage?.({data: {type: 'ready', version: 'fixture'}})); }
        postMessage(message, transfer) { this.sent = {message, transfer}; queueMicrotask(() => this.onmessage?.({data: {type: 'result', report: result}})); }
    }
    const host = {audioCtx: context, subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
        engine: {captureOutput: vi.fn(capture || (async () => ({left: new Float32Array(24000), right: new Float32Array(24000), frames: 24000, sampleRate: 48000, revision: 2})))}};
    const service = createAudioAnalysis({host, getRevision: () => revision, Worker, timeoutMs: 100});
    return {service, host, context, workers, listeners, changeRevision: () => revision++, emit: type => listeners.forEach(listener => listener({type}))};
}
afterEach(() => vi.useRealTimers());

describe('browser audio analysis lifecycle', () => {
    it('is lazy and measures actual output without starting or changing audio', async () => {
        const f = fixture(); expect(f.workers).toHaveLength(0);
        const onPhase = vi.fn();
        const result = await f.service.measure({durationSeconds: 0.5, expectedRevision: 7, onPhase});
        expect(onPhase.mock.calls.flat()).toEqual(['loading', 'capturing', 'analysing']);
        expect(result).toMatchObject({revision: 7, implementationVersion: 'fixture', capture: {frames: 24000, sampleRate: 48000, engineRevision: 2}, report: {schemaVersion: 1}});
        expect(f.host.engine.captureOutput).toHaveBeenCalledWith({durationSeconds: 0.5, signal: expect.any(AbortSignal)});
        expect(f.workers[0].sent.transfer).toHaveLength(2);
        expect(f.workers[0].sent.message.type).toBe('analyze');
        expect(f.workers[0].terminate).toHaveBeenCalledOnce();
        expect(f.listeners.size).toBe(0); expect(f.context.state).toBe('running');
    });
    it.each([0, 0.49, 10.1, Infinity, NaN, '5'])('rejects invalid duration %s without allocating or recording', async durationSeconds => {
        const f = fixture(); await expect(f.service.measure({durationSeconds})).rejects.toMatchObject({code: 'invalid-input'});
        expect(f.workers).toHaveLength(0); expect(f.host.engine.captureOutput).not.toHaveBeenCalled();
    });
    it('requires existing running audio and the current requested revision', async () => {
        const f = fixture();
        await expect(f.service.measure({expectedRevision: 6})).rejects.toMatchObject({code: 'rack-changed'});
        f.context.state = 'suspended';
        await expect(f.service.measure()).rejects.toMatchObject({code: 'audio-not-running'});
        expect(f.workers).toHaveLength(0);
    });
    it('rejects overlap and forwards cancellation to capture, then allows recovery', async () => {
        const f = fixture({capture: ({signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}))});
        const controller = new AbortController();
        const pending = f.service.measure({signal: controller.signal});
        await expect(f.service.measure()).rejects.toMatchObject({code: 'busy'});
        await new Promise(resolve => setTimeout(resolve, 0)); controller.abort();
        await expect(pending).rejects.toMatchObject({name: 'AbortError'});
        expect(f.workers[0].terminate).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
        f.host.engine.captureOutput.mockResolvedValue({left: new Float32Array(24000), right: new Float32Array(24000), frames: 24000, sampleRate: 48000, revision: 2});
        await expect(f.service.measure()).resolves.toHaveProperty('report.schemaVersion', 1);
    });
    it.each(['param-changed', 'module-added', 'module-removed', 'cables-changed', 'patch-loaded', 'registry'])('cancels on %s even if the patch later returns to the same values', async type => {
        const f = fixture({ready: false}); const pending = f.service.measure();
        f.emit(type); await expect(pending).rejects.toMatchObject({code: 'rack-changed'});
        expect(f.workers[0].terminate).toHaveBeenCalledOnce(); expect(f.host.engine.captureOutput).not.toHaveBeenCalled();
    });
    it('cancels on context suspension, host errors and disposal', async () => {
        for (const kind of ['suspend', 'audio-stopped', 'audio-error', 'module-error', 'dispose']) {
            const f = fixture({ready: false}); const pending = f.service.measure();
            if (kind === 'suspend') { f.context.state = 'suspended'; f.context.dispatchEvent(new Event('statechange')); }
            else if (kind === 'dispose') f.service.dispose(); else f.emit(kind);
            await expect(pending).rejects.toMatchObject(kind === 'dispose' ? {name: 'AbortError'} : {code: 'audio-not-running'});
            expect(f.workers[0].terminate).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
        }
    });
    it('rejects a changed revision even without a host event', async () => {
        const f = fixture(); f.host.engine.captureOutput.mockImplementation(async () => {
            f.changeRevision(); return {left: new Float32Array(24000), right: new Float32Array(24000), frames: 24000, sampleRate: 48000, revision: 2};
        });
        await expect(f.service.measure()).rejects.toMatchObject({code: 'rack-changed'});
        expect(f.workers[0].sent).toBeUndefined();
    });
    it('bounds worker startup and recovers after a load failure', async () => {
        vi.useFakeTimers(); const f = fixture({ready: false});
        const timedOut = expect(f.service.measure({durationSeconds: 0.5})).rejects.toMatchObject({code: 'analysis-timeout'});
        await vi.advanceTimersByTimeAsync(601); await timedOut;
        const pending = f.service.measure(); f.workers[1].onerror({message: 'load failed', preventDefault() {}});
        await expect(pending).rejects.toMatchObject({code: 'analysis-failed'});
    });
    it.each([{}, {schemaVersion: 2}, {schemaVersion: 1, oversized: 'x'.repeat(65536)}])('rejects an invalid or oversized report', async result => {
        const f = fixture({result});
        await expect(f.service.measure()).rejects.toMatchObject({code:'analysis-failed'});
        expect(f.workers[0].terminate).toHaveBeenCalledOnce();
    });
    it('handles unreadable worker messages and already-cancelled requests', async () => {
        const f = fixture({ready:false}); const controller = new AbortController(); controller.abort();
        await expect(f.service.measure({signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
        expect(f.workers).toHaveLength(0);
        const pending = f.service.measure(); f.workers[0].onmessageerror();
        await expect(pending).rejects.toMatchObject({code:'analysis-failed'});
        expect(f.workers[0].terminate).toHaveBeenCalledOnce();
    });
});
