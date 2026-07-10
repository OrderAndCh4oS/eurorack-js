import { expect, test } from '@playwright/test';

test('runs the custom-module patch and switches topology while audio is active', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);

    await page.locator('#patchSelect').selectOption('Test - Custom Modules');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('scope'));

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        return window.eurorackApp.host.engine && scope?.displayBuffer1?.some(sample => sample !== 0);
    });

    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);
    await page.locator('#patchSelect').selectOption('Test: Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(previousRevision => (
        window.eurorackApp.state.getModule('chorus') &&
        window.eurorackApp.host.engine?.revision > previousRevision
    ), revision);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
});
