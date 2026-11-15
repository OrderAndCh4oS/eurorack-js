import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudClient } from '../../src/js/patches/cloud-client.js';

const response = (status, data = { patches: [], nextCursor: null }) => ({ status, ok: status < 400, json: async () => data });
afterEach(() => { vi.useRealTimers(); });

describe('safe cloud read retries', () => {
    it('retries transient reads sequentially with the exact filters and cursor', async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(response(503, { error: { code: 'service_unavailable' } }))
            .mockResolvedValueOnce(response(200, { patches: [{ name: 'Loaded' }], nextCursor: 'next' }));
        const client = new CloudClient({ fetch });
        const result = client.list({ publicOnly: true, query: 'kick & snare', sort: 'popular', period: 'week', cursor: 'opaque+/=' });
        await vi.advanceTimersByTimeAsync(499); expect(fetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1500);
        await expect(result).resolves.toMatchObject({ patches: [{ name: 'Loaded' }], nextCursor: 'next' });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(new Set(fetch.mock.calls.map(([url]) => url)).size).toBe(1);
        expect(Object.fromEntries(new URL(fetch.mock.calls[0][0], 'https://rack.example').searchParams))
            .toEqual({ q: 'kick & snare', sort: 'popular', period: 'week', cursor: 'opaque+/=' });
        expect(client.pending.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    });
    it('recovers configuration from a non-JSON gateway error before treating cloud access as unavailable', async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockResolvedValueOnce({ status: 502, ok: false, json: async () => { throw new SyntaxError('Gateway HTML'); } })
            .mockResolvedValueOnce(response(200, { enabled: true }));
        const result = new CloudClient({ fetch }).configuration();
        await vi.advanceTimersByTimeAsync(500);
        await expect(result).resolves.toEqual({ enabled: true }); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it.each([400, 401, 403, 404, 429])('does not retry permanent or rate-limited HTTP %i responses', async status => {
        const fetch = vi.fn(async () => response(status, { error: { code: 'invalid_request' } }));
        await expect(new CloudClient({ fetch }).list()).rejects.toMatchObject({ status, code: 'invalid_request' });
        expect(fetch).toHaveBeenCalledOnce();
    });
    it('stops after three failed attempts instead of loading forever', async () => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => response(503, { error: { code: 'service_unavailable' } }));
        const client = new CloudClient({ fetch });
        const failed = expect(client.list()).rejects.toMatchObject({ status: 503 });
        await vi.runAllTimersAsync(); await failed;
        expect(fetch).toHaveBeenCalledTimes(3); expect(client.pending.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    });
    it('times out a stalled read before retrying it', async () => {
        vi.useFakeTimers(); let firstSignal;
        const fetch = vi.fn().mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
            firstSignal = signal; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        })).mockResolvedValueOnce(response(200));
        const result = new CloudClient({ fetch }).list();
        await vi.advanceTimersByTimeAsync(15000); expect(firstSignal.aborted).toBe(true); expect(fetch).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(500);
        await expect(result).resolves.toMatchObject({ patches: [] }); expect(fetch).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each(['signal', 'client'])('cancels retry backoff through %s without sending another request', async kind => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => response(503)); const client = new CloudClient({ fetch }); const controller = new AbortController();
        const failed = expect(client.list({}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(0);
        if (kind === 'signal') controller.abort(); else client.cancel();
        await failed; await vi.runAllTimersAsync();
        expect(fetch).toHaveBeenCalledOnce(); expect(client.pending.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    });
    it('cancels an active fetch without retrying or retaining its timeout', async () => {
        vi.useFakeTimers(); let activeSignal;
        const fetch = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
            activeSignal = signal; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }));
        const client = new CloudClient({ fetch }); const failed = expect(client.list()).rejects.toMatchObject({ name: 'AbortError' });
        client.cancel(); await failed; await vi.runAllTimersAsync();
        expect(activeSignal.aborted).toBe(true); expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    });
    it('does not fetch an already-cancelled read', async () => {
        const fetch = vi.fn(); const controller = new AbortController(); controller.abort();
        await expect(new CloudClient({ fetch }).list({}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('never retries a failed mutation', async () => {
        const fetch = vi.fn(async () => response(503));
        await expect(new CloudClient({ fetch }).create({ name: 'One patch' })).rejects.toMatchObject({ status: 503 });
        expect(fetch).toHaveBeenCalledOnce();
    });
});
