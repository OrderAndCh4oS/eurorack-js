/**
 * Test - Mult
 *
 * Demonstrates signal splitting:
 * - One LFO split to modulate two VCOs at different rates
 * - Creates a detuned/chorusing effect
 */
export default {
    name: 'Test - Mult',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'mult', instanceId: 'mult', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rate: 0.3, shape: 0.5 },
            vco1: { coarse: 0.4, fine: 0 },
            vco2: { coarse: 0.4, fine: 0.1 },
            mix: { lvl1: 0.6, lvl2: 0.6 },
            out: { volume: 0.5 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            // LFO to mult input
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'mult', toPort: 'in1' },
            // Mult outputs to both VCO pitch inputs
            { fromModule: 'mult', fromPort: 'out1a', toModule: 'vco1', toPort: 'vOct' },
            { fromModule: 'mult', fromPort: 'out1b', toModule: 'vco2', toPort: 'vOct' },
            // VCOs to mixer
            { fromModule: 'vco1', fromPort: 'ramp', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vco2', fromPort: 'ramp', toModule: 'mix', toPort: 'in2' },
            // Mix to output
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
