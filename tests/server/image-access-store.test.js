// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { ulid } from 'ulid';
import { MemoryStore } from '../../server/memory-store.js';
import { PostgresStore } from '../../server/postgres-store.js';

const ownerId = `image-access-${ulid()}`;
function fixture() {
    const previewId = ulid(), patchId = ulid();
    const preview = { id: previewId, ownerId, stateHash: 'rack-one', variants: {
        thumbnail: { key: `rack-previews/${previewId}/thumbnail.png`, bytes: 200, width: 640, height: 400 }
    } };
    const patch = { id: patchId, ownerId, visibility: 'public', previewId, stateHash: preview.stateHash,
        requestId: ulid(), requestHash: 'request-one', state: { modules: ['not-needed-for-image-access'] } };
    return { patch, preview };
}
async function seed(store, record = fixture()) {
    await store.transaction(async tx => { await tx.putPreview(record.preview); await tx.putPatch(record.patch); });
    return record;
}
function accessContract(getStore) {
    it('returns only current matching image metadata and reflects privacy changes', async () => {
        const store = getStore(), { patch, preview } = await seed(store);
        expect(await store.getImageAccess(patch.id, preview.id)).toEqual({ ownerId, visibility: 'public',
            previewId: preview.id, stateHash: patch.stateHash, variants: preview.variants });
        expect(await store.getImageAccess(patch.id, ulid())).toBeUndefined();
        await store.transaction(tx => tx.putPatch({ ...patch, visibility: 'private' }));
        expect((await store.getImageAccess(patch.id, preview.id)).visibility).toBe('private');
        await store.transaction(tx => tx.putPatch({ ...patch, stateHash: 'edited-rack' }));
        expect(await store.getImageAccess(patch.id, preview.id)).toBeUndefined();
        await store.transaction(tx => tx.putPatch(patch));
        await store.transaction(tx => tx.deletePreview(preview.id));
        expect(await store.getImageAccess(patch.id, preview.id)).toBeUndefined();
        await store.transaction(tx => tx.putPreview(preview));
        await store.transaction(tx => tx.deletePatch(patch.id));
        expect(await store.getImageAccess(patch.id, preview.id)).toBeUndefined();
    });
    it('batches personalised counts including zero-like patches and anonymous users', async () => {
        const store = getStore(), first = await seed(store), second = await seed(store), third = await seed(store);
        const ids = [first.patch.id, second.patch.id, third.patch.id];
        await store.transaction(async tx => {
            await tx.setLike(ids[0], 'alice', true); await tx.setLike(ids[0], 'bob', true); await tx.setLike(ids[1], 'bob', true);
            expect(await tx.likesFor(ids, 'alice')).toEqual(new Map([
                [ids[0], { likeCount: 2, likedByMe: true }], [ids[1], { likeCount: 1, likedByMe: false }], [ids[2], { likeCount: 0, likedByMe: false }]
            ]));
        });
        expect([...((await store.likesFor(ids)).values())].every(value => !value.likedByMe)).toBe(true);
        expect(await store.likesFor([], 'alice')).toEqual(new Map());
    });
    it('selects bounded oldest unused previews while retaining active and recent uploads', async () => {
        const store = getStore(), before = '2026-11-14T00:00:00.000Z';
        const active = fixture(); active.preview.createdAt = '2026-11-10T00:00:00.000Z';
        await seed(store, active);
        const unused = [];
        await store.transaction(async tx => {
            for (let i = 0; i < 28; i++) {
                const preview = fixture().preview;
                preview.createdAt = new Date(Date.UTC(2026, 10, 11, i)).toISOString();
                unused.push(preview); await tx.putPreview(preview);
            }
            for (const createdAt of [before, '2026-11-14T01:00:00.000Z']) {
                await tx.putPreview({ ...fixture().preview, createdAt });
            }
            expect(await tx.listUnusedPreviews(before, 2)).toEqual(unused.slice(0, 2));
            const batch = await tx.listUnusedPreviews(before);
            expect(batch).toEqual(unused.slice(0, 25));
            for (const preview of batch) await tx.deletePreview(preview.id);
        });
        expect(await store.transaction(tx => tx.listUnusedPreviews(before))).toEqual(unused.slice(25));
        expect(await store.getPreview(active.preview.id)).toEqual(active.preview);
        for (const limit of [0, -1, 1.5, 26]) await expect(store.listUnusedPreviews(before, limit)).rejects.toThrow(RangeError);
    });
    it('bounds garbage selection and leaves the remaining queue available', async () => {
        const store = getStore(), prefix = `cleanup-${ulid()}`;
        const keys = Array.from({ length: 78 }, (_, index) => `${prefix}/${String(index).padStart(3, '0')}`);
        try {
            await store.transaction(async tx => { for (const key of keys) await tx.addGarbage(key); });
            expect(await store.listGarbage(2)).toEqual(keys.slice(0, 2));
            const batch = await store.listGarbage(); expect(batch).toEqual(keys.slice(0, 75));
            await store.transaction(async tx => { for (const key of batch) await tx.deleteGarbage(key); });
            expect(await store.listGarbage()).toEqual(keys.slice(75));
            for (const limit of [0, -1, 1.5, 76]) await expect(store.listGarbage(limit)).rejects.toThrow(RangeError);
        } finally { await store.transaction(async tx => { for (const key of keys) await tx.deleteGarbage(key); }); }
    });
}

