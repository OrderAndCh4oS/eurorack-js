import { expect, test } from '@playwright/test';
import { openTestPatch } from './patch-library-helpers.js';

test('clears cables only after confirmation and preserves the rest of the rack', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await openTestPatch(page, 'Test - VCO Only');
    const snapshot = () => page.evaluate(() => window.eurorackApp.host.serializePatch());
    const before = await snapshot();
    expect(before.cables.length).toBeGreaterThan(0);
    const clear = page.locator('#clearCables');
    const cables = page.locator('#cable-svg .cable');
    const dialog = page.getByRole('dialog', { name: 'Clear all cables?', exact: true });

    await clear.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('This will remove all cables from the rack. Are you sure?', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    expect(await snapshot()).toEqual(before);
    await expect(cables).toHaveCount(before.cables.length);
    await dialog.screenshot({ path: testInfo.outputPath('clear-cables-dialog.png') });

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(clear).toBeFocused();
    expect(await snapshot()).toEqual(before);

    await clear.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(clear).toBeFocused();
    expect(await snapshot()).toEqual(before);
    await expect(cables).toHaveCount(before.cables.length);

    await clear.click();
    await dialog.getByRole('button', { name: 'Clear cables', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(clear).toBeFocused();
    await expect.poll(snapshot).toEqual({ ...before, cables: [] });
    await expect(cables).toHaveCount(0);
    await expect(page.locator('#activePatchLabel')).toContainText('Edited');
});
