/**
 * Test - Refrain
 * Phrase-level KEY/HARM/ENERGY/MOD evolution driving a shared-clock,
 * shared-reset Changes/Cascade patch with two audible plucked voices.
 */
export default {
    name: 'Test - Refrain',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'resetA', type: 'div', row: 1, index: 1 },
            { id: 'resetB', type: 'div', row: 1, index: 2 },
            { id: 'seedRnd', type: 'rnd', row: 1, index: 3 },
            { id: 'refrain', type: 'refrain', row: 1, index: 4 },
            { id: 'changes', type: 'changes', row: 1, index: 5 },
            { id: 'cascade', type: 'cascade', row: 1, index: 6 },
            { id: 'arp', type: 'arp', row: 1, index: 7 },
            { id: 'lead', type: 'pluck', row: 2, index: 0 },
            { id: 'bass', type: 'pluck', row: 2, index: 1 },
            { id: 'mix', type: 'mix', row: 2, index: 2 },
            { id: 'scope', type: 'scope', row: 2, index: 3 },
            { id: 'out', type: 'out', row: 2, index: 4 }
        ],
        params: {
            clock: {
                rate: 0.32,
                pause: 0
            },
            resetA: {
                rate1: 0,
                rate2: 0.5
            },
            resetB: {
                rate1: 0,
                // /8 of resetA's /16 output: a new Seed CV every 128 clocks.
                rate2: 0.0625
            },
            seedRnd: {
                rate: 1,
                // RND is unipolar 0–10 V; half amplitude fits Seed CV's 0–5 V range.
                amp: 0.5
            },
            refrain: {
                seed: 474,
                length: 4,
                amount: 1,
                chance: 100,
                mutateKey: 1,
                mutateHarm: 1,
                mutateEnergy: 1,
                mutateMod: 1,
                mutate: 0,
                anchor: 0,
                recall: 0
            },
            changes: {
                key: 0,
                scale: 0,
                changes: 1,
                motion: 2,
                resetAction: 0
            },
            cascade: {
                // ENERGY can subtract 8 fill steps; 12 guarantees a floor of 4.
                fill: 12,
                rotate: 0,
                resetAction: 0
            },
            arp: {
                root: 0,
                chord: 0,
                mode: 0,
                octaves: 2
            },
            lead: {
                pitch: 0.4,
                decay: 0.62,
                damp: 0.55,
                position: 0.32
            },
            bass: {
                pitch: 0.25,
                decay: 0.76,
                damp: 0.7,
                position: 0.42
            },
            mix: {
                lvl1: 0.62,
                lvl2: 0.78,
                lvl3: 0,
                lvl4: 0
            },
            scope: {
                time: 0.28,
                trigger: 0.5,
                gain1: 0.5,
                gain2: 0.5,
                offset1: 0.5,
                offset2: 0.5,
                mode: 0
            },
            out: {
                volume: 0.62
            }
        },
        cables: [
            // Shared clock and a two-stage /256 common reset.
            { fromModule: 'clock', fromPort: 'clock', toModule: 'resetA', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'refrain', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'changes', toPort: 'clock' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'cascade', toPort: 'clock' },
            { fromModule: 'resetA', fromPort: 'out1', toModule: 'resetB', toPort: 'clock' },
            { fromModule: 'resetB', fromPort: 'out1', toModule: 'refrain', toPort: 'reset' },
            { fromModule: 'resetB', fromPort: 'out1', toModule: 'changes', toPort: 'reset' },
            { fromModule: 'resetB', fromPort: 'out1', toModule: 'cascade', toPort: 'reset' },
            { fromModule: 'resetB', fromPort: 'out1', toModule: 'arp', toPort: 'reset' },

            // Hold each random Seed CV for two complete four-cell Refrain loops.
            // This leaves one eligible loop for Amount/Chance evolution.
            { fromModule: 'resetB', fromPort: 'out2', toModule: 'seedRnd', toPort: 'clock' },
            { fromModule: 'seedRnd', fromPort: 'step', toModule: 'refrain', toPort: 'seedCV' },

            // Refrain's semantic macro lanes.
            { fromModule: 'refrain', fromPort: 'key', toModule: 'changes', toPort: 'keyCV' },
            { fromModule: 'refrain', fromPort: 'harm', toModule: 'arp', toPort: 'chordCV' },
            { fromModule: 'refrain', fromPort: 'energy', toModule: 'cascade', toPort: 'fillCV' },
            { fromModule: 'refrain', fromPort: 'energy', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'refrain', fromPort: 'mod', toModule: 'lead', toPort: 'dampCV' },
            { fromModule: 'refrain', fromPort: 'mod', toModule: 'bass', toPort: 'positionCV' },

            // Changes and Cascade provide related harmony and articulation.
            { fromModule: 'changes', fromPort: 'root', toModule: 'arp', toPort: 'rootCV' },
            { fromModule: 'changes', fromPort: 'root', toModule: 'bass', toPort: 'vOct' },
            { fromModule: 'cascade', fromPort: 'lane4', toModule: 'arp', toPort: 'trigger' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'lead', toPort: 'vOct' },
            { fromModule: 'arp', fromPort: 'gate', toModule: 'lead', toPort: 'trigger' },
            { fromModule: 'cascade', fromPort: 'lane2', toModule: 'bass', toPort: 'trigger' },

            // Audible stereo and visible monitoring.
            { fromModule: 'lead', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'bass', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'scope', fromPort: 'out1', toModule: 'out', toPort: 'L' },
            { fromModule: 'scope', fromPort: 'out1', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
