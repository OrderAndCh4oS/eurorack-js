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
 * - First-order antiderivative antialiasing reduces reflected harmonics
 *
 * References:
 * - https://noiseengineering.us/blogs/loquelic-literitas-the-blog/getting-started-wavefolders/
 * - https://ccrma.stanford.edu/~jatin/ComplexNonlinearities/Wavefolder.html
 * - https://www.pure.ed.ac.uk/ws/portalfiles/portal/34115216/bilbao_pdf.pdf
 */

export default {
    id: 'fold',
    name: 'FOLD',
    hp: 4,
    color: 'module-color-six',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const ownAudio = new Float32Array(bufferSize);
        const ownFoldCV = new Float32Array(bufferSize);
        const ownSymCV = new Float32Array(bufferSize);
        let previousDrivenInput = 0;

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
                audio: ownAudio,
                foldCV: ownFoldCV,
                symCV: ownSymCV
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

                    // Combine drive and normalized input so parameter/CV changes
                    // are part of the signal presented to the nonlinearity.
                    const drivenInput = drive * input / 5;
                    const delta = drivenInput - previousDrivenInput;

                    // First-order antiderivative antialiasing for sin(PI*x).
                    // The divided difference integrates the memoryless transfer
                    // curve between samples, reducing harmonics reflected below
                    // Nyquist without an oversampling buffer.
                    const folded = Math.abs(delta) > 1e-8
                        ? (Math.cos(Math.PI * previousDrivenInput)
                            - Math.cos(Math.PI * drivenInput)) / (Math.PI * delta)
                        : Math.sin(Math.PI * (drivenInput + previousDrivenInput) * 0.5);
                    previousDrivenInput = drivenInput;

                    // Scale output back to audio range
                    out[i] = folded * OUTPUT_SCALE;
                }
            },

            reset() {
                ownAudio.fill(0);
                ownFoldCV.fill(0);
                ownSymCV.fill(0);
                out.fill(0);
                previousDrivenInput = 0;
            }
        };
    },

    ui: {
        knobs: [
            { id: 'fold', label: 'Fold', param: 'fold', min: 0, max: 1, default: 0.3 },
            { id: 'sym', label: 'Sym', param: 'sym', min: -1, max: 1, default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
            { id: 'foldCV', label: 'Fold', port: 'foldCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'symCV', label: 'Sym', port: 'symCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio' }
        ]
    }
};
