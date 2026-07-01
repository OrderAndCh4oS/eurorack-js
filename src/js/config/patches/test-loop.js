/**
 * Test - Loop
 * Record-ready VCO patch for the 2hp-style looper.
 */
export default {
    name: 'Test - Loop',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'loop', instanceId: 'loop', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.32, fine: 0.5, glide: 0 },
            loop: { length: 1, mix: 1, level: 0.8 },
            out: { volume: 0.55 }
        },
        switches: {
            loop: {
                record: 0,
                reverse: 0,
                halfSpeed: 0,
                clear: 0
            }
        },
        buttons: {
            loop: { mode: 0 }
        },
        cables: [
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'loop', toPort: 'in' },
            { fromModule: 'loop', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'loop', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
