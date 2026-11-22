import { afterEach, expect, it, vi } from 'vitest';
import { createMidiManager } from '../../src/js/midi/midi-manager.js';

const context = { state: 'running', currentTime: 3, getOutputTimestamp: () => ({ contextTime: 3, performanceTime: 1200 }) };
const port = (id, name) => ({ id, name, state: 'connected', send: vi.fn() });

async function routing() {
    const input = port('in-a', 'To Rack'), echo = port('in-b', 'From Rack');
    const dest = port('out-b', 'From Rack'), other = port('out-c', 'Keys');
    const access = { inputs: new Map([[input.id, input], [echo.id, echo]]), outputs: new Map([[dest.id, dest], [other.id, other]]) };
    vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn(async () => access) });
    const midi = createMidiManager({ bufferEvents: false });
    await midi.init();
    return { midi, access, input, echo, dest, other };
}
afterEach(() => vi.unstubAllGlobals());

it('only sends to a chosen output and releases overlapping notes once, including on port changes', async () => {
    const { midi, dest, other } = await routing();
    const start = [[3.125, 0x91, 64, 100]];
    midi.sendNotes('seq', start, context);
    expect(dest.send).not.toHaveBeenCalled();
    midi.setOutput(dest.id);
    midi.sendNotes('seq', start, context);
    midi.sendNotes('arp', start, context);
    midi.releaseNotes('seq');
    expect(dest.send.mock.calls).toEqual([[[0x91, 64, 100], 1325]]);
    midi.setOutput(other.id);
    expect(dest.send.mock.calls.at(-1)).toEqual([[0x81, 64, 0], 1325]);
    midi.sendNotes('arp', [[3.2, 0x81, 64, 0]], context);
    expect(other.send).not.toHaveBeenCalled();
    midi.sendNotes('arp', start, context);
    midi.releaseNotes();
    expect(other.send).toHaveBeenCalledTimes(2);
});

it('filters the return bus, releases input voices on route changes, and follows device hot-plug', async () => {
    const { midi, access, input, echo, dest } = await routing();
    const raw = vi.fn();
    midi.setOnRawMidiMessage(raw);
    expect(midi.getDeviceNames()).toEqual(['To Rack', 'From Rack']);
    echo.onmidimessage({ data: [0x90, 64, 110], timeStamp: 2 });
    midi.setOutput(dest.id);
    expect(echo.onmidimessage).toBeNull();
    expect(midi.getDeviceNames()).toEqual(['To Rack']);
    expect(raw.mock.calls.map(call => call[0])).toEqual([[0x90, 64, 110], [0x80, 64, 0]]);
    input.onmidimessage({ data: [0xfa], timeStamp: 10 });
    input.onmidimessage({ data: [0xf8], timeStamp: 11 });
    expect(raw).toHaveBeenLastCalledWith([0xf8], 11, 'To Rack');
    expect(midi.consumeClockEvents()).toEqual([]);
    midi.setInput(input.id);
    access.inputs.delete(input.id); access.onstatechange();
    expect(midi.isConnected).toBe(false);
    expect(raw.mock.calls.at(-1)[0]).toEqual([0xfc]);
    access.inputs.set(input.id, input); access.onstatechange();
    expect(midi.isConnected).toBe(true);
    access.outputs.delete(dest.id); access.onstatechange();
    expect(midi.outputId).toBe('');
});
