/**
 * OCHD - 8x Free-Running LFO
 *
 * Based on Instruo/DivKid øchd
 * https://www.instruomodular.com/product/ochd/
 *
 * Eight independent, free-running analogue triangle LFOs.
 * Outputs arranged from fastest (1) to slowest (8).
 * Frequencies tuned by ear for musical usefulness.
 *
 * Features:
 * - 8 triangle LFO outputs (-5V to +5V bipolar)
 * - Global rate control with CV
 * - Frequency range: ~160Hz to 25-minute cycles
 * - Random initial phases for organic drift
 * - Track and hold with strong negative CV
 */

export default {
    id: 'ochd',
    name: 'OCHD',
    hp: 4,
    color: '#1a3a4a',
    category: 'modulator',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Frequency multipliers for each output (relative to base rate)
        // Output 1 = fastest, Output 8 = slowest
        // Tuned for musical spread, not mathematical ratios
        const frequencyMultipliers = [
            1.0,      // Output 1: Base rate (fastest)
            0.54,     // Output 2
            0.29,     // Output 3
            0.16,     // Output 4
            0.087,    // Output 5
            0.047,    // Output 6
            0.026,    // Output 7
            0.014     // Output 8: Slowest (~1/70th of base)
        ];

        // Initialize with random phases (organic behavior)
        const phases = new Array(8).fill(0).map(() => Math.random());
        const directions = new Array(8).fill(0).map(() => Math.random() > 0.5 ? 1 : -1);

        // Frequency range (faithful to original øchd spec)
        const minBaseFreq = 0.0007;  // At knob=0, output 8 = ~25 min cycle
        const maxBaseFreq = 160;     // At knob=1, output 1 = ~160Hz

        // Own input buffer
        const ownRateCV = new Float32Array(bufferSize);

        return {
            params: {
                rate: 0.5  // Global rate 0-1
            },

            inputs: {
                rateCV: ownRateCV
            },

            outputs: {
                out1: new Float32Array(bufferSize),
                out2: new Float32Array(bufferSize),
                out3: new Float32Array(bufferSize),
                out4: new Float32Array(bufferSize),
                out5: new Float32Array(bufferSize),
                out6: new Float32Array(bufferSize),
                out7: new Float32Array(bufferSize),
                out8: new Float32Array(bufferSize)
            },

            leds: {
                led1: 0, led2: 0, led3: 0, led4: 0,
                led5: 0, led6: 0, led7: 0, led8: 0
            },

            process() {
                const { rate } = this.params;
                const { rateCV } = this.inputs;
                const outputs = [
                    this.outputs.out1, this.outputs.out2,
                    this.outputs.out3, this.outputs.out4,
                    this.outputs.out5, this.outputs.out6,
                    this.outputs.out7, this.outputs.out8
                ];

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate effective rate (knob + CV)
                    // CV is ±5V, normalize to ±0.5 contribution
                    const cvMod = (rateCV[i] || 0) / 10;
                    const effectiveRate = Math.max(0, Math.min(1, rate + cvMod));

                    // Calculate base frequency using exponential scaling
                    const baseFreq = minBaseFreq * Math.pow(maxBaseFreq / minBaseFreq, effectiveRate);

                    // Check for stall condition (very low effective rate)
                    const stalled = effectiveRate < 0.01;

                    // Process each LFO
                    for (let lfo = 0; lfo < 8; lfo++) {
                        if (!stalled) {
                            const freq = baseFreq * frequencyMultipliers[lfo];
                            const phaseInc = freq / sampleRate;

                            // Update phase based on direction
                            phases[lfo] += directions[lfo] * phaseInc;

                            // Triangle oscillator: reverse at peaks
                            if (phases[lfo] >= 1) {
                                phases[lfo] = 1 - (phases[lfo] - 1);
                                directions[lfo] = -1;
                            } else if (phases[lfo] <= 0) {
                                phases[lfo] = -phases[lfo];
                                directions[lfo] = 1;
                            }
                        }

                        // Output: phase 0-1 mapped to -5V to +5V
                        outputs[lfo][i] = (phases[lfo] * 2 - 1) * 5;
                    }
                }

                // Update LEDs with final sample values (normalized for display)
                for (let lfo = 0; lfo < 8; lfo++) {
                    // LED shows absolute value normalized to 0-1
                    this.leds[`led${lfo + 1}`] = outputs[lfo][bufferSize - 1] / 5;
                }

                // Reset own input if replaced by routing
                if (this.inputs.rateCV !== ownRateCV) {
                    ownRateCV.fill(0);
                    this.inputs.rateCV = ownRateCV;
                }
            },

            reset() {
                // Reinitialize with new random phases
                for (let lfo = 0; lfo < 8; lfo++) {
                    phases[lfo] = Math.random();
                    directions[lfo] = Math.random() > 0.5 ? 1 : -1;
                    this.outputs[`out${lfo + 1}`].fill(0);
                    this.leds[`led${lfo + 1}`] = 0;
                }
            }
        };
    },

    ui: {
        leds: ['led1', 'led2', 'led3', 'led4', 'led5', 'led6', 'led7', 'led8'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'rateCV', label: 'CV', port: 'rateCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out1', label: '1', port: 'out1', type: 'cv' },
            { id: 'out2', label: '2', port: 'out2', type: 'cv' },
            { id: 'out3', label: '3', port: 'out3', type: 'cv' },
            { id: 'out4', label: '4', port: 'out4', type: 'cv' },
            { id: 'out5', label: '5', port: 'out5', type: 'cv' },
            { id: 'out6', label: '6', port: 'out6', type: 'cv' },
            { id: 'out7', label: '7', port: 'out7', type: 'cv' },
            { id: 'out8', label: '8', port: 'out8', type: 'cv' }
        ]
    }
};
