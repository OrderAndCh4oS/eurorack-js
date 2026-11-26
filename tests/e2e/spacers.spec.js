import { expect, test } from '@playwright/test';

const prints = ['contour', 'orbit', 'weave', 'dunes', 'prism', 'pulse'];
const faceplates = ['vcf', 'mix', 'div', 'vco', 'lfo', 'vca'];

// Compare the artwork with real instrument panels rendered under the current theme.
async function checkPrintColours(canvases) {
    const matched = await canvases.evaluateAll((nodes, moduleTypes) => nodes.map((canvas, i) => {
        const panel = document.createElement('div');
        const definition = window.eurorackApp.host.registry.get(moduleTypes[i]);
        panel.className = 'module ' + definition.color;
        document.body.append(panel);
        const face = getComputedStyle(panel).backgroundColor;
        panel.remove();
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const token = name => getComputedStyle(document.body).getPropertyValue('--factory-' + name).trim()
            .slice(1).match(/../g).map(hex => parseInt(hex, 16));
        const ink = token('ink'), orange = token('orange');
        let hasInk = false, hasOrange = false, hasBlue = false;
        for (let j = 0; j < pixels.length; j += 4) {
            const r = pixels[j], g = pixels[j + 1], b = pixels[j + 2];
            if (pixels[j + 3] < 96) continue;
            // Thin strokes in small swatches are antialiased and alpha-premultiplied.
            hasInk ||= Math.abs(r - ink[0]) <= 2 && Math.abs(g - ink[1]) <= 2 && Math.abs(b - ink[2]) <= 2;
            hasOrange ||= Math.abs(r - orange[0]) <= 2 && Math.abs(g - orange[1]) <= 2 && Math.abs(b - orange[2]) <= 2;
            hasBlue ||= b > r + 8 && b > g + 8;
        }
        return {module: moduleTypes[i], faceMatches: face === getComputedStyle(canvas).backgroundColor, hasInk, hasOrange, hasBlue};
    }), faceplates);
    expect(matched).toEqual(faceplates.map(module => ({module, faceMatches:true, hasInk:true, hasOrange:true, hasBlue:false})));
}

test.afterEach(async ({ page }) => {
    expect((await page.pageErrors()).map(error => error.message)).toEqual([]);
});

