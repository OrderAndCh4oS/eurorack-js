import { createPatchService } from './patch-service.js';
import { LIMITS, HttpError, assert, id } from './validation.js';
import { patchHtml } from './html.js';
import { rackPage } from './rack-page.js';
import { readConfig } from './config.js';
import { timingSafeEqual } from 'node:crypto';

const securityHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Vercel-CDN-Cache-Control': 'no-store',
    'CDN-Cache-Control': 'no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' } }); }
async function boundedBody(request, maximum) {
    assert(Number(request.headers.get('content-length') || 0) <= maximum, 'Request body is too large.', 413, 'request_too_large');
    const chunks = []; let length = 0; const reader = request.body?.getReader();
    if (!reader) return new Uint8Array();
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length;
        if (length > maximum) { await reader.cancel(); throw new HttpError(413, 'request_too_large', 'Request body is too large.'); } chunks.push(value); }
    return Buffer.concat(chunks, length);
}
async function readJson(request) {
    assert(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'Use application/json.', 415, 'unsupported_media_type');
    try { const value = JSON.parse(Buffer.from(await boundedBody(request, LIMITS.stateBytes + 16384)).toString('utf8'));
        assert(value && !Array.isArray(value) && typeof value === 'object', 'Expected a JSON object.'); return value;
    } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'invalid_json', 'Invalid JSON request.'); }
}
export function createHandler({ store, authenticate = async () => null, authHandler, imageStore, baseUrl = 'http://localhost:3000', enabled = true, configurationMessage, cleanupSecret, service: suppliedService, ...serviceOptions } = {}) {
    const service = suppliedService || (store && createPatchService({ store, imageStore, ...serviceOptions }));
    const origin = new URL(baseUrl).origin;
    return async request => {
        const url = new URL(request.url); const path = url.pathname.replace(/\/$/, '') || '/'; const method = request.method;
        try {
            if (path === '/api/config' && method === 'GET') return json({ enabled, authEnabled: enabled, imagesEnabled: enabled && !!imageStore, limits: LIMITS,
                ...(!enabled ? { message: configurationMessage || 'Account saving is unavailable. Try again later.' } : {}) });
            const detail = /^\/patches\/([0-7][0-9A-HJKMNP-TV-Z]{25})$/.exec(path);
            if (!enabled) {
                if (detail && method === 'GET') return new Response(await rackPage(null, origin, detail[1]), { status: 503, headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
                throw new HttpError(503, 'cloud_not_configured', configurationMessage || 'Account saving is unavailable. Try again later.');
            }
            if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
                assert(request.headers.get('origin') === origin, 'Refresh the page and try again.', 403, 'invalid_origin');
                assert(request.headers.get('sec-fetch-site') !== 'cross-site', 'Refresh the page and try again.', 403, 'invalid_origin');
            }
            if (path.startsWith('/api/auth/')) {
                assert(authHandler, 'Sign-in is unavailable. Try again later.', 503, 'auth_unavailable'); return authHandler(request);
            }
            if (path === '/api/internal/cleanup-previews' && method === 'GET') {
                const provided = Buffer.from(request.headers.get('authorization') || '');
                const expected = Buffer.from(`Bearer ${cleanupSecret || ''}`);
                assert(cleanupSecret && provided.length === expected.length && timingSafeEqual(provided, expected), 'Unauthorized.', 401, 'unauthorized');
                return json(await service.cleanupPreviews());
            }
            const user = await authenticate(request);
            if (path === '/api/me' && method === 'GET') return json({ configured: true, user: await service.me(user) });
            if (path === '/api/me' && method === 'PATCH') return json({ user: await service.updateProfile(user, await readJson(request)) });
            if ((path === '/api/public-patches' || path === '/api/patches') && method === 'GET') return json(await service.list({
                user, publicOnly: path === '/api/public-patches', query: url.searchParams.get('q') || '', before: url.searchParams.get('cursor'),
                sort: url.searchParams.get('sort') || 'newest', period: url.searchParams.get('period') || 'all', limit: Number(url.searchParams.get('limit') || LIMITS.pageSize)
            }));
            if (path === '/api/patches' && method === 'POST') return json(await service.create(user, await readJson(request)), 201);
            if (path === '/api/patch-previews' && method === 'POST') {
                assert(user, 'Sign in to upload a rack preview.', 401, 'sign_in_required');
                assert(request.headers.get('content-type')?.startsWith('multipart/form-data;'), 'Upload a multipart rack image and state.', 415, 'unsupported_media_type');
                const bytes = await boundedBody(request, LIMITS.uploadBytes + LIMITS.stateBytes + 16384);
                let form; try { form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') }, body: bytes }).formData(); }
                catch { throw new HttpError(400, 'invalid_upload', 'Invalid rack image upload.'); }
                const file = form.get('image'); assert(file && typeof file.arrayBuffer === 'function', 'Rack image is required.');
                let state; try { state = JSON.parse(form.get('state')); } catch { throw new HttpError(400, 'invalid_patch', 'Upload the exact saved patch state with its image.'); }
                return json(await service.uploadPreview(user, { state, rendererVersion: form.get('rendererVersion') || undefined, theme: form.get('theme') || undefined }, Buffer.from(await file.arrayBuffer())), 201);
            }
            const match = /^\/api\/patches\/([0-7][0-9A-HJKMNP-TV-Z]{25})(?:\/(visibility|like|copies))?$/.exec(path);
            if (match) {
                const [, patchId, action] = match;
                if (!action && method === 'GET') return json(await service.get(patchId, user));
                if (!action && method === 'PUT') return json(await service.update(user, patchId, await readJson(request)));
                if (!action && method === 'DELETE') return json(await service.remove(user, patchId, await readJson(request)));
                if (action === 'visibility' && method === 'PUT') return json(await service.setVisibility(user, patchId, await readJson(request)));
                if (action === 'like' && method === 'PUT') return json(await service.like(user, patchId, (await readJson(request)).liked));
                if (action === 'copies' && method === 'POST') return json(await service.copy(user, patchId, await readJson(request)), 201);
                throw new HttpError(405, 'method_not_allowed', 'This method is not supported.');
            }
            const image = /^\/patches\/([^/]+)\/images\/([^/]+)\/(full|thumbnail|social)(?:\.png)?$/.exec(path);
            if (image && ['GET', 'HEAD'].includes(method)) {
                const { bytes, visibility, contentType, etag, length, notModified } = await service.image(user, image[1], image[2], image[3], {
                    includeAccess: true, ifNoneMatch: request.headers.get('if-none-match'), head: method === 'HEAD'
                });
                // Public previews must be embeddable by social sites. Private images keep
                // their session checks and same-origin restriction, including after a toggle.
                const publicImage = visibility === 'public';
                return new Response(method === 'HEAD' || notModified ? null : bytes, { status: notModified ? 304 : 200, headers: { ...securityHeaders,
                    // Browser storage is allowed, but every reuse revalidates current
                    // visibility. Shared response caches remain disabled above.
                    'Cache-Control': 'private, no-cache, max-age=0, must-revalidate', ETag: etag,
                    'Content-Type': contentType, 'Content-Disposition': 'inline',
                    ...(!notModified ? { 'Content-Length': String(length) } : {}),
                    'Cross-Origin-Resource-Policy': publicImage ? 'cross-origin' : 'same-origin',
                    ...(publicImage ? { 'Access-Control-Allow-Origin': '*' } : {}) } });
            }
            if (detail && ['GET', 'HEAD'].includes(method)) {
                let patch = null;
                // Social HTML always uses anonymous visibility. Owner data is fetched by the page
                // using its session, so crawlers and intermediary caches never see private metadata.
                try { patch = await service.get(detail[1], null); } catch (error) { if (error.status !== 404) throw error; }
                if (url.searchParams.get('view') !== 'details') {
                    return new Response(method === 'HEAD' ? null : await rackPage(patch, origin, detail[1]), {
                        status: patch ? 200 : 404,
                        headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8',
                            'Content-Security-Policy': "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }
                    });
                }
                return new Response(method === 'HEAD' ? null : patchHtml(patch, origin, detail[1]), { status: patch ? 200 : 404, headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" } });
            }
            throw new HttpError(404, 'not_found', 'Not found.');
        } catch (error) {
            if (!(error instanceof HttpError)) {
                // Do not log request bodies, database connection strings, OAuth tokens or email.
                console.error('Cloud patch request failed', { name: error?.name || 'Error' });
                return json({ error: { code: 'service_unavailable', message: 'Saved patches are unavailable. Try again later.' } }, 503);
            }
            return json({ error: { code: error.code, message: error.message } }, error.status);
        }
    };
}

let production;
export async function productionHandler(request) {
    if (!production) production = (async () => {
        const config = readConfig();
        if (!config.enabled) return createHandler({ enabled: false, baseUrl: config.baseUrl || 'http://localhost:3000' });
        const [{ Pool }, { createAuth }, { PostgresStore }, { createImageStore }] = await Promise.all([import('pg'), import('./auth.js'), import('./postgres-store.js'), import('./image-store.js')]);
        const pool = new Pool({ connectionString: config.databaseUrl, max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000 });
        const auth = createAuth(pool, process.env);
        return createHandler({ store: new PostgresStore(pool), baseUrl: config.baseUrl, cleanupSecret: process.env.CRON_SECRET, authHandler: request => auth.handler(request),
            authenticate: async request => (await auth.api.getSession({ headers: request.headers }))?.user || null,
            imageStore: config.imagesEnabled ? await createImageStore(process.env) : undefined });
    })().catch(error => { production = undefined; throw error; });
    try { return await (await production)(request); }
    catch { return json({ error: { code: 'service_unavailable', message: 'Saved patches are unavailable. Try again later.' } }, 503); }
}
export default productionHandler;
