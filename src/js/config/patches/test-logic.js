/**
 * Test - Logic Gates
 *
 * Demonstrates AND/OR logic operations:
 * - Two euclidean patterns feed into Logic
 * - AND output triggers kick (only when both patterns hit)
 * - OR output triggers snare (when either pattern hits)
 *
 * Try adjusting the euclidean patterns to hear different rhythms.
 */
export default {
    name: 'Test - Logic',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'euclid', instanceId: 'euclid1', row: 1 },
            { type: 'euclid', instanceId: 'euclid2', row: 1 },
            { type: 'logic', instanceId: 'logic', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { bpm: 0.35 },
            euclid1: { length: 8, hits: 5, rotate: 0 },
            euclid2: { length: 8, hits: 3, rotate: 0 },
            kick: { tune: 0.4, decay: 0.4, punch: 0.6 },
            snare: { tune: 0.5, decay: 0.3, noise: 0.6 },
            mix: { lvl1: 0.7, lvl2: 0.5 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            // Clock to both euclidean generators
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid1', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid2', toPort: 'clock' },
            // Euclidean outputs to logic inputs
            { fromModule: 'euclid1', fromPort: 'trig', toModule: 'logic', toPort: 'in1' },
            { fromModule: 'euclid2', fromPort: 'trig', toModule: 'logic', toPort: 'in2' },
            // AND triggers kick, OR triggers snare
            { fromModule: 'logic', fromPort: 'and', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'logic', fromPort: 'or', toModule: 'snare', toPort: 'trigger' },
            // Mix to output
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
