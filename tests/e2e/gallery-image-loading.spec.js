import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('fetches a signed-in gallery once and retains decoded images when profile credits change', async ({ page }) => {
    let publicName = 'Before';
    let lists = 0, images = 0;
    const png = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#eeeade' } }).png().toBuffer();
    await page.route('**/api/config', route => route.fulfill({ json: { enabled: true, authEnabled: true, imagesEnabled: true } }));
    await page.route('**/api/me', async route => {
        if (route.request().method() === 'PATCH') publicName = route.request().postDataJSON().name;
        await route.fulfill({ json: { user: { id: 'gallery-user', name: publicName } } });
    });
    await page.route('**/api/public-patches?**', route => {
        lists++;
        return route.fulfill({ json: { patches: [{
            id: '01K00000000000000000000000', name: 'Existing rack', authorName: publicName,
            visibility: 'public', moduleCount: 2, canEdit: false, provenance: {},
            images: { thumbnail: '/gallery-image.png' }
        }], nextCursor: null, previousCursor: null } });
    });
    await page.route('**/gallery-image.png', route => {
        images++;
        return route.fulfill({ body: png, contentType: 'image/png', headers: { 'Cache-Control': 'private, no-store' } });
    });
    await page.goto('/patches');
    const image = page.locator('.patch-entry img');
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await page.evaluate(() => { window.originalGalleryImage = document.querySelector('.patch-entry img'); });
    expect(lists).toBe(1);
    expect(images).toBe(1);

    await page.getByRole('button', { name: 'My profile', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Public name', { exact: true }).fill('After');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByText('By After', { exact: true })).toBeVisible();
    expect(lists).toBe(2);
    expect(await page.evaluate(() => window.originalGalleryImage === document.querySelector('.patch-entry img'))).toBe(true);
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(images).toBe(1);
});
