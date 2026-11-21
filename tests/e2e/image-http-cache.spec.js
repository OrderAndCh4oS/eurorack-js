import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { ulid } from 'ulid';

const origin = 'http://127.0.0.1:4176';
const headers = { origin };
const state = {
    version: 3, plugins: { core: 1 },
    modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }, { id: 'output', type: 'out', row: 1, index: 1 }],
    params: { osc: { coarse: 0.25 }, output: { volume: 0.4 } },
    cables: ['L', 'R'].map(toPort => ({ fromModule: 'osc', fromPort: 'triangle', toModule: 'output', toPort })),
    midiMappings: {}
};

async function json(response, status = 200) {
    expect(response.status(), await response.text()).toBe(status);
    return response.json();
}

test('a dark gallery card replaces an existing blank file with a visible rack', async ({ page, request }) => {
    const owner = { ...headers, cookie: 'eurorack-test-user=alice' };
    const flat = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#171813' } }).png().toBuffer();
    const light = await sharp(flat).composite([{ input: { create: { width: 60, height: 50, channels: 3, background: '#e5dfce' } } }]).png().toBuffer();
    const preview = await json(await request.post('/api/patch-previews', { headers: owner, multipart: {
        state: JSON.stringify(state), image: { name: 'light.png', mimeType: 'image/png', buffer: light },
        darkImage: { name: 'dark.png', mimeType: 'image/png', buffer: flat }
    } }), 201);
    const name = `Blank rack ${ulid()}`;
    const record = await json(await request.post('/api/patches', { headers: owner, data: {
        name, requestId: ulid(), state, visibility: 'public', previewId: preview.id
    } }), 201);
    try {
        await page.goto('/');
        await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
        await page.goto('/patches?q=' + encodeURIComponent(name));
        const img = page.locator(`article[data-patch-id="${record.id}"] img`);
        await expect(img).toHaveAttribute('src', /dark-thumbnail\?v=/, { timeout: 45000 });
        await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
        const repaired = await json(await request.get(`/api/patches/${record.id}`));
        expect(repaired.images.thumbnail).toBe(record.images.thumbnail);
        expect(repaired.revision).toBe(record.revision);
        const response = await request.get(repaired.images.dark.thumbnail);
        const stats = await sharp(await response.body()).stats();
        expect(stats.channels[0].stdev).toBeGreaterThan(10);
    } finally {
        await request.delete(`/api/patches/${record.id}`, { headers: owner, data: { expectedRevision: record.revision } });
    }
});

