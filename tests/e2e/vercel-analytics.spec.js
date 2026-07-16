import { expect, test } from '@playwright/test';

test('initializes the Vercel Web Analytics client', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Eurorack JS by orderandchaos');
    await expect(page.locator('script[src="/_vercel/insights/script.js"]')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => typeof window.va)).toBe('function');
});
