/**
 * Test - Changes + Cascade
 * Shared-clock harmonic sequencing with nested lead and bass articulation.
 */
export default {
    name: 'Test - Changes + Cascade',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'cascade', type: 'cascade', row: 1, index: 1 },
            { id: 'changes', type: 'changes', row: 1, index: 2 },
            { id: 'lead', type: 'pluck', row: 1, index: 3 },
            { id: 'bass', type: 'pluck', row: 1, index: 4 },
            { id: 'mix', type: 'mix', row: 1, index: 5 },
            { id: 'out', type: 'out', row: 1, index: 6 }
        ],
        params: {
            clock: {
                rate: 0.25,
                pause: 0
            },
            cascade: {
                fill: 8,
                rotate: 0,
                resetAction: 0
            },
            changes: {
                key: 0,
                scale: 0,
                changes: 1,
                motion: 0,
                resetAction: 0
            },
            lead: {
                pitch: 0.43,
                decay: 0.58,
                damp: 0.62,
                position: 0.32
            },
            bass: {
                pitch: 0.28,
                decay: 0.74,
                damp: 0.72,
                position: 0.42
            },
            mix: {
                lvl1: 0.66,
                lvl2: 0.82,
                lvl3: 0,
                lvl4: 0
            },
            out: {
                volume: 0.65
            }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'changes', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'cascade', toPort: 'clock' },
            { fromModule: 'changes', fromPort: 'pitch', toModule: 'lead', toPort: 'vOct' },
            { fromModule: 'cascade', fromPort: 'lane3', toModule: 'lead', toPort: 'trigger' },
            { fromModule: 'changes', fromPort: 'root', toModule: 'bass', toPort: 'vOct' },
            { fromModule: 'cascade', fromPort: 'lane1', toModule: 'bass', toPort: 'trigger' },
            { fromModule: 'lead', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'bass', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
