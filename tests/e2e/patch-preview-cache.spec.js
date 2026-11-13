import { expect, test } from '@playwright/test';

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
    expect(renderers).toEqual([]);
});

test('reuses a browser patch thumbnail after a full reload', async ({ page }) => {
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
    expect(captures).toBe(1);
    expect(await page.evaluate(async () => (await (await caches.open('eurorack-local-rack-previews-v1')).keys()).length)).toBe(1);
    await page.reload();
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary);
    await openAndWait();
    expect(captures).toBe(1);
});
