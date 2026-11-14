// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ulid, isValid } from 'ulid';
import { MemoryStore } from '../../server/memory-store.js';
import { MemoryImageStore } from '../../server/local-image-store.js';
import { createPatchService } from '../../server/patch-service.js';
import { createHandler } from '../../server/handler.js';
import { validateState, LIMITS } from '../../server/validation.js';
import { readConfig, readImageConfig } from '../../server/config.js';
import apiEntry, { forwardedRequest } from '../../api/index.js';

const alice = { id: 'auth-alice', name: 'Alice' };
const bob = { id: 'auth-bob', name: 'Bob' };
const charlie = { id: 'auth-charlie', name: 'Charlie' };
const state = () => ({ version: 3, plugins: { core: 1 }, modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }], params: { osc: { coarse: 0.35, fine: 0 } }, cables: [], midiMappings: {} });
const draft = overrides => ({ requestId: ulid(), name: 'A patch', state: state(), ...overrides });
let store, images, service, handler, clock, png;
beforeEach(async () => {
    store = new MemoryStore(); images = new MemoryImageStore(); clock = new Date('2026-11-13T12:00:00Z');
    service = createPatchService({ store, imageStore: images, now: () => clock });
    handler = createHandler({ store, imageStore: images, service, baseUrl: 'https://rack.example', authenticate: async req => ({ alice, bob, charlie })[req.headers.get('x-test-user')] || null });
    png = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#f0eee2' } }).png().toBuffer();
});
async function preview(user = alice, patchState = state()) { return service.uploadPreview(user, { state: patchState }, png); }
async function published() { const image = await preview(); return service.create(alice, draft({ visibility: 'public', previewId: image.id })); }
async function request(path, { user, method = 'GET', body, origin = 'https://rack.example', headers = {} } = {}) {
    return handler(new Request(`https://rack.example${path}`, { method, headers: { ...(user ? { 'x-test-user': user } : {}),
        ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
}

describe('cloud identity, access and revisions', () => {
    it('creates private ULID records and projects no auth identity publicly', async () => {
        const patch = await service.create(alice, draft());
        expect(isValid(patch.id)).toBe(true); expect(patch.visibility).toBe('private'); expect(patch.state).toEqual(state());
        expect(patch).not.toHaveProperty('ownerId'); expect(patch.provenance).not.toHaveProperty('originalCreatorId');
        await expect(service.get(patch.id, bob)).rejects.toMatchObject({ status: 404 });
        await expect(service.get(patch.id, null)).rejects.toMatchObject({ status: 404 });
        await expect(service.create(null, draft())).rejects.toMatchObject({ status: 401 });
    });
    it('enforces owner-only update, visibility and deletion', async () => {
        const patch = await published();
        await expect(service.update(bob, patch.id, { name: 'Taken', state: state(), expectedRevision: 1 })).rejects.toMatchObject({ status: 404 });
        await expect(service.setVisibility(bob, patch.id, { visibility: 'private', expectedRevision: 1 })).rejects.toMatchObject({ status: 404 });
        await expect(service.remove(bob, patch.id, { expectedRevision: 1 })).rejects.toMatchObject({ status: 404 });
        expect((await service.get(patch.id, null)).name).toBe('A patch');
    });
    it('only one concurrent revision succeeds and leaves precise state', async () => {
        const patch = await service.create(alice, draft());
        const results = await Promise.allSettled(['First', 'Second'].map(name => service.update(alice, patch.id, { name, state: state(), expectedRevision: 1 })));
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(r => r.status === 'rejected').reason).toMatchObject({ status: 409, code: 'revision_conflict' });
        expect((await service.get(patch.id, alice)).revision).toBe(2);
    });
    it('retries create once without overwriting later edits and rejects reused request content', async () => {
        const input = draft(); const patch = await service.create(alice, input);
        await service.update(alice, patch.id, { name: 'Later revision', state: state(), expectedRevision: 1 });
        const retry = await service.create(alice, input); expect(retry.name).toBe('Later revision'); expect(retry.revision).toBe(2);
        expect((await service.list({ user: alice })).patches).toHaveLength(1);
        await expect(service.create(alice, { ...input, name: 'Changed request' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
    });
    it('does not resurrect a deleted patch from a delayed create retry', async () => {
        const input = draft(); const patch = await service.create(alice, input);
        await service.remove(alice, patch.id, { expectedRevision: 1 });
        await expect(service.create(alice, input)).rejects.toMatchObject({ code: 'patch_deleted' });
        expect((await service.list({ user: alice })).patches).toHaveLength(0);
    });
    it('rejects cross-origin mutations before writing and preserves local config-disabled behavior', async () => {
        const response = await request('/api/patches', { user: 'alice', method: 'POST', body: draft(), origin: 'https://attacker.example' });
        expect(response.status).toBe(403); expect((await service.list({ user: alice })).patches).toHaveLength(0);
        const disabled = createHandler({ enabled: false });
        expect(await (await disabled(new Request('http://localhost:3000/api/config'))).json()).toMatchObject({ enabled: false, authEnabled: false });
        expect((await disabled(new Request('http://localhost:3000/api/me'))).status).toBe(503);
        expect(readConfig({ NODE_ENV: 'production', DATABASE_URL: 'secret' }).enabled).toBe(false);
    });
    it('accepts a PostgreSQL STORAGE_URL alias and rejects non-database URLs', () => {
        const env = { BETTER_AUTH_URL: 'https://rack.example', BETTER_AUTH_SECRET: 's'.repeat(32), GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test', STORAGE_URL: 'postgresql://user:secret@database.example/rack?sslmode=require' };
        expect(readConfig(env)).toMatchObject({ enabled: true, databaseUrl: env.STORAGE_URL });
        expect(readConfig({ ...env, STORAGE_URL: 'https://objects.example/bucket' }).enabled).toBe(false);
        expect(readConfig({ ...env, DATABASE_URL: 'invalid' }).enabled).toBe(false);
    });
    it('supports Neon Object Storage AWS variables with explicit private bucket and safe endpoints', () => {
        const env = { NODE_ENV: 'production', AWS_ENDPOINT_URL_S3: 'https://branch-storage.example', AWS_ACCESS_KEY_ID: 'test-key', AWS_SECRET_ACCESS_KEY: 'test-secret', AWS_REGION: 'us-east-2', S3_BUCKET: 'rack-previews' };
        expect(readImageConfig(env)).toMatchObject({ enabled: true, endpoint: env.AWS_ENDPOINT_URL_S3, region: 'us-east-2', forcePathStyle: true });
        expect(readImageConfig({ ...env, S3_BUCKET: '' }).enabled).toBe(false);
        expect(readImageConfig({ ...env, AWS_ENDPOINT_URL_S3: 'http://branch-storage.example' }).enabled).toBe(false);
        expect(readImageConfig({ ...env, AWS_ENDPOINT_URL_S3: 'https://user:password@branch-storage.example' }).enabled).toBe(false);
    });
    it('never turns email into public creator credit', async () => {
        const patch = await service.create({ id: 'secret-subject', name: 'private@example.com' }, draft());
        expect(patch.authorName).toBe('Patch maker');
        await expect(service.create(alice, draft({ authorName: 'person@example.com' }))).rejects.toMatchObject({ status: 400 });
    });
    it('restores Vercel rewrite paths without changing request bodies or overriding original paths', async () => {
        const rewritten = forwardedRequest(new Request('https://rack.example/api?__path=/api/patches&q=phrase', { method: 'POST', headers: { origin: 'https://rack.example', 'content-type': 'application/json' }, body: '{"name":"test"}' }));
        expect(rewritten.url).toBe('https://rack.example/api/patches?q=phrase');
        expect(await rewritten.json()).toEqual({ name: 'test' });
        expect(rewritten.headers.get('origin')).toBe('https://rack.example');
        expect(forwardedRequest(new Request('https://rack.example/api/me?__path=/api/patches')).url).toBe('https://rack.example/api/me');
    });
    it('rejects duplicate, external and traversal rewrite parameters with a bounded JSON response', async () => {
        for (const query of ['__path=/api/me&__path=/api/patches', '__path=https://attacker.example', '__path=/api/../secret', '__path=/api/%255c..%255csecret', '__path=']) {
            const response = await apiEntry.fetch(new Request(`https://rack.example/api?${query}`));
            expect(response.status).toBe(400); expect((await response.json()).error.code).toBe('invalid_route');
            expect(response.headers.get('cache-control')).toContain('no-store');
        }
    });
    it('keeps creator names account-wide instead of accepting per-patch display-name edits', async () => {
        const patch = await service.create(alice, draft());
        const changed = await service.update(alice, patch.id, { state: state(), authorName: 'Alice Instruments', expectedRevision: 1 });
        expect(changed.authorName).toBe('Alice');
        expect(changed.provenance.originalCreatorName).toBe('Alice');
        await service.updateProfile(alice, { name: 'Alice Instruments' });
        expect(await service.get(patch.id, alice)).toMatchObject({ authorName: 'Alice Instruments', revision: 2,
            provenance: { originalCreatorName: 'Alice Instruments' } });
    });
});

describe('publication, previews and social pages', () => {
    it('allows public social embeds but keeps private images same-origin for GET and HEAD', async () => {
        const patch = await published();
        const path = patch.images.social;
        for (const method of ['GET', 'HEAD']) {
            const response = await request(path, { method });
            expect(response.status).toBe(200);
            expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
            expect(response.headers.get('access-control-allow-origin')).toBe('*');
            expect(response.headers.get('cache-control')).toContain('no-store');
            const body = await response.arrayBuffer();
            expect(body.byteLength > 0).toBe(method === 'GET');
        }
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        for (const method of ['GET', 'HEAD']) {
            const owner = await request(path, { method, user: 'alice' });
            expect(owner.status).toBe(200);
            expect(owner.headers.get('cross-origin-resource-policy')).toBe('same-origin');
            expect(owner.headers.has('access-control-allow-origin')).toBe(false);
            expect(owner.headers.get('cache-control')).toContain('no-store');
            expect((await request(path, { method })).status).toBe(404);
            expect((await request(path, { method, user: 'bob' })).status).toBe(404);
        }
    });
    it('uses private image headers when an owner download is privatized in flight', async () => {
        const patch = await published();
        const originalGet = images.get.bind(images);
        let downloaded, release;
        const started = new Promise(resolve => { downloaded = resolve; });
        images.get = async key => { const bytes = await originalGet(key); downloaded(); await new Promise(resolve => { release = resolve; }); return bytes; };
        const pending = request(patch.images.social, { user: 'alice' });
        await started;
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        release();
        const response = await pending;
        expect(response.status).toBe(200);
        expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
        expect(response.headers.has('access-control-allow-origin')).toBe(false);
    });
    it('serves the saved rack editor at its canonical path without exposing private metadata', async () => {
        const patch = await published();
        const path = `/patches/${patch.id}`;
        const response = await request(path);
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('id="rackView"');
        expect(html).not.toContain('id="patch-detail"');
        expect(html).toContain('src="/js/app/app.js"');
        expect(html).toContain('href="/patch-library.css"');
        expect(html).toContain(`property="og:url" content="https://rack.example/patches/${patch.id}"`);
        expect(html).not.toContain('#saved=');
        expect(html.match(/<title>/g)).toHaveLength(1);
        const details = await (await request(`${path}?view=details`)).text();
        expect(details).toContain('id="patch-detail"');
        expect(details).toContain(`href="${path}">Open in rack`);
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        const privateHtml = await (await request(path, { user: 'alice' })).text();
        expect(privateHtml).toContain('id="rackView"');
        expect(privateHtml).toContain('name="robots" content="noindex,nofollow"');
        expect(privateHtml).not.toContain('og:title');
        expect(privateHtml).not.toContain(patch.name);
    });
    it('requires exact state-matching previews and keeps failed public saves atomic', async () => {
        await expect(service.create(alice, draft({ visibility: 'public' }))).rejects.toMatchObject({ code: 'preview_required' });
        const patch = await published(); const changed = state(); changed.params.osc.coarse = 0.5;
        await expect(service.update(alice, patch.id, { state: changed, expectedRevision: 1, previewId: patch.previewId })).rejects.toMatchObject({ code: 'preview_mismatch' });
        expect((await service.get(patch.id, null)).state.params.osc.coarse).toBe(0.35);
        await expect(service.create(bob, draft({ visibility: 'public', previewId: patch.previewId }))).rejects.toMatchObject({ code: 'preview_not_found' });
    });
    it('reencodes rack rasters as bounded PNG variants, refuses SVG and oversized images', async () => {
        const patch = await published();
        const raster = await service.image(null, patch.id, patch.previewId, 'social');
        expect(await sharp(raster).metadata()).toMatchObject({ width: 1200, height: 630, format: 'png' });
        await expect(service.uploadPreview(alice, { state: state() }, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"></svg>'))).rejects.toMatchObject({ status: 400 });
        await expect(service.uploadPreview(alice, { state: state() }, Buffer.alloc(LIMITS.uploadBytes + 1))).rejects.toMatchObject({ status: 413 });
    });
    it('revokes catalogue, raw JSON, image, copy and social metadata on privatization', async () => {
        const patch = await published();
        const htmlBefore = await (await request(`/patches/${patch.id}`)).text();
        expect(htmlBefore).toContain('name="twitter:card" content="summary_large_image"');
        expect(htmlBefore).toContain('property="og:image"'); expect(htmlBefore).toContain('A patch');
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        expect((await service.list({ publicOnly: true })).patches).toHaveLength(0);
        expect((await request(`/api/patches/${patch.id}`)).status).toBe(404);
        expect((await request(patch.images.full)).status).toBe(404);
        expect((await request(patch.images.full, { user: 'alice' })).status).toBe(200);
        await expect(service.copy(bob, patch.id, { requestId: ulid(), expectedRevision: 2 })).rejects.toMatchObject({ status: 404 });
        const hidden = await request(`/patches/${patch.id}`, { user: 'alice' }); expect(hidden.status).toBe(404);
        const htmlAfter = await hidden.text(); expect(htmlAfter).not.toContain('A patch'); expect(htmlAfter).not.toContain('og:image');
        expect(hidden.headers.get('cache-control')).toContain('no-store');
    });
    it('escapes public text in initial metadata and uses only canonical saved URLs', async () => {
        const image = await preview();
        const patch = await service.create(alice, draft({ name: '<script>alert(1)</script>', visibility: 'public', previewId: image.id }));
        const html = await (await request(`/patches/${patch.id}`)).text();
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); expect(html).not.toContain('<script>alert');
        expect(html).toContain(`property="og:url" content="https://rack.example/patches/${patch.id}"`); expect(html).not.toContain('#patch=');
    });
    it('hides stale and unattached images, but private owners may load active images', async () => {
        const first = await preview(); const second = await preview();
        const patch = await service.create(alice, draft({ previewId: first.id }));
        await expect(service.image(alice, patch.id, second.id, 'full')).rejects.toMatchObject({ status: 404 });
        await service.update(alice, patch.id, { state: state(), expectedRevision: 1, previewId: second.id });
        await expect(service.image(alice, patch.id, first.id, 'full')).rejects.toMatchObject({ status: 404 });
        expect((await service.image(alice, patch.id, second.id, 'full')).length).toBeGreaterThan(0);
    });
    it('revokes a public image that is privatized while object storage is still responding', async () => {
        const patch = await published();
        const originalGet = images.get.bind(images);
        let downloaded, release;
        const started = new Promise(resolve => { downloaded = resolve; });
        images.get = async key => { const bytes = await originalGet(key); downloaded(); await new Promise(resolve => { release = resolve; }); return bytes; };
        const pending = service.image(null, patch.id, patch.previewId, 'full');
        await started;
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        release();
        await expect(pending).rejects.toMatchObject({ status: 404 });
    });
});

describe('private forks and reactions', () => {
    it('keeps a test/local copy private until a later content save even without a cloud parent', async () => {
        const image = await preview();
        const copy = await service.create(alice, draft({ copy: true, visibility: 'public', previewId: image.id }));
        expect(copy.visibility).toBe('private'); expect(copy.requiresSaveBeforePublish).toBe(true);
        expect(copy.provenance.parentId).toBeNull(); expect(copy.savedAfterCopyAt).toBeNull();
        await expect(service.setVisibility(alice, copy.id, { expectedRevision: 1, visibility: 'public' })).rejects.toMatchObject({ code: 'copy_needs_save' });
        const stillPrivate = await service.setVisibility(alice, copy.id, { expectedRevision: 1, visibility: 'private' });
        expect(stillPrivate.requiresSaveBeforePublish).toBe(true);
        const saved = await service.update(alice, copy.id, { expectedRevision: 2, state: copy.state, visibility: 'public' });
        expect(saved.visibility).toBe('public'); expect(saved.requiresSaveBeforePublish).toBe(false); expect(saved.savedAfterCopyAt).toBeTruthy();
    });
    it('does not impose the copy publication gate on an ordinary new save', async () => {
        const image = await preview();
        const patch = await service.create(alice, draft({ previewId: image.id }));
        expect(patch.requiresSaveBeforePublish).toBe(false);
        expect((await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'public' })).visibility).toBe('public');
        await expect(service.create(alice, draft({ copy: 'yes' }))).rejects.toMatchObject({ status: 400 });
    });
    it('makes every copy private and blocks publication until an explicit later content save', async () => {
        const source = await published();
        const copy = await service.copy(bob, source.id, { requestId: ulid(), expectedRevision: 1, visibility: 'public' });
        expect(copy.visibility).toBe('private'); expect(copy.savedAfterCopyAt).toBeNull(); expect(copy.likeCount).toBe(0); expect(copy.requiresSaveBeforePublish).toBe(true);
        expect(copy.previewId).not.toBe(source.previewId);
        await expect(service.setVisibility(bob, copy.id, { expectedRevision: 1, visibility: 'public' })).rejects.toMatchObject({ code: 'copy_needs_save' });
        const saved = await service.update(bob, copy.id, { state: copy.state, expectedRevision: 1, visibility: 'public' });
        expect(saved.savedAfterCopyAt).toBeTruthy(); expect(saved.visibility).toBe('public'); expect(saved.requiresSaveBeforePublish).toBe(false);
    });
    it('preserves root credit through forks of forks after original deletion and parent privatization', async () => {
        const source = await published();
        const first = await service.copy(bob, source.id, { requestId: ulid(), expectedRevision: 1 });
        const parent = await service.update(bob, first.id, { state: first.state, expectedRevision: 1, visibility: 'public' });
        const fork = await service.copy(charlie, parent.id, { requestId: ulid(), expectedRevision: 2 });
        await service.remove(alice, source.id, { expectedRevision: 1 });
        await service.setVisibility(bob, parent.id, { expectedRevision: 2, visibility: 'private' });
        const result = await service.get(fork.id, charlie);
        expect(result.provenance).toMatchObject({ rootId: source.id, parentId: first.id, originalCreatorName: 'Alice', parentCreatorName: 'Bob', parentAvailable: false, rootAvailable: false });
        expect(await service.image(charlie, fork.id, fork.previewId, 'full')).toBeTruthy();
    });
    it('preserves edited state when forking from the editor, and original state for catalogue copies', async () => {
        const source = await published(); const changed = state(); changed.params.osc.coarse = 0.8;
        const edited = await service.copy(bob, source.id, { requestId: ulid(), expectedRevision: 1, state: changed });
        const unchanged = await service.copy(bob, source.id, { requestId: ulid(), expectedRevision: 1 });
        expect(edited.state.params.osc.coarse).toBe(0.8); expect(edited.previewId).toBeNull();
        expect(unchanged.state.params.osc.coarse).toBe(0.35); expect(unchanged.previewId).toBeTruthy();
    });
    it('retains independent fork raster objects during source cleanup, then removes unused objects', async () => {
        const source = await published(); const copy = await service.copy(bob, source.id, { requestId: ulid(), expectedRevision: 1 });
        await service.remove(alice, source.id, { expectedRevision: 1 });
        clock = new Date(clock.getTime() + 86400001); await service.cleanupPreviews();
        expect(images.objects.size).toBe(3); expect(await service.image(bob, copy.id, copy.previewId, 'social')).toBeTruthy();
        await service.remove(bob, copy.id, { expectedRevision: 1 }); await service.cleanupPreviews(); expect(images.objects.size).toBe(0);
    });
    it('keeps failed object deletions retryable without restoring dangling preview associations', async () => {
        const image = await preview();
        clock = new Date(clock.getTime() + 86400001);
        const originalDelete = images.delete.bind(images); let fail = true;
        images.delete = async key => { if (fail) throw new Error('temporary storage failure'); await originalDelete(key); };
        const first = await service.cleanupPreviews();
        expect(first).toEqual({ removed: 1, pendingObjects: 3 }); expect(await store.getPreview(image.id)).toBeUndefined();
        await expect(service.create(alice, draft({ previewId: image.id, visibility: 'public' }))).rejects.toMatchObject({ code: 'preview_not_found' });
        fail = false;
        expect(await service.cleanupPreviews()).toEqual({ removed: 0, pendingObjects: 0 }); expect(images.objects.size).toBe(0);
    });
    it('queues attempted upload objects for cleanup when the provider loses an upload response', async () => {
        images.put = async (key, bytes) => { images.objects.set(key, bytes); throw new Error('lost response'); };
        images.delete = async () => { throw new Error('provider unavailable'); };
        await expect(preview()).rejects.toThrow('lost response');
        expect(await store.listPreviews()).toHaveLength(0); expect(await store.listGarbage()).toHaveLength(1);
        images.delete = async key => { images.objects.delete(key); };
        expect(await service.cleanupPreviews()).toEqual({ removed: 0, pendingObjects: 0 }); expect(images.objects.size).toBe(0);
    });
    it('likes once per other user, independently from revisions, and retains likes while private', async () => {
        const patch = await published();
        await expect(service.like(alice, patch.id, true)).rejects.toMatchObject({ code: 'own_patch_like' });
        await service.like(bob, patch.id, true); expect(await service.like(bob, patch.id, true)).toEqual({ likeCount: 1, likedByMe: true });
        expect((await service.get(patch.id, null)).revision).toBe(1);
        await service.setVisibility(alice, patch.id, { expectedRevision: 1, visibility: 'private' });
        await expect(service.like(bob, patch.id, true)).rejects.toMatchObject({ status: 404 });
        const visible = await service.setVisibility(alice, patch.id, { expectedRevision: 2, visibility: 'public' });
        expect(visible.likeCount).toBe(1); expect(await service.like(bob, patch.id, false)).toEqual({ likeCount: 0, likedByMe: false });
    });
    it('retries forks idempotently after source removal without losing lineage', async () => {
        const source = await published(); const input = { requestId: ulid(), expectedRevision: 1 };
        const fork = await service.copy(bob, source.id, input); await service.remove(alice, source.id, { expectedRevision: 1 });
        expect((await service.copy(bob, source.id, input)).id).toBe(fork.id);
    });
});

describe('bounded validation, catalogue and quotas', () => {
    it('rejects unsafe keys, invalid contracts, duplicate cable inputs, rows, parameters and MIDI', () => {
        const invalid = state(); invalid.modules[0].row = -1; expect(() => validateState(invalid)).toThrow('row');
        const wrongParam = state(); wrongParam.params.osc.madeUp = 1; expect(() => validateState(wrongParam)).toThrow('parameter');
        const plugin = state(); plugin.plugins.core = 2; expect(() => validateState(plugin)).toThrow('contract');
        const badNumber = state(); badNumber.params.osc.coarse = Infinity; expect(() => validateState(badNumber)).toThrow('finite');
        const midi = state(); midi.midiMappings['0:1'] = { moduleId: 'missing', paramId: 'fine', min: 0, max: 1 }; expect(() => validateState(midi)).toThrow('MIDI');
        expect(() => validateState(JSON.parse('{"__proto__":{}}'))).toThrow('Unsafe');
        const cables = state(); cables.modules.push({ id: 'filter', type: 'vcf', row: 1, index: 1 });
        cables.cables = [{ fromModule: 'osc', fromPort: 'sine', toModule: 'filter', toPort: 'audio' }, { fromModule: 'osc', fromPort: 'sine', toModule: 'filter', toPort: 'audio' }];
        expect(() => validateState(cables)).toThrow();
    });
    it('lists only public patches with stable bounded pages, literal search and no state payloads', async () => {
        const image = await preview();
        await service.create(alice, draft({ name: 'Hidden phrase' }));
        for (let i = 0; i < 3; i++) await service.create(alice, draft({ name: `Public phrase ${i}`, visibility: 'public', previewId: image.id }));
        const first = await service.list({ publicOnly: true, query: 'phrase', limit: 2 });
        const second = await service.list({ publicOnly: true, query: 'phrase', limit: 2, before: first.nextCursor });
        expect(first.patches).toHaveLength(2); expect(second.patches).toHaveLength(1);
        expect(new Set([...first.patches, ...second.patches].map(p => p.id)).size).toBe(3);
        expect(first.patches[0]).not.toHaveProperty('state'); expect(first.patches[0]).toHaveProperty('moduleCount', 1);
        expect((await service.list({ publicOnly: true, query: '%' })).patches).toHaveLength(0);
        await expect(service.list({ publicOnly: true, limit: 100000 })).rejects.toMatchObject({ status: 400 });
    });
    it('enforces write rate limits across requests in the shared store', async () => {
        const patch = await service.create(alice, draft());
        for (let n = 1; n < 30; n++) await service.update(alice, patch.id, { state: state(), expectedRevision: n });
        await expect(service.update(alice, patch.id, { state: state(), expectedRevision: 30 })).rejects.toMatchObject({ status: 429 });
    });
    it('enforces patch quota atomically under concurrent creates', async () => {
        for (let n = 0; n < 99; n++) { clock = new Date(clock.getTime() + 61000); await service.create(alice, draft()); }
        const results = await Promise.allSettled([service.create(alice, draft()), service.create(alice, draft())]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(r => r.status === 'rejected').reason).toMatchObject({ code: 'patch_quota' });
    });
    it('bounds actual bytes even when Content-Length is missing', async () => {
        const response = await request('/api/patches', { user: 'alice', method: 'POST', body: { garbage: 'x'.repeat(300000) } });
        expect(response.status).toBe(413);
    });
    it('handles the multipart preview API followed by public JSON save and image fetch', async () => {
        const form = new FormData(); form.set('state', JSON.stringify(state())); form.set('image', new Blob([png], { type: 'image/png' }), 'rack.png');
        const uploaded = await handler(new Request('https://rack.example/api/patch-previews', { method: 'POST', headers: { origin: 'https://rack.example', 'x-test-user': 'alice' }, body: form }));
        expect(uploaded.status).toBe(201); const image = await uploaded.json();
        const response = await request('/api/patches', { user: 'alice', method: 'POST', body: draft({ visibility: 'public', previewId: image.id }) });
        expect(response.status).toBe(201); const patch = await response.json();
        const result = await request(patch.images.thumbnail); expect(result.status).toBe(200); expect(result.headers.get('content-type')).toBe('image/png');
    });
});
