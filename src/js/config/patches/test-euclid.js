/**
 * Test - Euclidean Rhythm
 *
 * Demonstrates the Euclidean rhythm generator:
 * - Clock → Euclid → Kick drum
 * - Creates the classic tresillo pattern (3 hits in 8 steps)
 *
 * Try adjusting the knobs:
 * - Hits: Changes how many triggers per cycle
 * - Length: Changes the cycle length
 * - Rotate: Shifts where the pattern starts
 */
export default {
    name: 'Test - Euclidean',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'euclid', instanceId: 'euclid', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { bpm: 0.4 },
            euclid: { length: 8, hits: 3, rotate: 0 },
            kick: { tune: 0.4, decay: 0.4, punch: 0.6 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid', toPort: 'clock' },
            { fromModule: 'euclid', fromPort: 'trig', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
