import { expect, test } from '@playwright/test';

test.afterEach(async ({ page }) => {
    expect((await page.pageErrors()).map(error => error.message)).toEqual([]);
});

async function openDemo(page, name, type) {
    await page.goto('/?test=' + encodeURIComponent('Test - ' + name));
    const panel = page.locator('.module-type-' + type);
    await expect(panel).toBeVisible();
    await checkPanelFit(panel);
    return panel;
}

async function checkPanelFit(panel) {
    const layout = await panel.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        const outside = [];
        for (const control of node.querySelectorAll('button, select, input, canvas, .knob, .jack, .knob-label, .jack-label')) {
            const box = control.getBoundingClientRect();
            if (!box.width || !box.height) continue;
            if (box.left < bounds.left - 1 || box.right > bounds.right + 1 ||
                box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1) {
                outside.push(control.id || control.getAttribute('aria-label') || control.textContent.trim());
            }
        }
        const touchingJacks = [];
        const jacks = [...node.querySelectorAll('.jack')];
        for (let i = 1; i < jacks.length; i++) {
            const box = jacks[i].getBoundingClientRect();
            for (const other of jacks.slice(0, i)) {
                const next = other.getBoundingClientRect();
                const width = Math.min(box.right, next.right) - Math.max(box.left, next.left);
                const height = Math.min(box.bottom, next.bottom) - Math.max(box.top, next.top);
                if (width > 1 && height > 1) touchingJacks.push([jacks[i].id, other.id]);
            }
        }
        return { outside, touchingJacks };
    });
    expect(layout.outside, 'Every visible control and jack label fits on the panel').toEqual([]);
    expect(layout.touchingJacks, 'Each jack has its own target').toEqual([]);
}

async function capture(page, label, seconds = 1.25) {
    await page.waitForFunction(() => {
        const engine = window.eurorackApp.host.engine;
        return engine?.running && engine.activeRevision && engine.activeRevision === engine.revision && !engine.pendingTopologies.size;
    });
    const result = await page.evaluate(async durationSeconds => {
        const { left, right, sampleRate } = await window.eurorackApp.host.engine.captureOutput({ durationSeconds });
        function measure(samples) {
            let energy = 0, peak = 0, rising = 0;
            for (let i = 0; i < samples.length; i++) {
                energy += samples[i] ** 2;
                peak = Math.max(peak, Math.abs(samples[i]));
                if (i && samples[i - 1] <= 0 && samples[i] > 0) rising++;
            }
            return { peak, rms: Math.sqrt(energy / samples.length), crossingsPerSecond: rising * sampleRate / samples.length };
        }
        return { sampleRate, frames: left.length, left: measure(left), right: measure(right) };
    }, seconds);
    await test.info().attach(label, { body: JSON.stringify(result), contentType: 'application/json' });
    return result;
}

async function playDemo(page) {
    await page.locator('#startButton').click();
    const result = await capture(page, 'Factory demo stereo OUT');
    for (const channel of [result.left, result.right]) {
        expect(channel.rms).toBeGreaterThan(0.001);
        expect(channel.peak).toBeLessThanOrEqual(1);
    }
}

test('edits a gate pattern and recalls the saved preset while the demo plays', async ({ page }) => {
    const panel = await openDemo(page, 'Four Track Gate Sequencer', 'gate-seq');
    await playDemo(page);
    const pad = panel.getByRole('button', { name: 'Step 2', exact: true });
    await expect(pad).toHaveAttribute('aria-pressed', 'false');
    await pad.click();
    await expect(pad).toHaveAttribute('aria-pressed', 'true');
    const memory = panel.getByRole('button', { name: 'Memory', exact: true });
    const steps = panel.getByRole('button', { name: 'Steps', exact: true });
    await memory.click();
    await checkPanelFit(panel);
    await panel.getByRole('button', { name: 'Save preset' }).click();
    await steps.click();
    await pad.click();
    await expect(pad).toHaveAttribute('aria-pressed', 'false');
    await memory.click();
    await panel.getByRole('button', { name: 'Load preset' }).click();
    await steps.click();
    await expect(pad).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: 'Track settings' }).click();
    await checkPanelFit(panel);
});

test('plays the fold percussion demo and switches synthesis modes', async ({ page }) => {
    const panel = await openDemo(page, 'Fold Percussion', 'fold-perc');
    await playDemo(page);
    await panel.getByRole('combobox', { name: 'Mode' }).selectOption({ label: 'Metal' });
    expect(await page.evaluate(() => window.eurorackApp.state.getParam('perc', 'mode'))).toBe(2);
});

