/**
 * Test - Pitch Tracker
 *
 * A sequenced source voice is converted back to held 1 V/oct pitch and a
 * validity gate. The original voice is heard on the left, the resynthesized
 * tracked voice on the right, and SCOPE displays Pitch CV beside the lock gate.
 */
export default {
    name: 'Test - Pitch Tracker',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'sequencer', type: 'seq', row: 1, index: 1 },
            { id: 'sourceOscillator', type: 'vco', row: 1, index: 2 },
            { id: 'tracker', type: 'pitch-track', row: 1, index: 3 },
            { id: 'trackedOscillator', type: 'vco', row: 2, index: 0 },
            { id: 'trackedAmplifier', type: 'vca', row: 2, index: 1 },
            { id: 'scope', type: 'scope', row: 2, index: 2 },
            { id: 'out', type: 'out', row: 2, index: 3 }
        ],
        params: {
            clock: { rate: 0.25, pause: 0 },
            sequencer: {
                step1: 0,
                step2: 0.08333333333333333,
                step3: 0.16666666666666666,
                step4: 0.25,
                step5: 0.3333333333333333,
                step6: 0.25,
                step7: 0.16666666666666666,
                step8: 0.08333333333333333,
                gate1: 1,
                gate2: 1,
                gate3: 1,
                gate4: 1,
                gate5: 1,
                gate6: 1,
                gate7: 1,
                gate8: 1,
                range: 1,
                length: 8,
                direction: 0
            },
            sourceOscillator: {
                coarse: 0.48105520203391067,
                fine: 0,
                glide: 0
            },
            tracker: { level: 0.5, smooth: 15, range: 0 },
            trackedOscillator: {
                coarse: 0.48105520203391067,
                fine: 0,
                glide: 0
            },
            trackedAmplifier: { ch1Gain: 0.8, ch2Gain: 0 },
            scope: {
                time: 0.32,
                trigger: 0.5,
                gain1: 0.62,
                gain2: 0.18,
                offset1: 0.5,
                offset2: 0.5,
                mode: 0
            },
            out: { volume: 0.65 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'sequencer', toPort: 'clock' },
            { fromModule: 'sequencer', fromPort: 'cv', toModule: 'sourceOscillator', toPort: 'vOct' },
            { fromModule: 'sourceOscillator', fromPort: 'triangle', toModule: 'tracker', toPort: 'audio' },
            { fromModule: 'sourceOscillator', fromPort: 'triangle', toModule: 'out', toPort: 'L' },
            { fromModule: 'tracker', fromPort: 'pitch', toModule: 'trackedOscillator', toPort: 'vOct' },
            { fromModule: 'tracker', fromPort: 'gate', toModule: 'trackedAmplifier', toPort: 'ch1CV' },
            { fromModule: 'tracker', fromPort: 'pitch', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'tracker', fromPort: 'gate', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'trackedOscillator', fromPort: 'triangle', toModule: 'trackedAmplifier', toPort: 'ch1In' },
            { fromModule: 'trackedAmplifier', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
