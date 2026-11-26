import { createPersistentPreviewCache, hashPreviewKey } from './preview-cache.js';
import { PATCH_LIMITS } from './limits.js';

export const PATCH_PREVIEW_RENDERER_VERSION = 'rack-industrial-v3';
export const PATCH_PREVIEW_MODES = Object.freeze(['light', 'dark']);
export const PATCH_THUMBNAIL_OPTIONS = Object.freeze({ maxWidth: 640, maxHeight: 480 });
export const PATCH_PREVIEW_LIMITS = Object.freeze({
    maxWidth: 1600,
    maxHeight: 1600,
    maxPixels: 2560000,
    timeoutMs: 45000,
    cacheEntries: 96,
    cacheBytes: 24 * 1024 * 1024
});

function aborted(signal) {
    if (signal?.aborted) throw signal.reason || new DOMException('Preview cancelled', 'AbortError');
}

function previewKey(state, options) {
    const version = state.modules.some(module => module.type === 'spacer')
        ? PATCH_PREVIEW_RENDERER_VERSION + '/spacer-prints-2' : PATCH_PREVIEW_RENDERER_VERSION;
    return JSON.stringify([version, options.mode || 'light', options.maxWidth, options.maxHeight, options.maxPixels, state]);
}

export async function getTestPatchPreview(state, name, mode = 'light') {
    const { TEST_PATCH_PREVIEWS } = await import('../config/test-patch-previews.js');
    const preview = TEST_PATCH_PREVIEWS[name]?.[mode];
    if (!preview || preview.rendererVersion !== PATCH_PREVIEW_RENDERER_VERSION) return null;
    const key = await getThumbnailCacheKey(state, mode);
    return key === preview.key ? { ...preview, url: new URL(`../../patch-previews/${preview.file}`, import.meta.url).href } : null;
}

export function getThumbnailCacheKey(state, mode = 'light') {
    return hashPreviewKey(previewKey(snapshotPatchPreview(state), { ...PATCH_THUMBNAIL_OPTIONS, mode }));
}

