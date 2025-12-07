/**
 * Fold (Wavefolder) Module
 *
 * Adds harmonic complexity by folding waveforms back on themselves.
 * Based on Serge-style sine wavefolder design.
 *
 * Controls:
 * - Fold: Amount of folding (adds harmonics)
 * - Sym: Symmetry/bias offset for asymmetric folding
 *
 * Inputs:
 * - Audio: Signal to fold
 * - Fold CV: Modulate fold amount
 * - Sym CV: Modulate symmetry
 *
 * Output:
 * - Out: Folded audio signal
 *
 * Algorithm: sin(drive * (input + offset))
 * - Drive scales with fold amount
 * - Offset adds DC bias for asymmetric folding
 *
 * References:
 * - https://noiseengineering.us/blogs/loquelic-literitas-the-blog/getting-started-wavefolders/
 * - https://ccrma.stanford.edu/~jatin/ComplexNonlinearities/Wavefolder.html
 */

export default {
    id: 'fold',
    name: 'FOLD',
    hp: 4,
    color: '#8b5a2b',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);

        // Output scaling (sin outputs ±1, scale to ±5V)
        const OUTPUT_SCALE = 5;

        // CV scaling
        const FOLD_CV_SCALE = 0.1;  // 5V = +0.5 fold
        const SYM_CV_SCALE = 0.2;   // 5V = +1V offset

        return {
            params: {
                fold: 0.3,  // 0-1, controls drive amount
                sym: 0      // -1 to 1, DC offset for asymmetric folding
            },

            inputs: {
                audio: new Float32Array(bufferSize),
                foldCV: new Float32Array(bufferSize),
                symCV: new Float32Array(bufferSize)
            },

            outputs: { out },

            leds: {},

            process() {
                const { fold, sym } = this.params;
                const { audio, foldCV, symCV } = this.inputs;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate effective fold amount (1 = unity, higher = more folds)
                    // Map 0-1 knob to 1-10 drive range
                    const foldMod = foldCV[i] * FOLD_CV_SCALE;
                    const effectiveFold = Math.max(0, Math.min(1, fold + foldMod));
                    const drive = 1 + effectiveFold * 9;  // 1 to 10

                    // Calculate symmetry offset
                    const symMod = symCV[i] * SYM_CV_SCALE;
                    const offset = (sym + symMod) * 2;  // Scale to ±2V offset

                    // Get input and add symmetry offset
                    const input = audio[i] + offset;

                    // Normalize input to folding range
                    // Divide by 5 to normalize ±5V audio to ±1
                    const normalizedInput = input / 5;

                    // Apply sine wavefolder
                    // sin(drive * x) folds the wave back on itself
                    const folded = Math.sin(drive * normalizedInput * Math.PI);

                    // Scale output back to audio range
                    out[i] = folded * OUTPUT_SCALE;
                }
            },

            reset() {
                out.fill(0);
            }
        };
    },

    ui: {
        knobs: [
            { id: 'fold', label: 'Fold', param: 'fold', min: 0, max: 1, default: 0.3 },
            { id: 'sym', label: 'Sym', param: 'sym', min: -1, max: 1, default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', type: 'audio' },
            { id: 'foldCV', label: 'Fold', port: 'foldCV', type: 'cv' },
            { id: 'symCV', label: 'Sym', port: 'symCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
