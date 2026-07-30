/**
 * DLY - Digital Delay
 *
 * Based on 2hp Delay specifications.
 * A flexible delay processor with CV over all parameters.
 *
 * Features:
 * - Time knob (milliseconds to ~1 second)
 * - Feedback knob (slapback to infinity)
 * - Mix knob (dry/wet balance)
 * - CV inputs for Time, Feedback, Mix
 * - Audio input/output
 */

import { createLinearCircularReader } from '../../utils/interpolation.js';
import { softLimitVoltage } from '../../utils/voltage.js';

// Maximum delay time in seconds
const MAX_DELAY_TIME = 1.0;

export default {
    id: 'dly',
    name: 'DLY',
    hp: 4,
    color: 'module-color-three',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);

        // Delay buffer - sized for max delay time
        const delayBufferSize = Math.ceil(sampleRate * MAX_DELAY_TIME) + bufferSize;
        const delayBuffer = new Float32Array(delayBufferSize);
        const readDelay = createLinearCircularReader(delayBuffer);
        let writeIndex = 0;

        const ownAudio = new Float32Array(bufferSize);
        const ownTimeCV = new Float32Array(bufferSize);
        const ownFeedbackCV = new Float32Array(bufferSize);
        const ownMixCV = new Float32Array(bufferSize);

        // One-pole lowpass in feedback path (darkens repeats like analog/tape delay)
        let dampState = 0;
        const dampCutoff = Math.min(8000, sampleRate * 0.45);
        const dampCoeff = 1 - Math.exp(-2 * Math.PI * dampCutoff / sampleRate);

        return {
            params: {
                time: 0.5,      // 0-1 (maps to 0ms - 1000ms)
                feedback: 0.3,  // 0-1 (0 = no repeats, 1 = infinite)
                mix: 0.5        // 0-1 (0 = dry, 1 = wet)
            },

            inputs: {
                audio: ownAudio,
                timeCV: ownTimeCV,
                feedbackCV: ownFeedbackCV,
                mixCV: ownMixCV
            },

            outputs: {
                out
            },

            leds: {
                active: 0
            },

            process() {
                const { time, feedback, mix } = this.params;
                const audioIn = this.inputs.audio;
                const timeCV = this.inputs.timeCV;
                const feedbackCV = this.inputs.feedbackCV;
                const mixCV = this.inputs.mixCV;

                let peakLevel = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate modulated parameters
                    // The hardware's 0-5V CV range spans the full knob range.
                    const modulatedTime = Math.max(0, Math.min(1, time + (timeCV[i] / 5)));

                    const modulatedFeedback = Math.max(0, Math.min(0.99, feedback + (feedbackCV[i] / 5)));

                    const modulatedMix = Math.max(0, Math.min(1, mix + (mixCV[i] / 5)));

                    // Convert time to samples (minimum 1 sample delay)
                    const delaySamples = Math.max(1, modulatedTime * sampleRate * MAX_DELAY_TIME);

                    // Read from delay buffer with linear interpolation for smooth modulation
                    const delayedSample = readDelay(writeIndex - delaySamples);

                    // Input sample
                    const inputSample = audioIn[i];

                    // Output: mix dry input with wet delayed signal (unfiltered)
                    out[i] = softLimitVoltage(
                        inputSample * (1 - modulatedMix) + delayedSample * modulatedMix,
                        5
                    );

                    // Apply lowpass to feedback path only (darkens repeats, not first echo)
                    dampState = softLimitVoltage(dampState + dampCoeff * (delayedSample - dampState), 5);

                    // Write to delay buffer: input + damped feedback
                    delayBuffer[writeIndex] = softLimitVoltage(
                        inputSample + dampState * modulatedFeedback,
                        5
                    );

                    // Advance write position
                    writeIndex = (writeIndex + 1) % delayBufferSize;

                    // Track peak for LED
                    peakLevel = Math.max(peakLevel, Math.abs(out[i]));
                }

                // Update LED (normalized to 0-1)
                this.leds.active = Math.min(1, peakLevel / 5);
            },

            reset() {
                delayBuffer.fill(0);
                writeIndex = 0;
                dampState = 0;
                ownAudio.fill(0);
                ownTimeCV.fill(0);
                ownFeedbackCV.fill(0);
                ownMixCV.fill(0);
                out.fill(0);
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.5 },
            { id: 'feedback', label: 'Fdbk', param: 'feedback', min: 0, max: 1, default: 0.3 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
            { id: 'timeCV', label: 'Time', port: 'timeCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'feedbackCV', label: 'Fdbk', port: 'feedbackCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'mixCV', label: 'Mix', port: 'mixCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio' }
        ]
    }
};
