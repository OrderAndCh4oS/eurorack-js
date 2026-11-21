import { put, get, del } from '@vercel/blob';
import { LIMITS, assert } from './validation.js';

// Store paths stay server-side. Neither private provider URLs nor read-write tokens are
// returned to a browser; the existing patch route controls public/owner visibility.
export function createVercelBlobImageStore(env = process.env, sdk = { put, get, del }) {
    const token = env.BLOB_READ_WRITE_TOKEN;
    assert(typeof token === 'string' && token.trim(), 'Private Vercel Blob storage is not configured.', 503, 'images_unavailable');
    function checkKey(key) {
        assert(typeof key === 'string' && /^rack-previews\/[0-7][0-9A-HJKMNP-TV-Z]{25}\/(?:dark-)?(?:(?:full|thumbnail|social)\.png|thumbnail\.webp)$/.test(key), 'Invalid rack image key.');
    }
    return {
        async put(key, body, { contentType = 'image/png' } = {}) {
            checkKey(key);
            assert(contentType === (key.endsWith('.webp') ? 'image/webp' : 'image/png'), 'Invalid rack image type.');
            assert(body.byteLength <= LIMITS.imageBytes, 'Rack image is too large.', 413, 'image_too_large');
            const result = await sdk.put(key, body, { token, access: 'private', addRandomSuffix: false,
                allowOverwrite: false, contentType, cacheControlMaxAge: 31536000 });
            assert(result.pathname === key, 'Image storage returned an unexpected path.', 503, 'image_unavailable');
        },
        async get(key) {
            checkKey(key);
            // Keys are immutable. Cache bytes in Blob's private CDN; current patch
            // visibility is checked by the application before and after each read.
            const result = await sdk.get(key, { token, access: 'private', useCache: true });
            assert(result?.statusCode === 200 && result.stream, 'Rack image is unavailable.', 503, 'image_unavailable');
            if (result.blob.size !== null && !(result.blob.size <= LIMITS.imageBytes)) {
                await result.stream.cancel().catch(() => {});
                assert(false, 'Stored rack image is too large.', 503, 'image_unavailable');
            }
            const reader = result.stream.getReader(); const chunks = []; let bytes = 0;
            try {
                while (true) {
                    const { value, done } = await reader.read(); if (done) break;
                    bytes += value.byteLength;
                    assert(bytes <= LIMITS.imageBytes, 'Stored rack image is too large.', 503, 'image_unavailable');
                    chunks.push(value);
                }
                return Buffer.concat(chunks, bytes);
            } catch (error) { await reader.cancel().catch(() => {}); throw error; }
            finally { reader.releaseLock(); }
        },
        async delete(key) { checkKey(key); await sdk.del(key, { token }); }
    };
}
