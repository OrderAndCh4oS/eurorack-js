import { productionHandler } from '../server/handler.js';
import { HttpError } from '../server/validation.js';

// Vercel's Web Handler format preserves streaming Request bodies and every auth Set-Cookie.
// Explicit route forwarding also handles runtimes that expose the rewritten destination
// instead of the source pathname. It conveys routing only; authorization stays in handler.js.
export function forwardedRequest(request) {
    const url = new URL(request.url);
    const routes = url.searchParams.getAll('__path');
    if (routes.length > 1) throw new HttpError(400, 'invalid_route', 'Ambiguous application route.');
    const route = routes[0];
    if (route !== undefined && !/^\/(?:api\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*|patches\/[0-7][0-9A-HJKMNP-TV-Z]{25}(?:\/images\/[0-7][0-9A-HJKMNP-TV-Z]{25}\/(?:thumbnail|(?:full|thumbnail|social)\.png))?)\/?$/.test(route)) {
        throw new HttpError(400, 'invalid_route', 'Invalid application route.');
    }
    if (route && ['/api', '/api/', '/api/index', '/api/index.js'].includes(url.pathname)) {
        url.pathname = route;
    }
    if (route) { url.searchParams.delete('__path'); return new Request(url, request); }
    return request;
}
export default { async fetch(request) {
    try { return await productionHandler(forwardedRequest(request)); }
    catch (error) {
        if (!(error instanceof HttpError)) throw error;
        return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status,
            headers: { 'Cache-Control': 'private, no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
} };
