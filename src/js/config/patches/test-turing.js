/**
 * Test Patch: Turing Machine
 *
 * Demonstrates the Turing Machine random looping sequencer.
 * Clock drives the Turing, CV output goes through quantizer to VCO.
 * Adjust Lock knob to control randomness vs locked patterns.
 */
export default {
    name: 'Test: Turing',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'turing', instanceId: 'turing', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            turing: { lock: 0.75, scale: 0.6, length: 5 },
            quant: { scale: 5, octave: 0, semitone: 0 },
            vco: { coarse: 0.3, fine: 0, glide: 11.33 },
            vcf: { cutoff: 0.51, resonance: 0.25 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            adsr: { attack: 0, decay: 0.3, sustain: 0.4, release: 0.73 },
            out: { volume: 0.8 }
        },
        switches: {
            clk: { pause: 0 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'turing', toPort: 'clock' },
            { fromModule: 'turing', fromPort: 'cv', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'turing', fromPort: 'pulse', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
