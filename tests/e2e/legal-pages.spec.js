import { test, expect } from '@playwright/test';

test('privacy and terms are public, server-rendered and linked from the instrument', async ({ browser, page }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const document = await context.newPage();
    try {
        const privacy = await document.goto('/privacy-policy');
        expect(privacy.status()).toBe(200);
        await expect(document.getByRole('heading', { name: 'Privacy policy', exact: true })).toBeVisible();
        await expect(document.getByRole('heading', { name: 'Sign-in and saved data' })).toBeVisible();
        await expect(document.getByRole('link', { name: 'Resend’s privacy policy' })).toBeVisible();
        await expect(document.locator('a[href="mailto:support@orderandchaos.xyz"]').first()).toBeVisible();
        await document.screenshot({ path: testInfo.outputPath('privacy-desktop.png') });
        await document.getByRole('link', { name: 'Terms of service', exact: true }).click();
        await expect(document.getByRole('heading', { name: 'Terms of service', exact: true })).toBeVisible();
        await expect(document.getByText('You retain any rights you hold in your patches.', { exact: false })).toBeVisible();
        await document.setViewportSize({ width: 360, height: 800 });
        await document.screenshot({ path: testInfo.outputPath('terms-mobile.png') });
        expect(await document.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await document.goto('/privacy-policy');
        expect(await document.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await document.screenshot({ path: testInfo.outputPath('privacy-mobile.png') });
    } finally { await context.close(); }
    await page.goto('/');
    await expect(page.locator('a[href="/privacy-policy"]').first()).toHaveText('Privacy');
    await expect(page.locator('a[href="/terms-of-service"]').first()).toHaveText('Terms');
});
