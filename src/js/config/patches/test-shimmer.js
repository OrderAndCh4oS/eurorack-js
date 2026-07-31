/**
 * Test - Shimmer
 *
 * A clocked envelope makes the stereo Ensemble VCO percussive, then feeds
 * matched INPUT and REGEN Shimmer instances. Their spectrum panels expose the
 * one-generation INPUT layer beside REGEN's octave ladder; OUT plays REGEN in
 * stereo.
 */
export default {
    name: 'Test - Shimmer',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'envelope', type: 'adsr', row: 1, index: 1 },
            { id: 'ensemble', type: 'ensemble-vco', row: 1, index: 2 },
            { id: 'vca', type: 'vca', row: 1, index: 3 },
            { id: 'inputShimmer', type: 'shimmer', row: 2, index: 0 },
            { id: 'regenShimmer', type: 'shimmer', row: 2, index: 1 },
            { id: 'inputSpectrum', type: 'spectrum', row: 3, index: 0 },
            { id: 'regenSpectrum', type: 'spectrum', row: 3, index: 1 },
            { id: 'out', type: 'out', row: 3, index: 2 }
        ],
        params: {
            clock: { rate: 0.3, pause: 0 },
            envelope: { attack: 0.03, decay: 0.22, sustain: 0, release: 0.28 },
            ensemble: {
                root: 0.28,
                pitch: 0,
                fine: 0,
                spread: 0.48,
                scale: 1,
                scaleGroup: 0,
                detune: 0.1,
                oscillatorCount: 10,
                balance: 0.5,
                crossfade: 0.68,
                crossFm: 0.04,
                crossFmMode: 0,
                twist: 0.12,
                twistMode: 1,
                warp: 0.06,
                warpMode: 0,
                stereoMode: 0,
                freezeMode: 0,
                freeze: 0,
                learnMode: 0,
                learnNote: 7,
                addNote: 0,
                deleteNote: 0,
                resetScale: 0,
                scaleMemory: {}
            },
            vca: { ch1Gain: 0.82, ch2Gain: 0.82 },
            inputShimmer: {
                decay: 0.82,
                size: 0.58,
                diffusion: 0.86,
                preDelay: 0.08,
                damp: 0.3,
                modDepth: 0.24,
                interval: 12,
                shimmer: 0.62,
                mix: 1,
                route: 0,
                freeze: 0,
                clear: 0
            },
            regenShimmer: {
                decay: 0.82,
                size: 0.58,
                diffusion: 0.86,
                preDelay: 0.08,
                damp: 0.3,
                modDepth: 0.24,
                interval: 12,
                shimmer: 0.62,
                mix: 1,
                route: 1,
                freeze: 0,
                clear: 0
            },
            inputSpectrum: { floor: 0.35, decay: 0.65, scale: 0 },
            regenSpectrum: { floor: 0.35, decay: 0.65, scale: 0 },
            out: { volume: 0.46 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'envelope', toPort: 'gate' },
            { fromModule: 'ensemble', fromPort: 'outA', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'ensemble', fromPort: 'outB', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'envelope', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'envelope', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'inputShimmer', toPort: 'inL' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'inputShimmer', toPort: 'inR' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'regenShimmer', toPort: 'inL' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'regenShimmer', toPort: 'inR' },
            { fromModule: 'inputShimmer', fromPort: 'outL', toModule: 'inputSpectrum', toPort: 'audio' },
            { fromModule: 'regenShimmer', fromPort: 'outL', toModule: 'regenSpectrum', toPort: 'audio' },
            { fromModule: 'regenShimmer', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'regenShimmer', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
