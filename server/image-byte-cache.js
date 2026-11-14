// Only immutable raster bytes belong here. Callers must authorize every request
// separately and must not mutate returned buffers. No user/access decisions are cached.
export function createImageByteCache({ maxBytes = 32 * 1024 * 1024, maxEntries = 128 } = {}) {
    for (const [name, value] of Object.entries({ maxBytes, maxEntries })) {
        if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Invalid image cache ${name}`);
    }
    const entries = new Map(), pending = new Map();
    let bytes = 0;
    function remove(key) {
        bytes -= entries.get(key).byteLength;
        entries.delete(key);
    }
    function retain(key, value) {
        if (!maxEntries || !maxBytes || value.byteLength > maxBytes) return;
        if (entries.has(key)) remove(key);
        while (entries.size >= maxEntries || bytes + value.byteLength > maxBytes) remove(entries.keys().next().value);
        entries.set(key, value); bytes += value.byteLength;
    }
    return {
        get(key, loader) {
            if (entries.has(key)) {
                const value = entries.get(key);
                entries.delete(key); entries.set(key, value);
                return Promise.resolve(value);
            }
            if (pending.has(key)) return pending.get(key);
            const request = Promise.resolve().then(loader).then(value => {
                if (!Buffer.isBuffer(value)) throw new TypeError('Image cache loaders must return a Buffer');
                retain(key, value); return value;
            }).finally(() => {
                if (pending.get(key) === request) pending.delete(key);
            });
            // A burst of distinct requests must not grow the deduplication index
            // without bound. Overflow loads still work, but are not indexed.
            if (pending.size < maxEntries) pending.set(key, request);
            return request;
        }
    };
}
