import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { ulid } from 'ulid';

const origin = 'http://127.0.0.1:4176';
test('public card images load on another website with and without CORS', async ({ browser }) => {
    const owner = await browser.newContext();
    await owner.addCookies([{ name: 'eurorack-test-user', value: 'alice', url: origin }]);
    const visitor = await browser.newContext();
    await visitor.grantPermissions(['local-network-access'], { origin: 'http://127.0.0.1:4177' });
    try {
        const state = { version: 3, plugins: { core: 1 }, modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }], params: {}, cables: [], midiMappings: {} };
        const png = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#ff4a0a' } }).png().toBuffer();
        const upload = await owner.request.post(`${origin}/api/patch-previews`, { headers: { origin }, multipart: {
            state: JSON.stringify(state), image: { name: 'rack.png', mimeType: 'image/png', buffer: png }
        } });
        expect(upload.status()).toBe(201);
        const preview = await upload.json();
        const create = await owner.request.post(`${origin}/api/patches`, { headers: { origin }, data: {
            requestId: ulid(), name: 'Social image test', visibility: 'public', state, previewId: preview.id
        } });
        expect(create.status()).toBe(201);
        const patch = await create.json();
        const probe = await visitor.request.get(`${origin}${patch.images.social}`);
        expect(probe.status()).toBe(200);
        expect(probe.headers()['cross-origin-resource-policy']).toBe('cross-origin');
        expect(probe.headers()['access-control-allow-origin']).toBe('*');
        const page = await visitor.newPage();
        const diagnostics = [];
        page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
        page.on('requestfailed', request => diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`));
        // The fixture uses a different origin. Explicit local-network permission
        // keeps Chrome's loopback gate separate from the image's CORP/CORS policy.
        await page.route('http://127.0.0.1:4177/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Social preview</title><main></main>' }));
        await page.goto('http://127.0.0.1:4177/');
        const result = await page.evaluate(async imageUrl => {
            const load = crossOrigin => new Promise(resolve => {
                const img = new Image();
                if (crossOrigin) img.crossOrigin = 'anonymous';
                img.onload = () => resolve({ loaded: true, width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve({ loaded: false });
                img.src = imageUrl; document.querySelector('main').append(img);
            });
            return Promise.all([load(false), load(true)]);
        }, `${origin}${patch.images.social}`);
        expect(result, diagnostics.join('\n')).toEqual([{ loaded: true, width: 1200, height: 630 }, { loaded: true, width: 1200, height: 630 }]);
        const hidden = await owner.request.put(`${origin}/api/patches/${patch.id}/visibility`, { headers: { origin }, data: { visibility: 'private', expectedRevision: patch.revision } });
        expect(hidden.status()).toBe(200);
        expect((await visitor.request.get(`${origin}${patch.images.social}`)).status()).toBe(404);
    } finally { await Promise.allSettled([owner.close(), visitor.close()]); }
});
