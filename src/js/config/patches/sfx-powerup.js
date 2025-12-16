/**
 * SFX - Powerup
 *
 * Classic video game powerup / collect item sound.
 * Rising pitch sweep with sparkly harmonics.
 *
 * Tweak controls:
 * - pitchEnv rise: Sweep speed (faster = quick pickup, slower = big powerup)
 * - vco coarse: Starting pitch
 * - fold amount: Harmonic richness / sparkle
 * - filter cutoff: Brightness
 * - phaser: Add movement/shimmer
 */
export default {
    name: 'SFX - Powerup',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'func', instanceId: 'pitchEnv', row: 1 },
            { type: 'adsr', instanceId: 'ampEnv', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'fold', instanceId: 'fold', row: 1 },
            { type: 'vcf', instanceId: 'filter', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'phaser', instanceId: 'phaser', row: 1 },
            { type: 'verb', instanceId: 'verb', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.11 },
            pitchEnv: { rise: 0.79, fall: 0.64, curve: 0.5 },
            ampEnv: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 0.75 },
            vco: { coarse: 0.2, fine: 0, glide: 0 },
            fold: { fold: 0.54, sym: -0.33 },
            filter: { cutoff: 0.59, resonance: 0.37 },
            vca: { ch1Gain: 0.7, ch2Gain: 0 },
            phaser: { rate: 0.31, depth: 0.5, feedback: 0.19, mix: 0.5 },
            verb: { time: 0.35, damp: 0.6, mix: 0.3 },
            out: { volume: 0.7 }
        },
        switches: {},
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'pitchEnv', toPort: 'trig' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'ampEnv', toPort: 'gate' },
            { fromModule: 'pitchEnv', fromPort: 'out', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'fold', toPort: 'audio' },
            { fromModule: 'fold', fromPort: 'out', toModule: 'filter', toPort: 'audio' },
            { fromModule: 'filter', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'pitchEnv', fromPort: 'out', toModule: 'filter', toPort: 'cutoffCV' },
            { fromModule: 'ampEnv', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'phaser', toPort: 'inL' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'phaser', toPort: 'inR' },
            { fromModule: 'phaser', fromPort: 'outL', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'phaser', fromPort: 'outR', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