describe('memory image access and batch likes', () => {
    accessContract(() => new MemoryStore());
    it.each([false, true])('waits for pending mutations without leaking uncommitted data (rollback=%s)', async rollback => {
        const store = new MemoryStore(), { patch, preview } = await seed(store);
        let release, changed;
        const gate = new Promise(resolve => { release = resolve; });
        const changeStarted = new Promise(resolve => { changed = resolve; });
        const mutation = store.transaction(async tx => {
            await tx.putPatch({ ...patch, visibility: 'private' }); changed(); await gate;
            if (rollback) throw new Error('rolled back');
        });
        const mutationResult = mutation.catch(error => error);
        await changeStarted;
        const resolved = vi.fn();
        const reading = store.getImageAccess(patch.id, preview.id).then(value => { resolved(); return value; });
        await new Promise(resolve => setImmediate(resolve));
        expect(resolved).not.toHaveBeenCalled();
        release(); await mutationResult;
        const access = await reading;
        expect(access.visibility).toBe(rollback ? 'public' : 'private');
        access.variants.thumbnail.bytes = 0;
        expect((await store.getImageAccess(patch.id, preview.id)).variants.thumbnail.bytes).toBe(200);
    });
});

describe('PostgreSQL image read query budget', () => {
    it('reads image metadata using one query without acquiring a transaction connection', async () => {
        const pool = { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn() }, store = new PostgresStore(pool);
        expect(await store.getImageAccess('patch', 'preview')).toBeUndefined();
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][1]).toEqual(['patch', 'preview']);
        expect(pool.connect).not.toHaveBeenCalled();
    });
    it('reads a page of like counts with one query and none for an empty page', async () => {
        const pool = { query: vi.fn(async () => ({ rows: [{ patch_id: 'one', likeCount: 2, likedByMe: true }] })) }, store = new PostgresStore(pool);
        expect(await store.likesFor(['one', 'two'], 'alice')).toEqual(new Map([
            ['one', { likeCount: 2, likedByMe: true }], ['two', { likeCount: 0, likedByMe: false }]
        ]));
        expect(pool.query).toHaveBeenCalledTimes(1);
        await store.likesFor([], 'alice');
        expect(pool.query).toHaveBeenCalledTimes(1);
    });
});

const databaseUrl = process.env.TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)('real PostgreSQL image-access snapshots', () => {
    let pool, store;
    beforeAll(async () => {
        const parsed = new URL(databaseUrl);
        if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/eurorack_test') throw new Error('Integration tests require a dedicated local eurorack_test database.');
        pool = new Pool({ connectionString: databaseUrl, max: 3 });
        await pool.query(await readFile(new URL('../../db/001-patches.sql', import.meta.url), 'utf8'));
        store = new PostgresStore(pool);
    });
    afterAll(async () => {
        if (!pool) return;
        try {
            await pool.query("DELETE FROM patch_records WHERE data->>'ownerId'=$1", [ownerId]);
            await pool.query('DELETE FROM patch_requests WHERE owner_id=$1', [ownerId]);
            await pool.query("DELETE FROM patch_previews WHERE data->>'ownerId'=$1", [ownerId]);
        } finally { await pool.end(); }
    });
    accessContract(() => store);
    it('does not queue image reads behind the application write lock and observes the next committed visibility', async () => {
        const { patch, preview } = await seed(store);
        const writer = await pool.connect();
        try {
            await writer.query('BEGIN'); await writer.query('SELECT pg_advisory_xact_lock(716335822)');
            await writer.query("UPDATE patch_records SET data=jsonb_set(data,'{visibility}','\"private\"'::jsonb) WHERE id=$1", [patch.id]);
            // A transaction-based read would deadlock here until this writer commits.
            const access = await Promise.race([
                store.getImageAccess(patch.id, preview.id),
                new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Image read waited for the write lock')), 1500); timer.unref(); })
            ]);
            expect(access.visibility).toBe('public');
            await writer.query('COMMIT');
            expect((await store.getImageAccess(patch.id, preview.id)).visibility).toBe('private');
        } finally { await writer.query('ROLLBACK'); writer.release(); }
    });
});
