import { PATCH_STORAGE_KEY } from '../config/constants.js';
import { normalizePatch } from '../app/patch-format.js';

// Keep the original name-keyed bank readable. Unsupported entries are preserved
// for export, never removed just because today's registry cannot open them.
export class LocalPatchStore {
    constructor(storage) { this.suppliedStorage = storage; }
    get storage() { return this.suppliedStorage || globalThis.localStorage; }
    read() {
        const raw = this.storage.getItem(PATCH_STORAGE_KEY);
        if (!raw) return {};
        const value = JSON.parse(raw);
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Could not read your browser patches.');
        return value;
    }
    write(patches) { this.storage.setItem(PATCH_STORAGE_KEY, JSON.stringify(patches)); }
    list() { return Object.entries(this.read()).map(([key, patch]) => ({ ...patch, key, source: 'local', canEdit: true })); }
    save({ name, state, id, provenance }, { key, copy = false } = {}) {
        name = name.trim(); if (!name) throw new Error('Enter a patch name.');
        const patches = this.read();
        if ((copy || key !== name) && Object.hasOwn(patches, name)) throw new Error('A patch with this name already exists. Choose another name.');
        const old = key ? patches[key] : patches[name];
        const patch = { name, factory: false, id: id || old?.id, created: old?.created || new Date().toISOString(), state: normalizePatch(state),
            ...(provenance ? { provenance: { ...provenance, verified: false } } : {}) };
        if (key && key !== name) delete patches[key];
        Object.defineProperty(patches, name, { value: patch, enumerable: true, writable: true, configurable: true });
        this.write(patches); return { ...patch, key: name, source: 'local', canEdit: true };
    }
    async saveWithPreviews(input, options, loadPreview = () => import('./patch-preview.js')) {
        const patch = this.save(input, options);
        try {
            const preview = await loadPreview();
            await preview.cacheLocalPatchPreviews(patch.state);
            return { patch, previewsReady: true };
        } catch {
            // The rack was saved even when the browser could not render its images.
            return { patch, previewsReady: false };
        }
    }
    remove(key) { const patches = this.read(); delete patches[key]; this.write(patches); }
}
