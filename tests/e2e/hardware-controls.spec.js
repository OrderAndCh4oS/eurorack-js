import { openTestPatch } from './patch-library-helpers.js';
import { expect, test } from '@playwright/test';

const loadFactoryPatch = async (page, name, moduleId) => {
    await openTestPatch(page, name);
    await page.waitForFunction(id => window.eurorackApp.state.getModule(id), moduleId);
};

test('the Oct switch changes the pitches captured at the running worklet output', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.evaluate(() => window.eurorackApp.loadPatchState({
        version: 3, plugins: { core: 1 }, midiMappings: {},
        modules: ['lfo', 'arp', 'out', 'granulita'].map((type, index) => ({ id: type, type, row: 1, index })),
        params: { lfo: { rateKnob: 1, range: 1, waveKnob: 1 }, arp: { chord: 0, octaves: 1 }, out: { volume: 1 } },
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'arp', toPort: 'trigger' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'out', toPort: 'L' }
        ]
    }, { managed: true }));
    const dir = page.locator('#module-granulita select[data-param="direction"]');
    await dir.selectOption({ label: 'FWD' });
    expect(await page.evaluate(() => window.eurorackApp.state.getParam('granulita', 'direction'))).toBe(2);
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
    const pitches = () => page.evaluate(async () => {
        const { left } = await window.eurorackApp.host.engine.captureOutput({ durationSeconds: 0.2 });
        // OUT sends 5 V as full scale, and ARP sends 12 semitones per volt.
        return [...new Set(left.map(value => Math.round(value * 60)))].sort((a, b) => a - b);
    });
    const oct = page.getByRole('button', { name: 'Oct', exact: true });
    await expect(oct).toHaveAttribute('aria-pressed', 'false');
    expect(await pitches()).toEqual([0, 4, 7]);
    await oct.click();
    await expect(oct).toHaveAttribute('aria-pressed', 'true');
    expect(await pitches()).toEqual([0, 4, 7, 12, 16, 19]);
    await oct.click();
    expect(await pitches()).toEqual([0, 4, 7]);
});

test('learns joystick axes and switches without moving them during assignment', async ({ page }) => {
    await page.addInitScript(() => {
        const input = { name: 'Test controller' };
        Object.defineProperty(navigator, 'requestMIDIAccess', {
            value: async () => ({ inputs: new Map([['test', input]]) })
        });
        window.sendTestCC = (cc, value) => input.onmidimessage({ data: [0xb0, cc, value] });
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.midiManager?.isConnected);
    await page.evaluate(() => window.eurorackApp.loadPatchState({
        version: 3, plugins: { core: 1 }, midiMappings: {}, params: {},
        modules: [{ id: 'stick', type: 'joystick', row: 1, index: 0 }, { id: 'arp', type: 'arp', row: 1, index: 1 }], cables: []
    }, { managed: true }));
    const params = () => page.evaluate(() => {
        const state = window.eurorackApp.state;
        return [state.getParam('stick', 'x'), state.getParam('stick', 'y'), state.getParam('arp', 'octaves')];
    });
    const initial = await params();
    await page.locator('#midiLearnBtn').click();
    for (const [cc, selector] of [[10, '#module-stick button[data-param="x"]'], [11, '#module-stick button[data-param="y"]'], [12, '#module-arp .switch[data-param="octaves"]']]) {
        await page.locator(selector).click();
        await page.evaluate(n => window.sendTestCC(n, 63), cc);
        await expect(page.locator(selector)).toHaveClass(/midi-mapped/);
        expect(await params()).toEqual(initial);
    }
    await page.locator('#midiLearnBtn').click();
    await page.evaluate(() => { window.sendTestCC(10, 0); window.sendTestCC(11, 127); window.sendTestCC(12, 127); });
    expect(await params()).toEqual([-1, 1, 2]);
});

test('zooms frozen spectrogram history captured by the audio worklet', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.evaluate(() => window.eurorackApp.loadPatchState({
        version: 3, plugins: { core: 1 }, midiMappings: {}, params: {},
        modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }, { id: 'spec', type: 'spectrogram', row: 1, index: 1 }],
        cables: [{ fromModule: 'osc', fromPort: 'triangle', toModule: 'spec', toPort: 'audio' }]
    }, { managed: true }));
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('spec').instance.history.length >= 24);
    await page.locator('#module-spec .switch[data-param="freeze"]').click();
    const knob = page.locator('#module-spec .knob[data-param="time"]');
    const count = () => page.evaluate(() => window.eurorackApp.state.getModule('spec').instance.getExportData().history.length);
    const box = await knob.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    for (const dy of [180, -180]) {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + dy);
        await page.mouse.up();
        if (dy > 0) await expect.poll(count).toBe(20);
        else await expect.poll(count).toBeGreaterThanOrEqual(24);
    }
});

