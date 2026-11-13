// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createPersistentPreviewCache } from '../../src/js/patches/preview-cache.js';
import { createPatchPreviewService } from '../../src/js/patches/patch-preview.js';

const patch = level => ({ version: 3, plugins: { core: 1 }, modules: [{ id: 'vco1', type: 'vco', row: 1, index: 0 }], params: { vco1: { level } }, cables: [], midiMappings: {} });
const png = () => new Blob(['png'], { type: 'image/png' });

function storageFixture() {
    const records = new Map();
    return { records, storage: { open: async () => ({
        match: async key => records.get(key)?.clone(),
        put: async (key, value) => { records.set(key, value); },
        delete: async key => records.delete(key),
        keys: async () => [...records.keys()]
    }) } };
}

describe('local rack preview persistence', () => {
    it('reuses a local thumbnail across service lifetimes without recapturing the rack', async () => {
        const { storage } = storageFixture();
        const capture = vi.fn(async () => png());
        const create = () => createPatchPreviewService({ capture, persistentCache: createPersistentPreviewCache({ storage, origin: 'https://example.test' }), createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} });
        await create().getPatchPreviewObjectUrl(patch(0.5), { persistent: true, maxWidth: 640 });
        await create().getPatchPreviewObjectUrl(patch(0.5), { persistent: true, maxWidth: 640 });
        expect(capture).toHaveBeenCalledTimes(1);
        await create().getPatchPreviewObjectUrl(patch(0.7), { persistent: true, maxWidth: 640 });
        await create().getPatchPreviewObjectUrl(patch(0.5), { persistent: true, maxWidth: 320 });
        expect(capture).toHaveBeenCalledTimes(3);
    });

    it('does not persist images unless the local/test caller opts in', async () => {
        const persistentCache = { get: vi.fn(), put: vi.fn() };
        const service = createPatchPreviewService({ capture: async () => png(), persistentCache, createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} });
        await service.getPatchPreviewObjectUrl(patch(0.5));
        expect(persistentCache.get).not.toHaveBeenCalled();
        expect(persistentCache.put).not.toHaveBeenCalled();
    });

    it('bounds persistent entries and bytes and tolerates blocked browser storage', async () => {
        const { storage, records } = storageFixture();
        const cache = createPersistentPreviewCache({ storage, origin: 'https://example.test', maxEntries: 2, maxBytes: 5 });
        await cache.put('first', png());
        await cache.put('second', png());
        expect(records.size).toBe(1);
        expect(await cache.get('first')).toBeNull();
        expect((await cache.get('second')).size).toBe(3);
        const blocked = createPersistentPreviewCache({ storage: { open: async () => { throw new Error('Storage denied'); } }, origin: 'https://example.test' });
        expect(await blocked.get('a')).toBeNull();
        await expect(blocked.put('a', png())).resolves.toBeUndefined();
    });

    it('lets a new gallery consume an in-flight capture after the old view is cancelled', async () => {
        let finish;
        const capture = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        const service = createPatchPreviewService({ capture, createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} });
        const controller = new AbortController();
        const first = service.getPatchPreviewObjectUrl(patch(0.5), { signal: controller.signal });
        const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
        controller.abort();
        const second = service.getPatchPreviewObjectUrl(patch(0.5));
        finish(png());
        await cancelled;
        expect(await second).toBe('blob:preview');
        expect(capture).toHaveBeenCalledTimes(1);
    });
});
