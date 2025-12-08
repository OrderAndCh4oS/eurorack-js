/**
 * Test Patch: PWM Generator
 *
 * Demonstrates the PWM module converting VCO triangle wave to pulse
 * with LFO modulation on the pulse width for classic PWM sound.
 * Dual scopes show before (triangle + LFO) and after (modulated pulse).
 */
export default {
    name: 'Test: PWM',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'scope', instanceId: 'scope1', row: 1 },
            { type: 'pwm', instanceId: 'pwm', row: 1 },
            { type: 'scope', instanceId: 'scope2', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.4, fine: 0, glide: 5 },
            lfo: { rateKnob: 0.3, waveKnob: 0 },
            scope1: { time: 0, trigger: 0.5, gain1: 0.5, gain2: 0.5, offset1: 0.5, offset2: 0.5 },
            pwm: { pw: 0.31, pwmAmt: 0.38 },
            scope2: { time: 0, trigger: 0.47, gain1: 0, gain2: 0, offset1: 0.49, offset2: 0.5 },
            out: { volume: 0.8 }
        },
        switches: {
            lfo: { range: 0 },
            scope1: { mode: 0 },
            scope2: { mode: 0 }
        },
        cables: [
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'scope1', toPort: 'in1' },
            { fromModule: 'scope1', fromPort: 'out1', toModule: 'pwm', toPort: 'in' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'scope1', toPort: 'in2' },
            { fromModule: 'scope1', fromPort: 'out2', toModule: 'pwm', toPort: 'pwmCV' },
            { fromModule: 'pwm', fromPort: 'out', toModule: 'scope2', toPort: 'in1' },
            { fromModule: 'scope2', fromPort: 'out1', toModule: 'out', toPort: 'L' },
            { fromModule: 'scope2', fromPort: 'out1', toModule: 'out', toPort: 'R' }
        ]
    }
};
