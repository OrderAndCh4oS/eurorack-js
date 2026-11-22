import { expect, test } from '@playwright/test';
import { MODULE_MANIFEST } from '../../src/js/rack/module-manifest.js';

test.describe('visual system architecture guide', () => {
    test('renders the current architecture and catalog without requiring Mermaid', async ({ page }) => {
        await page.goto('/system-architecture.html');

        await expect(page).toHaveTitle(/System Architecture/);
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Voltages in.');
        const moduleCount = page.locator('.fact').filter({ hasText: 'built-in modules' }).locator('b');
        await expect(moduleCount).toHaveText(String(MODULE_MANIFEST.length));
        await expect(page.locator('#catalog')).toContainText('cascade');
        await expect(page.locator('#catalog')).toContainText('pitch-track');
        await expect(page.locator('#patches')).toContainText('CV Recorder lane buffers');
        await expect(page.locator('#quality > .grid-2 > article.card')).toHaveCount(2);
    });

    test('keeps the guide within a mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/system-architecture.html');

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const viewportOverflow = await page.evaluate(() => (
            document.documentElement.scrollWidth - window.innerWidth
        ));
        expect(viewportOverflow).toBeLessThanOrEqual(1);
    });
});
