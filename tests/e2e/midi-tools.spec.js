import { expect, test } from '@playwright/test';

const tools = [
    { path: '/midi-controller.html', title: 'MIDI Controller' },
    { path: '/midi-drum-controller.html', title: 'MIDI Drum Controller' }
];

for (const tool of tools) {
    test(`${tool.title} follows the saved theme and fits mobile`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('eurorack-theme', 'classic');
            localStorage.setItem('eurorack-theme-mode', 'dark');
        });

        await page.goto(tool.path);

        await expect(page.locator('html')).toHaveClass(/theme-classic/);
        await expect(page.locator('html')).toHaveClass(/theme-dark/);
        await expect(page.getByRole('heading', { level: 1, name: tool.title })).toBeVisible();
        await expect(page.locator('.controller-grid')).toBeVisible();
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
