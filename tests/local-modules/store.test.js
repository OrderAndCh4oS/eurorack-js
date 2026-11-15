import { describe, expect, it, vi } from 'vitest';
import { LocalModuleStore, LOCAL_MODULE_STORAGE_KEY, LOCAL_MODULE_LIMITS } from '../../src/js/local-modules/store.js';

function fixture() {
    const data = new Map();
    const storage = {
        getItem: vi.fn(key => data.get(key) ?? null),
        setItem: vi.fn((key, value) => data.set(key, value))
    };
    let next = 0;
    const createId = vi.fn(async () => String(++next).padStart(26, '0'));
    return { data, storage, createId, store: new LocalModuleStore({ storage, createId }) };
}

describe('LocalModuleStore', () => {
    it('stores inert drafts, restores them, and returns independent snapshots', async () => {
        const { store, storage, createId } = fixture();
        const record = await store.create({ name: ' My module ', source: 'throw new Error("not executed")' });
        expect(record.name).toBe('My module');
        expect(record.id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
        record.source = 'changed returned object';
        expect(store.get(record.id).source).toContain('not executed');
        const restored = new LocalModuleStore({ storage, createId });
        expect(restored.list()).toEqual(store.list());
        const list = restored.list();
        list[0].revisions.push({ id: 'invalid' });
        expect(store.get(record.id).revisions).toEqual([]);
        expect(store.get('missing')).toBeNull();
        expect(store.getRevision('missing')).toBeNull();
    });

    it('preserves immutable source revisions while the draft is edited', async () => {
        const { store } = fixture();
        const draft = await store.create({ name: 'Utility', source: 'export default { original: true }' });
        const first = await store.saveRevision(draft.id);
        expect(await store.saveRevision(draft.id)).toEqual(first);
        store.save(draft.id, { source: 'export default { updated: true }' });
        const second = await store.saveRevision(draft.id);
        expect(second.id).not.toBe(first.id);
        expect(store.getRevision(first.id)).toEqual(first);
        expect(store.get(draft.id).revisions).toHaveLength(2);
        second.source = 'mutated';
        expect(store.getRevision(second.id).source).toContain('updated');
        store.save(draft.id, { source: first.source });
        expect(await store.saveRevision(draft.id)).toEqual(first);
    });

    it('handles overlapping ID creation without losing drafts or duplicating a revision', async () => {
        const { store } = fixture();
        const [a, b] = await Promise.all([
            store.create({ name: 'A', source: '' }), store.create({ name: 'B', source: '' })
        ]);
        expect(store.list().map(item => item.id)).toEqual([a.id, b.id]);
        const [one, two] = await Promise.all([store.saveRevision(a.id), store.saveRevision(a.id)]);
        expect(one).toEqual(two);
        expect(store.get(a.id).revisions).toHaveLength(1);
    });

    it('does not activate a stale draft if it changes while a revision ID is awaited', async () => {
        const { store, createId } = fixture();
        const draft = await store.create({ name: 'A', source: 'first' });
        let resolveId;
        createId.mockImplementationOnce(() => new Promise(resolve => { resolveId = resolve; }));
        const pending = store.saveRevision(draft.id);
        store.save(draft.id, { source: 'second' });
        resolveId('00000000000000000000000002');
        await expect(pending).rejects.toThrow('changed while preparing');
        expect(store.get(draft.id).source).toBe('second');
        expect(store.get(draft.id).revisions).toEqual([]);
    });

    it.each(['{broken', '{"version":2,"modules":[]}', '{"version":1,"modules":[{}]}'])(
        'preserves malformed storage instead of silently resetting it: %s', async raw => {
            const { data, store, storage } = fixture();
            data.set(LOCAL_MODULE_STORAGE_KEY, raw);
            expect(() => store.list()).toThrow('Saved data has not been changed');
            await expect(store.create({ name: 'A', source: '' })).rejects.toThrow('Saved data has not been changed');
            expect(data.get(LOCAL_MODULE_STORAGE_KEY)).toBe(raw);
            expect(storage.setItem).not.toHaveBeenCalled();
        }
    );

    it('rejects duplicate IDs in persisted records and never repairs them destructively', async () => {
        const { store, data } = fixture();
        const draft = await store.create({ name: 'A', source: '' });
        const raw = JSON.stringify({ version: 1, modules: [draft, draft] });
        data.set(LOCAL_MODULE_STORAGE_KEY, raw);
        expect(() => store.save(draft.id, { source: 'replacement' })).toThrow('Saved data has not been changed');
        expect(data.get(LOCAL_MODULE_STORAGE_KEY)).toBe(raw);
    });

    it('enforces UTF-8 source and total storage quotas before writing', async () => {
        const { store, data, storage } = fixture();
        await expect(store.create({ name: 'Big', source: 'é'.repeat(LOCAL_MODULE_LIMITS.sourceBytes / 2 + 1) })).rejects.toThrow('256 KiB');
        expect(storage.setItem).not.toHaveBeenCalled();
        const draft = await store.create({ name: 'Large history', source: 'a'.repeat(230 * 1024) });
        let previous;
        let rejected = false;
        for (let i = 0; i < 12; i++) {
            store.save(draft.id, { source: String(i).padStart(2, '0') + 'a'.repeat(230 * 1024) });
            previous = data.get(LOCAL_MODULE_STORAGE_KEY);
            try { await store.saveRevision(draft.id); }
            catch (error) {
                expect(error.message).toContain('2 MiB');
                expect(data.get(LOCAL_MODULE_STORAGE_KEY)).toBe(previous);
                rejected = true;
                break;
            }
        }
        expect(rejected).toBe(true);
    });

    it('notifies only after durable writes and leaves previous data intact on storage failure', async () => {
        const { store, storage, data } = fixture();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        const draft = await store.create({ name: 'A', source: 'original' });
        expect(listener).toHaveBeenCalledOnce();
        const raw = data.get(LOCAL_MODULE_STORAGE_KEY);
        storage.setItem.mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
        expect(() => store.save(draft.id, { source: 'new' })).toThrow('previous modules are unchanged');
        expect(listener).toHaveBeenCalledOnce();
        expect(data.get(LOCAL_MODULE_STORAGE_KEY)).toBe(raw);
        unsubscribe();
        store.save(draft.id, { source: '' });
        expect(listener).toHaveBeenCalledOnce();
    });

    it('rejects invalid generated IDs without writes', async () => {
        const { store, createId, storage } = fixture();
        createId.mockResolvedValueOnce('not-a-ulid');
        await expect(store.create({ name: 'A', source: '' })).rejects.toThrow('valid module ID');
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});
