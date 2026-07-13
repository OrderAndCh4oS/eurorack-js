import { expect, test } from '@playwright/test';

test('connected cable ends can be preserved, moved, and fanned out', async ({ page }) => {
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

    await page.locator('#patchSelect').selectOption('Test: Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('chorus'));

    const fanoutSource = page.locator('.jack.output[data-module="vco"][data-port="triangle"]');
    const fanoutDestination = page.locator('.jack.input[data-module="out"][data-port="L"]');
    const fanoutFromBox = await fanoutSource.boundingBox();
    const fanoutToBox = await fanoutDestination.boundingBox();

    await page.mouse.move(fanoutFromBox.x + fanoutFromBox.width / 2, fanoutFromBox.y + fanoutFromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fanoutToBox.x + fanoutToBox.width / 2, fanoutToBox.y + fanoutToBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.cables)).toEqual(expect.arrayContaining([
        expect.objectContaining({ fromModule: 'vco', fromPort: 'triangle', toModule: 'chorus', toPort: 'inL' }),
        expect.objectContaining({ fromModule: 'vco', fromPort: 'triangle', toModule: 'chorus', toPort: 'inR' }),
        expect.objectContaining({ fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'L' })
    ]));
    expect(await page.evaluate(() => window.eurorackApp.state.cables.some(cable => (
        cable.fromModule === 'chorus' && cable.fromPort === 'outL' &&
        cable.toModule === 'out' && cable.toPort === 'L'
    )))).toBe(false);
});
