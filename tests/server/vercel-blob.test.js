// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ulid } from 'ulid';
import { createVercelBlobImageStore } from '../../server/vercel-blob-image-store.js';
import { readImageConfig } from '../../server/config.js';
import { LIMITS } from '../../server/validation.js';

const token = 'test-token-never-public';
const key = () => `rack-previews/${ulid()}/full.png`;
function sdkWithBytes(bytes) {
    return { put: vi.fn(async pathname => ({ pathname, url: 'https://private-provider.invalid/image.png' })),
        get: vi.fn(async () => ({ statusCode: 200, stream: new Blob([bytes]).stream(), blob: { size: bytes.length } })),
        del: vi.fn(async () => {}) };
}
describe('private Vercel Blob image storage', () => {
    it('prefers the explicit Blob token over optional S3 credentials', () => {
        const config = readImageConfig({ BLOB_READ_WRITE_TOKEN: token, S3_ENDPOINT: 'https://s3.example', S3_BUCKET: 'rack', S3_ACCESS_KEY_ID: 'key', S3_SECRET_ACCESS_KEY: 'secret' });
        expect(config).toEqual({ provider: 'vercel-blob', enabled: true, token });
        expect(readImageConfig({ BLOB_READ_WRITE_TOKEN: '  ' }).enabled).toBe(false);
    });
    it('uploads immutable private paths, reuses the private provider cache, and exposes no provider URLs', async () => {
        const bytes = Buffer.from('rack PNG fixture'); const sdk = sdkWithBytes(bytes); const path = key();
        const store = createVercelBlobImageStore({ BLOB_READ_WRITE_TOKEN: token }, sdk);
        expect(await store.put(path, bytes)).toBeUndefined();
        expect(sdk.put).toHaveBeenCalledWith(path, bytes, { token, access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/png', cacheControlMaxAge: 31536000 });
        expect(await store.get(path)).toEqual(bytes);
        expect(sdk.get).toHaveBeenCalledWith(path, { token, access: 'private', useCache: true });
        await store.delete(path); expect(sdk.del).toHaveBeenCalledWith(path, { token });
    });
    it('stores precomputed WebP thumbnails with their actual MIME type', async () => {
        const bytes = Buffer.from('webp fixture'), sdk = sdkWithBytes(bytes);
        const store = createVercelBlobImageStore({ BLOB_READ_WRITE_TOKEN: token }, sdk);
        const path = `rack-previews/${ulid()}/thumbnail.webp`;
        await store.put(path, bytes, { contentType: 'image/webp' });
        expect(sdk.put.mock.calls[0][2]).toMatchObject({ contentType: 'image/webp', allowOverwrite: false, access: 'private' });
        await expect(store.put(path, bytes)).rejects.toMatchObject({ status: 400 });
        await expect(store.put(path.replace('thumbnail', 'social'), bytes, { contentType: 'image/webp' })).rejects.toMatchObject({ status: 400 });
    });
    it('rejects arbitrary provider URLs and paths before sending credentials', async () => {
        const sdk = sdkWithBytes(Buffer.from('x')); const store = createVercelBlobImageStore({ BLOB_READ_WRITE_TOKEN: token }, sdk);
        for (const path of ['https://attacker.example/steal', '../secret', 'other-folder/full.png']) {
            await expect(store.put(path, Buffer.from('x'))).rejects.toMatchObject({ status: 400 });
            await expect(store.get(path)).rejects.toMatchObject({ status: 400 });
            await expect(store.delete(path)).rejects.toMatchObject({ status: 400 });
        }
        expect(sdk.put).not.toHaveBeenCalled(); expect(sdk.get).not.toHaveBeenCalled(); expect(sdk.del).not.toHaveBeenCalled();
    });
    it('treats missing/conditional responses as unavailable and bounds actual response bytes', async () => {
        const sdk = sdkWithBytes(Buffer.alloc(LIMITS.imageBytes + 1)); const store = createVercelBlobImageStore({ BLOB_READ_WRITE_TOKEN: token }, sdk);
        sdk.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ statusCode: 304, stream: null });
        await expect(store.get(key())).rejects.toMatchObject({ code: 'image_unavailable' });
        await expect(store.get(key())).rejects.toMatchObject({ code: 'image_unavailable' });
        // Metadata cannot override the hard streaming limit.
        sdk.get.mockResolvedValueOnce({ statusCode: 200, stream: new Blob([Buffer.alloc(LIMITS.imageBytes + 1)]).stream(), blob: { size: 1 } });
        await expect(store.get(key())).rejects.toMatchObject({ code: 'image_unavailable' });
    });
    it('does not accept provider-renamed paths or missing credentials', async () => {
        expect(() => createVercelBlobImageStore({})).toThrow('not configured');
        const sdk = sdkWithBytes(Buffer.from('x')); sdk.put.mockResolvedValue({ pathname: 'unexpected.png' });
        const store = createVercelBlobImageStore({ BLOB_READ_WRITE_TOKEN: token }, sdk);
        await expect(store.put(key(), Buffer.from('x'))).rejects.toMatchObject({ code: 'image_unavailable' });
    });
});
