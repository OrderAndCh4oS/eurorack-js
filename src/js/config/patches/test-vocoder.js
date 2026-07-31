/**
 * Test - Vocoder
 *
 * A clocked kick plus enveloped wide-band noise shapes a rich ramp carrier
 * through the 12-band vocoder. The noise gives SIBILANCE useful energy above
 * 5 kHz; the spectrum shows the transferred envelope while the right output
 * carries the direct result for comparison.
 */
export default {
    name: 'Test - Vocoder',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'kick', type: 'kick', row: 1, index: 1 },
            { id: 'noise', type: 'nse', row: 1, index: 2 },
            { id: 'modMix', type: 'mix', row: 1, index: 3 },
            { id: 'vco', type: 'vco', row: 1, index: 4 },
            { id: 'vocoder', type: 'vocoder', row: 1, index: 5 },
            { id: 'spectrum', type: 'spectrum', row: 1, index: 6 },
            { id: 'out', type: 'out', row: 1, index: 7 }
        ],
        params: {
            clk: { rate: 0.27, pause: 0 },
            kick: { pitch: 0.35, decay: 0.6, tone: 0.55, click: 0.7 },
            noise: { rate: 0.65, vcaMode: 1 },
            modMix: { lvl1: 0.65, lvl2: 0.35, lvl3: 0, lvl4: 0 },
            vco: { coarse: 0.42, fine: 0, glide: 5 },
            vocoder: {
                analysisGain: 1.4,
                carrierGain: 1,
                attackMs: 5,
                releaseMs: 180,
                shift: 0,
                sibilance: 0.35,
                mix: 1
            },
            spectrum: { floor: 0.35, decay: 0.6, scale: 0 },
            out: { volume: 0.7 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'noise', toPort: 'trigger' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'modMix', toPort: 'in1' },
            { fromModule: 'noise', fromPort: 'noise', toModule: 'modMix', toPort: 'in2' },
            { fromModule: 'modMix', fromPort: 'out', toModule: 'vocoder', toPort: 'modulator' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vocoder', toPort: 'carrier' },
            { fromModule: 'vocoder', fromPort: 'out', toModule: 'spectrum', toPort: 'audio' },
            { fromModule: 'spectrum', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vocoder', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