test('plays the stereo DJ filter demo and engages bypass', async ({ page }) => {
    const panel = await openDemo(page, 'Stereo DJ Filter', 'dj-filter');
    await playDemo(page);
    await panel.getByRole('button', { name: 'Bypass' }).click();
    expect(await page.evaluate(() => window.eurorackApp.state.getParam('filter', 'bypass'))).toBe(1);
});

test('muting the two patched stems silences both channels of the performance demo', async ({ page }) => {
    const panel = await openDemo(page, 'Performance Mutes', 'mutes');
    await playDemo(page);
    for (const lane of ['1', '2']) await panel.getByRole('button', { name: lane, exact: true }).click();
    // Allow the panel's de-click ramp to finish before measuring silence.
    await expect.poll(async () => {
        const result = await capture(page, 'Muted stereo OUT', 0.2);
        return Math.max(result.left.peak, result.right.peak);
    }).toBe(0);
});

function wavTone(frequency) {
    const rate = 16000;
    const pcmBytes = rate * 2;
    const buffer = Buffer.alloc(44 + pcmBytes);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + pcmBytes, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(pcmBytes, 40);
    for (let i = 0; i < rate; i++) {
        buffer.writeInt16LE(Math.round(16000 * Math.sin(i * 2 * Math.PI * frequency / rate)), 44 + i * 2);
    }
    return { name: 'tone-' + frequency + '.wav', mimeType: 'audio/wav', buffer };
}

async function importTone(page, panel, frequency) {
    const file = wavTone(frequency);
    const picker = page.waitForEvent('filechooser');
    await panel.getByRole('button', { name: 'Import WAV' }).click();
    await (await picker).setFiles(file);
    await expect(panel.getByRole('status')).toContainText(file.name);
}

async function expectTone(page, panel, frequency) {
    await panel.getByRole('button', { name: 'Audition' }).click();
    const { left } = await capture(page, 'Imported ' + frequency + ' Hz at OUT', 0.5);
    expect(left.rms).toBeGreaterThan(0.05);
    expect(Math.abs(left.crossingsPerSecond - frequency)).toBeLessThan(5);
}

test('imports WAVs, edits slices, and retains both recorded and imported audio across restart', async ({ page }) => {
    const panel = await openDemo(page, 'Slice Sampler', 'slice-sampler');
    await playDemo(page);
    await panel.getByRole('button', { name: 'Player B' }).click();
    await checkPanelFit(panel);
    await panel.getByRole('button', { name: 'Player A' }).click();
    // Leave A under manual control so we measure the file selected with the picker.
    await panel.locator('#jack-sampler-trigA').click({ button: 'right' });
    await panel.getByRole('combobox', { name: 'Play A', exact: true }).selectOption({ label: 'Fwd loop' });
    await importTone(page, panel, 320);
    await expectTone(page, panel, 320);
    await panel.getByRole('spinbutton', { name: 'Cursor percent' }).fill('37.5');
    await panel.getByRole('button', { name: 'Add', exact: true }).click();
    expect(await page.evaluate(() => window.eurorackApp.state.getParam('sampler', 'markersA')))
        .toEqual([0.25, 0.375, 0.5, 0.75]);

    await panel.locator('#jack-sampler-trigB').click({ button: 'right' });
    await page.keyboard.down('Shift');
    await panel.locator('#jack-sampler-outA').dragTo(panel.locator('#jack-sampler-recB'));
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => window.eurorackApp.state.cables)).toContainEqual({
        fromModule: 'sampler', fromPort: 'outA', toModule: 'sampler', toPort: 'recB'
    });
    await panel.getByRole('button', { name: 'Player B' }).click();
    await panel.getByRole('combobox', { name: 'Play B', exact: true }).selectOption({ label: 'Fwd loop' });
    await panel.getByRole('combobox', { name: 'Cuts B', exact: true }).selectOption({ label: 'Manual' });
    const record = panel.getByRole('button', { name: 'Record', exact: true });
    await record.click();
    await expect(panel.locator('.slice-legend:visible')).toContainText('recording');
    await capture(page, 'Player A while player B records', 0.3);
    await record.click();
    await expect(panel.getByRole('status')).toContainText('Capture');

    await page.locator('#startButton').click();
    await page.waitForFunction(() => !window.eurorackApp.host.engine?.running);
    await panel.getByRole('button', { name: 'Player A' }).click();
    await importTone(page, panel, 640);
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
    await expectTone(page, panel, 640);
    await panel.getByRole('button', { name: 'Player B' }).click();
    await panel.getByRole('button', { name: 'Audition' }).click();
    const retained = await capture(page, 'Recorded player B after restarting audio', 0.5);
    expect(retained.right.rms).toBeGreaterThan(0.05);
    expect(Math.abs(retained.right.crossingsPerSecond - 320)).toBeLessThan(5);
});
