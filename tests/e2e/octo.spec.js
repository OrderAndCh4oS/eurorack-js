import { expect, test } from '@playwright/test';

async function outputPeaks(page) {
    await page.waitForFunction(() => {
        const engine = window.eurorackApp.host.engine;
        return engine?.running && engine.activeRevision === engine.revision && !engine.pendingTopologies.size;
    });
    return page.evaluate(async () => {
        const { left, right } = await window.eurorackApp.host.engine.captureOutput({ durationSeconds: 0.65 });
        const peak = samples => samples.reduce((highest, sample) => Math.max(highest, Math.abs(sample)), 0);
        return { left: peak(left), right: peak(right) };
    });
}

test('carries audio and triggers across rows, reconnects the trunk, and reopens a browser save', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/?test=Test+-+Octo+Cable+Snake');
    const sendLink = page.locator('#jack-sender-link');
    const receiveLink = page.locator('#jack-receiver-link');
    await expect(sendLink).toBeVisible();
    await expect(receiveLink).toBeVisible();
    await expect(page.locator('#module-sender .jack.input')).toHaveCount(8);
    await expect(page.locator('#module-receiver .jack.output')).toHaveCount(8);
    const cables = page.locator('#cable-svg .cable');
    await expect(cables).toHaveCount(6);
    await page.locator('#startButton').click();
    const playing = await outputPeaks(page);
    expect(playing.left).toBeGreaterThan(0.1);
    expect(playing.right).toBeGreaterThan(0.1);

    const laneOne = page.locator('#jack-sender-in1');
    await laneOne.click({ button: 'right' });
    const laneOpen = await outputPeaks(page);
    expect(laneOpen.left).toBe(0);
    expect(laneOpen.right).toBeGreaterThan(0.1);
    await page.locator('#jack-tone-triangle').dragTo(laneOne);
    await expect(cables).toHaveCount(6);

    await receiveLink.click({ button: 'right' });
    await expect(cables).toHaveCount(5);
    expect((await outputPeaks(page)).left).toBe(0);
    await sendLink.dragTo(receiveLink);
    await expect(cables).toHaveCount(6);
    const reconnected = await outputPeaks(page);
    expect(reconnected.left).toBeGreaterThan(0.1);
    expect(reconnected.right).toBeGreaterThan(0.1);
    await page.locator('#startButton').click();

    const patch = await page.evaluate(() => window.eurorackApp.host.serializePatch());
    await page.locator('#savePatchCopy').click();
    const save = page.getByRole('dialog', { name: 'Save a copy' });
    await save.getByLabel('Patch name', { exact: true }).fill('Two rows with one trunk');
    await save.getByLabel('Save to', { exact: true }).selectOption('local');
    await save.getByRole('button', { name: 'Save copy', exact: true }).click();
    await expect(save).toHaveCount(0);
    const savedId = await page.evaluate(() => window.eurorackApp.patchLibrary.active.id);
    await page.goto('/#local=' + encodeURIComponent(savedId));
    await page.reload();
    await expect(page.locator('#activePatchLabel')).toContainText('Two rows with one trunk');
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(patch);
    await page.locator('#startButton').click();
    const reopened = await outputPeaks(page);
    expect(reopened.left).toBeGreaterThan(0.1);
    expect(reopened.right).toBeGreaterThan(0.1);
    expect(errors).toEqual([]);
});
