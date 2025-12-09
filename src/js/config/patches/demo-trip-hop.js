/**
 * Demo Patch: Trip-Hop
 *
 * Portishead-inspired dark, downtempo atmosphere.
 * Slow tempo, filtered drums, detuned melodies with vinyl degradation.
 *
 * Features:
 * - Slow tempo with euclidean snare variation
 * - Detuned VCO melody through filter and crusher for vinyl texture
 * - Heavy reverb for atmosphere
 * - Slow LFO modulation for movement
 */
export default {
    name: 'Demo: Trip-Hop',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'euclid', instanceId: 'euclid', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'crush', instanceId: 'crush', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'verb', instanceId: 'verb', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 },
            { type: 'seq', instanceId: 'seq', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            div: { rate1: 0.5, rate2: 0.4 },
            euclid: { length: 8, hits: 5, rotate: 0 },
            kick: { pitch: 0.35, decay: 0.6, tone: 0.3, click: 0.5 },
            snare: { snap: 0.5, decay: 0.35, pitch: 0.5 },
            hat: { decay: 0.15, sizzle: 0.4, blend: 0.5 },
            seq: {
                step1: 0.31, step2: 0.5, step3: 0.35, step4: 0.69,
                step5: 0.35, step6: 0.7, step7: 0.45, step8: 1,
                length: 8, range: 1, direction: 0
            },
            quant: { scale: 2, octave: 0, semitone: 0 },
            vco: { coarse: 0.29, fine: -0.15, glide: 0.4 },
            vcf: { cutoff: 0.35, resonance: 0.25 },
            adsr: { attack: 0.15, decay: 0.4, sustain: 0.3, release: 0.6 },
            vca: { ch1Gain: 0.7, ch2Gain: 0 },
            lfo: { rateKnob: 0.3, waveKnob: 0 },
            crush: { bits: 0.7, rate: 0.8, mix: 0.3 },
            mix: { lvl1: 0.22, lvl2: 0.63, lvl3: 0.47, lvl4: 0.66 },
            verb: { time: 0.75, damp: 0.6, mix: 0.45 },
            out: { volume: 0.65 }
        },
        switches: {
            clk: { pause: false },
            lfo: { range: false }
        },
        buttons: {
            seq: {
                gate1: 1, gate2: 0, gate3: 1, gate4: 1,
                gate5: 1, gate6: 0, gate7: 0, gate8: 1
            }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'euclid', fromPort: 'trig', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in4' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'crush', toPort: 'inL' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'crush', toPort: 'inR' },
            { fromModule: 'crush', fromPort: 'outL', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'crush', fromPort: 'outR', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
