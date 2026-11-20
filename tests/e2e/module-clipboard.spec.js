import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
const panel = (page, id) => page.locator(`#module-${id} > .module-label`);
const selected = page => page.locator('.rack-row .module-selected');
const wire = (fromModule, toModule, toPort = 'ch1In') => ({ fromModule, fromPort: 'ch1Out', toModule, toPort });
const cables = [wire('feed', 'first'), wire('first', 'second'), wire('second', 'first', 'ch2In'), wire('second', 'monitor')];
const patch = {
    version: 3, plugins: { core: 1 }, midiMappings: {}, cables,
    modules: ['feed', 'first', 'second', 'monitor'].map((id, index) => ({ id, type: 'vca', row: 1, index })),
    params: { first: { ch1Gain: 0.375 } }
};

async function openRack(page, state = patch) {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await page.evaluate(state => window.eurorackApp.loadPatchState(state, { managed: true }), state);
}

test('rack shortcut hints use three compact lines on desktop and wrap within a narrow footer', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1728, height: 960 });
    await openRack(page);
    const hints = page.locator('.cable-hints');
    await hints.scrollIntoViewIfNeeded();
    await expect(hints).toHaveCSS('text-transform', 'none');
    await expect(hints).toHaveCSS('font-family', /Space Grotesk/);
    await page.evaluate(() => document.fonts.ready);
    const metrics = () => hints.evaluate(el => ({
        lines: el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight),
        width: el.clientWidth, contentWidth: el.scrollWidth
    }));
    expect((await metrics()).lines).toBeCloseTo(3, 1);
    await page.locator('.rack-bottom-bar').screenshot({ path: testInfo.outputPath('desktop-shortcuts.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await hints.scrollIntoViewIfNeeded();
    const narrow = await metrics();
    expect(narrow.lines).toBeGreaterThan(3);
    expect(narrow.contentWidth).toBe(narrow.width);
    const box = await hints.boundingBox();
    expect((await page.locator('.app-footer').boundingBox()).y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    await page.locator('.rack-bottom-bar').screenshot({ path: testInfo.outputPath('mobile-shortcuts.png') });
});

test('selected panels have a continuous orange ring and their titles identify individual instances', async ({ page }, testInfo) => {
    await openRack(page, { ...patch, params: {}, cables: [],
        modules: ['swing-left', 'swing-right'].map((id, index) => ({ id, type: 'swing', row: 1, index }))
    });
    const left = panel(page, 'swing-left');
    const right = panel(page, 'swing-right');
    const tip = page.getByRole('tooltip');
    await left.hover({ position: { x: 5, y: 3 } });
    await expect(tip).toHaveText('swing-left');
    const bubble = await tip.boundingBox();
    expect(bubble.y + bubble.height).toBeLessThan((await left.boundingBox()).y);
    await right.hover();
    await expect(tip).toHaveText('swing-right');
    await page.locator('#rack-row-2').hover();
    await expect(tip).toBeHidden();

    await left.click();
    await right.click({ modifiers: ['Control'] });
    await expect(selected(page)).toHaveCount(2);
    await page.locator('#rack-container').focus();
    await page.keyboard.press('Tab');
    await expect(left).toBeFocused();
    await expect(left).toHaveCSS('outline-style', 'none');
    await expect(tip).toHaveText('swing-left');

    const module = page.locator('#module-swing-left');
    const accent = await module.evaluate(el => getComputedStyle(el).getPropertyValue('--factory-orange').trim());
    const orange = Buffer.from(accent.slice(1), 'hex');
    const screenshot = await module.screenshot({ scale: 'css', path: testInfo.outputPath('selected-swing.png') });
    const { data, info: { width, height, channels } } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const center = Math.floor(width / 2);
    const middle = Math.floor(height / 2);
    for (const [x, y] of [[center, 1], [2, 9], [width - 2, 9], [2, middle], [width - 2, middle], [center, height - 2]]) {
        const offset = (y * width + x) * channels;
        // The factory skin overlays its colors with a 5% paper texture.
        for (const [channel, value] of orange.entries()) {
            expect(Math.abs(data[offset + channel] - value), `panel edge at ${x},${y}`).toBeLessThanOrEqual(13);
        }
    }
});

test('range and individual selection copy just the internal wiring while audio runs', async ({ page }) => {
    await openRack(page);
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveText('Stop');
    await panel(page, 'first').click();
    await panel(page, 'monitor').click({ modifiers: ['Shift'] });
    await expect(selected(page)).toHaveCount(3);
    await panel(page, 'monitor').click({ modifiers: ['Control'] });
    await expect(selected(page)).toHaveCount(2);
    await expect(panel(page, 'first')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page, 'second')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ControlOrMeta+c');
    const copied = await page.evaluate(async () => JSON.parse(await navigator.clipboard.readText()));
    expect(copied.patch.modules.map(module => module.id)).toEqual(['first', 'second']);
    expect(copied.patch.cables).toEqual([cables[1], cables[2]]);
    await page.evaluate(() => window.eurorackApp.setParam('first', 'ch1Gain', 0.9));
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('.rack-row .module')).toHaveCount(6);
    const newIds = await selected(page).evaluateAll(items => items.map(el => el.dataset.instanceId));
    const [a, b] = newIds;
    const state = await page.evaluate(() => window.eurorackApp.host.serializePatch());
    expect(state.modules.map(module => module.id)).toEqual(['feed', 'first', 'second', a, b, 'monitor']);
    expect(state.params[a].ch1Gain).toBe(0.375);
    expect(state.params.first.ch1Gain).toBe(0.9);
    expect(state.cables).toEqual([...cables, wire(a, b), wire(b, a, 'ch2In')]);
    await expect(page.locator('#cable-svg .cable')).toHaveCount(6);
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('.rack-row .module')).toHaveCount(8);
    await expect(selected(page)).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(selected(page)).toHaveCount(0);
    await panel(page, 'feed').click();
    await panel(page, 'monitor').click({ modifiers: ['Meta'] });
    await expect(selected(page)).toHaveCount(2);
    await page.keyboard.press('ControlOrMeta+c');
    const nonadjacent = await page.evaluate(async () => JSON.parse(await navigator.clipboard.readText()).patch);
    expect(nonadjacent.modules.map(module => module.id)).toEqual(['feed', 'monitor']);
    expect(nonadjacent.cables).toEqual([]);
});

