/**
 * Test Patch: Chorus
 *
 * Tests the chorus effect on a VCO triangle wave.
 * Creates a lush, widened sound with stereo modulation.
 */
export default {
    name: 'Test: Chorus',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'chorus', instanceId: 'chorus', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.4, fine: 0 },
            chorus: { rate: 0.4, depth: 0.6, mix: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'chorus', toPort: 'inL' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'chorus', toPort: 'inR' },
            { fromModule: 'chorus', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'chorus', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