test('the list saves missing artwork for a public patch, preserves its light cache and supports later saves', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext();
    await context.addCookies([{ name: 'eurorack-test-user', value: 'alice', url: origin }]);
    let patchId;
    try {
        const png = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#eeeade' } })
            .composite([{ input: { create: { width: 40, height: 50, channels: 3, background: '#333' } } }]).png().toBuffer();
        const preview = await json(await context.request.post(`${origin}/api/patch-previews`, { headers, multipart: {
            state: JSON.stringify(state), image: { name: 'rack.png', mimeType: 'image/png', buffer: png }
        } }), 201);
        const name = `Image cache ${ulid()}`;
        const original = await json(await context.request.post(`${origin}/api/patches`, { headers, data: {
            requestId: ulid(), name, state, visibility: 'public', previewId: preview.id
        } }), 201);
        patchId = original.id;
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        const requests = new Map();
        const update = (requestId, values) => requests.set(requestId, { ...requests.get(requestId), ...values });
        // ExtraInfo exposes the actual wire 304; Playwright's response combines
        // that response with its cached body and reports the original 200.
        await cdp.send('Network.enable');
        cdp.on('Network.requestWillBeSent', event => update(event.requestId, { url: event.request.url }));
        cdp.on('Network.requestWillBeSentExtraInfo', event => update(event.requestId, { requestHeaders: event.headers }));
        cdp.on('Network.responseReceivedExtraInfo', event => update(event.requestId, { status: event.statusCode, responseHeaders: event.headers }));
        let previewUploads = 0;
        page.on('request', request => {
            if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/patch-previews') previewUploads++;
        });
        const entriesFor = path => [...requests.values()].filter(request => request.url === `${origin}${path}`);
        const header = (values, name) => Object.entries(values || {}).find(([key]) => key.toLowerCase() === name)?.[1];
        const card = page.locator(`.patch-entry[data-patch-id="${patchId}"]`);
        const waitForThumbnail = async path => {
            const image = card.locator('img');
            await expect(image).toHaveAttribute('src', path);
            await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        };
        const returnToGallery = async path => {
            await card.getByRole('button', { name: 'Open in rack', exact: true }).click();
            await expect(page.locator('#module-osc')).toBeVisible();
            await page.locator('[data-patch-view="public"]').click();
            await waitForThumbnail(path);
        };
        const reloadAndExpectConditionalHit = async (path, etag) => {
            // A same-document return may reuse Chromium's decoded image without
            // a request. A full reload must revalidate instead of downloading it.
            expect(entriesFor(path).filter(request => request.status === 200)).toHaveLength(1);
            await page.reload();
            await waitForThumbnail(path);
            await expect.poll(() => entriesFor(path).some(request => request.status === 304
                && header(request.requestHeaders, 'if-none-match') === etag)).toBe(true);
        };

        // No route interception: the browser's real HTTP cache must stay enabled.
        const anonymous = await browser.newContext();
        try {
            const visitor = await anonymous.newPage();
            await visitor.goto(`${origin}/patches?q=${encodeURIComponent(name)}`);
            await visitor.getByRole('button', { name: 'Dark mode', exact: true }).click();
            const thumbnail = visitor.locator(`article[data-patch-id="${patchId}"] img`);
            await expect(thumbnail).toHaveAttribute('src', /\/dark-thumbnail$/, { timeout: 45000 });
            await expect.poll(() => thumbnail.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
            const pixels = await thumbnail.evaluate(img => {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 64, 64);
                return Array.from(ctx.getImageData(0, 0, 64, 64).data).filter((_, i) => i % 4 === 0);
            });
            expect(pixels.filter(red => Math.abs(red - pixels[0]) > 14).length).toBeGreaterThan(200);
        } finally { await anonymous.close(); }
        expect(original.images.dark).toBeUndefined();
        const repaired = await json(await context.request.get(`${origin}/api/patches/${patchId}`));
        expect(repaired.images.thumbnail).toBe(original.images.thumbnail);
        expect(repaired.previewId).toBe(original.previewId);
        expect(repaired.updatedAt).toBe(original.updatedAt);
        expect(repaired.revision).toBe(original.revision);
        expect(repaired.stateHash).toBe(original.stateHash);
        const repairs = [];
        page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/previews')) repairs.push(request.url()); });
        await page.goto(`${origin}/patches?q=${encodeURIComponent(name)}`);
        const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
        await waitForThumbnail(original.images.thumbnail);
        await expect.poll(() => entriesFor(original.images.thumbnail).some(request => request.status === 200)).toBe(true);
        const originalEtag = header(entriesFor(original.images.thumbnail).find(request => request.status === 200).responseHeaders, 'etag');
        expect(originalEtag).toBeTruthy();
        await returnToGallery(original.images.thumbnail);
        await reloadAndExpectConditionalHit(original.images.thumbnail, originalEtag);

        await card.getByRole('button', { name: 'Open in rack', exact: true }).click();
        await expect(page.locator('#module-osc')).toBeVisible();
        await page.locator('#savePatch').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 30000 });
        expect(previewUploads).toBe(1);
        const saved = await json(await context.request.get(`${origin}/api/patches/${patchId}`));
        expect(saved.previewId).not.toBe(original.previewId);
        expect(saved.state.params.osc.coarse).toBe(original.state.params.osc.coarse);
        for (const [variant, format, width, height] of [['thumbnail', 'webp', 640, 420], ['full', 'png', 1600, 1600], ['social', 'png', 1200, 630]]) {
            expect(saved.images[variant]).not.toBe(original.images[variant]);
            const response = await context.request.get(`${origin}${saved.images[variant]}`);
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toBe(`image/${format}`);
            const metadata = await sharp(await response.body()).metadata();
            expect(metadata.format).toBe(format);
            expect(metadata.width).toBeLessThanOrEqual(width);
            expect(metadata.height).toBeLessThanOrEqual(height);
            if (variant === 'social') expect([metadata.width, metadata.height]).toEqual([width, height]);
            const darkResponse = await context.request.get(`${origin}${saved.images.dark[variant]}`);
            expect(darkResponse.status()).toBe(200);
            const darkBytes = await darkResponse.body();
            const dark = await sharp(darkBytes).metadata();
            expect([dark.format, dark.width, dark.height]).toEqual([format, metadata.width, metadata.height]);
            if (variant === 'full') {
                const corner = bytes => sharp(bytes).removeAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
                expect((await corner(await response.body()))[0]).toBeGreaterThan(200);
                expect((await corner(darkBytes))[0]).toBeLessThan(50);
            }
        }
        expect((await context.request.get(`${origin}${original.images.thumbnail}`, { headers: { 'If-None-Match': originalEtag } })).status()).toBe(404);

        await page.locator('[data-patch-view="public"]').click();
        await toggle.click();
        await waitForThumbnail(saved.images.dark.thumbnail);
        await toggle.click();
        await waitForThumbnail(saved.images.thumbnail);
        await expect.poll(() => entriesFor(saved.images.thumbnail).some(request => request.status === 200)).toBe(true);
        const savedEtag = header(entriesFor(saved.images.thumbnail).find(request => request.status === 200).responseHeaders, 'etag');
        expect(savedEtag).not.toBe(originalEtag);
        await returnToGallery(saved.images.thumbnail);
        await reloadAndExpectConditionalHit(saved.images.thumbnail, savedEtag);
        await page.goto(`${origin}/patches/${patchId}?view=details`);
        await toggle.click();
        await expect.poll(() => page.locator('.rack-preview').evaluate(img => img.currentSrc)).toBe(origin + saved.images.dark.full);
        await toggle.click();
        await expect.poll(() => page.locator('.rack-preview').evaluate(img => img.currentSrc)).toBe(origin + saved.images.full);
        expect(previewUploads).toBe(1);
        expect(repairs).toEqual([]);
    } finally {
        if (patchId) {
            const response = await context.request.get(`${origin}/api/patches/${patchId}`);
            if (response.ok()) await context.request.delete(`${origin}/api/patches/${patchId}`, { headers, data: { expectedRevision: (await response.json()).revision } });
        }
        await context.close();
    }
});
