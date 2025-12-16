/**
 * SFX - Shield Impact
 *
 * Metallic shield hit / energy barrier impact sound.
 * Ring modulation creates inharmonic, metallic tones.
 *
 * Tweak controls:
 * - vco1/vco2 coarse/fine: Tune for different metallic characters
 * - ring mix: Blend ring mod with source
 * - filter cutoff/resonance: Shape the metallic tone
 * - ampEnv decay: Impact sustain length
 * - chorus: Add shimmer
 */
export default {
    name: 'SFX - Shield Impact',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'adsr', instanceId: 'ampEnv', row: 1 },
            { type: 'func', instanceId: 'pitchEnv', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'ring', instanceId: 'ring', row: 1 },
            { type: 'vcf', instanceId: 'filter', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'chorus', instanceId: 'chorus', row: 1 },
            { type: 'verb', instanceId: 'verb', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.09 },
            ampEnv: { attack: 0.13, decay: 0.61, sustain: 0.4, release: 0.69 },
            pitchEnv: { rise: 0.03, fall: 0.27, curve: 0.35 },
            vco1: { coarse: 0.61, fine: -3.28, glide: 0 },
            vco2: { coarse: 0.36, fine: 1.72, glide: 0 },
            ring: { mix: 0.41 },
            filter: { cutoff: 0.24, resonance: 0.44 },
            vca: { ch1Gain: 0.8, ch2Gain: 0 },
            chorus: { rate: 0.71, depth: 0.33, mix: 0.55 },
            verb: { time: 0.31, damp: 0.19, mix: 0.77 },
            out: { volume: 0.7 }
        },
        switches: {},
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'ampEnv', toPort: 'gate' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'pitchEnv', toPort: 'trig' },
            { fromModule: 'pitchEnv', fromPort: 'out', toModule: 'vco1', toPort: 'fm' },
            { fromModule: 'pitchEnv', fromPort: 'out', toModule: 'vco2', toPort: 'fm' },
            { fromModule: 'vco1', fromPort: 'pulse', toModule: 'ring', toPort: 'x' },
            { fromModule: 'vco2', fromPort: 'pulse', toModule: 'ring', toPort: 'y' },
            { fromModule: 'ring', fromPort: 'out', toModule: 'filter', toPort: 'audio' },
            { fromModule: 'filter', fromPort: 'bpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'ampEnv', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'chorus', toPort: 'inL' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'chorus', toPort: 'inR' },
            { fromModule: 'chorus', fromPort: 'outL', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'chorus', fromPort: 'outR', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
