import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openTestPatch } from './patch-library-helpers.js';
import beatboxProFixture from './fixtures/beatbox-pro.js';

async function capture(page, durationSeconds = 0.5) {
    return page.evaluate(async durationSeconds => {
        const result = await window.eurorackApp.host.engine.captureOutput({ durationSeconds });
        let peak = 0, energy = 0;
        for (const value of result.left) {
            if (!Number.isFinite(value)) throw new Error('Nonfinite worklet sample');
            peak = Math.max(peak, Math.abs(value));
            energy += value * value;
        }
        return { peak, rms: Math.sqrt(energy / result.left.length), frames: result.left.length };
    }, durationSeconds);
}

async function waitForTopology(page) {
    await page.waitForFunction(() => {
        const engine = window.eurorackApp.host.engine;
        return engine.activeRevision === engine.revision && !engine.pendingTopologies.size;
    });
}

async function checkPanel(panel, hp, inputs = 6) {
    await expect(panel).toHaveClass(new RegExp(`module-${hp}hp`));
    await expect(panel.locator('.jack[data-dir="input"]')).toHaveCount(inputs);
    const bounds = await panel.boundingBox();
    for (const jack of await panel.locator('.jack').all()) {
        const box = await jack.boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    }
}

test('separate Vocal and Beatbox panels drive independent real AudioWorklet voices', async ({ page }, testInfo) => {
    test.slow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && /disabled|worklet|wasm|airway/i.test(message.text())) errors.push(message.text());
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await openTestPatch(page, 'Test - Vocal');
    const voicePanel = page.locator('#module-vocal');
    await checkPanel(voicePanel, 28, 16);
    await expect(voicePanel.locator('.knob[data-param]')).toHaveCount(16);
    const vocalBounds = await voicePanel.boundingBox();
    for (const control of await voicePanel.locator('.knob-container, .jack-container, .vocal-sound-cell').all()) {
        const box = await control.boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(vocalBounds.y + vocalBounds.height - 8);
    }
    await expect(voicePanel.locator('[data-param="mode"], [data-param="audition"]')).toHaveCount(0);
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
    const voice = await capture(page, 1);
    expect(voice.rms).toBeGreaterThan(0.001);
    expect(voice.peak).toBeLessThanOrEqual(1);
    await expect(voicePanel.locator('.vocal-sound')).toHaveCount(32);
    const bankBoxes = await voicePanel.locator('.vocal-sound').evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { x: box.x, y: box.y, bottom: box.bottom };
    }));
    expect(new Set(bankBoxes.map(box => box.y)).size).toBe(4);
    expect(new Set(bankBoxes.map(box => box.x)).size).toBe(8);
    const cells = await voicePanel.locator('.vocal-sound-cell').evaluateAll(cells => cells.map(cell => {
        const label = cell.querySelector('.vocal-sound-label'), button = cell.querySelector('button');
        const l = label.getBoundingClientRect(), b = button.getBoundingClientRect(), c = cell.getBoundingClientRect();
        return { width: b.width, height: b.height, labelRight: l.right, buttonLeft: b.left,
            buttonRight: b.right, cellRight: c.right, align: getComputedStyle(label).textAlign,
            text: button.textContent, lit: button.classList.contains('active') };
    }));
    for (const cell of cells) {
        expect(cell.width).toBe(10); expect(cell.height).toBe(10);
        expect(cell.labelRight).toBeLessThan(cell.buttonLeft);
        expect(cell.buttonRight).toBeCloseTo(cell.cellRight, 1);
        expect(cell.align).toBe('right'); expect(cell.text).toBe('');
    }
    // Match the actual SEQ control in both states, including its theme-owned glow.
    for (const active of [true, false]) {
        const styles = await page.evaluate(active => {
            const properties = ['width', 'height', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow'];
            return ['#module-vocal .vocal-sound', '#module-phrase .seq-gate-btn'].map(selector => {
                const node = document.querySelector(selector + (active ? '.active' : ':not(.active)'));
                const css = getComputedStyle(node);
                return Object.fromEntries(properties.map(property => [property, css[property]]));
            });
        }, active);
        expect(styles[0]).toEqual(styles[1]);
    }
    await voicePanel.getByRole('button', { name: 'Disable all sounds', exact: true }).click();
    await expect(voicePanel.locator('.vocal-sound[aria-pressed="true"]')).toHaveCount(0);
    await capture(page, .25);
    expect((await capture(page)).peak).toBeLessThan(.0001);
    await voicePanel.getByRole('button', { name: 'SH sound', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('vocal').params.enableSH)).toBe(1);
    await expect(voicePanel.getByRole('button', { name: 'SH sound', exact: true })).toHaveAttribute('aria-current', 'true');
    expect((await capture(page, 1)).rms).toBeGreaterThan(.0001);
    await voicePanel.getByRole('button', { name: 'A sound', exact: true }).click();
    await voicePanel.getByRole('button', { name: 'M sound', exact: true }).click();
    await voicePanel.getByRole('button', { name: 'Female vocal tract', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('vocal').params.female)).toBe(1);
    await expect(voicePanel.getByRole('button', { name: 'Female vocal tract', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.eurorackApp.host.setParam('vocal', 'pitch', 12));
    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    const femaleAudio = await capture(page, 2);
    expect(femaleAudio.rms).toBeGreaterThan(.001);
    expect(femaleAudio.peak).toBeLessThanOrEqual(1);
    const femaleProfile = await page.evaluate(() => window.eurorackApp.host.engine.requestProfilingReport());
    await writeFile(testInfo.outputPath('female-audio-profile.json'), JSON.stringify({ femaleAudio, femaleProfile }, null, 2));
    // Export/reload preserves a sparse pool and its light state.
    await page.evaluate(async () => {
        const host = window.eurorackApp.host;
        await host.loadPatch(host.state.serializePatch(host.registry));
    });
    await expect(voicePanel.locator('.vocal-sound[aria-pressed="true"]')).toHaveCount(3);
    await expect(voicePanel.getByRole('button', { name: 'Female vocal tract', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['A', 'M', 'SH']) await expect(voicePanel.getByRole('button', { name: `${label} sound`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect((await capture(page, 1)).rms).toBeGreaterThan(.001);
    await page.screenshot({ path: testInfo.outputPath('vocal.png'), fullPage: true });

    // Add a second physical engine while the first runs; no shared mutable mouth.
    const extraId = await page.evaluate(() => window.eurorackApp.host.addModule('beatbox').id);
    await waitForTopology(page);
    await page.evaluate(id => window.eurorackApp.host.setParam(id, 'audition', 1), extraId);
    expect((await capture(page)).rms).toBeGreaterThan(0.001);
    await page.evaluate(id => window.eurorackApp.host.removeModule(id), extraId);

    await openTestPatch(page, 'Test - Beatbox');
    const beatPanel = page.locator('#module-beatbox');
    await checkPanel(beatPanel, 16, 8);
    await expect(beatPanel.locator('[data-port="gate"], [data-param="mode"], [data-param="articulation"]')).toHaveCount(0);
    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    const beat = await capture(page, 2);
    expect(beat.rms).toBeGreaterThan(0.001);
    expect(beat.peak).toBeLessThanOrEqual(1);
    const profile = await page.evaluate(() => window.eurorackApp.host.engine.requestProfilingReport());
    await writeFile(testInfo.outputPath('audio-profile.json'), JSON.stringify({ voice, beat, profile }, null, 2));
    await page.screenshot({ path: testInfo.outputPath('beatbox.png'), fullPage: true });

    await page.evaluate(() => {
        const host = window.eurorackApp.host;
        host.disconnect(host.state.cables.find(c => c.toModule === 'beatbox' && c.toPort === 'trig'));
    });
    await waitForTopology(page);
    await capture(page, 1);
    expect((await capture(page)).peak).toBeLessThan(0.001);
    await beatPanel.locator('[data-param="audition"]').click();
    expect((await capture(page)).peak).toBeGreaterThan(0.001);

    // The extended panel uses the same neutral voice but exposes physical CV.
    await page.evaluate(state => window.eurorackApp.loadPatchState(state, { managed: true }), beatboxProFixture.state);
    const proPanel = page.locator('#module-beatboxPro');
    await checkPanel(proPanel, 28, 17);
    await expect(proPanel.locator('.knob[data-param]')).toHaveCount(16);
    await expect(proPanel.locator('.jack[data-dir="output"]')).toHaveCount(3);
    await proPanel.locator('.switch[data-param="wrap"]').click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('beatboxPro').params.wrap)).toBe(0);
    await proPanel.locator('.switch[data-param="wrap"]').click();
    await expect.poll(() => page.evaluate(() => window.eurorackApp.state.getModule('beatboxPro').params.wrap)).toBe(1);
    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    const proAudio = await capture(page, 2);
    expect(proAudio.rms).toBeGreaterThan(.001);
    expect(proAudio.peak).toBeLessThanOrEqual(1);
    const proProfile = await page.evaluate(() => window.eurorackApp.host.engine.requestProfilingReport());
    await writeFile(testInfo.outputPath('beatbox-pro-profile.json'), JSON.stringify({ proAudio, proProfile }, null, 2));
    await page.screenshot({ path: testInfo.outputPath('beatbox-pro.png'), fullPage: true });
    // Check the maximum 2x physical rendering rate with a sustained Hum.
    await page.evaluate(() => {
        const host = window.eurorackApp.host;
        for (const cable of [...host.state.cables]) {
            if (cable.toModule === 'beatboxPro' && ['vOct', 'soundCV', 'decayCV'].includes(cable.toPort)) host.disconnect(cable);
        }
        host.setParam('beatboxPro', 'sound', 9);
        host.setParam('beatboxPro', 'pitch', 12);
        host.setParam('beatboxPro', 'decay', 4);
    });
    await waitForTopology(page);
    await capture(page, .25);
    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    const maximumTuneAudio = await capture(page, 2);
    expect(maximumTuneAudio.rms).toBeGreaterThan(.001);
    expect(maximumTuneAudio.peak).toBeLessThanOrEqual(1);
    const maximumTuneProfile = await page.evaluate(() => window.eurorackApp.host.engine.requestProfilingReport());
    await writeFile(testInfo.outputPath('beatbox-pro-maximum-tune.json'), JSON.stringify({ maximumTuneAudio, maximumTuneProfile }, null, 2));
    const chokeId = await page.evaluate(() => {
        const host = window.eurorackApp.host, source = host.addModule('atten');
        host.setParam(source.id, 'offset1', 1);
        host.connect({ fromModule: source.id, fromPort: 'out1', toModule: 'beatboxPro', toPort: 'choke' });
        return source.id;
    });
    await waitForTopology(page);
    await capture(page, .1);
    expect((await capture(page)).peak).toBeLessThan(.0001);
    await page.evaluate(id => window.eurorackApp.host.removeModule(id), chokeId);
    await waitForTopology(page);
    expect((await capture(page, 1)).peak).toBeGreaterThan(.001);

    await openTestPatch(page, 'Test - Vocal');
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
    expect((await capture(page, 1)).rms).toBeGreaterThan(0.001);
    await page.locator('#startButton').click();
    expect(errors).toEqual([]);
});
