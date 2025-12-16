/**
 * SFX - Laser
 *
 * Classic sci-fi laser/blaster sound effect.
 * Pitch sweep with bright, cutting character.
 *
 * Tweak controls:
 * - pitchEnv rise/fall: Sweep shape
 * - vco coarse: Starting pitch (higher = smaller weapon)
 * - filter cutoff: Brightness/bite
 * - filter resonance: Add whistle/zing
 */
export default {
    name: 'SFX - Laser',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'func', instanceId: 'pitchEnv', row: 1 },
            { type: 'adsr', instanceId: 'ampEnv', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'filter', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'verb', instanceId: 'verb', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.1 },
            pitchEnv: { rise: 0.41, fall: 0.67, curve: 0.59 },
            ampEnv: { attack: 0, decay: 0.25, sustain: 0, release: 0.82 },
            vco: { coarse: 0.24, fine: 0, glide: 0 },
            filter: { cutoff: 0.6, resonance: 0.66 },
            vca: { ch1Gain: 0.33, ch2Gain: 0 },
            verb: { time: 0.35, damp: 0.26, mix: 0.18 },
            out: { volume: 0.68 }
        },
        switches: {},
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'pitchEnv', toPort: 'trig' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'ampEnv', toPort: 'gate' },
            { fromModule: 'pitchEnv', fromPort: 'out', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'filter', toPort: 'audio' },
            { fromModule: 'filter', fromPort: 'hpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'ampEnv', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
