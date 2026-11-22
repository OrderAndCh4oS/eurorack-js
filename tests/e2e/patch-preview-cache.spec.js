import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('saves an 18-row rack with both themed previews', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'eurorack-test-user', value: 'alice', url: baseURL }]);
    // A cropped top-left corner can still produce two valid, richly coloured
    // PNGs. Mark the last row in the preview frame to verify it made the save.
    await page.route('**/industrial-theme.css', async route => {
        const response = await route.fetch();
        const marker = '#patch-preview-rack .rack-row[data-row="18"]::after { inset: 0; height: 100%; background: lime; z-index: 200; }';
        await route.fulfill({ response, body: (await response.text()) + '\n' + marker });
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary?.user);
    await page.evaluate(async () => {
        const app = window.eurorackApp;
        const modules = Array.from({ length: 252 }, (_, i) => ({
            id: `bus${i}`, type: 'mix', row: 1 + Math.floor(i / 14), index: i % 14
        }));
        const cables = modules.slice(1).flatMap(({ id }, i) => [
            { fromModule: `bus${i}`, fromPort: 'out', toModule: id, toPort: 'in1' },
            { fromModule: 'bus0', fromPort: 'out', toModule: id, toPort: 'in2' }
        ]);
        await app.loadPatchState({ version: 3, plugins: { core: 1 }, modules, params: {}, cables, midiMappings: {} }, { managed: true });
        void app.patchLibrary.openSave({ destination: 'cloud', publish: true });
    });
    const dialog = page.getByRole('dialog', { name: 'Save and publish' });
    await dialog.getByLabel('Patch name').fill('Dense routing preview');
    await dialog.getByRole('button', { name: 'Save and publish' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 25000 });
    const saved = await page.evaluate(() => window.eurorackApp.patchLibrary.active);
    expect(saved.visibility).toBe('public');
    expect(saved.state.modules).toHaveLength(252);
    expect(saved.state.cables).toHaveLength(502);
    const images = await Promise.all([saved.images.full, saved.images.dark.full].map(url => page.request.get(url)));
    for (const image of images) {
        expect(image.status()).toBe(200);
        expect(image.headers()['content-type']).toBe('image/png');
    }
    const [light, dark] = await Promise.all(images.map(image => image.body()));
    expect(light.equals(dark)).toBe(false);
    for (const png of [light, dark]) {
        const { width, height } = await sharp(png).metadata();
        const region = { left: Math.floor(width / 2), top: Math.floor(height * 0.97), width: 8, height: 8 };
        const pixels = await sharp(png).extract(region).removeAlpha().raw().toBuffer();
        const green = pixels.filter((value, i) => i % 3 === 1 && value > 230 && pixels[i - 1] < 25 && pixels[i + 1] < 25);
        expect(green.length).toBeGreaterThan(region.width * region.height / 2);
    }
});

test('loads test patch thumbnails without creating rack renderers', async ({ page }) => {
    const renderers = [];
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/patch-preview.html')) renderers.push(request.url()); });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary);
    await page.locator('[data-patch-view="tests"]').click();
    for (let index = 0; index < 3; index++) {
        const image = page.locator('.patch-entry img').nth(index);
        await expect(image).toHaveAttribute('src', /\/patch-previews\/[a-f0-9]{64}\.webp$/);
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    }
    const first = page.locator('.patch-entry img').first();
    const light = await first.getAttribute('src');
    const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
    await toggle.click();
    await expect(first).toHaveAttribute('src', /\/patch-previews\/[a-f0-9]{64}\.webp$/);
    await expect(first).not.toHaveAttribute('src', light);
    await toggle.click();
    await expect(first).toHaveAttribute('src', light);
    expect(renderers).toEqual([]);
});

test('opening My patches caches both browser thumbnails and reuses them after reload', async ({ page }) => {
    let captures = 0;
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/patch-preview.html')) captures++; });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary);
    await page.evaluate(async () => {
        const { TEST_PATCHES } = await import('/js/config/test-patches.js');
        const patch = Object.values(TEST_PATCHES)[0];
        localStorage.setItem('eurorack-patches', JSON.stringify({ 'Cached local rack': { name: 'Cached local rack', state: patch.state, factory: false } }));
    });
    const openAndWait = async () => {
        await page.locator('[data-patch-view="mine"]').click();
        const image = page.locator('[data-patch-name="Cached local rack"] img');
        await expect(image).toBeVisible({ timeout: 30000 });
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    };
    await openAndWait();
    await expect.poll(() => page.evaluate(async () => (await (await caches.open('eurorack-local-rack-previews-v1')).keys()).length)).toBe(2);
    expect(captures).toBe(2);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary);
    await openAndWait();
    expect(captures).toBe(2);
});
