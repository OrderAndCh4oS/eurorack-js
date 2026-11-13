import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { productionHandler } from '../server/handler.js';

const port = Number(process.env.PORT || 4176);
const origin = `http://127.0.0.1:${port}`;
const root = fileURLToPath(new URL('../dist/', import.meta.url));
let handler = productionHandler;
if (process.env.EURORACK_TEST_BACKEND === '1') {
    // The test identity provider is never imported by api/index.js or on Vercel.
    if (process.env.NODE_ENV !== 'test' || process.env.VERCEL) throw new Error('Test backend requires local NODE_ENV=test.');
    const { createTestBackend } = await import('../tests/server/test-backend.js');
    handler = createTestBackend({ baseUrl: origin }).handler;
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
createServer(async (incoming, outgoing) => {
    try {
        const url = new URL(incoming.url, origin);
        if (url.pathname.startsWith('/api/') || /^\/patches\/[^/]+/.test(url.pathname)) {
            const request = new Request(url, { method: incoming.method, headers: incoming.headers,
                ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
            const response = await handler(request);
            outgoing.statusCode = response.status;
            for (const [key, value] of response.headers) if (key !== 'set-cookie') outgoing.setHeader(key, value);
            if (response.headers.getSetCookie().length) outgoing.setHeader('set-cookie', response.headers.getSetCookie());
            if (incoming.method === 'HEAD' || !response.body) outgoing.end();
            else Readable.fromWeb(response.body).pipe(outgoing);
            return;
        }
        if (url.pathname === '/patches/') { outgoing.writeHead(308, { Location: '/patches' }); outgoing.end(); return; }
        if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
        const legalAlias = { '/privacy': '/privacy-policy', '/terms': '/terms-of-service' }[url.pathname];
        if (legalAlias) { outgoing.writeHead(308, { Location: legalAlias }); outgoing.end(); return; }
        const pathname = ['/', '/patches'].includes(url.pathname) ? '/index.html'
            : ['/privacy-policy', '/terms-of-service'].includes(url.pathname) ? `${url.pathname}.html` : decodeURIComponent(url.pathname);
        const file = resolve(root, `.${pathname}`);
        if (!file.startsWith(`${resolve(root)}${sep}`) || !(await stat(file)).isFile()) { outgoing.writeHead(404); outgoing.end(); return; }
        outgoing.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        outgoing.end(incoming.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
        outgoing.writeHead(error.code === 'ENOENT' ? 404 : 500);
        outgoing.end(error.code === 'ENOENT' ? 'Not found.' : 'Unable to serve request.');
    }
}).listen(port, '127.0.0.1', () => console.log(`Eurorack: ${origin}${process.env.EURORACK_TEST_BACKEND === '1' ? ' (isolated test backend)' : ''}`));
