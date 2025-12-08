/**
 * Test - Function Generator
 *
 * Demonstrates the FUNC module in LFO mode:
 * - FUNC cycles to generate complex LFO
 * - Modulates VCO pitch for vibrato
 * - Curve shapes the LFO waveform
 *
 * Try adjusting Rise/Fall for asymmetric LFO shapes.
 */
export default {
    name: 'Test - Func',
    factory: true,
    state: {
        modules: [
            { type: 'func', instanceId: 'func', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            func: { rise: 0.3634, fall: 0.8234, curve: 0.5667 },
            vco: { coarse: 0, fine: -6, glide: 0 },
            vcf: { cutoff: 0.4467, resonance: 0.1333 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            func: { cycle: true }
        },
        cables: [
            // FUNC LFO modulates VCO pitch (vibrato)
            { fromModule: 'func', fromPort: 'out', toModule: 'vco', toPort: 'fm' },
            // VCO through filter and VCA
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Mix to output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
