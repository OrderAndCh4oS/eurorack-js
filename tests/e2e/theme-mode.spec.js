import { expect, test } from '@playwright/test';

const darkPaper = 'rgb(23, 24, 19)';
const darkInk = 'rgb(183, 179, 168)';
const lightPaper = 'rgb(240, 238, 226)';
const toggle = page => page.getByRole('button', { name: 'Dark mode', exact: true });

test('the top bar switches the live rack, drawers, catalogue and reading views', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.locator('.sidebar-module[data-module-type="vco"]').click();
    const vco = page.locator('.rack-row .module-type-vco');
    const patch = await page.evaluate(() => window.eurorackApp.host.serializePatch());
    const navigation = page.getByRole('navigation', { name: 'Patch views' });
    await expect(navigation).toHaveCSS('background-color', lightPaper);
    await navigation.getByRole('button', { name: 'Dark mode' }).press('Space');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.eurorackApp.themeMode)).toBe('dark');
    await expect(navigation).toHaveCSS('background-color', darkPaper);
    await expect(vco).toHaveCSS('background-color', 'rgb(21, 22, 21)');
    await expect(vco.locator('.module-label')).toHaveCSS('color', darkInk);

    for (const [button, drawer] of [['#patchWorkbenchToggle', '#patch-workbench'], ['#rackDebuggerToggle', '#rack-debugger'], ['#analysisToggle', '#rack-analysis']]) {
        await page.locator(button).click();
        await expect(page.locator(drawer)).toBeVisible();
        await expect(page.locator(drawer)).toHaveCSS('background-color', darkPaper);
        await page.locator(button).click();
    }
    await page.locator('#savePatchCopy').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCSS('background-color', darkPaper);
    await expect(dialog.locator('input').first()).toHaveCSS('color', darkInk);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(patch);

    await navigation.getByRole('button', { name: 'Test patches' }).click();
    await expect(page.locator('#patchLibrary')).toHaveCSS('background-color', darkPaper);
    await expect(page.locator('.patch-entry-caption h3').first()).toHaveCSS('color', darkInk);
    await navigation.getByRole('link', { name: 'Introduction' }).click();
    await expect(page.locator('.marketing-page')).toHaveCSS('background-color', darkPaper);
    await expect(page.locator('.marketing-rack figcaption')).toHaveCSS('color', darkInk);
    await navigation.getByRole('link', { name: 'Docs' }).click();
    await expect(page.locator('.docs-page')).toHaveCSS('background-color', darkPaper);
    await expect(page.locator('.docs-intro')).toHaveCSS('color', 'rgb(168, 165, 152)');
    await page.screenshot({ path: testInfo.outputPath('industrial-dark-docs.png') });
    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await toggle(page).click();
    await expect(page.locator('.docs-page')).toHaveCSS('background-color', lightPaper);
    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('the phone player, library and standalone pages share the mode', async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?demo=introduction');
    await expect(page.locator('#playerPatchName')).toHaveText('Introduction');
    await expect(toggle(page)).toBeInViewport({ ratio: 1 });
    await toggle(page).click();
    await expect(page.locator('#playerFooter')).toHaveCSS('color', darkInk);
    await expect(toggle(page)).toHaveCSS('background-color', 'rgb(255, 74, 10)');
    await page.screenshot({ path: testInfo.outputPath('industrial-dark-player.png') });
    await page.getByRole('button', { name: 'Patches', exact: true }).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

    const tools = await context.newPage();
    for (const path of ['/midi-controller.html', '/privacy-policy', '/terms-of-service', '/email-sign-in.html', '/introduction']) {
        await tools.goto(path);
        await expect(toggle(tools)).toHaveAttribute('aria-pressed', 'true');
        await expect(tools.locator('body')).toHaveCSS('background-color', darkPaper);
    }
    await toggle(tools).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#patchLibrary')).toHaveCSS('background-color', lightPaper);
});