function waitForPreview(promise, signal) {
    if (!signal) return promise;
    aborted(signal);
    return new Promise((resolve, reject) => {
        const cancel = () => reject(signal.reason || new DOMException('Preview cancelled', 'AbortError'));
        signal.addEventListener('abort', cancel, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
    });
}

export function getPreviewDimensions(width, height, options = {}) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Preview dimensions must be positive finite numbers');
    }
    const limit = (name, fallback) => {
        const value = options[name] ?? fallback;
        if (!Number.isFinite(value) || value < 1) throw new Error(`Invalid preview ${name}`);
        return Math.min(value, fallback);
    };
    const maxWidth = limit('maxWidth', PATCH_PREVIEW_LIMITS.maxWidth);
    const maxHeight = limit('maxHeight', PATCH_PREVIEW_LIMITS.maxHeight);
    const maxPixels = limit('maxPixels', PATCH_PREVIEW_LIMITS.maxPixels);
    const scale = Math.min(1, maxWidth / width, maxHeight / height, Math.sqrt(maxPixels / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function snapshotPatchPreview(value) {
    const state = structuredClone(value?.state || value);
    if (!state || state.version !== 3 || !Array.isArray(state.modules) || !Array.isArray(state.cables)) {
        throw new Error('A version 3 patch is required for a preview');
    }
    if (state.modules.length > PATCH_LIMITS.modules || state.cables.length > PATCH_LIMITS.cables) throw new Error('Patch exceeds preview limits');
    for (const module of state.modules) {
        if (!Number.isInteger(module.row) || module.row < 1 || module.row > PATCH_LIMITS.rows) throw new Error('Invalid preview rack row');
    }
    return state;
}

async function captureInFrame(state, options = {}, documentRef = document) {
    aborted(options.signal);
    const frame = documentRef.createElement('iframe');
    frame.title = 'Patch preview renderer';
    frame.dataset.patchPreviewFrame = 'true';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;height:1600px;border:0;pointer-events:none;';
    frame.src = new URL('../../patch-preview.html', import.meta.url).href;
    let timer;
    let onAbort;
    try {
        return await new Promise((resolve, reject) => {
            const fail = error => reject(error);
            onAbort = () => fail(options.signal.reason || new DOMException('Preview cancelled', 'AbortError'));
            options.signal?.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => fail(Object.assign(new Error('Patch preview timed out'), { code: 'preview-timeout' })), PATCH_PREVIEW_LIMITS.timeoutMs);
            frame.addEventListener('error', () => fail(new Error('Unable to load patch preview renderer')), { once: true });
            frame.addEventListener('load', async () => {
                try {
                    aborted(options.signal);
                    // The URL is fixed to our own origin. Direct access deliberately
                    // avoids accepting patch data through a public message listener.
                    const renderer = frame.contentWindow?.eurorackPatchPreview;
                    if (renderer?.version !== PATCH_PREVIEW_RENDERER_VERSION) {
                        throw new Error('Patch preview renderer is unavailable');
                    }
                    const blob = await renderer.capture(state, {
                        mode: options.mode,
                        maxWidth: options.maxWidth,
                        maxHeight: options.maxHeight,
                        maxPixels: options.maxPixels
                    });
                    aborted(options.signal);
                    if (!blob || blob.type !== 'image/png' || blob.size === 0) throw new Error('Patch preview was empty');
                    resolve(blob);
                } catch (error) {
                    // Some image decoders reject with an Event that has no message.
                    fail(error?.message ? error : new Error('Unable to render the patch preview', { cause: error }));
                }
            }, { once: true });
            documentRef.body.appendChild(frame);
        });
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        try {
            frame.contentWindow?.eurorackPatchPreview?.dispose?.();
        } finally {
            frame.remove();
        }
    }
}

export function createPatchPreviewService({
    capture = captureInFrame,
    createObjectURL = blob => URL.createObjectURL(blob),
    revokeObjectURL = url => URL.revokeObjectURL(url),
    maxEntries = PATCH_PREVIEW_LIMITS.cacheEntries,
    maxBytes = PATCH_PREVIEW_LIMITS.cacheBytes,
    persistentCache = createPersistentPreviewCache()
} = {}) {
    let queue = Promise.resolve();
    let generation = 0;
    let bytes = 0;
    const cache = new Map();

    function capturePatchPreview(state, options = {}) {
        const snapshot = snapshotPatchPreview(state);
        const run = queue.then(() => {
            aborted(options.signal);
            return capture(snapshot, options);
        });
        queue = run.catch(() => {});
        return run;
    }

    function removeEntry(key) {
        const entry = cache.get(key);
        if (!entry) return;
        cache.delete(key);
        entry.controller.abort();
        if (entry.url) {
            bytes -= entry.size;
            revokeObjectURL(entry.url);
        }
    }

    async function getPatchPreviewObjectUrl(state, options = {}) {
        aborted(options.signal);
        const snapshot = snapshotPatchPreview(state);
        const key = previewKey(snapshot, options);
        let entry = cache.get(key);
        if (entry) {
            cache.delete(key);
            cache.set(key, entry);
            return waitForPreview(entry.promise, options.signal);
        }
        const startedAt = generation;
        entry = { size: 0, url: null, promise: null, controller: new AbortController() };
        // A view change cancels that consumer, not the shared capture. A quick
        // return to the gallery can reuse its in-flight work and cached result.
        entry.promise = (async () => {
            const diskKey = options.persistent ? await hashPreviewKey(key) : null;
            let blob = diskKey ? await persistentCache.get(diskKey) : null;
            aborted(entry.controller.signal);
            if (!blob) {
                blob = await capturePatchPreview(snapshot, { ...options, signal: entry.controller.signal });
                aborted(entry.controller.signal);
                if (diskKey) await persistentCache.put(diskKey, blob);
            }
            return blob;
        })().then(blob => {
            if (startedAt !== generation || cache.get(key) !== entry) {
                throw new DOMException('Preview cache cleared', 'AbortError');
            }
            entry.url = createObjectURL(blob);
            entry.size = blob.size;
            bytes += blob.size;
            let complete = [...cache.entries()].filter(([, cached]) => cached.url);
            while (complete.length > maxEntries || (bytes > maxBytes && complete.length > 1)) {
                removeEntry(complete[0][0]);
                complete = complete.slice(1);
            }
            return entry.url;
        }).catch(error => {
            if (cache.get(key) === entry) removeEntry(key);
            throw error;
        });
        cache.set(key, entry);
        return waitForPreview(entry.promise, options.signal);
    }

    function clearPatchPreviewCache() {
        generation += 1;
        [...cache.keys()].forEach(removeEntry);
    }

    return { capturePatchPreview, getPatchPreviewObjectUrl, clearPatchPreviewCache };
}

const previews = createPatchPreviewService();
export const capturePatchPreview = previews.capturePatchPreview;
export const getPatchPreviewObjectUrl = previews.getPatchPreviewObjectUrl;
export const clearPatchPreviewCache = previews.clearPatchPreviewCache;

export function cacheLocalPatchPreviews(state) {
    return Promise.all(PATCH_PREVIEW_MODES.map(mode =>
        getPatchPreviewObjectUrl(state, { ...PATCH_THUMBNAIL_OPTIONS, mode, persistent: true })));
}
