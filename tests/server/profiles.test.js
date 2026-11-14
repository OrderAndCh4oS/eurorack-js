// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ulid } from 'ulid';
import sharp from 'sharp';
import { MemoryStore } from '../../server/memory-store.js';
import { MemoryImageStore } from '../../server/local-image-store.js';
import { createPatchService } from '../../server/patch-service.js';
import { createHandler } from '../../server/handler.js';

const alice = { id: 'profile-alice', name: 'Alice' }, bob = { id: 'profile-bob', name: 'Bob' }, charlie = { id: 'profile-charlie', name: 'Charlie' };
const state = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} };
let store, service, handler, png, clock;
beforeEach(async () => {
    store = new MemoryStore(); clock = new Date('2026-11-14T12:00:00Z');
    service = createPatchService({ store, imageStore: new MemoryImageStore(), now: () => clock });
    handler = createHandler({ store, service, baseUrl: 'https://rack.example', authenticate: async request => ({ alice, bob, charlie })[request.headers.get('x-user')] || null });
    png = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#f0eee2' } }).png().toBuffer();
});
const draft = extra => ({ requestId: ulid(), name: 'Rack', state, ...extra });
async function publish(user = alice, name = 'Rack') {
    const preview = await service.uploadPreview(user, { state }, png);
    return service.create(user, draft({ name, visibility: 'public', previewId: preview.id }));
}
async function request(method = 'GET', body, user = 'alice', origin = 'https://rack.example') {
    return handler(new Request('https://rack.example/api/me', { method, headers: { origin, 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}

describe('account-wide public profiles', () => {
    it('persists an editable public name independently of stale Google session details', async () => {
        expect(await (await request()).json()).toEqual({ configured: true, user: alice });
        const response = await request('PATCH', { name: '  Alice Instruments  ' });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ user: { id: alice.id, name: 'Alice Instruments' } });
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(await (await request()).json()).toEqual({ configured: true, user: { id: alice.id, name: 'Alice Instruments' } });
        const restartedService = createPatchService({ store });
        expect(await restartedService.me({ ...alice, name: 'Google reset name', email: 'private@example.com' })).toEqual({ id: alice.id, name: 'Alice Instruments' });
        expect(await service.me({ id: 'no-public-name', name: 'private@example.com' })).toEqual({ id: 'no-public-name', name: 'Patch maker' });
        expect(await (await request('GET', undefined, null)).json()).toEqual({ configured: true, user: null });
    });

    it('rejects unauthenticated, cross-origin and foreign-account profile writes', async () => {
        expect((await request('PATCH', { name: 'Intruder' }, null)).status).toBe(401);
        expect((await request('PATCH', { name: 'Intruder' }, 'alice', 'https://attacker.example')).status).toBe(403);
        expect((await request('PATCH', { name: 'Intruder', id: alice.id }, 'bob')).status).toBe(400);
        expect((await request('PATCH', { name: 'Intruder', userId: alice.id }, 'bob')).status).toBe(400);
        expect(await service.me(alice)).toEqual(alice); expect(await service.me(bob)).toEqual(bob);
        expect(store.data.profiles.size).toBe(0);
    });

    it('validates a bounded single-line public name without exposing email', async () => {
        for (const name of ['', ' ', null, 1, {}, 'x'.repeat(81), 'person@example.com', 'First\nLast', '\tAlice', 'Ali\u0000ce', 'Alice\u007f', 'Alice\u0085', 'Alice\u2028Name']) {
            expect((await request('PATCH', { name })).status, JSON.stringify(name)).toBe(400);
        }
        expect((await request('PATCH', {})).status).toBe(400);
        expect((await request('PATCH', { name: 'Zoë & Friends' })).status).toBe(200);
        expect((await service.me(alice)).name).toBe('Zoë & Friends');
    });

    it('updates all patch and fork credits without changing saved racks, revisions or requests', async () => {
        const first = await publish(), second = await publish(alice, 'Second');
        const privatePatch = await service.create(alice, draft({ name: 'Private' }));
        const fork = await service.copy(bob, first.id, { requestId: ulid(), expectedRevision: 1 });
        const before = structuredClone(store.data.patches), requests = structuredClone(store.data.requests);
        await service.updateProfile(alice, { name: 'New Alice' });
        for (const patch of [first, second, privatePatch]) expect(await service.get(patch.id, alice)).toMatchObject({ authorName: 'New Alice', revision: 1,
            provenance: { originalCreatorName: 'New Alice' } });
        const copy = await service.get(fork.id, bob);
        expect(copy).toMatchObject({ authorName: 'Bob', provenance: { originalCreatorName: 'New Alice', parentCreatorName: 'New Alice' } });
        expect(copy).not.toHaveProperty('ownerId'); expect(copy.provenance).not.toHaveProperty('parentCreatorId');
        expect(copy.provenance).not.toHaveProperty('originalCreatorId');
        expect(store.data.patches).toEqual(before); expect(store.data.requests).toEqual(requests);
    });

    it('retains current original and parent attribution after source deletion, including legacy forks', async () => {
        const root = await publish();
        const child = await service.copy(bob, root.id, { requestId: ulid(), expectedRevision: 1 });
        await service.update(bob, child.id, { state, visibility: 'public', expectedRevision: 1 });
        const grandchild = await service.copy(charlie, child.id, { requestId: ulid(), expectedRevision: 2 });
        // A legacy record has only the parent patch ID and its frozen name.
        const legacy = await store.getPatch(grandchild.id); delete legacy.parentCreatorId; await store.putPatch(legacy);
        await service.remove(bob, child.id, { expectedRevision: 2 });
        await service.remove(alice, root.id, { expectedRevision: 1 });
        await service.updateProfile(alice, { name: 'Root artist' }); await service.updateProfile(bob, { name: 'Remix artist' });
        const record = await service.get(grandchild.id, charlie);
        expect(record.provenance).toMatchObject({ originalCreatorName: 'Root artist', parentCreatorName: 'Remix artist', rootAvailable: false, parentAvailable: false });
        expect(record.authorName).toBe('Charlie');
    });

    it('uses current names in literal searches before cursor pagination', async () => {
        for (const name of ['One', 'Two', 'Three']) await publish(alice, name);
        await service.create(alice, draft({ name: 'Private' })); await publish(bob, 'Other creator');
        await service.updateProfile(alice, { name: 'Synth_% Collective' });
        const options = { publicOnly: true, query: 'synth_%', limit: 2, sort: 'popular', period: 'week' };
        const first = await service.list(options), second = await service.list({ ...options, before: first.nextCursor });
        expect(first.patches).toHaveLength(2); expect(second.patches).toHaveLength(1);
        expect(new Set([...first.patches, ...second.patches].map(p => p.id)).size).toBe(3);
        expect(first.patches.every(p => p.authorName === 'Synth_% Collective')).toBe(true);
        expect((await service.list({ publicOnly: true, query: 'Alice' })).patches).toEqual([]);
        expect((await service.list({ user: alice, query: 'synth_%' })).patches).toHaveLength(4);
    });

    it('prevents stale per-patch names from replacing a profile on new saves, copies, edits or retries', async () => {
        const source = await publish(bob);
        await service.updateProfile(alice, { name: 'Current Alice' });
        const input = draft({ authorName: 'Cached Alice' });
        const patch = await service.create(alice, input);
        const fork = await service.copy(alice, source.id, { requestId: ulid(), authorName: 'Cached Alice', expectedRevision: 1 });
        expect(patch.authorName).toBe('Current Alice'); expect(fork.authorName).toBe('Current Alice');
        expect((await service.update(alice, patch.id, { state, expectedRevision: 1, authorName: 'Cached Alice' })).authorName).toBe('Current Alice');
        const before = await store.getPatch(patch.id);
        await service.updateProfile(alice, { name: 'Latest Alice' });
        const retry = await service.create(alice, input);
        expect(retry.authorName).toBe('Latest Alice'); expect(retry.revision).toBe(2);
        expect(await store.getPatch(patch.id)).toEqual(before);
    });

    it('renders current names and fork credits in escaped social metadata', async () => {
        const root = await publish(); const child = await service.copy(bob, root.id, { requestId: ulid(), expectedRevision: 1 });
        await service.update(bob, child.id, { state, visibility: 'public', expectedRevision: 1 });
        await service.updateProfile(alice, { name: '<Alice & Friends>' }); await service.updateProfile(bob, { name: 'Bob Instruments' });
        const response = await handler(new Request(`https://rack.example/patches/${child.id}?view=details`));
        const html = await response.text();
        expect(response.status).toBe(200); expect(html).toContain('Bob Instruments'); expect(html).toContain('&lt;Alice &amp; Friends&gt;');
        expect(html).not.toContain('<Alice & Friends>'); expect(html).not.toContain(alice.id); expect(html).not.toContain(bob.id);
    });

    it('loads profile and related-patch data once per catalogue page', async () => {
        for (let i = 0; i < 3; i++) await publish();
        const profiles = vi.spyOn(store, 'getProfiles'), related = vi.spyOn(store, 'getPatches');
        await service.list({ publicOnly: true });
        expect(profiles).toHaveBeenCalledTimes(1); expect(related).toHaveBeenCalledTimes(1);
    });

    it('rate limits profile changes independently of patch saves', async () => {
        for (let i = 0; i < 10; i++) expect((await request('PATCH', { name: `Alice ${i}` })).status).toBe(200);
        expect((await request('PATCH', { name: 'Too many' })).status).toBe(429);
        expect((await service.me(alice)).name).toBe('Alice 9');
        expect((await service.create(alice, draft())).authorName).toBe('Alice 9');
        clock = new Date(clock.getTime() + 61000);
        expect((await request('PATCH', { name: 'Alice again' })).status).toBe(200);
    });
});
