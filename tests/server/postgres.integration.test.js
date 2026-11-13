// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { ulid } from 'ulid';
import sharp from 'sharp';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions, createAuth } from '../../server/auth.js';
import { PostgresStore } from '../../server/postgres-store.js';
import { createPatchService } from '../../server/patch-service.js';
import { MemoryImageStore } from '../../server/local-image-store.js';

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('real PostgreSQL adapter and Better Auth migration', () => {
    let pool, store, service, auth;
    const env = { BETTER_AUTH_URL: 'http://localhost:4173', BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters', GOOGLE_CLIENT_ID: 'test-google-client', GOOGLE_CLIENT_SECRET: 'test-google-secret' };
    const user = { id: `fixture-${ulid()}`, name: 'Fixture creator' };
    const other = { id: `fixture-${ulid()}`, name: 'Second creator' };
    const state = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} };
    beforeAll(async () => {
        const parsed = new URL(url);
        if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/eurorack_test') throw new Error('Integration tests require a dedicated local eurorack_test database.');
        pool = new Pool({ connectionString: url, max: 4 });
        const migration = await getMigrations(authOptions(pool, env));
        await migration.runMigrations();
        await pool.query(await readFile(new URL('../../db/001-patches.sql', import.meta.url), 'utf8'));
        store = new PostgresStore(pool);
        service = createPatchService({ store, imageStore: new MemoryImageStore() });
        auth = createAuth(pool, env);
    });
    afterAll(async () => { await pool?.end(); });
    it('uses the pinned auth schema and rejects a forged session', async () => {
        const rows = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        expect(rows.rows.map(row => row.table_name)).toEqual(expect.arrayContaining(['user', 'session', 'account', 'verification', 'rateLimit', 'patch_records', 'patch_requests']));
        const session = await auth.api.getSession({ headers: new Headers({ cookie: 'better-auth.session_token=forged.signature' }) });
        expect(session).toBeNull();
    });
    it('starts the real OAuth state flow and rejects cross-origin sign-in', async () => {
        const request = origin => new Request('http://localhost:4173/api/auth/sign-in/social', { method: 'POST', headers: { origin, cookie: 'unrelated=1', 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'google', callbackURL: 'http://localhost:4173/' }) });
        const invalid = await auth.handler(request('http://attacker.example'));
        expect(invalid.status).toBe(403);
        const valid = await auth.handler(request('http://localhost:4173'));
        expect(valid.status).toBe(200);
        const result = await valid.json();
        expect(new URL(result.url).hostname).toBe('accounts.google.com');
        expect(new URL(result.url).searchParams.get('redirect_uri')).toBe('http://localhost:4173/api/auth/callback/google');
    });
    it('persists previews, forks, idempotency, likes and revisions using real SQL transactions', async () => {
        const png = await sharp({ create: { width: 60, height: 40, channels: 3, background: '#f0eee2' } }).png().toBuffer();
        const image = await service.uploadPreview(user, { state }, png);
        const input = { name: 'SQL fixture', state, requestId: ulid(), visibility: 'public', previewId: image.id };
        const patch = await service.create(user, input);
        expect((await service.create(user, input)).id).toBe(patch.id);
        expect((await service.list({ publicOnly: true, query: 'SQL fixture' })).patches.some(p => p.id === patch.id)).toBe(true);
        expect(await service.like(other, patch.id, true)).toEqual({ likeCount: 1, likedByMe: true });
        const fork = await service.copy(other, patch.id, { requestId: ulid(), expectedRevision: 1 });
        expect(fork.visibility).toBe('private'); expect(fork.previewId).not.toBe(patch.previewId);
        const races = await Promise.allSettled(['One', 'Two'].map(name => service.update(user, patch.id, { state, name, expectedRevision: 1 })));
        expect(races.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(races.find(result => result.status === 'rejected').reason.status).toBe(409);
        const stats = await store.totals(user.id); expect(stats.count).toBe(1); expect(stats.imageBytes).toBeGreaterThan(0);
        const garbageKey = `rack-previews/${ulid()}/full.png`;
        await store.transaction(async tx => { await tx.addGarbage(garbageKey); await tx.addGarbage(garbageKey); });
        expect(await store.listGarbage()).toContain(garbageKey); expect(await store.garbageCount()).toBeGreaterThan(0);
        await store.deleteGarbage(garbageKey); expect(await store.listGarbage()).not.toContain(garbageKey);
        await service.remove(user, patch.id, { expectedRevision: 2 });
        await expect(service.create(user, input)).rejects.toMatchObject({ code: 'patch_deleted' });
        expect((await service.get(fork.id, other)).provenance.originalCreatorName).toBe('Fixture creator');
        expect((await store.likes(patch.id, other.id)).likeCount).toBe(0);
        await service.remove(other, fork.id, { expectedRevision: 1 });
    });
});
