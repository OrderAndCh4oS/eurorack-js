/**
 * Ring Modulator Module
 *
 * Multiplies two signals together, producing sum and difference frequencies.
 * Creates metallic, bell-like, and inharmonic tones.
 *
 * Controls:
 * - Mix: Blend between dry carrier (X) and ring modulated output
 *
 * Inputs:
 * - X: Carrier signal
 * - Y: Modulator signal
 *
 * Output:
 * - Out: Ring modulated signal (or dry/wet blend)
 *
 * Algorithm: out = x * y (scaled to maintain audio levels)
 *
 * References:
 * - https://en.wikipedia.org/wiki/Ring_modulation
 * - https://synthesizeracademy.com/ring-modulator/
 */

export default {
    id: 'ring',
    name: 'RING',
    hp: 4,
    color: '#7b3f00',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);

        // Scale factor: ±5V * ±5V = ±25V, divide by 5 to get back to ±5V
        const SCALE = 1 / 5;

        return {
            params: {
                mix: 1  // 0 = dry (X only), 1 = full ring mod
            },

            inputs: {
                x: new Float32Array(bufferSize),  // Carrier
                y: new Float32Array(bufferSize)   // Modulator
            },

            outputs: { out },

            leds: {},

            process() {
                const { mix } = this.params;
                const { x, y } = this.inputs;

                for (let i = 0; i < bufferSize; i++) {
                    // Ring modulation: multiply signals
                    const ringMod = x[i] * y[i] * SCALE;

                    // Mix dry (carrier) with wet (ring mod)
                    out[i] = x[i] * (1 - mix) + ringMod * mix;
                }
            },

            reset() {
                out.fill(0);
            }
        };
    },

    ui: {
        knobs: [
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1 }
        ],
        inputs: [
            { id: 'x', label: 'X', port: 'x', type: 'audio' },
            { id: 'y', label: 'Y', port: 'y', type: 'audio' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
