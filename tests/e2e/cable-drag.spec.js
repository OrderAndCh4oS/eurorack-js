import { expect, test } from '@playwright/test';

test('clicking a connected endpoint preserves its cable and dragging moves it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test: Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('chorus'));

    const source = page.locator('.jack.input[data-module="chorus"][data-port="inL"]');
    const destination = page.locator('.jack.input[data-module="out"][data-port="L"]');
    const before = await page.evaluate(() => structuredClone(window.eurorackApp.state.cables));

    await source.click();
    expect(await page.evaluate(() => window.eurorackApp.state.cables)).toEqual(before);

    const fromBox = await source.boundingBox();
    const toBox = await destination.boundingBox();
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.cables.some(cable => (
            cable.fromModule === 'vco' && cable.fromPort === 'triangle' &&
            cable.toModule === 'out' && cable.toPort === 'L'
        ))
    ))).toBe(true);
    expect(await page.evaluate(() => window.eurorackApp.state.cables.some(cable => (
        cable.fromModule === 'vco' && cable.toModule === 'chorus' && cable.toPort === 'inL'
    )))).toBe(false);
});
