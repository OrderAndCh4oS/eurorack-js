/**
 * FLANGER - Flanger Effect
 *
 * Creates sweeping comb filter effect using short modulated delay with feedback.
 * Similar to chorus but with shorter delays and higher feedback for resonance.
 *
 * Features:
 * - Rate knob (LFO speed)
 * - Depth knob (modulation amount)
 * - Feedback knob (resonance, supports negative)
 * - Mix knob (dry/wet balance)
 * - Stereo inputs/outputs
 * - LFO LED indicator
 */

// Delay line parameters (shorter than chorus for flanging)
const BASE_DELAY_MS = 2;    // Base delay time in ms
const MOD_DEPTH_MS = 5;     // Maximum modulation depth in ms
const MAX_DELAY_MS = 10;    // Maximum total delay

export default {
    id: 'flanger',
    name: 'FLANGER',
    hp: 6,
    color: '#9f7b6b',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Delay buffers - sized for max delay
        const delayBufferSize = Math.ceil(sampleRate * MAX_DELAY_MS / 1000) + bufferSize;
        const delayBufferL = new Float32Array(delayBufferSize);
        const delayBufferR = new Float32Array(delayBufferSize);
        let writeIndex = 0;

        // LFO state
        let lfoPhase = 0;
        const STEREO_PHASE_OFFSET = Math.PI; // 180 degrees for dramatic stereo

        return {
            params: {
                rate: 0.3,      // 0-1 (maps to 0.05-2 Hz, slower than chorus)
                depth: 0.5,     // 0-1 (modulation amount)
                feedback: 0.5,  // 0-1 (maps to -0.9 to 0.9)
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
                lfo: 0
            },

            process() {
                const { rate, depth, feedback, mix } = this.params;
                const inL = this.inputs.inL;
                const inR = this.inputs.inR;

                // Map rate to Hz (0.05-2 Hz, slower sweep than chorus)
                const lfoFreq = 0.05 + rate * 1.95;
                const phaseIncrement = (2 * Math.PI * lfoFreq) / sampleRate;

                // Base delay in samples
                const baseDelaySamples = (BASE_DELAY_MS / 1000) * sampleRate;
                // Modulation depth in samples
                const modDepthSamples = (MOD_DEPTH_MS / 1000) * sampleRate * depth;

                // Map feedback to bipolar range (-0.9 to 0.9)
                const fb = (feedback * 2 - 1) * 0.9;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate LFO values with stereo offset
                    const lfoL = Math.sin(lfoPhase);
                    const lfoR = Math.sin(lfoPhase + STEREO_PHASE_OFFSET);

                    // Calculate modulated delay times (always positive)
                    const delayL = baseDelaySamples + (lfoL + 1) / 2 * modDepthSamples;
                    const delayR = baseDelaySamples + (lfoR + 1) / 2 * modDepthSamples;

                    // Read from delay buffers with linear interpolation
                    const wetL = readInterpolated(delayBufferL, writeIndex, delayL, delayBufferSize);
                    const wetR = readInterpolated(delayBufferR, writeIndex, delayR, delayBufferSize);

                    // Write input + feedback to delay buffers
                    delayBufferL[writeIndex] = inL[i] + wetL * fb;
                    delayBufferR[writeIndex] = inR[i] + wetR * fb;

                    // Mix dry and wet
                    outL[i] = inL[i] * (1 - mix) + wetL * mix;
                    outR[i] = inR[i] * (1 - mix) + wetR * mix;

                    // Advance write index
                    writeIndex = (writeIndex + 1) % delayBufferSize;

                    // Advance LFO phase
                    lfoPhase += phaseIncrement;
                    if (lfoPhase >= 2 * Math.PI) {
                        lfoPhase -= 2 * Math.PI;
                    }
                }

                // Update LED (show LFO position)
                this.leds.lfo = (Math.sin(lfoPhase) + 1) / 2;
            },

            reset() {
                delayBufferL.fill(0);
                delayBufferR.fill(0);
                writeIndex = 0;
                lfoPhase = 0;
                outL.fill(0);
                outR.fill(0);
                this.leds.lfo = 0;
            }
        };

        // Helper: read from circular buffer with linear interpolation
        function readInterpolated(buffer, writeIdx, delaySamples, bufSize) {
            const readIndexFloat = writeIdx - delaySamples;
            let idx0 = Math.floor(readIndexFloat);
            let idx1 = idx0 + 1;
            const frac = readIndexFloat - idx0;

            // Wrap indices
            while (idx0 < 0) idx0 += bufSize;
            while (idx1 < 0) idx1 += bufSize;
            idx0 = idx0 % bufSize;
            idx1 = idx1 % bufSize;

            return buffer[idx0] * (1 - frac) + buffer[idx1] * frac;
        }
    },

    ui: {
        leds: ['lfo'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.3 },
            { id: 'depth', label: 'Depth', param: 'depth', min: 0, max: 1, default: 0.5 },
            { id: 'feedback', label: 'Fdbk', param: 'feedback', min: 0, max: 1, default: 0.5 },
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
