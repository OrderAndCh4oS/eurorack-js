// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { monotonicFactory } from 'ulid';
import { MemoryStore } from '../../server/memory-store.js';
import { createPatchService } from '../../server/patch-service.js';
import { createHandler } from '../../server/handler.js';

const DAY = 86400000;
const alice = { id: 'alice', name: 'Alice' }, bob = { id: 'bob', name: 'Bob' };
let store, service, clock, makeId, sequence;
beforeEach(() => {
    store = new MemoryStore(); clock = new Date('2026-11-14T12:00:00.000Z'); makeId = monotonicFactory(); sequence = 0;
    service = createPatchService({ store, now: () => clock });
});
async function patch(name, extra = {}) {
    const id = makeId(Date.parse('2024-01-01') + sequence++);
    const record = { id, name, ownerId: alice.id, authorName: alice.name, description: '', revision: 1, visibility: 'public',
        createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', rootId: id, requestId: id,
        state: { modules: [] }, ...extra };
    await store.putPatch(record); return record;
}
async function votes(record, count, ageDays = 0) {
    for (let i = 0; i < count; i++) await store.setLike(record.id, `voter-${i}`, true, new Date(clock.getTime() - ageDays * DAY).toISOString());
}
const names = page => page.patches.map(p => p.name);

