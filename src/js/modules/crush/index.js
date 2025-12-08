/**
 * CRUSH - Bitcrusher Effect
 *
 * Lo-fi effect that reduces bit depth and sample rate for digital distortion/aliasing.
 * Creates crunchy, retro digital artifacts.
 *
 * Features:
 * - Bits knob (bit depth reduction)
 * - Rate knob (sample rate reduction)
 * - Mix knob (dry/wet balance)
 * - Stereo inputs/outputs
 * - Active LED indicator
 */

export default {
    id: 'crush',
    name: 'CRUSH',
    hp: 4,
    color: '#5a4a3a',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Sample-and-hold state for rate reduction
        let heldSampleL = 0;
        let heldSampleR = 0;
        let sampleCounter = 0;

        return {
            params: {
                bits: 0.5,      // 0-1 (maps to 2-16 bits)
                rate: 0,        // 0-1 (0 = no reduction, 1 = max reduction)
                mix: 0.5        // 0-1 (dry/wet)
            },

            inputs: {
                inL: new Float32Array(bufferSize),
                inR: new Float32Array(bufferSize)
            },

            outputs: {
                outL,
                outR
            },

            leds: {
                active: 0
            },

            process() {
                const { bits, rate, mix } = this.params;
                const inL = this.inputs.inL;
                const inR = this.inputs.inR;

                // Map bits to actual bit depth (2-16 bits)
                // Lower knob = fewer bits = more crushed
                const bitDepth = 2 + bits * 14;
                const levels = Math.pow(2, bitDepth);
                const halfLevels = levels / 2;

                // Map rate to sample rate reduction factor (1-64x)
                // 0 = no reduction (every sample), 1 = max reduction
                const rateReduction = 1 + rate * 63;

                let peakLevel = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Sample rate reduction (sample-and-hold)
                    sampleCounter++;
                    if (sampleCounter >= rateReduction) {
                        heldSampleL = inL[i];
                        heldSampleR = inR[i];
                        sampleCounter = 0;
                    }

                    // Bit depth reduction (quantization)
                    // Scale to levels, round, scale back
                    // Input is ±5V range, normalize to -1 to 1 for quantization
                    const normalizedL = heldSampleL / 5;
                    const normalizedR = heldSampleR / 5;

                    const crushedL = Math.round(normalizedL * halfLevels) / halfLevels * 5;
                    const crushedR = Math.round(normalizedR * halfLevels) / halfLevels * 5;

                    // Mix dry and wet
                    outL[i] = inL[i] * (1 - mix) + crushedL * mix;
                    outR[i] = inR[i] * (1 - mix) + crushedR * mix;

                    // Track peak for LED
                    peakLevel = Math.max(peakLevel, Math.abs(outL[i]), Math.abs(outR[i]));
                }

                // Update LED (normalized to 0-1)
                this.leds.active = Math.min(1, peakLevel / 5);
            },

            reset() {
                heldSampleL = 0;
                heldSampleR = 0;
                sampleCounter = 0;
                outL.fill(0);
                outR.fill(0);
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'bits', label: 'Bits', param: 'bits', min: 0, max: 1, default: 0.5 },
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'inL', label: 'In L', port: 'inL', type: 'audio' },
            { id: 'inR', label: 'In R', port: 'inR', type: 'audio' }
        ],
        outputs: [
            { id: 'outL', label: 'Out L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'Out R', port: 'outR', type: 'audio' }
        ]
    }
};
