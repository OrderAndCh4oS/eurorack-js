import { expect, test } from '@playwright/test';

async function openOutput(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.evaluate(() => window.eurorackApp.loadPatchState({
        version: 3, plugins: { core: 1 }, midiMappings: {}, cables: [],
        modules: [{ id: 'output', type: 'out', row: 1, index: 0 }],
        params: { output: { volume: 0.5 } }
    }, { managed: true }));
    return page.getByRole('slider', { name: 'Vol', exact: true });
}

test('a knob shows its value above the dial on hover and throughout a drag outside it', async ({ page }) => {
    const knob = await openOutput(page);
    const tip = page.getByRole('tooltip');
    await knob.hover();
    await expect(tip).toHaveText('Vol 0.50');
    const box = await knob.boundingBox(), bubble = await tip.boundingBox();
    expect(bubble.y + bubble.height).toBeLessThan(box.y);
    expect(Math.abs((box.x + box.width / 2) - (bubble.x + bubble.width / 2))).toBeLessThanOrEqual(1);

    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y - 20);
    await expect(tip).toHaveText('Vol 0.633');
    expect(await page.evaluate(() => window.eurorackApp.state.getParam('output', 'volume'))).toBeCloseTo(0.5 + 20 / 150, 10);
    await page.mouse.up();
    await expect(tip).toBeHidden();
    await knob.focus();
    await knob.press('ArrowUp');
    await expect(tip).toHaveText('Vol 0.643');
    await knob.press('Escape');
    await expect(tip).toBeHidden();
});

test('a native slider on a custom panel shows its current value on hover, drag and keyboard input', async ({ page }) => {
    await openOutput(page);
    const slider = page.getByRole('slider', { name: 'Offset' });
    await page.locator('#module-output .module-content').evaluate(panel => {
        const input = document.createElement('input');
        Object.assign(input, { type: 'range', min: '-1', max: '1', step: '0.0001', value: '-0.3457' });
        input.setAttribute('aria-label', 'Offset');
        input.style.width = '72px';
        panel.append(input);
    });
    const tip = page.getByRole('tooltip');
    await slider.hover();
    await expect(tip).toHaveText('Offset -0.346');
    const box = await slider.boundingBox();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2);
    await expect(tip).toHaveText('Offset 1.00');
    await page.mouse.up();
    await expect(tip).toBeHidden();
    await slider.press('Home');
    await expect(tip).toHaveText('Offset -1.00');
    await slider.evaluate(el => { el.value = '0.1251'; });
    await expect(tip).toHaveText('Offset 0.125');
    await slider.evaluate(el => el.remove());
    await expect(tip).toBeHidden();
});

test.describe('touch input', () => {
    test.use({ hasTouch: true });
    test('a touch drag shows the knob value until release', async ({ page, context }) => {
        const knob = await openOutput(page);
        const box = await knob.boundingBox();
        const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
        const client = await context.newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await expect(page.getByRole('tooltip')).toHaveText('Vol 0.50');
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 20 }] });
        await expect(page.getByRole('tooltip')).toHaveText('Vol 0.633');
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(page.getByRole('tooltip')).toBeHidden();
    });
});
