/**
 * Test Patch: dB Meter
 *
 * Tests the dB meter module with a stereo signal path.
 * VCO through VCA with LFO modulation, monitored by dB meter.
 */
export default {
    name: 'Test: dB Meter',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'db', instanceId: 'db', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rate: 0.3 },
            vco: { coarse: 0.4, fine: 0 },
            vca: { gain1: 0.7, gain2: 0.7 }
        },
        switches: {
            db: { mode: 0, hold: 1 }
        },
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'db', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'db', toPort: 'R' },
            { fromModule: 'db', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'db', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
