import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function openSetup(page, { denyFirst = false } = {}) {
    await page.addInitScript(deny => {
        const input = { id: 'in', name: 'To Rack' };
        const returned = { id: 'echo', name: 'From Rack' };
        window.sentNotes = [];
        const output = {
            id: 'out', name: 'From Rack',
            send(data, timestamp) { window.sentNotes.push({ data, timestamp }); }
        };
        const access = { inputs: new Map([[input.id, input], [returned.id, returned]]), outputs: new Map([[output.id, output]]) };
        let attempts = 0;
        Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => {
            if (deny && attempts++ === 0) throw new DOMException('Denied', 'NotAllowedError');
            return access;
        } });
        window.sendToRack = (data, delay = 0) => input.onmidimessage({ data, timeStamp: performance.now() + delay });
    }, denyFirst);
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await page.getByRole('button', { name: 'MIDI Setup', exact: true }).click();
    return page.getByRole('dialog', { name: 'MIDI Setup' });
}

test('plays an incoming MIDI note, records stereo WAV and returns a clocked phrase on channel 2', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const setup = await openSetup(page);
    await expect(setup.getByLabel('MIDI output')).toHaveValue('');
    await setup.getByLabel('MIDI input').selectOption('in');
    await setup.getByLabel('MIDI output').selectOption('out');
    await page.evaluate(() => { window.sendToRack([0x90, 69, 100]); window.sendToRack([0x80, 69, 0]); window.sendToRack([0xf8]); });
    await expect(setup.getByText('Note 69 on channel 1 from To Rack')).toBeVisible();
    await expect(setup.getByText('Clock received from To Rack')).toBeVisible();
    await setup.getByRole('button', { name: 'Open MIDI starter' }).click();
    await expect(page).toHaveTitle('Test - MIDI In and Out · Eurorack');
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);

    const record = page.locator('#module-rec .rec-button');
    await record.click();
    await page.evaluate(() => window.sendToRack([0x90, 69, 100]));
    await page.waitForFunction(() => window.eurorackApp.state.getModule('notes').instance.leds.gate === 1);
    const audio = await page.evaluate(async () => {
        const { left, right, sampleRate } = await window.eurorackApp.host.engine.captureOutput({ durationSeconds: 0.25 });
        const crossings = left.reduce((n, v, i) => n + (i > 0 && left[i - 1] <= 0 && v > 0), 0);
        return { hz: crossings * sampleRate / left.length, peak: Math.max(...left), stereo: left.every((v, i) => v === right[i]) };
    });
    expect(audio.hz).toBeGreaterThan(434);
    expect(audio.hz).toBeLessThan(446);
    expect(audio.peak).toBeGreaterThan(0.1);
    expect(audio.stereo).toBe(true);
    await page.evaluate(() => window.sendToRack([0x80, 69, 0]));
    const download = page.waitForEvent('download');
    await record.click();
    const wav = await readFile(await (await download).path());
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.subarray(44).some(value => value !== 0)).toBe(true);

    await page.evaluate(() => {
        window.sendToRack([0xfa]);
        for (let tick = 1; tick <= 36; tick++) window.sendToRack([0xf8], tick * 12);
        window.sendToRack([0xfc], 500);
    });
    const messages = () => page.evaluate(() => window.sentNotes.map(note => note.data));
    await expect.poll(messages).toEqual([60, 64, 67, 70].flatMap(key => [[0x91, key, 127], [0x81, key, 0]]));
    // Stop the rack during a long gate and require an actual outgoing Note Off.
    await page.evaluate(() => {
        window.eurorackApp.host.setParam('length', 'length1', 1);
        window.sendToRack([0xfa]);
    });
    await expect.poll(async () => (await messages()).at(-1)).toEqual([0x91, 60, 127]);
    await page.locator('#startButton').click();
    await expect.poll(async () => (await messages()).at(-1)).toEqual([0x81, 60, 0]);
    expect(errors).toEqual([]);
});

test('recovers MIDI permission and uses the ordinary unsaved-rack prompt for the starter', async ({ page }) => {
    const setup = await openSetup(page, { denyFirst: true });
    await expect(setup.getByLabel('MIDI input')).toBeDisabled();
    await setup.getByRole('button', { name: 'Retry MIDI access' }).click();
    await expect(setup.getByLabel('MIDI input')).toBeEnabled();
    await setup.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('#sidebar [data-module-type="vco"]').click();
    await page.getByRole('button', { name: 'MIDI Setup', exact: true }).click();
    await setup.getByRole('button', { name: 'Open MIDI starter' }).click();
    await page.getByRole('dialog', { name: 'Unsaved rack changes' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.rack-row .module')).toHaveCount(1);
    await expect(page.locator('#midiLearnBtn')).toBeVisible();
});
