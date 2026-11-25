// One-based step numbers match the labels on the panel. Positive cells fire
// that many hits; a negative value stores the ratchet count on a silent cell.
function track(hits, settings = {}) {
    return {
        length: 16, ratio: 1, gateLength: 25, delay: 0, swing: 50, rotation: 0, probability: 100, mute: 0,
        cells: Array.from({ length: 64 }, (_, i) => hits[i + 1] || -1),
        ...settings
    };
}

export default {
    name: 'Test - Four Track Gate Sequencer',
    factory: true,
    state: {
        version: 3, plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'gates', type: 'gate-seq', row: 1, index: 1 },
            { id: 'kick', type: 'kick', row: 1, index: 2 },
            { id: 'snare', type: 'snare', row: 1, index: 3 },
            { id: 'hat', type: 'hat', row: 1, index: 4 },
            { id: 'mix', type: 'mix', row: 1, index: 5 },
            { id: 'out', type: 'out', row: 1, index: 6 }
        ],
        params: {
            clk: { rate: .38 }, gates: {
                fillFirst: 17, fillLast: 20,
                pattern: [
                    track({ 1: 1, 5: 1, 9: 1, 13: 1, 17: 1, 19: 1 }),
                    track({ 5: 1, 13: 1, 18: 2, 20: 3 }),
                    track({ 1: 1, 3: 1, 5: 1, 7: 2, 17: 1, 18: 1, 19: 2 }, { length: 7, swing: 54 }),
                    track({ 10: 1, 20: 1 }, { rotation: 1 })
                ]
            },
            mix: { lvl1: .52, lvl2: .39, lvl3: .26 }, out: { volume: .68 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'gates', toPort: 'clock' },
            { fromModule: 'gates', fromPort: 'a', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'gates', fromPort: 'b', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'gates', fromPort: 'c', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'gates', fromPort: 'd', toModule: 'hat', toPort: 'trigOpen' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ], midiMappings: {}
    }
};
