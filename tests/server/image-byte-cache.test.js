// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createImageByteCache } from '../../server/image-byte-cache.js';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('immutable image byte cache', () => {
    it('deduplicates simultaneous loads and reuses completed bytes', async () => {
        const cache = createImageByteCache(), pending = deferred(), bytes = Buffer.from('rack');
        const loader = vi.fn(() => pending.promise);
        const first = cache.get('image', loader), second = cache.get('image', loader);
        expect(first).toBe(second);
        await Promise.resolve();
        expect(loader).toHaveBeenCalledTimes(1);
        pending.resolve(bytes);
        expect(await first).toBe(bytes);
        expect(await cache.get('image', loader)).toBe(bytes);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('evicts the least recently used image when the byte budget fills', async () => {
        const cache = createImageByteCache({ maxBytes: 6, maxEntries: 10 });
        const a = vi.fn(async () => Buffer.from('aaa')), b = vi.fn(async () => Buffer.from('bbb'));
        const c = vi.fn(async () => Buffer.from('ccc'));
        await cache.get('a', a); await cache.get('b', b);
        await cache.get('a', a); // Keep a newer than b.
        await cache.get('c', c);
        await cache.get('a', a);
        expect(a).toHaveBeenCalledTimes(1);
        await cache.get('b', b);
        expect(b).toHaveBeenCalledTimes(2);
    });

    it('also bounds entry count for small images', async () => {
        const cache = createImageByteCache({ maxBytes: 100, maxEntries: 2 });
        const a = vi.fn(async () => Buffer.from('a'));
        await cache.get('a', a);
        await cache.get('b', async () => Buffer.from('b'));
        await cache.get('c', async () => Buffer.from('c'));
        await cache.get('a', a);
        expect(a).toHaveBeenCalledTimes(2);
    });

    it('returns oversized images without retaining them or displacing smaller images', async () => {
        const cache = createImageByteCache({ maxBytes: 4, maxEntries: 2 });
        const small = vi.fn(async () => Buffer.from('ok'));
        const oversized = vi.fn(async () => Buffer.from('large'));
        await cache.get('small', small);
        expect(await cache.get('large', oversized)).toEqual(Buffer.from('large'));
        await cache.get('large', oversized);
        await cache.get('small', small);
        expect(oversized).toHaveBeenCalledTimes(2);
        expect(small).toHaveBeenCalledTimes(1);
    });

    it('retries rejected loads and never retains errors or non-byte values', async () => {
        const cache = createImageByteCache();
        const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('not bytes').mockResolvedValue(Buffer.from('rack'));
        await expect(cache.get('image', loader)).rejects.toThrow('offline');
        await expect(cache.get('image', loader)).rejects.toThrow('must return a Buffer');
        expect(await cache.get('image', loader)).toEqual(Buffer.from('rack'));
        await cache.get('image', loader);
        expect(loader).toHaveBeenCalledTimes(3);
    });

    it('releases failed in-flight loads so a subsequent attempt can be deduplicated', async () => {
        const cache = createImageByteCache(), first = deferred(), next = deferred();
        const loader = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(() => next.promise);
        const a = cache.get('image', loader), b = cache.get('image', loader);
        const failed = Promise.allSettled([a, b]);
        first.reject(new Error('offline'));
        expect((await failed).every(result => result.status === 'rejected')).toBe(true);
        const c = cache.get('image', loader), d = cache.get('image', loader);
        expect(c).toBe(d);
        next.resolve(Buffer.from('rack'));
        await c;
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('bounds the in-flight index without preventing overflow loads', async () => {
        const cache = createImageByteCache({ maxEntries: 1 }), slow = deferred(), overflow = deferred();
        const slowLoader = vi.fn(() => slow.promise), overflowLoader = vi.fn(() => overflow.promise);
        const first = cache.get('slow', slowLoader);
        expect(cache.get('slow', slowLoader)).toBe(first);
        const overflowA = cache.get('other', overflowLoader), overflowB = cache.get('other', overflowLoader);
        await Promise.resolve();
        expect(overflowLoader).toHaveBeenCalledTimes(2);
        overflow.resolve(Buffer.from('other')); slow.resolve(Buffer.from('slow'));
        expect(await Promise.all([first, overflowA, overflowB])).toEqual([Buffer.from('slow'), Buffer.from('other'), Buffer.from('other')]);
    });

    it('can disable retention and rejects invalid bounds', async () => {
        for (const options of [{ maxBytes: 0 }, { maxEntries: 0 }]) {
            const cache = createImageByteCache(options), loader = vi.fn(async () => Buffer.from('rack'));
            await cache.get('image', loader); await cache.get('image', loader);
            expect(loader).toHaveBeenCalledTimes(2);
        }
        for (const value of [-1, 0.5, Infinity, NaN]) {
            expect(() => createImageByteCache({ maxBytes: value })).toThrow(RangeError);
            expect(() => createImageByteCache({ maxEntries: value })).toThrow(RangeError);
        }
    });
});
