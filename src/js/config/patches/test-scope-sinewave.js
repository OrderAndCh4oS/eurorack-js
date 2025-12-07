/**
 * Test - Scope Sine Wave
 *
 * Simple patch to display a classic waveform on the oscilloscope.
 * VCO triangle output (closest to sine wave) patched to scope input.
 * Also routed to output so you can hear it.
 */
export default {
    name: 'Test - Scope Sine Wave',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'scope', instanceId: 'scope', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            // LFO: faster rate to show visible wave on scope
            lfo: { rateKnob: 0.85, waveKnob: 0 },
            // VCO: low frequency for easy viewing
            vco: { coarse: 0.3, fine: 0, glide: 0 },
            // Scope: slower time base to see more cycles
            scope: { time: 0.3, trigger: 0.5 },
            // Output: moderate volume
            out: { volume: 0.5 }
        },
        switches: {
            // LFO in fast mode for visible oscillation on scope
            lfo: { range: true }
        },
        cables: [
            // VCO triangle to scope CH1 (green trace)
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'scope', toPort: 'in1' },
            // LFO sine to scope CH2 (cyan trace)
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'scope', toPort: 'in2' },
            // Scope passthrough to output
            { fromModule: 'scope', fromPort: 'out1', toModule: 'out', toPort: 'L' },
            { fromModule: 'scope', fromPort: 'out1', toModule: 'out', toPort: 'R' }
        ]
    }
};
