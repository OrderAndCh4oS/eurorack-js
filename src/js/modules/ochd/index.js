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

let ochdInstanceCounter = 0;

function nextPhaseOffset() {
    const offset = ((ochdInstanceCounter % 17) - 8) * 0.006;
    ochdInstanceCounter++;
    return offset;
}

export default {
    id: 'ochd',
    name: 'OCHD',
    hp: 4,
    color: 'module-color-two',
    category: 'modulation',

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

        // Initialize with an organic per-instance offset while preserving a
        // deterministic fastest-to-slowest phase relationship.
        const phaseTemplate = [0.49, 0.25, 0.20, 0.15, 0.10, 0.08, 0.06, 0.04];
        let phaseOffset = nextPhaseOffset();
        const phases = phaseTemplate.map(phase => Math.max(0.01, Math.min(0.99, phase + phaseOffset)));
        const directions = new Array(8).fill(1);

        // Frequency range (faithful to original øchd spec)
        const minBaseFreq = 1 / (1500 * frequencyMultipliers[7]);
        const maxBaseFreq = 160;     // At knob=1, output 1 = ~160Hz

        // Own input buffer
        const ownRateCV = new Float32Array(bufferSize);
        const outputBuffers = Array.from(
            { length: 8 },
            () => new Float32Array(bufferSize)
        );

        return {
            params: {
                rate: 0.5,      // Global rate 0-1
                rateCvAmt: 1    // Bipolar attenuverter for Rate CV
            },

            inputs: {
                rateCV: ownRateCV
            },

            outputs: {
                out1: outputBuffers[0],
                out2: outputBuffers[1],
                out3: outputBuffers[2],
                out4: outputBuffers[3],
                out5: outputBuffers[4],
                out6: outputBuffers[5],
                out7: outputBuffers[6],
                out8: outputBuffers[7]
            },

            leds: {
                led1: 0, led2: 0, led3: 0, led4: 0,
                led5: 0, led6: 0, led7: 0, led8: 0
            },

            process() {
                const rate = Number.isFinite(this.params.rate)
                    ? Math.max(0, Math.min(1, this.params.rate))
                    : 0.5;
                const rateCvAmt = Number.isFinite(this.params.rateCvAmt)
                    ? Math.max(-1, Math.min(1, this.params.rateCvAmt))
                    : 1;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate effective rate (knob + CV)
                    const cvSample = Number.isFinite(ownRateCV[i])
                        ? Math.max(-5, Math.min(5, ownRateCV[i]))
                        : 0;
                    const rawRate = rate + cvSample / 5 * rateCvAmt;
                    const effectiveRate = Math.max(0, Math.min(1, rawRate));

                    // Calculate base frequency using exponential scaling
                    const baseFreq = minBaseFreq * Math.pow(maxBaseFreq / minBaseFreq, effectiveRate);

                    // Negative control below the knob's minimum stalls the
                    // cores; knob minimum itself retains the 25-minute output.
                    const stalled = rawRate < 0;

                    // Process each LFO
                    for (let lfo = 0; lfo < 8; lfo++) {
                        if (!stalled) {
                            const freq = baseFreq * frequencyMultipliers[lfo];
                            // A rising-and-falling triangle traverses two phase
                            // units per cycle.
                            const phaseInc = 2 * freq / sampleRate;

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
                        outputBuffers[lfo][i] = (phases[lfo] * 2 - 1) * 5;
                    }
                }

                // Update LEDs with final sample values (normalized for display)
                for (let lfo = 0; lfo < 8; lfo++) {
                    // LED shows absolute value normalized to 0-1
                    this.leds[`led${lfo + 1}`] = outputBuffers[lfo][bufferSize - 1] / 5;
                }

                // Reset own input if replaced by routing
            },

            reset() {
                phaseOffset = nextPhaseOffset();
                ownRateCV.fill(0);
                for (let lfo = 0; lfo < 8; lfo++) {
                    phases[lfo] = Math.max(0.01, Math.min(0.99, phaseTemplate[lfo] + phaseOffset));
                    directions[lfo] = 1;
                    this.outputs[`out${lfo + 1}`].fill(0);
                    this.leds[`led${lfo + 1}`] = 0;
                }
            }
        };
    },

    ui: {
        leds: ['led1', 'led2', 'led3', 'led4', 'led5', 'led6', 'led7', 'led8'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.5 },
            { id: 'rateCvAmt', label: 'CV Amt', param: 'rateCvAmt', min: -1, max: 1, default: 1 }
        ],
        switches: [],
        inputs: [
            { id: 'rateCV', label: 'CV', port: 'rateCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out1', label: '1', port: 'out1', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out2', label: '2', port: 'out2', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out3', label: '3', port: 'out3', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out4', label: '4', port: 'out4', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out5', label: '5', port: 'out5', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out6', label: '6', port: 'out6', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out7', label: '7', port: 'out7', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'out8', label: '8', port: 'out8', signal: 'cv', voltage: { min: -5, max: 5 } }
        ]
    }
};
