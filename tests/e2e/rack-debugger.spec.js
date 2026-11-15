import { expect, test } from '@playwright/test';

const PATCH = {
    version: 3,
    plugins: { core: 1 },
    modules: [
        { id: 'osc', type: 'vco', row: 1, index: 0 },
        { id: 'loose', type: 'lfo', row: 1, index: 1 },
        { id: 'main', type: 'out', row: 1, index: 2 }
    ],
    params: {},
    cables: [{ fromModule: 'osc', fromPort: 'ramp', toModule: 'main', toPort: 'L' }],
    midiMappings: {}
};

async function setup(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.rackDebugger);
    await page.evaluate(patch => window.eurorackApp.loadPatchState(patch, { managed: true }), PATCH);
}

test('checks live connections, focuses modules and clears highlights without editing the patch', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setup(page);
    const snapshot = () => page.evaluate(() => window.eurorackApp.host.serializePatch());
    const before = await snapshot();
    const toggle = page.locator('#rackDebuggerToggle');
    const panel = page.getByRole('complementary', { name: 'Connections' });
    const loose = page.locator('#module-loose');
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('status')).toHaveText('1 thing to check');
    await expect(loose).toHaveClass(/rack-debugger-flagged/);
    await expect(page.locator('#module-osc')).not.toHaveClass(/rack-debugger-flagged/);
    expect(await snapshot()).toEqual(before);
    await panel.locator('[data-issue-code="module-unconnected"] button').click();
    await expect(loose).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('rack-debugger-desktop.png') });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(loose).not.toHaveClass(/rack-debugger-flagged/);
    expect(await snapshot()).toEqual(before);

    await toggle.click();
    await page.evaluate(() => {
        const app = window.eurorackApp;
        app.host.connect({ fromModule: 'loose', fromPort: 'primary', toModule: 'osc', toPort: 'vOct' });
        app.renderStateCables();
    });
    await expect(panel.getByRole('status')).toHaveText('No connection issues found.');
    await expect(loose).not.toHaveClass(/rack-debugger-flagged/);
    expect(await page.evaluate(() => window.eurorackApp.host.engine)).toBeNull();

    await page.evaluate(() => window.eurorackApp.addModule('lfo', { id: 'spare', row: 2 }));
    await expect(page.locator('#module-spare')).toHaveClass(/rack-debugger-flagged/);
    page.once('dialog', dialog => dialog.accept());
    await page.evaluate(() => window.eurorackApp.removeRackRow(2));
    await expect(panel.getByRole('status')).toHaveText('No connection issues found.');
    await expect(page.locator('#module-spare')).toHaveCount(0);

    await page.evaluate(() => window.eurorackApp.removeModule('main'));
    await expect(panel.locator('[data-issue-code="missing-output"]')).toBeVisible();
    await page.evaluate(() => window.eurorackApp.loadPatchState({ version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} }, { managed: true }));
    await expect(panel.getByRole('status')).toHaveText('Add modules to check their connections.');
    await expect(page.locator('.rack-debugger-marker')).toHaveCount(0);
});

test('keeps the compact toolbar and hides connection checks outside the rack', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page);
    await page.locator('#rackDebuggerToggle').click();
    const panel = page.locator('#rack-debugger');
    const metrics = await page.evaluate(() => {
        const bounds = id => document.getElementById(id).getBoundingClientRect().toJSON();
        return { panel: bounds('rack-debugger'), rack: bounds('rack-container'), toolbar: bounds('toolbar'), width: innerWidth };
    });
    expect(metrics.toolbar.height).toBe(38);
    expect(metrics.panel.width).toBeLessThanOrEqual(metrics.width);
    expect(metrics.panel.bottom).toBeLessThanOrEqual(metrics.rack.top);
    await page.screenshot({ path: testInfo.outputPath('rack-debugger-mobile.png') });
    for (const view of ['tests', 'public', 'mine']) {
        await page.locator(`[data-patch-view="${view}"]`).click();
        await expect(panel).toBeHidden();
        await expect(page.locator('#rackDebuggerToggle')).toBeHidden();
    }
    await page.locator('[data-patch-view="rack"]').click();
    await expect(panel).toBeVisible();
    await expect(page.locator('#module-loose')).toHaveClass(/rack-debugger-flagged/);
});

test('does not add diagnostic markers to saved rack previews', async ({ page }) => {
    await setup(page);
    await page.locator('#rackDebuggerToggle').click();
    await expect(page.locator('#module-loose .rack-debugger-marker')).toHaveCount(1);
    const snapshot = await page.evaluate(() => window.eurorackApp.host.serializePatch());
    await page.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.id = 'debugger-preview-check';
        frame.src = '/patch-preview.html';
        frame.style.cssText = 'position:fixed;left:-10000px;width:1600px;height:1600px';
        document.body.append(frame);
    });
    const frame = await page.locator('#debugger-preview-check').elementHandle().then(handle => handle.contentFrame());
    await frame.waitForFunction(() => window.eurorackPatchPreview);
    const preview = await frame.evaluate(async patch => {
        const { renderPatchPreview } = await import('/js/patches/patch-preview-frame.js');
        const rendered = await renderPatchPreview(patch);
        try {
            return {
                modules: rendered.element.querySelectorAll('.module').length,
                decorations: rendered.element.querySelectorAll('.rack-debugger-flagged, .rack-debugger-marker, [aria-describedby^="rack-debugger-"]').length,
                state: rendered.host.serializePatch()
            };
        } finally { rendered.dispose(); }
    }, snapshot);
    expect(preview.modules).toBe(snapshot.modules.length);
    expect(preview.decorations).toBe(0);
    expect(preview.state).toEqual(snapshot);
    await page.locator('#debugger-preview-check').evaluate(frame => frame.remove());
    await expect(page.locator('#module-loose .rack-debugger-marker')).toHaveCount(1);
});
