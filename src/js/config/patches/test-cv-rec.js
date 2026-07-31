/**
 * Test - CV Recorder
 *
 * LFO and random voltages plus two independent divided gates feed CV REC.
 * Its lanes are visible on SCOPE; lane 2 is scaled and quantized into an
 * unmistakable repeating PLUCK melody after recording stops.
 */
export default {
    name: 'Test - CV Recorder',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'divider', type: 'div', row: 1, index: 1 },
            { id: 'lfo', type: 'lfo', row: 1, index: 2 },
            { id: 'random', type: 'rnd', row: 1, index: 3 },
            { id: 'recorder', type: 'cv-rec', row: 1, index: 4 },
            { id: 'voice', type: 'pluck', row: 2, index: 0 },
            { id: 'pitchDepth', type: 'atten', row: 2, index: 1 },
            { id: 'quantizer', type: 'quant', row: 2, index: 2 },
            { id: 'scope', type: 'scope', row: 2, index: 3 },
            { id: 'out', type: 'out', row: 2, index: 4 }
        ],
        params: {
            clock: { rate: 0.27, pause: 0 },
            divider: { rate1: 0.4375, rate2: 0.375 },
            lfo: { range: 0, rateKnob: 0.2, waveKnob: 0.3 },
            random: { rate: 1, amp: 0.5, seed: 31415 },
            recorder: {
                mode: 1,
                shape: 0,
                playMode: 0,
                record: 0,
                play: 0,
                resetAction: 0,
                clear: 0
            },
            voice: { pitch: 0.28, decay: 0.74, damp: 0.5, position: 0.35 },
            pitchDepth: { atten1: 0.625, offset1: 0.5, atten2: 1, offset2: 0.5 },
            quantizer: { scale: 1, octave: 0, semitone: 0 },
            scope: {
                time: 0.3,
                trigger: 0.5,
                gain1: 0.5,
                gain2: 0.5,
                offset1: 0.5,
                offset2: 0.5,
                mode: 0
            },
            out: { volume: 0.58 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'divider', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'random', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'recorder', toPort: 'clock' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'recorder', toPort: 'cv1In' },
            { fromModule: 'divider', fromPort: 'out1', toModule: 'recorder', toPort: 'gate1In' },
            { fromModule: 'random', fromPort: 'step', toModule: 'recorder', toPort: 'cv2In' },
            { fromModule: 'divider', fromPort: 'out2', toModule: 'recorder', toPort: 'gate2In' },
            { fromModule: 'recorder', fromPort: 'cv1Out', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'recorder', fromPort: 'cv2Out', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'recorder', fromPort: 'cv1Out', toModule: 'voice', toPort: 'dampCV' },
            { fromModule: 'recorder', fromPort: 'cv2Out', toModule: 'pitchDepth', toPort: 'in1' },
            { fromModule: 'pitchDepth', fromPort: 'out1', toModule: 'quantizer', toPort: 'cv' },
            { fromModule: 'quantizer', fromPort: 'cv', toModule: 'voice', toPort: 'vOct' },
            { fromModule: 'recorder', fromPort: 'gate1Out', toModule: 'voice', toPort: 'trigger' },
            { fromModule: 'voice', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'voice', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
