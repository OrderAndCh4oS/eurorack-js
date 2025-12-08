/**
 * Test - Random
 *
 * Demonstrates random voltage generator creating evolving textures:
 * - Step output quantized to VCO for random melodies
 * - Smooth output modulates filter for evolving timbre
 * - Gate output triggers envelope for rhythmic pulses
 *
 * Try adjusting rate for tempo and amp for pitch range.
 */
export default {
    name: 'Test - Rnd',
    factory: true,
    state: {
        modules: [
            { type: 'rnd', instanceId: 'rnd', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            rnd: { rate: 0.7533, amp: 0.6867 },
            quant: { scale: 3, octave: -1, semitone: 0 },
            vco: { coarse: 0.3367, fine: 0, glide: 5 },
            vcf: { cutoff: 0.2533, resonance: 0.7 },
            adsr: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.62 },
            vca: { ch1Gain: 0.6667, ch2Gain: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            // Step output through quantizer to VCO pitch
            { fromModule: 'rnd', fromPort: 'step', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            // Gate output triggers envelope
            { fromModule: 'rnd', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            // Smooth output modulates filter cutoff
            { fromModule: 'rnd', fromPort: 'smooth', toModule: 'vcf', toPort: 'cutoffCV' },
            // VCO through filter through VCA
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            // VCA to output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
