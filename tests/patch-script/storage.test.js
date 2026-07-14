import { describe, expect, it } from 'vitest';
import { PatchScriptStore, PATCH_SCRIPT_STORAGE_KEY } from '../../src/js/patch-script/storage.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        values
    };
}

describe('patch script storage', () => {
    it('creates, updates, selects, and removes named scripts', () => {
        const storage = memoryStorage();
        const store = new PatchScriptStore(storage);
        const script = store.create('Voice', 'patch()');
        store.update(script.id, { name: 'Bass', source: 'patch().module("vco", "osc")' });

        expect(store.get(script.id)).toMatchObject({ name: 'Bass', source: 'patch().module("vco", "osc")' });
        expect(JSON.parse(storage.values.get(PATCH_SCRIPT_STORAGE_KEY)).version).toBe(1);
        expect(store.remove(script.id)).toBe(true);
        expect(store.list()).toEqual([]);
    });

    it('recovers from malformed storage', () => {
        const store = new PatchScriptStore(memoryStorage({ [PATCH_SCRIPT_STORAGE_KEY]: '{broken' }));
        expect(store.list()).toEqual([]);
        expect(store.data.version).toBe(1);
    });
});
