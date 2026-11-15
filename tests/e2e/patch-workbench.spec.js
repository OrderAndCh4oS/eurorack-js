import { expect, test } from '@playwright/test';

test('patch workbench completes sockets, applies atomically, and preserves the rack on errors', async ({ page }) => {
    const startupErrors = [];
    page.on('pageerror', error => startupErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') startupErrors.push(message.text());
    });
    await page.addInitScript(() => {
        localStorage.setItem('eurorack-theme', 'classic');
        localStorage.setItem('eurorack-theme-mode', 'dark');
    });
    await page.goto('/');
    try {
        await page.waitForFunction(() => !!window.eurorackApp?.patchWorkbench, null, { timeout: 10_000 });
    } catch (error) {
        throw new Error(`App did not initialize: ${startupErrors.join(' | ') || error.message}`);
    }
    await expect(page.locator('body')).toHaveClass(/theme-industrial/);
    await expect(page.locator('body')).toHaveClass(/theme-light/);
    await expect(page.locator('body')).not.toHaveClass(/theme-classic|theme-dark/);
    await expect(page.locator('#themeSelect, #themeModeToggle')).toHaveCount(0);
    await page.locator('#patchWorkbenchToggle').click();
    const drawer = page.locator('#patch-workbench');
    const editor = drawer.locator('[data-role="editor"]');
    await expect(drawer).toBeVisible();
    const guideLink = drawer.getByRole('link', { name: 'Guide' });
    const referenceLink = drawer.getByRole('link', { name: 'Reference' });
    await expect(guideLink).toHaveAttribute(
        'href',
        '/docs/patch-workbench-guide'
    );
    await expect(referenceLink).toHaveAttribute(
        'href',
        '/docs/patch-workbench'
    );
    await expect(guideLink).not.toHaveAttribute('target');
    await expect(referenceLink).not.toHaveAttribute('target');
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

    const drawerColor = await drawer.evaluate(element => getComputedStyle(element).backgroundColor);
    const editorColor = await editor.evaluate(element => getComputedStyle(element.parentElement).backgroundColor);
    expect(editorColor).not.toBe(drawerColor);

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
