import { expect, test } from '@playwright/test';

test('finds a module by family and name, reads its guide and returns to the filtered directory', async ({ page }) => {
    await page.goto('/docs/modules');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Module demos');
    await page.getByRole('combobox', { name: 'Module family' }).selectOption('effect');
    await page.getByRole('searchbox').fill('shimmer');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const directory = page.url();
    const card = page.locator('[data-module-guide="shimmer"]');
    await card.getByRole('heading').getByRole('link').click();
    await expect(page).toHaveURL(/\/docs\/modules\/shimmer$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shimmer reverb');
    const preview = page.locator('.docs-demo img');
    await expect.poll(() => preview.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(directory);
    await expect(page.getByRole('combobox', { name: 'Module family' })).toHaveValue('effect');
    await expect(card).toBeVisible();
});

test('opens the illustrated demo from a directly loaded guide', async ({ page }, testInfo) => {
    await page.goto('/docs/modules/vco');
    await expect(page.locator('.docs-intro')).toContainText('oscillator');
    expect(await page.evaluate(() => Boolean(window.eurorackApp))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('oscillator-guide.png') });
    await page.getByRole('link', { name: 'Open in rack' }).click();
    await expect(page).toHaveTitle('Test - VCO Only · Eurorack');
    await expect(page.locator('#module-vco')).toBeVisible();
    await expect(page.locator('#module-vca')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/docs\/modules\/vco$/);
});

test('keeps the current rack while reading and asks before replacing an edited patch', async ({ page }) => {
    await page.goto('/?test=Test+-+VCO+Only');
    await expect(page).toHaveTitle('Test - VCO Only · Eurorack');
    await page.evaluate(() => window.eurorackApp.setParam('vco', 'fine', 2));
    await page.getByRole('button', { name: 'Module demos', exact: true }).click();
    await page.locator('[data-module-guide="adsr"] h3 a').click();
    await page.getByRole('link', { name: 'Open in rack' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/modules\/adsr$/);
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch().params.vco.fine)).toBe(2);
    await page.getByRole('link', { name: 'Open in rack' }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveTitle('Test - ADSR Envelope · Eurorack');
    await expect(page.locator('#module-adsr')).toBeVisible();
});

test('fits a long panel reference on a phone and switches the demo image with the theme', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto('/docs/modules/ensemble-vco');
    const preview = page.locator('.docs-demo img');
    await expect.poll(() => preview.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('ensemble-guide-phone.png') });
    const light = await preview.evaluate(img => img.currentSrc);
    await page.locator('[data-theme-mode-toggle]').click();
    await expect.poll(() => preview.evaluate(img => img.currentSrc)).not.toBe(light);
    await expect(page.getByRole('link', { name: 'Open in rack' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
