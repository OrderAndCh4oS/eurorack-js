import { expect, test } from '@playwright/test';
import { openTestPatch } from './patch-library-helpers.js';

const newPatch = page => page.getByRole('button', { name: 'New patch', exact: true });
const rack = page => page.evaluate(() => window.eurorackApp.host.serializePatch());

async function openChorus(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await openTestPatch(page, 'Test - Chorus');
}

async function expectEmptyRack(page) {
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle('Untitled · Eurorack');
    await expect(page.locator('#activePatchLabel')).toHaveText('Untitled · Unsaved rack');
    await expect(page.locator('#patchName')).toHaveValue('');
    await expect(page.locator('.rack-row .module, #cable-svg path')).toHaveCount(0);
    expect(await rack(page)).toMatchObject({ modules: [], cables: [], params: {}, midiMappings: {} });
}

test('New patch offers the discard dialog from My patches and clears the playing rack on confirmation', async ({ page }) => {
    await openChorus(page);
    await expect(page.locator('#newPatch + [data-patch-view="mine"]')).toHaveText('My patches');
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveText('Stop');
    const original = await rack(page);
    expect(original.cables.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'My patches', exact: true }).click();
    const catalogue = page.url();
    await newPatch(page).click();
    const dialog = page.getByRole('dialog', { name: 'Start a new patch?' });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(catalogue);
    expect(await rack(page)).toEqual(original);
    await newPatch(page).click();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expectEmptyRack(page);
    await expect(page.locator('#startButton')).toHaveText('Stop');
    await page.goBack();
    await expect(page).toHaveURL(catalogue);
    await page.getByRole('button', { name: 'Rack', exact: true }).click();
    await expectEmptyRack(page);
});

test('New patch waits for the edited rack to be saved and preserves that browser save', async ({ page }) => {
    await openChorus(page);
    await page.locator('.sidebar-module[data-module-type="vca"]').click();
    const edited = await rack(page);
    const warning = page.getByRole('dialog', { name: 'Unsaved rack changes' });
    const save = page.getByRole('dialog', { name: 'Save a copy' });
    await newPatch(page).click();
    await warning.getByRole('button', { name: 'Save', exact: true }).click();
    await save.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await rack(page)).toEqual(edited);
    await newPatch(page).click();
    await warning.getByRole('button', { name: 'Save', exact: true }).click();
    await save.getByRole('textbox', { name: 'Patch name', exact: true }).fill('Keep this chorus');
    await save.getByRole('button', { name: 'Save copy', exact: true }).click();
    await expectEmptyRack(page);
    await page.getByRole('button', { name: 'My patches', exact: true }).click();
    const saved = page.locator('.patch-entry').filter({ has: page.getByRole('heading', { name: 'Keep this chorus', exact: true }) });
    await saved.getByRole('button', { name: 'Open in rack', exact: true }).click();
    expect(await rack(page)).toEqual(edited);
});

test('New patch opens a clean untitled rack from the standalone navigation', async ({ page }) => {
    await page.goto('/docs');
    await page.getByRole('link', { name: 'New patch', exact: true }).click();
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await expectEmptyRack(page);
    await newPatch(page).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectEmptyRack(page);
});

test('New patch from Docs protects a recovered sign-in draft', async ({ page }) => {
    await page.goto('/docs');
    await page.evaluate(async () => {
        const { default: patch } = await import('/js/config/patches/test-chorus.js');
        sessionStorage.setItem('eurorack-login-draft-v1', JSON.stringify({
            state: patch.state, name: 'Unfinished chorus', active: null, createdAt: Date.now(),
            baseline: JSON.stringify({ version: 3, plugins: {}, modules: [], params: {}, cables: [], midiMappings: {} })
        }));
    });
    await page.getByRole('link', { name: 'New patch', exact: true }).click();
    await page.getByRole('dialog', { name: 'Unsaved rack changes' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#patchName')).toHaveValue('Unfinished chorus');
    await expect(page.locator('.rack-row .module')).toHaveCount(3);
    await expect(page.locator('#cable-svg .cable')).toHaveCount(4);
});
