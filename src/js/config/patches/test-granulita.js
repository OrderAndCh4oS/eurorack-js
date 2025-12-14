/**
 * Test - Granulita
 * VCO through granular chord generator with reverb
 * Tests granular synthesis, chord generation, and shimmer reverb
 */
export default {
    name: 'Test - Granulita',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'granulita', instanceId: 'granulita', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.25 },
            lfo: { rateKnob: 0.15 },
            vco: { coarse: 0.35, fine: 0.5 },
            granulita: {
                blend: 0.7,
                pitch: 0.5,
                chord: 0.2,
                voice: 0,
                verb: 0.4,
                count: 0.4,
                length: 0.35
            },
            out: { volume: 0.5 }
        },
        switches: {
            clk: { pause: false },
            lfo: { range: 0 },
            granulita: { direction: 2, hitMode: 1 }
        },
        buttons: {},
        cables: [
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'granulita', toPort: 'inL' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'granulita', toPort: 'pitchCV' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'granulita', toPort: 'hit' },
            { fromModule: 'granulita', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'granulita', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
