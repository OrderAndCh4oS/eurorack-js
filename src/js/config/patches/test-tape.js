/**
 * Test - Tape
 *
 * VCO through a multi-head tape delay with LFO time modulation. The scope shows
 * the wet audio on channel 1 and the tape clock output on channel 2.
 */
export default {
    name: 'Test - Tape',
    factory: true,
    state: {
        version: 2,
        modules: [
            { id: 'lfo', type: 'lfo', row: 1, index: 0 },
            { id: 'vco', type: 'vco', row: 1, index: 1 },
            { id: 'tape', type: 'tape', row: 1, index: 2 },
            { id: 'scope', type: 'scope', row: 1, index: 3 },
            { id: 'out', type: 'out', row: 1, index: 4 }
        ],
        params: {
            lfo: { rateKnob: 0.18, waveKnob: 0, range: 0 },
            vco: { coarse: 0.34, fine: 0, glide: 5 },
            tape: {
                time: 0.35,
                feedback: 0.55,
                mix: 0.48,
                drive: 0.45,
                age: 0.45,
                lowCut: 0.18,
                wow: 0.3,
                crinkle: 0.18,
                freeze: 0,
                headMode: 1
            },
            scope: { time: 0.46, gain1: 0.55, gain2: 0.5, offset1: 0.5, offset2: 0.5, trigger: 0.52, mode: 0 },
            out: { volume: 0.48 }
        },
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'tape', toPort: 'timeCV' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'tape', toPort: 'audio' },
            { fromModule: 'tape', fromPort: 'out', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'tape', fromPort: 'clock', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'tape', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'tape', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
