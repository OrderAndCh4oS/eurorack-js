import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluatePatchScript, preparePatchEvaluator, disposePatchEvaluator, MAX_SCRIPT_BYTES, MAX_RESULT_BYTES } from '../../src/js/patch-script/evaluator.js';
import { decodeEvaluationResult } from '../../src/js/patch-script/evaluator-limits.js';

const valid = { modules: [], connections: [], midiMappings: {} };
let channels;
let originalChannel;

beforeEach(() => {
    document.body.innerHTML = '';
    channels = [];
    originalChannel = window.MessageChannel;
    window.MessageChannel = class {
        constructor() {
            this.port1 = { close: vi.fn(), postMessage: vi.fn() };
            this.port2 = { close: vi.fn(), postMessage: vi.fn() };
            channels.push(this);
        }
    };
});

afterEach(() => {
    disposePatchEvaluator({ document });
    window.MessageChannel = originalChannel;
    vi.useRealTimers();
});

async function ready() {
    const frame = document.querySelector('[data-patch-evaluator]');
    frame.contentWindow.postMessage = vi.fn();
    window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow,
        origin: 'null',
        data: { type: 'eurorack-patch-sandbox-ready' }
    }));
    await Promise.resolve();
    return frame;
}

describe('isolated patch evaluator transport', () => {
    it('reuses an opaque-origin host while disposing each evaluation channel', async () => {
        const promise = evaluatePatchScript('patch()');
        const frame = await ready();
        expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
        expect(frame.referrerPolicy).toBe('no-referrer');
        expect(frame.src).toMatch(/\/patch-script-sandbox\.html$/);
        expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
            { type: 'eurorack-patch-evaluate', source: 'patch()' }, '*', [channels[0].port2]
        );
        channels[0].port1.onmessage({ data: { ok: true, json: JSON.stringify(valid) } });
        await expect(promise).resolves.toEqual(valid);
        expect(document.querySelector('[data-patch-evaluator]')).toBe(frame);
        expect(channels[0].port1.close).toHaveBeenCalledOnce();
        expect(channels[0].port2.close).toHaveBeenCalledOnce();
        const next = evaluatePatchScript('patch()');
        await Promise.resolve();
        channels[1].port1.onmessage({ data: { ok: true, json: JSON.stringify(valid) } });
        await expect(next).resolves.toEqual(valid);
        expect(document.querySelectorAll('[data-patch-evaluator]')).toHaveLength(1);
        expect(document.querySelector('[data-patch-evaluator]')).toBe(frame);
    });

    it('ignores readiness messages from another frame or a non-opaque origin', async () => {
        const controller = new AbortController();
        const promise = evaluatePatchScript('patch()', { signal: controller.signal });
        const frame = document.querySelector('iframe');
        frame.contentWindow.postMessage = vi.fn();
        for (const [source, origin] of [[window, 'null'], [frame.contentWindow, 'https://example.com']]) {
            window.dispatchEvent(new MessageEvent('message', { source, origin, data: { type: 'eurorack-patch-sandbox-ready' } }));
        }
        expect(frame.contentWindow.postMessage).not.toHaveBeenCalled();
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('terminates evaluation and cleans up on timeout', async () => {
        vi.useFakeTimers();
        const promise = evaluatePatchScript('while (true) {}', { timeoutMs: 5 });
        await ready();
        const rejection = expect(promise).rejects.toThrow('evaluation limit');
        await vi.advanceTimersByTimeAsync(5);
        await rejection;
        expect(document.querySelector('iframe')).not.toBeNull();
        expect(channels[0].port1.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
        expect(channels[0].port1.close).toHaveBeenCalledOnce();
    });

    it('bounds sandbox startup and rejects unavailable browser isolation without running source', async () => {
        vi.useFakeTimers();
        const promise = evaluatePatchScript('patch()');
        const rejection = expect(promise).rejects.toThrow('did not start');
        await vi.advanceTimersByTimeAsync(5000);
        await rejection;
        window.MessageChannel = undefined;
        await expect(evaluatePatchScript('globalThis.unsafeRan = true')).rejects.toThrow('not available');
        expect(globalThis.unsafeRan).toBeUndefined();
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('supports cancellation before startup and while executing', async () => {
        const controller = new AbortController();
        const promise = evaluatePatchScript('while (true) {}', { signal: controller.signal });
        await ready();
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        await expect(evaluatePatchScript('patch()', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(document.querySelector('iframe')).not.toBeNull();
        expect(channels[0].port1.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
        expect(channels).toHaveLength(1);
    });

    it('rejects oversized UTF-8 input and malformed results', async () => {
        await expect(evaluatePatchScript('a'.repeat(MAX_SCRIPT_BYTES + 1))).rejects.toThrow('64 KiB');
        await expect(evaluatePatchScript('😀'.repeat(MAX_SCRIPT_BYTES / 3))).rejects.toThrow('64 KiB');
        expect(channels).toHaveLength(0);
        const promise = evaluatePatchScript('patch()');
        await ready();
        channels[0].port1.onmessage({ data: { ok: true, json: '{}' } });
        await expect(promise).rejects.toThrow('Invalid patch');
    });

    it('prewarms without creating a worker channel and separates concurrent replies', async () => {
        const prepared = preparePatchEvaluator();
        const frame = await ready();
        await prepared;
        expect(channels).toHaveLength(0);
        const first = evaluatePatchScript('patch().module("out", "first")');
        const second = evaluatePatchScript('patch().module("out", "second")');
        await Promise.resolve();
        const one = { ...valid, modules: [{ id: 'first' }] };
        const two = { ...valid, modules: [{ id: 'second' }] };
        channels[1].port1.onmessage({ data: { ok: true, json: JSON.stringify(two) } });
        channels[0].port1.onmessage({ data: { ok: true, json: JSON.stringify(one) } });
        await expect(first).resolves.toEqual(one);
        await expect(second).resolves.toEqual(two);
        expect(document.querySelector('[data-patch-evaluator]')).toBe(frame);
    });

    it('limits concurrency and disposes active evaluations with the host', async () => {
        const prepared = preparePatchEvaluator();
        await ready();
        await prepared;
        const running = Array.from({ length: 4 }, () => evaluatePatchScript('patch()'));
        await expect(evaluatePatchScript('patch()')).rejects.toThrow('Too many');
        const rejections = running.map(promise => expect(promise).rejects.toMatchObject({ name: 'AbortError' }));
        disposePatchEvaluator();
        await Promise.all(rejections);
        expect(document.querySelector('[data-patch-evaluator]')).toBeNull();
        for (const channel of channels) {
            expect(channel.port1.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
            expect(channel.port1.close).toHaveBeenCalledOnce();
        }
    });
});

describe('evaluation result bounds', () => {
    it('rejects oversized, excessively nested, nonfinite and prototype-shaped data', () => {
        expect(() => decodeEvaluationResult(' '.repeat(MAX_RESULT_BYTES + 1))).toThrow('1 MiB');
        expect(() => decodeEvaluationResult('{"modules":[],"connections":[],"midiMappings":{"__proto__":{}}}')).toThrow('key');
        expect(() => decodeEvaluationResult('{"modules":[],"connections":[],"midiMappings":{"value":1e400}}')).toThrow('finite');
        let nested = {};
        for (let n = 0; n < 35; n++) nested = { nested };
        expect(() => decodeEvaluationResult(JSON.stringify({ ...valid, midiMappings: nested }))).toThrow('complex');
    });
});
