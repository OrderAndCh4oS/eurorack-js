import { expect, test } from '@playwright/test';

const tools = [
    { path: '/midi-controller.html', title: 'MIDI Controller' },
    { path: '/midi-drum-controller.html', title: 'MIDI Drum Controller' }
];

for (const tool of tools) {
    test(`${tool.title} shows CC values and fits the Industrial Dark mobile layout`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('eurorack-theme', 'classic');
            localStorage.setItem('eurorack-theme-mode', 'dark');
        });

        await page.goto(tool.path);

        await expect(page.locator('body')).toHaveClass(/theme-dark/);
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 24, 19)');
        await expect(page.getByRole('button', { name: 'Dark mode', pressed: true })).toBeVisible();
        expect(await page.evaluate(() => [localStorage.getItem('eurorack-theme'), localStorage.getItem('eurorack-theme-mode')])).toEqual([null, 'dark']);
        await expect(page.getByRole('heading', { level: 1, name: tool.title })).toBeVisible();
        await expect(page.locator('.controller-grid')).toBeVisible();
        const knob = page.getByRole('slider', { name: 'Knob 1', exact: true });
        await knob.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Knob 1 64');
        await knob.press('ArrowUp');
        await expect(page.getByRole('tooltip')).toHaveText('Knob 1 65');
        await knob.dblclick();
        await expect(page.getByRole('tooltip')).toHaveText('Knob 1 64');
        expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
        expect(await page.locator('.controller-grid').evaluate(element => (
            getComputedStyle(element).gridTemplateColumns.split(' ').length
        ))).toBe(2);
    });
}

test('Industrial mode uses a contiguous flat instrument sheet', async ({ page }) => {
    await page.goto('/midi-controller.html');

    const styles = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const heading = getComputedStyle(document.querySelector('h1'));
        const grid = getComputedStyle(document.querySelector('.controller-grid'));
        const knob = getComputedStyle(document.querySelector('.knob'));
        return {
            bodyBackground: body.backgroundColor,
            headingBackground: heading.backgroundColor,
            gridGap: grid.gap,
            knobBackgroundImage: knob.backgroundImage
        };
    });

    expect(styles.bodyBackground).toBe(styles.headingBackground);
    expect(styles.gridGap).toBe('0px');
    expect(styles.knobBackgroundImage).toBe('none');
});
