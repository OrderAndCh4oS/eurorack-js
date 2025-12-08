/**
 * Test Patch: Bitcrusher
 *
 * Tests the bitcrusher effect on a VCO saw wave.
 * Creates lo-fi digital distortion and aliasing artifacts.
 */
export default {
    name: 'Test: Bitcrusher',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'crush', instanceId: 'crush', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.35, fine: 0 },
            crush: { bits: 0.3, rate: 0.3, mix: 0.7 }
        },
        switches: {},
        cables: [
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'crush', toPort: 'inL' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'crush', toPort: 'inR' },
            { fromModule: 'crush', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'crush', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