describe('catalogue ranking and keyset pages', () => {
    it('ranks by likes received in each rolling period, including likes on older patches', async () => {
        const timing = [['Day', 1, 0.5], ['Week', 2, 3], ['Month', 3, 15], ['Year', 4, 180], ['All time', 5, 500]];
        for (const [name, count, age] of timing) await votes(await patch(name), count, age);
        for (const [index, period] of ['day', 'week', 'month', 'year', 'all'].entries()) {
            const result = await service.list({ publicOnly: true, sort: 'popular', period });
            expect(result.patches[0]).toMatchObject({ name: timing[index][0], popularityCount: timing[index][1] });
        }
        const current = await patch('Boundary');
        await votes(current, 1, 1);
        expect((await service.list({ publicOnly: true, sort: 'popular', period: 'day' })).patches.find(p => p.id === current.id).popularityCount).toBe(1);
    });

    it('traverses tied popularity scores in both directions without duplicates or missing rows', async () => {
        const records = [];
        for (let i = 0; i < 5; i++) { const record = await patch(`Rack ${i}`); await votes(record, i < 2 ? 2 : 1); records.push(record); }
        const options = { publicOnly: true, sort: 'popular', period: 'all', limit: 2 };
        const first = await service.list(options);
        const second = await service.list({ ...options, before: first.nextCursor });
        const third = await service.list({ ...options, before: second.nextCursor });
        expect(names(first)).toEqual(['Rack 1', 'Rack 0']);
        expect(names(second)).toEqual(['Rack 4', 'Rack 3']);
        expect(names(third)).toEqual(['Rack 2']);
        expect(new Set([...first.patches, ...second.patches, ...third.patches].map(p => p.id)).size).toBe(5);
        expect(first.previousCursor).toBeNull(); expect(third.nextCursor).toBeNull();
        const previous = await service.list({ ...options, before: third.previousCursor });
        expect(names(previous)).toEqual(names(second));
        const beginning = await service.list({ ...options, before: previous.previousCursor });
        expect(names(beginning)).toEqual(names(first)); expect(beginning.previousCursor).toBeNull();
    });

    it('freezes the ranking window and excludes newly created patches and votes on subsequent pages', async () => {
        const old = await patch('Old'), middle = await patch('Middle'), newest = await patch('Newest');
        await votes(old, 1, 0.99); await votes(middle, 2, 0.99); await votes(newest, 3, 0.99);
        const options = { publicOnly: true, sort: 'popular', period: 'day', limit: 1 };
        const first = await service.list(options);
        clock = new Date(clock.getTime() + DAY);
        await store.setLike(old.id, 'late-voter', true, clock.toISOString());
        await votes(await patch('New arrival', { createdAt: clock.toISOString() }), 20);
        const second = await service.list({ ...options, before: first.nextCursor });
        const third = await service.list({ ...options, before: second.nextCursor });
        expect(names(first)).toEqual(['Newest']); expect(names(second)).toEqual(['Middle']); expect(names(third)).toEqual(['Old']);
        expect(third.patches[0].popularityCount).toBe(1); expect(third.patches[0].likeCount).toBe(2);
    });

    it('does not refresh a vote timestamp when the same user retries Like', async () => {
        const record = await patch('Retry');
        await service.like(bob, record.id, true);
        clock = new Date(clock.getTime() + 2 * DAY);
        await service.like(bob, record.id, true);
        expect((await service.list({ publicOnly: true, sort: 'popular', period: 'day' })).patches[0]).toMatchObject({ popularityCount: 0, likeCount: 1 });
        await service.like(bob, record.id, false); await service.like(bob, record.id, true);
        expect((await service.list({ publicOnly: true, sort: 'popular', period: 'day' })).patches[0].popularityCount).toBe(1);
    });

    it('filters before ranking and pagination, and excludes private patches even when highly rated', async () => {
        const hidden = await patch('Needle hidden', { visibility: 'private' }); await votes(hidden, 20);
        const unrelated = await patch('Unrelated'); await votes(unrelated, 10);
        for (let i = 0; i < 3; i++) await patch(`Needle ${i}`);
        const options = { publicOnly: true, sort: 'popular', period: 'week', query: 'needle', limit: 2 };
        const first = await service.list(options), second = await service.list({ ...options, before: first.nextCursor });
        expect(names(first)).toEqual(['Needle 2', 'Needle 1']); expect(names(second)).toEqual(['Needle 0']);
        expect((await service.list({ publicOnly: true, query: '%' })).patches).toEqual([]);
        expect(first.patches[0]).not.toHaveProperty('ownerId'); expect(first.patches[0]).not.toHaveProperty('state');
    });

    it('pages newest account search results without leaking other owners or accepting another account cursor', async () => {
        for (let i = 0; i < 3; i++) await patch(`Find ${i}`, { visibility: 'private' });
        await patch('Find Bob', { ownerId: bob.id }); await patch('Ignore');
        const options = { user: alice, query: 'find', limit: 2 };
        const first = await service.list(options), second = await service.list({ ...options, before: first.nextCursor });
        expect(names(first)).toEqual(['Find 2', 'Find 1']); expect(names(second)).toEqual(['Find 0']);
        expect(names(await service.list({ ...options, before: second.previousCursor }))).toEqual(names(first));
        await expect(service.list({ ...options, user: bob, before: first.nextCursor })).rejects.toMatchObject({ status: 400, code: 'invalid_cursor' });
    });

    it('validates cursor shape and rejects cursors used with changed filters or page size', async () => {
        await patch('One'); await patch('Two');
        const options = { publicOnly: true, sort: 'popular', period: 'week', limit: 1 };
        const first = await service.list(options);
        for (const changes of [{ sort: 'newest', period: 'all' }, { period: 'day' }, { query: 'One' }, { limit: 2 }]) {
            await expect(service.list({ ...options, ...changes, before: first.nextCursor })).rejects.toMatchObject({ status: 400, code: 'invalid_cursor' });
        }
        for (const before of ['garbage', 'a'.repeat(1025), '%', Buffer.from('null').toString('base64url')]) {
            await expect(service.list({ ...options, before })).rejects.toMatchObject({ status: 400, code: 'invalid_cursor' });
        }
        const value = JSON.parse(Buffer.from(first.nextCursor, 'base64url'));
        for (const changes of [{ score: -1 }, { score: 2147483648 }, { score: Number.MAX_SAFE_INTEGER }, { id: 'bad' }, { direction: 'offset' },
            { asOf: '2030-01-01T00:00:00.000Z' }, { asOf: '0000-01-01T00:00:00.000Z' }, { asOf: '-271821-04-20T00:00:00.000Z' }]) {
            const before = Buffer.from(JSON.stringify({ ...value, ...changes })).toString('base64url');
            await expect(service.list({ ...options, before })).rejects.toMatchObject({ status: 400, code: 'invalid_cursor' });
        }
        await expect(service.list({ ...options, sort: 'unknown' })).rejects.toMatchObject({ status: 400 });
        await expect(service.list({ ...options, period: 'unknown' })).rejects.toMatchObject({ status: 400 });
    });

    it('passes URL search, ranking, period and cursors through both catalogue API routes', async () => {
        const one = await patch('Chosen one'), two = await patch('Chosen two'); await patch('Ignored');
        await votes(one, 2); await votes(two, 1);
        const handler = createHandler({ service, store, baseUrl: 'https://rack.example', authenticate: async () => alice });
        const get = async query => { const response = await handler(new Request(`https://rack.example${query}`)); expect(response.status).toBe(200); return response.json(); };
        const first = await get('/api/public-patches?q=Chosen&sort=popular&period=day&limit=1');
        expect(names(first)).toEqual(['Chosen one']);
        expect(names(await get(`/api/public-patches?q=Chosen&sort=popular&period=day&limit=1&cursor=${first.nextCursor}`))).toEqual(['Chosen two']);
        expect(names(await get('/api/patches?q=Chosen&limit=1'))).toEqual(['Chosen two']);
    });
});
