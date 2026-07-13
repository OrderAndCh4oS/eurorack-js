import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('runs the custom-module patch and switches topology while audio is active', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);

    await page.locator('#patchSelect').selectOption('Test - Custom Modules');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('scope'));

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        return window.eurorackApp.host.engine && scope?.displayBuffer1?.some(sample => sample !== 0);
    });

    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);
    await page.locator('#patchSelect').selectOption('Test: Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(previousRevision => (
        window.eurorackApp.state.getModule('chorus') &&
        window.eurorackApp.host.engine?.revision > previousRevision
    ), revision);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
});

test('collects opt-in AudioWorklet profiling without module failures', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test: Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('chorus'));
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);

    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    await expect.poll(async () => page.evaluate(async () => {
        const report = await window.eurorackApp.host.engine.requestProfilingReport();
        return report.blocks.samples;
    })).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(async () => {
        const report = await window.eurorackApp.host.engine.requestProfilingReport();
        return report.modules.chorus?.samples || 0;
    })).toBeGreaterThan(0);
    const report = await page.evaluate(async () => {
        const result = await window.eurorackApp.host.engine.requestProfilingReport();
        window.eurorackApp.host.engine.setProfiling(false);
        return result;
    });

    expect(report.deadlineMs).toBeGreaterThan(0);
    expect(report.blocks.samples).toBeGreaterThan(0);
    expect(report.blocks.p99).toBeGreaterThanOrEqual(0);
    expect(report.blocks.p99Utilization).toBeGreaterThanOrEqual(0);
    expect(report.modules.chorus.samples).toBeGreaterThan(0);
});

test('loads compact and generative synth voice demos while audio is active', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await expect(page.locator('#patchSelect option', { hasText: 'Demo - Synth Voice' })).toHaveCount(12);

    await page.locator('#patchSelect').selectOption('Demo - Synth Voice 01 - Subtractive');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('seq'));
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);

    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);
    await page.locator('#patchSelect').selectOption('Demo - Synth Voice 12 - Dynamic Generative');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(previousRevision => (
        window.eurorackApp.state.getModule('cycle') &&
        window.eurorackApp.state.getModule('waveVca') &&
        window.eurorackApp.host.engine?.revision > previousRevision
    ), revision);

    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('fits the ensemble oscillator inside one module and runs its worklet DSP', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test: Ensemble VCO');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('ensemble'));

    const bounds = await page.locator('#module-ensemble').evaluate(panel => {
        const content = panel.querySelector('.module-content');
        const panelRect = panel.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        return {
            panelBottom: panelRect.bottom,
            contentBottom: contentRect.bottom,
            scrollHeight: content.scrollHeight,
            clientHeight: content.clientHeight
        };
    });
    expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => window.eurorackApp.host.engine?.revision > 0);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('fits every resonator bank socket inside its module and runs its worklet DSP', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test: Resonator Bank');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('resbank'));

    const bounds = await page.locator('#module-resbank').evaluate(panel => {
        const content = panel.querySelector('.module-content');
        const audioInput = panel.querySelector('#jack-resbank-audio');
        const panelRect = panel.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const audioInputRect = audioInput.getBoundingClientRect();
        return {
            panelBottom: panelRect.bottom,
            contentBottom: contentRect.bottom,
            audioInputBottom: audioInputRect.bottom,
            scrollHeight: content.scrollHeight,
            clientHeight: content.clientHeight
        };
    });
    expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.audioInputBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => window.eurorackApp.host.engine?.revision > 0);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});
