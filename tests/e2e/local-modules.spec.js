import { expect, test } from '@playwright/test';

async function openModules(page) {
    await page.waitForFunction(() => Boolean(window.eurorackApp?.patchWorkbench));
    await page.locator('#patchWorkbenchToggle').click();
    await page.getByRole('tab', { name: 'Modules', exact: true }).click();
    return page.locator('.module-source-browser');
}

test('own modules survive reload and old patches retain their working audio revision', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const browser = await openModules(page);
    await browser.getByRole('button', { name: 'New module', exact: true }).click();
    await browser.getByRole('textbox', { name: 'Module name', exact: true }).fill('Local gain');
    const sourceEditor = browser.getByRole('textbox', { name: 'Your module source', exact: true });
    const originalSource = await sourceEditor.inputValue();
    await browser.getByRole('button', { name: 'Save', exact: true }).click();
    expect(await page.locator('.rack .module').count()).toBe(0);
    await browser.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(browser.locator('.module-source-status')).toHaveText('Added to rack.');
    const originalType = await page.evaluate(() => window.eurorackApp.host.serializePatch().modules[0].type);
    expect(originalType).toMatch(/^local-[a-z0-9]{26}$/);

    // Exercise compilation of locally registered types, then run it on the audio thread.
    await page.getByRole('tab', { name: 'Patch', exact: true }).click();
    await page.getByRole('textbox', { name: 'Patch script editor' }).fill(`patch()
      .module('vco', 'osc', { coarse: 0.3 })
      .module('${originalType}', 'gain', { level: 0.5 })
      .module('db', 'meter').module('out', 'main', { volume: 0.1 })
      .connect('osc.triangle', 'gain.audio')
      .connect('gain.out', 'meter.L').connect('gain.out', 'main.L')`);
    await page.locator('[data-action="apply"]').click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.locator('[data-role="status"]')).toHaveText('Applied atomically');
    await page.getByRole('button', { name: 'Close Code', exact: true }).click();
    await page.locator('#startButton').click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('meter')?.instance.leds.L0)).toBeGreaterThan(0);
    await page.locator('#savePatch').click();
    await page.getByRole('textbox', { name: 'Patch name', exact: true }).fill('Original local gain');
    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.locator('#patchWorkbenchToggle').click();
    await page.getByRole('tab', { name: 'Modules', exact: true }).click();
    await browser.locator('[data-source-kind="local"]').click();
    await sourceEditor.fill(originalSource.replace('input[i] * this.params.level', '0'));
    await browser.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(browser.locator('.module-source-status')).toHaveText('Added to rack.');
    const revisedType = await page.evaluate(() => window.eurorackApp.host.serializePatch().modules.at(-1).type);
    expect(revisedType).not.toBe(originalType);
    // Opening the library after a real reload must resolve the original revision,
    // including in the isolated thumbnail renderer, from this browser's storage.
    await page.goto('/patches?view=mine');
    const card = page.locator('[data-patch-name="Original local gain"]');
    await expect(card.getByRole('img', { name: 'Rack for Original local gain' })).toBeVisible({ timeout: 15000 });
    await card.getByRole('button', { name: 'Open in rack' }).click();
    await expect(page.locator('#module-gain')).toBeVisible();
    expect(await page.evaluate(() => window.eurorackApp.state.getModule('gain').type)).toBe(originalType);
    await page.locator('#startButton').click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('meter')?.instance.leds.L0)).toBeGreaterThan(0);
    const revisions = await page.evaluate(() => window.eurorackApp.localModules.list()[0].revisions);
    expect(revisions).toHaveLength(2);
    expect(errors).toEqual([]);
});

test('module source stays usable on mobile and draft errors preserve the rack', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const browser = await openModules(page);
    await browser.getByRole('searchbox', { name: 'Search modules' }).fill('vco');
    await browser.locator('[data-module-source="vco"]').click();
    await expect(browser.locator('.module-source-code')).toContainText('createDSP');
    await expect(browser.getByRole('button', { name: 'Use module', exact: true })).toBeHidden();
    await browser.getByRole('button', { name: 'New module', exact: true }).click();
    const source = browser.getByRole('textbox', { name: 'Your module source' });
    const template = await source.inputValue();
    await source.fill('export default { broken');
    await source.press('Control+s');
    await expect(browser.locator('.module-source-status')).toHaveText('Saved in this browser.');
    await browser.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(browser.locator('.module-source-status')).toHaveAttribute('data-kind', 'error');
    expect(await page.locator('.rack .module').count()).toBe(0);
    await expect(source).toHaveValue('export default { broken');
    const dimensions = await browser.evaluate(root => ({ right: root.getBoundingClientRect().right, viewport: innerWidth }));
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
    await source.fill(template.replace('    ui: {', `    telemetry: { fields: [], methods: [] },
    render() { throw new Error('Renderer failed'); },
    ui: {`));
    await browser.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(browser.locator('.module-source-status')).toHaveText('Renderer failed');
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch().modules)).toEqual([]);
    await source.fill(template);
    await browser.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(browser.locator('.module-source-status')).toHaveText('Added to rack.');
});
