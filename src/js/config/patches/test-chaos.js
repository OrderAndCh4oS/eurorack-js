/**
 * Test - Chaos
 *
 * X and Y draw the Lorenz attractor in Scope X-Y mode while the correlated Z
 * coordinate frequency-modulates an audible oscillator.
 */
export default {
    name: 'Test - Chaos',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'chaos', type: 'chaos', row: 1, index: 0 },
            { id: 'vco', type: 'vco', row: 1, index: 1 },
            { id: 'out', type: 'out', row: 1, index: 2 },
            { id: 'scope', type: 'scope', row: 2, index: 0 }
        ],
        params: {
            chaos: {
                rate: 0.82,
                character: 1 / 3,
                depth: 0.35
            },
            vco: {
                coarse: 0.4,
                fine: 0,
                glide: 5
            },
            out: {
                volume: 0.5
            },
            scope: {
                time: 0.45,
                gain1: 0.5,
                gain2: 0.5,
                offset1: 0.5,
                offset2: 0.5,
                trigger: 0.5,
                mode: 1
            }
        },
        cables: [
            { fromModule: 'chaos', fromPort: 'x', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'chaos', fromPort: 'y', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'chaos', fromPort: 'z', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'L' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
