const CACHE_NAME = 'eurorack-local-rack-previews-v1';
const MAX_ENTRIES = 96;
const MAX_BYTES = 24 * 1024 * 1024;

// Only locally rendered browser patches use this cache. Remote saved images
// continue through the authenticated, visibility-checked image endpoint.
export function createPersistentPreviewCache({ storage = globalThis.caches, origin = globalThis.location?.origin,
    maxEntries = MAX_ENTRIES, maxBytes = MAX_BYTES } = {}) {
    let writes = Promise.resolve();
    let unavailable = !storage || !origin || origin === 'null';
    const request = key => `${origin}/__local-rack-preview-cache/${key}`;
    return {
        async get(key) {
            if (unavailable) return null;
            try {
                const response = await (await storage.open(CACHE_NAME)).match(request(key));
                if (!response || response.headers.get('Content-Type') !== 'image/png') return null;
                const blob = await response.blob();
                return blob.size > 0 && blob.size <= maxBytes ? blob : null;
            } catch { unavailable = true; return null; }
        },
        async put(key, blob) {
            if (unavailable || !blob?.size || blob.size > maxBytes || blob.type !== 'image/png') return;
            const write = writes.then(async () => {
                if (unavailable) return;
                try {
                    const cache = await storage.open(CACHE_NAME);
                    // Cache keys preserve insertion order: replacing an entry
                    // moves it to the end, making eviction bounded and predictable.
                    await cache.delete(request(key));
                    await cache.put(request(key), new Response(blob, { headers: {
                        'Content-Type': 'image/png', 'X-Preview-Bytes': String(blob.size)
                    } }));
                    const keys = await cache.keys();
                    const sizes = await Promise.all(keys.map(async item => Number((await cache.match(item))?.headers.get('X-Preview-Bytes')) || 0));
                    let bytes = sizes.reduce((sum, size) => sum + size, 0);
                    for (let index = 0; index < keys.length && (keys.length - index > maxEntries || bytes > maxBytes); index++) {
                        await cache.delete(keys[index]); bytes -= sizes[index];
                    }
                } catch { unavailable = true; }
            });
            writes = write.catch(() => {});
            await write;
        }
    };
}

export async function hashPreviewKey(value, crypto = globalThis.crypto) {
    if (!crypto?.subtle) return null;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
