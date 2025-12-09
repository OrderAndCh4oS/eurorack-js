/**
 * Test patch for MIDI-DRUM module
 * Trigger drums from a MIDI controller or the drum pad controller.
 *
 * 1. Open midi-drum-controller.html in another browser tab
 * 2. Connect IAC Driver or a MIDI controller
 * 3. Click pads or hit keys to trigger drums
 *
 * Default GM mapping:
 * - Pad 1 (C1/36): Kick
 * - Pad 2 (D1/38): Snare
 * - Pad 3 (F#1/42): Closed Hat
 * - Pad 4 (A#1/46): Open Hat
 */
export default {
    name: 'Test: MIDI-DRUM',
    factory: true,
    state: {
        modules: [
            { type: 'midi-drum', instanceId: 'drum', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 2 },
            { type: 'out', instanceId: 'out', row: 2 }
        ],
        knobs: {
            drum: { channel: 0 },  // Omni (all channels)
            kick: { pitch: 0.3, decay: 0.5, tone: 0.3, click: 0.5 },
            snare: { snap: 0.5, decay: 0.4, pitch: 0.5 },
            hat: { decay: 0.4, sizzle: 0.5, blend: 0.5 },
            mix: { level1: 0.9, level2: 0.7, level3: 0.6, level4: 0 },
            out: { levelL: 0.7, levelR: 0.7 }
        },
        switches: {},
        cables: [
            // MIDI drum triggers to drum modules
            { fromModule: 'drum', fromPort: 'trig1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'drum', fromPort: 'trig2', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'drum', fromPort: 'trig3', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'drum', fromPort: 'trig4', toModule: 'hat', toPort: 'trigOpen' },
            // Drums to mixer
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            // Mixer to output
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
