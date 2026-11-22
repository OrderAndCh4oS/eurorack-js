import { describe, expect, it, vi } from 'vitest';
import {
    createPatchPreviewService,
    getPreviewDimensions,
    PATCH_PREVIEW_LIMITS,
    PATCH_PREVIEW_RENDERER_VERSION,
    snapshotPatchPreview
} from '../../src/js/patches/patch-preview.js';

function patch(level = 0.5) {
    return {
        version: 3,
        plugins: { core: 1 },
        modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
        params: { vco_1: { level } },
        cables: [],
        midiMappings: {}
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

describe('patch preview capture service', () => {
    it('identifies a stalled frame as a preview timeout and removes it', async () => {
        vi.useFakeTimers();
        try {
            const service = createPatchPreviewService();
            const failed = expect(service.capturePatchPreview(patch())).rejects.toMatchObject({ code: 'preview-timeout' });
            await Promise.resolve();
            expect(document.querySelector('[data-patch-preview-frame]')).not.toBeNull();
            await vi.advanceTimersByTimeAsync(PATCH_PREVIEW_LIMITS.timeoutMs);
            await failed;
            expect(document.querySelector('[data-patch-preview-frame]')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('reports an image decoder failure even when the browser rejects with a DOM event', async () => {
        const service = createPatchPreviewService();
        const failed = expect(service.capturePatchPreview(patch())).rejects.toThrow('Unable to render the patch preview');
        await Promise.resolve();
        const frame = document.querySelector('[data-patch-preview-frame]');
        frame.contentWindow.eurorackPatchPreview = {
            version: PATCH_PREVIEW_RENDERER_VERSION,
            capture: async () => { throw new Event('error'); }
        };
        frame.dispatchEvent(new Event('load'));
        await failed;
    });

    it('captures the immutable requested state and serializes rendering jobs', async () => {
        const first = deferred();
        const blob = new Blob(['png'], { type: 'image/png' });
        const capture = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(blob);
        const service = createPatchPreviewService({ capture });
        const state = patch();
        const a = service.capturePatchPreview(state);
        state.params.vco_1.level = 0.9;
        const b = service.capturePatchPreview(state);
        await Promise.resolve();
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture.mock.calls[0][0].params.vco_1.level).toBe(0.5);
        first.resolve(blob);
        await Promise.all([a, b]);
        expect(capture).toHaveBeenCalledTimes(2);
        expect(capture.mock.calls[1][0].params.vco_1.level).toBe(0.9);
    });

    it('skips a queued capture cancelled before it starts', async () => {
        const first = deferred();
        const capture = vi.fn().mockImplementation(() => first.promise);
        const service = createPatchPreviewService({ capture });
        const a = service.capturePatchPreview(patch());
        const controller = new AbortController();
        const b = service.capturePatchPreview(patch(0.2), { signal: controller.signal });
        const rejected = expect(b).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        first.resolve(new Blob(['png'], { type: 'image/png' }));
        await a;
        await rejected;
        expect(capture).toHaveBeenCalledTimes(1);
    });

    it('reuses images for matching state and revokes bounded least-recently-used URLs', async () => {
        const capture = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
        const createObjectURL = vi.fn().mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b');
        const revokeObjectURL = vi.fn();
        const service = createPatchPreviewService({ capture, createObjectURL, revokeObjectURL, maxEntries: 1 });
        expect(await service.getPatchPreviewObjectUrl(patch())).toBe('blob:a');
        expect(await service.getPatchPreviewObjectUrl(patch())).toBe('blob:a');
        expect(capture).toHaveBeenCalledTimes(1);
        expect(await service.getPatchPreviewObjectUrl(patch(0.2))).toBe('blob:b');
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:a');
        service.clearPatchPreviewCache();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:b');
    });

    it('does not cache a late image after the account cache has been cleared', async () => {
        const pending = deferred();
        const createObjectURL = vi.fn();
        const service = createPatchPreviewService({ capture: () => pending.promise, createObjectURL });
        const image = service.getPatchPreviewObjectUrl(patch());
        const rejected = expect(image).rejects.toMatchObject({ name: 'AbortError' });
        service.clearPatchPreviewCache();
        pending.resolve(new Blob(['png'], { type: 'image/png' }));
        await rejected;
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('preserves aspect ratio while bounding dimensions and pixels', () => {
        expect(getPreviewDimensions(1528, 780)).toEqual({ width: 1528, height: 780 });
        expect(getPreviewDimensions(1528, 12000)).toEqual({ width: 203, height: 1600 });
        const limited = getPreviewDimensions(1528, 780, { maxPixels: 100000 });
        expect(limited.width * limited.height).toBeLessThanOrEqual(100000);
        expect(limited.width / limited.height).toBeCloseTo(1528 / 780, 1);
        expect(() => getPreviewDimensions(Infinity, 100)).toThrow();
        expect(() => getPreviewDimensions(100, 100, { maxHeight: 0 })).toThrow();
    });

    it('rejects unbounded rack shapes before creating a preview frame', () => {
        const state = patch();
        state.modules[0].row = 1000000;
        expect(() => snapshotPatchPreview(state)).toThrow('Invalid preview rack row');
        expect(() => snapshotPatchPreview({ version: 2 })).toThrow('version 3');
    });
});