test('keeps recent-module hardware controls consistent in Industrial Light', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await loadFactoryPatch(page, 'Test - Probability Sequencer', 'probSeq');

    const panel = page.locator('#module-probSeq');
    await expect(panel.locator('input[type="range"]')).toHaveCount(0);
    await expect(panel.locator('.prob-seq-editor-knob .knob')).toHaveCount(2);
    await expect(panel.locator('.hardware-button')).toHaveCount(9);
    await expect(panel.locator('.hardware-select')).toHaveCount(1);

    const statusCenters = await panel.locator('.prob-seq-status-row > span').evaluateAll(items => (
        items.map(item => {
            const box = item.getBoundingClientRect();
            return box.x + box.width / 2;
        })
    ));
    expect(statusCenters).toHaveLength(4);
    expect(statusCenters[3] - statusCenters[0]).toBeGreaterThan(100);
    expect(statusCenters).toEqual([...statusCenters].sort((a, b) => a - b));

    const styles = await panel.evaluate(element => {
        const readStyle = selector => {
            const style = getComputedStyle(element.querySelector(selector));
            return {
                backgroundImage: style.backgroundImage,
                borderRadius: style.borderTopLeftRadius,
                boxShadow: style.boxShadow,
                transform: style.transform
            };
        };
        const button = element.querySelector('.prob-seq-step:not(.selected)');
        const idleButton = readStyle('.prob-seq-step:not(.selected)');
        button.classList.add('active');
        const activeButton = readStyle('.prob-seq-step.active');
        button.classList.remove('active');
        return {
            button: idleButton,
            activeButton,
            select: readStyle('.hardware-select')
        };
    });

    expect(styles.button.borderRadius).toBe('0px');
    expect(styles.button.transform).toBe('none');
    expect(styles.activeButton.transform).toBe('none');
    expect(styles.button.backgroundImage).toBe('none');
    expect(styles.button.boxShadow).toBe('none');
    expect(styles.select.boxShadow).toBe('none');

    await loadFactoryPatch(page, 'Test - CV Recorder', 'recorder');
    await expect(page.locator('#module-recorder .action-btn')).toHaveCount(4);
    await expect(page.locator('#module-recorder .switch')).toHaveCount(3);
    const establishedIndustrialStyles = await page.locator('#module-recorder').evaluate(element => {
        const action = getComputedStyle(element.querySelector('.action-btn'));
        const toggle = element.querySelector('.switch');
        const toggleStyle = getComputedStyle(toggle);
        const toggleCap = getComputedStyle(toggle, '::after');
        return {
            action: {
                backgroundImage: action.backgroundImage,
                borderRadius: action.borderTopLeftRadius
            },
            toggle: {
                height: toggleStyle.height,
                width: toggleStyle.width,
                capBackgroundImage: toggleCap.backgroundImage,
                capBorderRadius: toggleCap.borderTopLeftRadius,
                capBoxShadow: toggleCap.boxShadow
            }
        };
    });
    expect(establishedIndustrialStyles.action).toEqual({
        backgroundImage: 'none',
        borderRadius: '0px'
    });
    expect(establishedIndustrialStyles.toggle).toEqual({
        height: '22px',
        width: '14px',
        capBackgroundImage: 'none',
        capBorderRadius: '0px',
        capBoxShadow: 'none'
    });

    await loadFactoryPatch(page, 'Test - Pitch Tracker', 'tracker');
    await expect(page.locator('#module-tracker .switch')).toHaveCount(1);

    await loadFactoryPatch(page, 'Test - Shimmer', 'inputShimmer');
    await expect(page.locator('#module-inputShimmer .action-btn')).toHaveCount(2);
    await expect(page.locator('#module-inputShimmer .switch')).toHaveCount(1);

    expect(pageErrors).toEqual([]);
});
