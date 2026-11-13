import { expect, test } from '@playwright/test';
import { openTestPatch } from './patch-library-helpers.js';

async function expectPreviewFits(entry) {
    const image = entry.locator('.patch-preview-frame img');
    await expect(image).toBeVisible({ timeout: 30000 });
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)).toBe(true);
    const bounds = await image.evaluate(img => {
        const frame = img.parentElement.getBoundingClientRect();
        const box = img.getBoundingClientRect();
        return { frame: { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom }, image: { left: box.left, top: box.top, right: box.right, bottom: box.bottom } };
    });
    expect(bounds.image.left).toBeGreaterThanOrEqual(bounds.frame.left);
    expect(bounds.image.top).toBeGreaterThanOrEqual(bounds.frame.top);
    expect(bounds.image.right).toBeLessThanOrEqual(bounds.frame.right);
    expect(bounds.image.bottom).toBeLessThanOrEqual(bounds.frame.bottom);
}

test('browses illustrated test racks and saves an independent local copy', async ({ page }, testInfo) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await page.waitForFunction(() => window.eurorackApp?.host);
    await expect(page.locator('#patchSelect')).toHaveCount(0);
    await page.locator('[data-patch-view="tests"]').click();
    await expect(page.locator('.patch-entry')).toHaveCount(75);
    // Wait for each first-row image, rather than whichever asynchronous capture
    // finishes first. Intrinsic image height must never overflow its fixed frame.
    for (let index = 0; index < 3; index++) await expectPreviewFits(page.locator('.patch-entry').nth(index));
    await expect(page.locator('.patch-entry').first()).toHaveCSS('border-radius', '0px');
    await page.screenshot({ path: testInfo.outputPath('test-patches.png') });
    expect(await page.evaluate(() => window.eurorackApp.host.audioCtx)).toBeNull();
    await openTestPatch(page, 'Test - Chorus');
    const before = await page.evaluate(() => window.eurorackApp.host.serializePatch());
    await page.locator('[data-patch-view="mine"]').click();
    await page.locator('[data-patch-view="rack"]').click();
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(before);
    await page.locator('#savePatchCopy').click();
    await page.getByRole('dialog').getByRole('textbox', { name: 'Patch name', exact: true }).fill('My chorus copy');
    await page.getByRole('dialog').getByRole('button', { name: 'Save copy', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eurorack-patches'))['My chorus copy']);
    expect(saved.id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/); expect(saved.state).toEqual(before);
    await page.locator('[data-patch-view="mine"]').click();
    await expect(page.locator('.patch-entry').filter({ has: page.getByRole('heading', { name: 'My chorus copy', exact: true }) })).toBeVisible();
    expect(errors).toEqual([]);
});

test('fits complete rack previews in a 360px mobile catalogue', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/'); await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('[data-patch-view="tests"]').click();
    await expectPreviewFits(page.locator('.patch-entry').first());
    const library = page.locator('#patchLibrary');
    const sizing = await library.evaluate(node => ({ width: node.clientWidth, contentWidth: node.scrollWidth }));
    expect(sizing.contentWidth).toBe(sizing.width);
    await page.screenshot({ path: testInfo.outputPath('test-patches-mobile.png') });
    const third = page.locator('.patch-entry').nth(2);
    await third.scrollIntoViewIfNeeded();
    await expectPreviewFits(third);
    await page.screenshot({ path: testInfo.outputPath('test-patches-mobile-vcf.png') });
});
