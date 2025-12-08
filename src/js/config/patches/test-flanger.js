/**
 * Test Patch: Flanger
 *
 * Tests the flanger effect on a VCO pulse wave.
 * Creates jet-like sweeping comb filter effect.
 */
export default {
    name: 'Test: Flanger',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'flanger', instanceId: 'flanger', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.35, fine: 0 },
            flanger: { rate: 0.25, depth: 0.6, feedback: 0.7, mix: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'flanger', toPort: 'inL' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'flanger', toPort: 'inR' },
            { fromModule: 'flanger', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'flanger', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
