export default {
    name: 'Test - MIDI In and Out',
    catalogueKey: 'Test - Ableton Live', // Keep existing catalogue searches and page cursors working.
    description: 'Play the top row on MIDI channel 1. Send MIDI clock to hear the four-step return on a synth or instrument track on channel 2.',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'notes', type: 'midi-cv', row: 1, index: 0 },
            { id: 'osc', type: 'vco', row: 1, index: 1 },
            { id: 'env', type: 'adsr', row: 1, index: 2 },
            { id: 'amp', type: 'vca', row: 1, index: 3 },
            { id: 'rec', type: 'rec', row: 1, index: 4 },
            { id: 'out', type: 'out', row: 1, index: 5 },
            { id: 'clock', type: 'midi-clk', row: 2, index: 0 },
            { id: 'seq', type: 'seq', row: 2, index: 1 },
            { id: 'length', type: 'gate-delay', row: 2, index: 2 },
            { id: 'returnNotes', type: 'midi-out', row: 2, index: 3 }
        ],
        params: {
            // The VCO maps its coarse control exponentially from 4.3 to 22000 Hz. Tune MIDI 69 to A440.
            osc: { coarse: Math.log((440 * 2 ** (-9 / 12)) / 4.3) / Math.log(22000 / 4.3), glide: 0 },
            env: { attack: 0.01, decay: 0.2, sustain: 0.65, release: 0.18 },
            amp: { ch1Gain: 0.6, ch2Gain: 0 },
            clock: { division: 3 },
            seq: { length: 4, range: 0, step1: 0, step2: 4 / 12, step3: 7 / 12, step4: 10 / 12 },
            length: { delay1: 0, length1: 0.42 },
            returnNotes: { channel: 2 }
        },
        cables: [
            { fromModule: 'notes', fromPort: 'pitch', toModule: 'osc', toPort: 'vOct' },
            { fromModule: 'notes', fromPort: 'gate', toModule: 'env', toPort: 'gate' },
            { fromModule: 'osc', fromPort: 'triangle', toModule: 'amp', toPort: 'ch1In' },
            { fromModule: 'env', fromPort: 'env', toModule: 'amp', toPort: 'ch1CV' },
            { fromModule: 'amp', fromPort: 'ch1Out', toModule: 'rec', toPort: 'L' },
            { fromModule: 'amp', fromPort: 'ch1Out', toModule: 'rec', toPort: 'R' },
            { fromModule: 'rec', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'rec', fromPort: 'outR', toModule: 'out', toPort: 'R' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'reset', toModule: 'seq', toPort: 'reset' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'returnNotes', toPort: 'pitch' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'length', toPort: 'trig1' },
            { fromModule: 'length', fromPort: 'gate1', toModule: 'returnNotes', toPort: 'gate' }
        ],
        midiMappings: {}
    }
};
