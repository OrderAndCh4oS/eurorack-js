import { expect, test } from '@playwright/test';
import { ulid } from 'ulid';

const origin = 'http://127.0.0.1:4176';

test('opens saved URLs directly in the rack, including reloads, while keeping details and snapshots separate', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addCookies([{ name: 'eurorack-test-user', value: 'alice', url: origin }]);
    const response = await context.request.post(`${origin}/api/patches`, {
        headers: { origin },
        data: {
            requestId: ulid(), name: 'Canonical route rack', visibility: 'private',
            state: { version: 3, plugins: { core: 1 }, modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }], params: {}, cables: [], midiMappings: {} }
        }
    });
    expect(response.status()).toBe(201);
    const saved = await response.json();
    const canonical = `${origin}/patches/${saved.id}`;
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(canonical);
        await page.waitForFunction(id => window.eurorackApp?.patchLibrary?.active?.id === id, saved.id);
        await expect(page).toHaveURL(canonical);
        await expect(page.locator('#module-osc')).toBeVisible();
        await page.reload();
        await page.waitForFunction(id => window.eurorackApp?.patchLibrary?.active?.id === id, saved.id);
        await expect(page).toHaveURL(canonical);
        await expect(page.locator('#module-osc')).toBeVisible();

        await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
        await page.getByRole('button', { name: 'Details', exact: true }).click();
        await expect(page).toHaveURL(`${canonical}?view=details`);
        await expect(page.getByRole('heading', { name: saved.name, exact: true })).toBeVisible();
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 24, 19)');
        await page.getByRole('button', { name: 'Save a copy', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toHaveCSS('background-color', 'rgb(23, 24, 19)');
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        const open = page.getByRole('link', { name: 'Open in rack', exact: true });
        await expect(open).toHaveAttribute('href', canonical);
        await open.click();
        await page.waitForFunction(id => window.eurorackApp?.patchLibrary?.active?.id === id, saved.id);
        await expect(page).toHaveURL(canonical);
        await expect(page.locator('#module-osc')).toBeVisible();

        await page.locator('#savedPatchLink').click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonical);

        await page.goto(`${origin}/#saved=${saved.id}`);
        await page.waitForFunction(id => window.eurorackApp?.patchLibrary?.active?.id === id, saved.id);
        await expect(page).toHaveURL(canonical);
        await expect(page.locator('#module-osc')).toBeVisible();

        await page.locator('#sharePatch').click();
        await expect(page).toHaveURL(/\/#patch=gz1\./);
        expect(new URL(page.url()).pathname).toBe('/');
        const snapshotUrl = page.url();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snapshotUrl);
        await page.reload();
        await page.waitForFunction(() => window.eurorackApp?.patchLibrary?.active?.source === 'snapshot');
        await expect(page.locator('#module-osc')).toBeVisible();
        await expect(page).toHaveURL(snapshotUrl);
        expect(errors).toEqual([]);
    } finally { await context.close(); }
});
