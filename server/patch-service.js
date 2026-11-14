import { ulid } from 'ulid';
import { LIMITS, assert, id, revision, hash, textField, publicName, visibility, validateState, HttpError } from './validation.js';
import { rasterVariants } from './image-store.js';
import { cataloguePage } from './catalogue-pagination.js';

export function createPatchService({ store, imageStore, now = () => new Date(), generateId = ulid, contracts }) {
    const timestamp = () => now().toISOString();
    function signedIn(user) { assert(user?.id, 'Sign in to continue.', 401, 'sign_in_required'); return user; }
    function accessible(patch, user) { assert(patch && (patch.visibility === 'public' || patch.ownerId === user?.id), 'Patch not found.', 404, 'not_found'); return patch; }
    function owned(patch, user) { signedIn(user); assert(patch && patch.ownerId === user.id, 'Patch not found.', 404, 'not_found'); return patch; }
    function current(patch, expected) { assert(patch.revision === revision(expected), 'This patch has changed. Reload it or save a copy.', 409, 'revision_conflict'); }
    async function rate(tx, user, kind, maximum) {
        const allowed = await tx.consumeRate(`${kind}:${user.id}`, Math.floor(now().getTime() / 60000), maximum);
        assert(allowed, 'Too many requests. Try again in a minute.', 429, 'rate_limited');
    }
    async function quota(tx, user, nextBytes, previousBytes = 0, creating = false) {
        const totals = await tx.totals(user.id);
        assert(!creating || totals.count < LIMITS.patches, 'Patch limit reached. Delete a patch or save in this browser.', 413, 'patch_quota');
        assert(totals.stateBytes - previousBytes + nextBytes <= LIMITS.accountStateBytes, 'Your account storage is full. Delete a patch or save in this browser.', 413, 'storage_quota');
    }
    async function previewFor(tx, previewId, user, stateHash, required) {
        if (!previewId) { assert(!required, 'Save this patch with a preview before making it public.', 400, 'preview_required'); return null; }
        const preview = await tx.getPreview(id(previewId, 'previewId'));
        assert(preview && preview.ownerId === user.id, 'Rack preview not found.', 404, 'preview_not_found');
        assert(preview.stateHash === stateHash, 'The preview is out of date. Save the patch again.', 409, 'preview_mismatch');
        return preview;
    }
    async function project(tx, patch, user, includeState = true) {
        const parent = patch.parentId ? await tx.getPatch(patch.parentId) : null;
        const root = patch.rootId !== patch.id ? await tx.getPatch(patch.rootId) : patch;
        const canEdit = patch.ownerId === user?.id;
        return { id: patch.id, name: patch.name, description: patch.description, authorName: patch.authorName,
            revision: patch.revision, visibility: patch.visibility, previewId: patch.previewId, moduleCount: patch.state.modules.length,
            createdAt: patch.createdAt, updatedAt: patch.updatedAt, publishedAt: patch.publishedAt,
            savedAfterCopyAt: patch.savedAfterCopyAt,
            requiresSaveBeforePublish: !!patch.requiresSaveBeforePublish || (!!patch.parentId && !patch.savedAfterCopyAt), canEdit,
            ...(includeState ? { state: patch.state, stateHash: patch.stateHash } : {}),
            provenance: { parentId: patch.parentId, rootId: patch.rootId, originalCreatorName: patch.originalCreatorName,
                parentCreatorName: patch.parentCreatorName, parentRevision: patch.parentRevision,
                parentAvailable: !!parent && (parent.visibility === 'public' || parent.ownerId === user?.id),
                rootAvailable: !!root && (root.visibility === 'public' || root.ownerId === user?.id) },
            ...(await tx.likes(patch.id, user?.id)),
            images: patch.previewId ? Object.fromEntries(['thumbnail', 'full', 'social'].map(variant => [variant, `/patches/${patch.id}/images/${patch.previewId}/${variant}.png`])) : null
        };
    }
    function labels(body, previous) {
        const name = textField(body.name, 'Name', 128, previous?.name);
        assert(name, 'Enter a patch name.');
        return { name, description: textField(body.description, 'Description', 1000, previous?.description || '') };
    }
    return {
        async get(patchId, user) { return store.transaction(async tx => project(tx, accessible(await tx.getPatch(id(patchId)), user), user)); },
        async list({ user, publicOnly = false, query, before, sort = 'newest', period = 'all', limit = LIMITS.pageSize }) {
            if (!publicOnly) signedIn(user);
            assert(Number.isInteger(limit) && limit > 0 && limit <= 50, 'Page size must be between 1 and 50.');
            query = textField(query, 'Search', 100, '');
            const ownerId = publicOnly ? undefined : user.id;
            const page = cataloguePage({ publicOnly, ownerId, query, sort, period, limit, cursor: before, now: now() });
            return store.transaction(async tx => {
                const records = await tx.listPatches({ ownerId, publicOnly, query, sort, ...page, limit: limit + 1 });
                const hasMore = records.length > limit;
                const selected = records.slice(0, limit);
                if (page.direction === 'previous') selected.reverse();
                const hasPrevious = page.direction === 'previous' ? hasMore : !!page.boundary;
                const hasNext = page.direction === 'previous' ? !!page.boundary : hasMore;
                return {
                    patches: await Promise.all(selected.map(async p => ({ ...await project(tx, p, user, false), ...(sort === 'popular' ? { popularityCount: p.popularityCount } : {}) }))),
                    nextCursor: selected.length && hasNext ? page.cursorFor(selected.at(-1), 'next') : null,
                    previousCursor: selected.length && hasPrevious ? page.cursorFor(selected[0], 'previous') : null
                };
            });
        },
        async uploadPreview(user, body, bytes) {
            signedIn(user); assert(imageStore, 'Previews are unavailable. Try again later.', 503, 'images_unavailable');
            const validated = validateState(body.state, contracts);
            await store.transaction(async tx => rate(tx, user, 'preview', 12));
            const variants = await rasterVariants(bytes);
            const previewId = generateId();
            const record = { id: previewId, ownerId: user.id, stateHash: validated.stateHash, createdAt: timestamp(),
                rendererVersion: textField(body.rendererVersion, 'Renderer version', 40, 'rack-v1'), theme: textField(body.theme, 'Theme', 40, 'industrial-light'), bytes: 0, variants: {} };
            const uploaded = [];
            try {
                for (const [name, variant] of Object.entries(variants)) {
                    const key = `rack-previews/${previewId}/${name}.png`;
                    uploaded.push(key); await imageStore.put(key, variant.body);
                    record.variants[name] = { key, bytes: variant.body.length, width: variant.width, height: variant.height };
                    record.bytes += variant.body.length;
                }
                await store.transaction(async tx => {
                    const totals = await tx.totals(user.id);
                    assert(totals.imageBytes + record.bytes <= LIMITS.accountImageBytes, 'Your preview storage is full. Save in this browser instead.', 413, 'image_quota');
                    await tx.putPreview(record);
                });
            } catch (error) {
                // Failed uploads may have reached the provider despite a lost response. Queue
                // every attempted key for a later idempotent cleanup, then try immediate removal.
                try { await store.transaction(async tx => { for (const key of uploaded) await tx.addGarbage(key); }); } catch { /* Preserve the original failure if the database is unavailable too. */ }
                await Promise.allSettled(uploaded.map(key => imageStore.delete(key))); throw error;
            }
            return { id: previewId, stateHash: record.stateHash };
        },
        async create(user, body) {
            signedIn(user); id(body.requestId, 'requestId');
            assert(body.copy === undefined || typeof body.copy === 'boolean', 'copy must be true or false.');
            const validated = validateState(body.state, contracts);
            const inputHash = hash(body);
            return store.transaction(async tx => {
                const previous = await tx.findRequest(user.id, body.requestId);
                if (previous) { assert(previous.requestHash === inputHash, 'This save has changed. Close the dialog and try again.', 409, 'idempotency_conflict'); assert(!previous.deleted, 'This patch was deleted.', 409, 'patch_deleted'); return project(tx, previous, user); }
                await rate(tx, user, 'write', 30); await quota(tx, user, validated.stateBytes, 0, true);
                const requestedVisibility = visibility(body.visibility);
                const selectedVisibility = body.copy ? 'private' : requestedVisibility;
                const preview = await previewFor(tx, body.previewId, user, validated.stateHash, selectedVisibility === 'public');
                const patchId = generateId(); const time = timestamp();
                const authorName = publicName(body.authorName ?? (user.name?.includes('@') ? undefined : user.name));
                const patch = { id: patchId, ownerId: user.id, ...labels(body), ...validated, authorName,
                    revision: 1, visibility: selectedVisibility, previewId: preview?.id || null,
                    createdAt: time, updatedAt: time, publishedAt: selectedVisibility === 'public' ? time : null,
                    requestId: body.requestId, requestHash: inputHash, parentId: null, parentRevision: null, rootId: patchId,
                    originalCreatorId: user.id, originalCreatorName: authorName, parentCreatorName: null, savedAfterCopyAt: null,
                    requiresSaveBeforePublish: !!body.copy };
                await tx.putPatch(patch); return project(tx, patch, user);
            });
        },
        async update(user, patchId, body) {
            signedIn(user); id(patchId);
            const validated = validateState(body.state, contracts);
            return store.transaction(async tx => {
                const patch = owned(await tx.getPatch(patchId), user); current(patch, body.expectedRevision);
                await rate(tx, user, 'write', 30); await quota(tx, user, validated.stateBytes, patch.stateBytes);
                const selectedVisibility = visibility(body.visibility ?? patch.visibility);
                const previewId = body.previewId === undefined ? (validated.stateHash === patch.stateHash ? patch.previewId : null) : body.previewId;
                const preview = await previewFor(tx, previewId, user, validated.stateHash, selectedVisibility === 'public');
                const time = timestamp();
                const next = { ...patch, ...labels(body, patch), ...validated,
                    authorName: body.authorName === undefined ? patch.authorName : publicName(body.authorName),
                    visibility: selectedVisibility, previewId: preview?.id || null,
                    revision: patch.revision + 1, updatedAt: time,
                    savedAfterCopyAt: patch.parentId || patch.requiresSaveBeforePublish || patch.savedAfterCopyAt ? time : null,
                    requiresSaveBeforePublish: false,
                    publishedAt: selectedVisibility === 'public' ? (patch.publishedAt || time) : patch.publishedAt };
                await tx.putPatch(next); return project(tx, next, user);
            });
        },
        async setVisibility(user, patchId, body) {
            signedIn(user); id(patchId);
            return store.transaction(async tx => {
                const patch = owned(await tx.getPatch(patchId), user); current(patch, body.expectedRevision);
                const nextVisibility = visibility(body.visibility);
                assert(nextVisibility !== 'public' || (!patch.requiresSaveBeforePublish && (!patch.parentId || patch.savedAfterCopyAt)), 'Save this copy again before making it public.', 409, 'copy_needs_save');
                if (nextVisibility === 'public') await previewFor(tx, patch.previewId, user, patch.stateHash, true);
                await rate(tx, user, 'write', 30);
                const time = timestamp();
                const next = { ...patch, visibility: nextVisibility, revision: patch.revision + 1, updatedAt: time,
                    publishedAt: nextVisibility === 'public' ? (patch.publishedAt || time) : patch.publishedAt };
                await tx.putPatch(next); return project(tx, next, user);
            });
        },
        async remove(user, patchId, body) {
            signedIn(user); id(patchId);
            return store.transaction(async tx => {
                const patch = owned(await tx.getPatch(patchId), user); current(patch, body.expectedRevision);
                await rate(tx, user, 'write', 30); await tx.deletePatch(patch.id);
                return { deleted: true };
            });
        },
        async copy(user, sourceId, body) {
            signedIn(user); id(sourceId); id(body.requestId, 'requestId');
            const inputHash = hash({ sourceId, ...body });
            const edited = body.state === undefined ? null : validateState(body.state, contracts);
            return store.transaction(async tx => {
                const previous = await tx.findRequest(user.id, body.requestId);
                if (previous) { assert(previous.requestHash === inputHash, 'This save has changed. Close the dialog and try again.', 409, 'idempotency_conflict'); assert(!previous.deleted, 'This copy was deleted.', 409, 'patch_deleted'); return project(tx, previous, user); }
                const source = accessible(await tx.getPatch(sourceId), user); current(source, body.expectedRevision);
                await rate(tx, user, 'write', 30);
                const validated = edited || { state: source.state, stateHash: source.stateHash, stateBytes: source.stateBytes };
                await quota(tx, user, validated.stateBytes, 0, true);
                let preview = null;
                if (body.previewId) preview = await previewFor(tx, body.previewId, user, validated.stateHash, false);
                else if (validated.stateHash === source.stateHash && source.previewId) {
                    const original = await tx.getPreview(source.previewId);
                    if (original) {
                        const totals = await tx.totals(user.id);
                        assert(totals.imageBytes + original.bytes <= LIMITS.accountImageBytes, 'Your preview storage is full. Save in this browser instead.', 413, 'image_quota');
                        // Independent association, immutable bytes. Cleanup counts every association.
                        preview = { ...original, id: generateId(), ownerId: user.id, createdAt: timestamp() };
                        await tx.putPreview(preview);
                    }
                }
                const time = timestamp();
                const patch = { id: generateId(), ownerId: user.id, ...labels({ ...body, name: body.name ?? `${source.name.slice(0, 123)} copy` }),
                    ...validated, authorName: publicName(body.authorName ?? (user.name?.includes('@') ? undefined : user.name)),
                    revision: 1, visibility: 'private', previewId: preview?.id || null, createdAt: time, updatedAt: time, publishedAt: null,
                    requestId: body.requestId, requestHash: inputHash, parentId: source.id, parentRevision: source.revision, rootId: source.rootId,
                    originalCreatorId: source.originalCreatorId, originalCreatorName: source.originalCreatorName,
                    parentCreatorName: source.authorName, savedAfterCopyAt: null, requiresSaveBeforePublish: true };
                await tx.putPatch(patch); return project(tx, patch, user);
            });
        },
        async like(user, patchId, liked) {
            signedIn(user); id(patchId); assert(typeof liked === 'boolean', 'liked must be true or false.');
            return store.transaction(async tx => {
                const patch = accessible(await tx.getPatch(patchId), user);
                assert(patch.visibility === 'public', 'Patch not found.', 404, 'not_found');
                assert(patch.ownerId !== user.id, 'You cannot like your own patch.', 400, 'own_patch_like');
                await rate(tx, user, 'like', 60); await tx.setLike(patchId, user.id, liked, timestamp());
                return tx.likes(patchId, user.id);
            });
        },
        async image(user, patchId, previewId, variant, { includeAccess = false } = {}) {
            id(patchId); id(previewId); assert(['full', 'thumbnail', 'social'].includes(variant), 'Image not found.', 404, 'not_found');
            assert(imageStore, 'Previews are unavailable. Try again later.', 503, 'images_unavailable');
            const preview = await store.transaction(async tx => {
                const patch = accessible(await tx.getPatch(patchId), user);
                assert(patch.previewId === previewId, 'Image not found.', 404, 'not_found');
                const image = await tx.getPreview(previewId);
                assert(image && image.stateHash === patch.stateHash, 'Image not found.', 404, 'not_found'); return image;
            });
            let bytes;
            try { bytes = await imageStore.get(preview.variants[variant].key); }
            catch { throw new HttpError(503, 'image_unavailable', 'Preview unavailable. Try again later.'); }
            // Storage may be slow. Recheck visibility and the active image after retrieval so a
            // privacy change or newer saved rack cannot be overtaken by an in-flight download.
            const visibility = await store.transaction(async tx => {
                const patch = accessible(await tx.getPatch(patchId), user);
                assert(patch.previewId === previewId && patch.stateHash === preview.stateHash, 'Image not found.', 404, 'not_found');
                return patch.visibility;
            });
            return includeAccess ? { bytes, visibility } : bytes;
        },
        async cleanupPreviews() {
            assert(imageStore, 'Image storage is not configured.', 503);
            // A 24 hour grace period keeps failed/slow saves retryable. Detach associations and
            // queue their unused keys atomically; remote object deletion cannot be rolled back.
            const removed = await store.transaction(async tx => {
                let removed = 0;
                const candidates = new Set();
                for (const preview of await tx.listPreviews()) {
                    if (now().getTime() - Date.parse(preview.createdAt) < 86400000 || await tx.previewReferences(preview.id)) continue;
                    for (const variant of Object.values(preview.variants)) candidates.add(variant.key);
                    await tx.deletePreview(preview.id); removed++;
                }
                for (const key of candidates) if (await tx.objectReferences(key) === 0) await tx.addGarbage(key);
                return removed;
            });
            for (const key of await store.listGarbage()) {
                // Only internally generated immutable keys are ever enqueued. Once their final
                // association is removed, neither a copy nor a save can introduce a new one.
                try { await imageStore.delete(key); await store.deleteGarbage(key); }
                catch { /* The durable queue retains failed deletions for the next run. */ }
            }
            return { removed, pendingObjects: await store.garbageCount() };
        }
    };
}