test('a single module pastes in another tab and clipboard shortcuts still edit text', async ({ page, context }) => {
    await openRack(page);
    await panel(page, 'first').click();
    await page.keyboard.press('ControlOrMeta+c');
    const destination = await context.newPage();
    await openRack(destination, { ...patch, modules: [], params: {}, cables: [] });
    await destination.locator('#rack-row-2').click({ position: { x: 25, y: 45 } });
    await destination.keyboard.press('ControlOrMeta+v');
    await expect(destination.locator('#rack-row-2 .module-selected')).toHaveCount(1);
    await expect(destination.locator('#cable-svg .cable')).toHaveCount(0);

    const name = destination.locator('#patchName');
    await name.fill('Ordinary text');
    await name.press('ControlOrMeta+a');
    await destination.keyboard.press('ControlOrMeta+c');
    await name.fill('');
    await destination.keyboard.press('ControlOrMeta+v');
    await expect(name).toHaveValue('Ordinary text');
    await expect(destination.locator('.rack-row .module')).toHaveCount(1);
});

test('a local module pastes from its saved revision in another tab', async ({ page, context }) => {
    const empty = { ...patch, modules: [], params: {}, cables: [] };
    await openRack(page, empty);
    await page.locator('#patchWorkbenchToggle').click();
    await page.getByRole('tab', { name: 'Modules', exact: true }).click();
    await page.getByRole('button', { name: 'New module', exact: true }).click();
    await page.getByRole('button', { name: 'Use module', exact: true }).click();
    await expect(page.locator('.module-source-status')).toHaveText('Added to rack.');
    await page.getByRole('button', { name: 'Close Code', exact: true }).click();
    const source = page.locator('.rack-row .module');
    const id = await source.getAttribute('data-instance-id');
    await source.locator('.module-label').click();
    await page.keyboard.press('ControlOrMeta+c');

    const destination = await context.newPage();
    await openRack(destination, empty);
    await destination.locator('#rack-row-1').click({ position: { x: 25, y: 45 } });
    await destination.keyboard.press('ControlOrMeta+v');
    const copy = selected(destination);
    await expect(copy).toHaveCount(1);
    const copied = await destination.evaluate(() => window.eurorackApp.host.serializePatch().modules[0]);
    expect(copied.type).toMatch(/^local-[a-z0-9]{26}$/);
    expect(copied.id).not.toBe(id);
    await expect(copy.locator('[data-param="level"]')).toBeVisible();
});
