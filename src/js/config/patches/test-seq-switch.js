/**
 * Test - Sequential Switch
 *
 * Clocks through four audible sources with seq-switch's 4-to-1 path.
 */
export default {
    name: 'Test - Sequential Switch',
    factory: true,
    state: {
        version: 2,
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'vco', type: 'vco', row: 1, index: 1 },
            { id: 'nse', type: 'nse', row: 1, index: 2 },
            { id: 'seqsw', type: 'seq-switch', row: 1, index: 3 },
            { id: 'vca', type: 'vca', row: 1, index: 4 },
            { id: 'out', type: 'out', row: 1, index: 5 }
        ],
        params: {
            clk: { rate: 0.22, pause: 0 },
            vco: { coarse: 0.34, fine: 0, glide: 0 },
            nse: { rate: 0.85, vcaMode: 0 },
            seqsw: { steps: 4 },
            vca: { ch1Gain: 0.7, ch2Gain: 0.7 },
            out: { volume: 0.45 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seqsw', toPort: 'clock' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'seqsw', toPort: 'in1' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'seqsw', toPort: 'in2' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'seqsw', toPort: 'in3' },
            { fromModule: 'nse', fromPort: 'noise', toModule: 'seqsw', toPort: 'in4' },
            { fromModule: 'seqsw', fromPort: 'commonOut', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
