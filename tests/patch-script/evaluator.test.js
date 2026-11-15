import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluatePatchScript, MAX_SCRIPT_BYTES, MAX_RESULT_BYTES } from '../../src/js/patch-script/evaluator.js';
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
    window.MessageChannel = originalChannel;
    vi.useRealTimers();
});

function ready() {
    const frame = document.querySelector('[data-patch-evaluator]');
    frame.contentWindow.postMessage = vi.fn();
    window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow,
        origin: 'null',
        data: { type: 'eurorack-patch-sandbox-ready' }
    }));
    return frame;
}

describe('isolated patch evaluator transport', () => {
    it('uses a disposable opaque-origin sandbox and accepts only bounded JSON', async () => {
        const promise = evaluatePatchScript('patch()');
        const frame = ready();
        expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
        expect(frame.referrerPolicy).toBe('no-referrer');
        expect(frame.src).toMatch(/\/patch-script-sandbox\.html$/);
        expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
            { type: 'eurorack-patch-evaluate', source: 'patch()' }, '*', [channels[0].port2]
        );
        channels[0].port1.onmessage({ data: { ok: true, json: JSON.stringify(valid) } });
        await expect(promise).resolves.toEqual(valid);
        expect(document.querySelector('[data-patch-evaluator]')).toBeNull();
        expect(channels[0].port1.close).toHaveBeenCalledOnce();
        expect(channels[0].port2.close).toHaveBeenCalledOnce();
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
        ready();
        const rejection = expect(promise).rejects.toThrow('evaluation limit');
        await vi.advanceTimersByTimeAsync(5);
        await rejection;
        expect(document.querySelector('iframe')).toBeNull();
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
        ready();
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        await expect(evaluatePatchScript('patch()', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(document.querySelector('iframe')).toBeNull();
        expect(channels).toHaveLength(1);
    });

    it('rejects oversized UTF-8 input and malformed results', async () => {
        await expect(evaluatePatchScript('a'.repeat(MAX_SCRIPT_BYTES + 1))).rejects.toThrow('64 KiB');
        await expect(evaluatePatchScript('😀'.repeat(MAX_SCRIPT_BYTES / 3))).rejects.toThrow('64 KiB');
        expect(channels).toHaveLength(0);
        const promise = evaluatePatchScript('patch()');
        ready();
        channels[0].port1.onmessage({ data: { ok: true, json: '{}' } });
        await expect(promise).rejects.toThrow('Invalid patch');
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
