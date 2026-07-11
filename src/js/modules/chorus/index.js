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

import { createLinearCircularReader } from '../../utils/interpolation.js';

// Delay line parameters
const BASE_DELAY_MS = 20;   // Base delay time in ms
const MOD_DEPTH_MS = 10;    // Maximum modulation depth in ms
const MAX_DELAY_MS = 50;    // Maximum total delay

export default {
    id: 'chorus',
    name: 'CHORUS',
    hp: 6,
    color: 'module-color-three',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Delay buffers - sized for max delay
        const delayBufferSize = Math.ceil(sampleRate * MAX_DELAY_MS / 1000) + bufferSize;
        const delayBufferL = new Float32Array(delayBufferSize);
        const delayBufferR = new Float32Array(delayBufferSize);
        const readDelayL = createLinearCircularReader(delayBufferL);
        const readDelayR = createLinearCircularReader(delayBufferR);
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
                    const delayedL = readDelayL(writeIndex - delayL);
                    const delayedR = readDelayR(writeIndex - delayR);

                    // Write input to delay buffers
                    delayBufferL[writeIndex] = inL[i];
                    delayBufferR[writeIndex] = inR[i];

                    // Mix dry and wet
                    outL[i] = inL[i] * (1 - mix) + delayedL * mix;
                    outR[i] = inR[i] * (1 - mix) + delayedR * mix;

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
            { id: 'inL', label: 'In L', port: 'inL', signal: 'audio' },
            { id: 'inR', label: 'In R', port: 'inR', signal: 'audio' }
        ],
        outputs: [
            { id: 'outL', label: 'Out L', port: 'outL', signal: 'audio' },
            { id: 'outR', label: 'Out R', port: 'outR', signal: 'audio' }
        ]
    }
};