test('each print has two palettes and edits survive a shared patch link', async ({ page }, info) => {
    await page.goto('/?test=Test+-+Spacer+Prints');
    const panels = page.locator('.module-type-spacer');
    await expect(panels).toHaveCount(6);
    const styles = () => panels.evaluateAll(nodes => nodes.map(node => node.dataset.spacerStyle));
    const pixels = () => panels.locator('canvas').evaluateAll(nodes => nodes.map(canvas => canvas.toDataURL()));
    expect(await styles()).toEqual(prints);
    await checkPrintColours(panels.locator('canvas'));
    const light = await pixels();
    await page.locator('#themeModeToggle').click();
    const dark = await pixels();
    await checkPrintColours(panels.locator('canvas'));
    expect(dark.every((bitmap, i) => bitmap !== light[i])).toBe(true);
    expect(await styles()).toEqual(prints);
    const picker = page.getByRole('dialog', { name: 'Edit spacer' });
    await panels.first().click({ button: 'right' });
    await checkPrintColours(picker.locator('canvas'));
    await picker.screenshot({ path: info.outputPath('style-picker-dark.png') });
    await page.keyboard.press('Escape');
    await page.locator('#themeModeToggle').click();
    expect(await pixels()).toEqual(light);

    const panel = page.locator('#module-contour');
    await panel.click({ button: 'right' });
    await expect(picker.getByRole('radio')).toHaveCount(6);
    await checkPrintColours(picker.locator('canvas'));
    await expect(picker.getByRole('radio', { name: 'Contour' })).toBeChecked();
    await picker.screenshot({ path: info.outputPath('style-picker.png') });
    await picker.getByText('Prism', { exact: true }).click();
    await picker.getByRole('button', { name: 'Apply' }).click();
    expect(await styles()).toEqual(['prism', ...prints.slice(1)]);
    await panel.locator('.module-label').focus();
    await page.keyboard.press('Shift+F10');
    await expect(picker.getByRole('radio', { name: 'Prism' })).toBeFocused();
    await picker.getByText('Orbit', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-spacer-style', 'prism');
    const hash = await page.evaluate(async () => {
        const { createPatchUrlHash } = await import('/js/app/patch-format.js');
        const app = window.eurorackApp;
        return createPatchUrlHash({ name: 'Print proof', state: app.host.serializePatch() }, { registry: app.host.registry });
    });
    await page.goto('/#' + hash);
    await page.reload();
    await expect(page.locator('#module-contour')).toHaveAttribute('data-spacer-style', 'prism');
    expect(await styles()).toEqual(['prism', ...prints.slice(1)]);
});

test('narrow spacer labels fit inside their footer in both themes', async ({ page }) => {
    await page.goto('/?test=Test+-+Spacer+Prints');
    const panels = page.locator('.module-type-spacer');
    await expect(panels).toHaveCount(prints.length);

    for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await page.locator('#themeModeToggle').click();
        const clipped = await panels.evaluateAll(nodes => {
            const failures = [];
            for (const hp of [6, 5, 4, 3, 2, 1]) {
                for (const panel of nodes) {
                    window.eurorackApp.setParam(panel.dataset.instanceId, 'hp', hp);
                    const button = panel.querySelector('.spacer-legend');
                    const footer = button.getBoundingClientRect();
                    const art = panel.querySelector('canvas').getBoundingClientRect();
                    const labels = hp >= 5 ? button.children : [button.firstElementChild];
                    for (const label of labels) {
                        const text = document.createRange();
                        text.selectNodeContents(label);
                        const box = text.getBoundingClientRect();
                        if (text.getClientRects().length !== 1 || !box.width ||
                            box.left < footer.left - 0.5 || box.right > footer.right + 0.5 ||
                            box.top < Math.max(footer.top, art.bottom) - 0.5 || box.bottom > footer.bottom + 0.5) {
                            failures.push(`${panel.dataset.spacerStyle} ${hp} HP: ${label.textContent}`);
                        }
                    }
                }
            }
            return failures;
        });
        expect(clipped, theme).toEqual([]);
    }

    await page.getByRole('button', { name: 'Change artwork for Contour, 1 HP spacer' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit spacer' }).getByRole('spinbutton')).toHaveValue('1');
});

test('fills gaps from 1 to 84 HP while a voice continues playing', async ({ page }) => {
    await page.goto('/?test=Test+-+VCO+Only');
    await page.locator('#startButton').click();
    await page.waitForFunction(() => {
        const engine = window.eurorackApp?.host.engine;
        return engine?.activeRevision && engine.activeRevision === engine.revision;
    });
    const revision = await page.evaluate(() => window.eurorackApp.host.engine.activeRevision);
    const open = () => page.getByRole('button', { name: '+ Spacer', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Add spacer' });
    const width = picker.getByRole('spinbutton');
    await open();
    const free = Number(await width.inputValue());
    expect(free).toBeGreaterThan(1);
    expect(free).toBeLessThan(84);
    await width.fill(String(free - 1));
    await picker.getByRole('button', { name: 'Add spacer' }).click();
    await open();
    await expect(width).toHaveValue('1');
    await picker.getByText('Weave', { exact: true }).click();
    await picker.getByRole('button', { name: 'Add spacer' }).click();
    const stripe = page.locator('#rack-row-1 .module-type-spacer').last();
    expect((await stripe.boundingBox()).width).toBe(18);
    await expect(stripe).toHaveAttribute('data-spacer-style', 'weave');
    await open();
    await expect(picker.getByRole('combobox')).toHaveValue('2');
    await expect(width).toHaveValue('84');
    await width.fill('7');
    await picker.getByRole('button', { name: 'Fill gap' }).click();
    await picker.getByText('Dunes', { exact: true }).click();
    await picker.getByRole('button', { name: 'Add spacer' }).click();
    const wide = page.locator('#rack-row-2 .module-type-spacer');
    expect((await wide.boundingBox()).width).toBe(84 * 18);
    await open();
    await expect(picker.getByRole('button', { name: 'Add spacer' })).toBeDisabled();
    await expect(picker.getByRole('alert')).toHaveText(/All rows are full/);
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await wide.getByRole('button', { name: /Change artwork/ }).click();
    const edit = page.getByRole('dialog', { name: 'Edit spacer' });
    await edit.getByRole('spinbutton').fill('13');
    await edit.getByText('Pulse', { exact: true }).click();
    await edit.getByRole('button', { name: 'Apply' }).click();
    expect((await wide.boundingBox()).width).toBe(13 * 18);
    await expect(wide).toHaveAttribute('data-spacer-style', 'pulse');
    const sound = await page.evaluate(async () => {
        const engine = window.eurorackApp.host.engine;
        const { left } = await engine.captureOutput({ durationSeconds: 0.15 });
        return { revision: engine.activeRevision, audible: left.some(sample => Math.abs(sample) > 0.001) };
    });
    expect(sound).toEqual({ revision, audible: true });
});
