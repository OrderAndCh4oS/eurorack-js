/**
 * CHORUS - Stereo Chorus Effect
 *
 * Creates thickening/detuning by mixing dry signal with modulated delayed copies.
 * Stereo width achieved through phase-offset LFOs.
 *
 * Features:
 * - Rate knob (LFO speed)
 * - Depth knob (modulation amount)
 * - Mix knob (dry/wet balance)
 * - Stereo inputs/outputs
 * - LFO LED indicator
 */

// Delay line parameters
const BASE_DELAY_MS = 20;   // Base delay time in ms
const MOD_DEPTH_MS = 10;    // Maximum modulation depth in ms
const MAX_DELAY_MS = 50;    // Maximum total delay

export default {
    id: 'chorus',
    name: 'CHORUS',
    hp: 6,
    color: '#6b8e9f',
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
        const STEREO_PHASE_OFFSET = Math.PI / 2; // 90 degrees for stereo width

        return {
            params: {
                rate: 0.3,      // 0-1 (maps to 0.1-5 Hz)
                depth: 0.5,     // 0-1 (modulation amount)
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
                const { rate, depth, mix } = this.params;
                const inL = this.inputs.inL;
                const inR = this.inputs.inR;

                // Map rate to Hz (0.1-5 Hz)
                const lfoFreq = 0.1 + rate * 4.9;
                const phaseIncrement = (2 * Math.PI * lfoFreq) / sampleRate;

                // Base delay in samples
                const baseDelaySamples = (BASE_DELAY_MS / 1000) * sampleRate;
                // Modulation depth in samples
                const modDepthSamples = (MOD_DEPTH_MS / 1000) * sampleRate * depth;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate LFO values with stereo offset
                    const lfoL = Math.sin(lfoPhase);
                    const lfoR = Math.sin(lfoPhase + STEREO_PHASE_OFFSET);

                    // Calculate modulated delay times
                    const delayL = baseDelaySamples + lfoL * modDepthSamples;
                    const delayR = baseDelaySamples + lfoR * modDepthSamples;

                    // Read from delay buffers with linear interpolation
                    const readDelayL = readInterpolated(delayBufferL, writeIndex, delayL, delayBufferSize);
                    const readDelayR = readInterpolated(delayBufferR, writeIndex, delayR, delayBufferSize);

                    // Write input to delay buffers
                    delayBufferL[writeIndex] = inL[i];
                    delayBufferR[writeIndex] = inR[i];

                    // Mix dry and wet
                    outL[i] = inL[i] * (1 - mix) + readDelayL * mix;
                    outR[i] = inR[i] * (1 - mix) + readDelayR * mix;

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
