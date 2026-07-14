import { expect, test } from '@playwright/test';

test('patch workbench completes sockets, applies atomically, and preserves the rack on errors', async ({ page }) => {
    const startupErrors = [];
    page.on('pageerror', error => startupErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') startupErrors.push(message.text());
    });
    await page.goto('/');
    try {
        await page.waitForFunction(() => !!window.eurorackApp?.patchWorkbench, null, { timeout: 10_000 });
    } catch (error) {
        throw new Error(`App did not initialize: ${startupErrors.join(' | ') || error.message}`);
    }
    await page.locator('#patchWorkbenchToggle').click();
    const drawer = page.locator('#patch-workbench');
    const editor = drawer.locator('[data-role="editor"]');
    await expect(drawer).toBeVisible();
    const guideLink = drawer.getByRole('link', { name: 'Guide' });
    const referenceLink = drawer.getByRole('link', { name: 'Reference' });
    await expect(guideLink).toHaveAttribute(
        'href',
        'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/docs/patch-workbench-guide.md'
    );
    await expect(referenceLink).toHaveAttribute(
        'href',
        'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/docs/patch-workbench.md'
    );
    await expect(guideLink).toHaveAttribute('target', '_blank');
    await expect(referenceLink).toHaveAttribute('target', '_blank');
    await expect(drawer.locator('[data-role="scripts"]')).toHaveValue('__current_rack__');
    await expect(editor).toHaveValue(/^patch\(\)/);
    await expect(drawer.locator('.syntax-function').filter({ hasText: 'patch' }).first()).toBeVisible();
    const editorMetrics = await editor.evaluate(element => {
        const editorStyle = getComputedStyle(element);
        const codeStyle = getComputedStyle(element.parentElement.querySelector('code'));
        return {
            editor: [editorStyle.fontFamily, editorStyle.fontSize, editorStyle.fontWeight, editorStyle.lineHeight, editorStyle.letterSpacing],
            code: [codeStyle.fontFamily, codeStyle.fontSize, codeStyle.fontWeight, codeStyle.lineHeight, codeStyle.letterSpacing]
        };
    });
    expect(editorMetrics.code).toEqual(editorMetrics.editor);
    expect(editorMetrics.code[2]).toBe('300');

    const drawerColor = () => drawer.evaluate(element => getComputedStyle(element).backgroundColor);
    const editorColor = () => editor.evaluate(element => getComputedStyle(element.parentElement).backgroundColor);
    const themeColors = [await drawerColor()];
    const editorColors = [await editorColor()];
    await page.evaluate(() => window.eurorackApp.setTheme('classic'));
    themeColors.push(await drawerColor());
    editorColors.push(await editorColor());
    await page.evaluate(() => window.eurorackApp.setThemeMode('dark'));
    themeColors.push(await drawerColor());
    editorColors.push(await editorColor());
    await page.evaluate(() => window.eurorackApp.setTheme('industrial'));
    themeColors.push(await drawerColor());
    editorColors.push(await editorColor());
    expect(new Set(themeColors).size).toBe(4);
    expect(new Set(editorColors).size).toBe(1);
    await page.evaluate(() => window.eurorackApp.setThemeMode('light'));

    await editor.fill(`patch().module('comp', 'compressor', { filterMode: 0 })`);
    await editor.evaluate(element => {
        const cursor = element.value.indexOf('0');
        element.setSelectionRange(cursor, cursor);
    });
    await editor.press('Control+Space');
    await drawer.locator('.patch-completion').filter({ hasText: '2 — LP' }).click();
    await expect(editor).toHaveValue(`patch().module('comp', 'compressor', { filterMode: 2 })`);

    await editor.fill(`patch().module('vco', 'osc').connect('osc.ra`);
    await expect(drawer.locator('.syntax-method').filter({ hasText: 'module' })).toBeVisible();
    await expect(drawer.locator('.patch-completion').filter({ hasText: 'osc.ramp' })).toBeVisible();
    const completionMenu = drawer.locator('[data-role="completions"]');
    const completionColor = () => completionMenu.evaluate(element => getComputedStyle(element).backgroundColor);
    const fixedCompletionColor = await completionColor();
    await page.evaluate(() => {
        window.eurorackApp.setTheme('classic');
        window.eurorackApp.setThemeMode('dark');
    });
    expect(await completionColor()).toBe(fixedCompletionColor);
    await page.evaluate(() => {
        window.eurorackApp.setTheme('industrial');
        window.eurorackApp.setThemeMode('light');
    });
    await editor.press('Tab');
    await expect(editor).toHaveValue(/osc\.ramp/);

    await page.locator('#startButton').click();
    await editor.fill(`patch()
      .module('vco', 'osc', { coarse: 0.3 })
      .module('out', 'main', { volume: 0.6 })
      .connect('osc.ramp', 'main.L')
      .connect('osc.ramp', 'main.R')`);
    await editor.press('Control+s');

    await expect(drawer.locator('[data-role="status"]')).toHaveText('Saved and applied atomically');
    await expect(page.locator('#module-osc')).toBeVisible();
    await expect(page.locator('#module-main')).toBeVisible();
    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);

    await editor.fill(`patch().module('vco', 'broken').connect('broken.missing', 'broken.sync')`);
    await drawer.locator('[data-action="apply"]').click();

    await expect(drawer.locator('[data-role="status"]')).toHaveAttribute('data-kind', 'error');
    await expect(page.locator('#module-osc')).toBeVisible();
    await expect(page.locator('#module-main')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.host.engine.revision)).toBe(revision);
});
