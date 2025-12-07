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

// Maximum delay time in seconds
const MAX_DELAY_TIME = 1.0;

export default {
    id: 'dly',
    name: 'DLY',
    hp: 4,
    color: '#2d5a7b',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);

        // Delay buffer - sized for max delay time
        const delayBufferSize = Math.ceil(sampleRate * MAX_DELAY_TIME) + bufferSize;
        const delayBuffer = new Float32Array(delayBufferSize);
        let writeIndex = 0;

        // One-pole lowpass in feedback path (darkens repeats like analog/tape delay)
        let dampState = 0;
        const dampCoeff = 0.7; // Higher = brighter repeats, lower = darker

        return {
            params: {
                time: 0.5,      // 0-1 (maps to 0ms - 1000ms)
                feedback: 0.3,  // 0-1 (0 = no repeats, 1 = infinite)
                mix: 0.5        // 0-1 (0 = dry, 1 = wet)
            },

            inputs: {
                audio: new Float32Array(bufferSize),
                timeCV: new Float32Array(bufferSize),
                feedbackCV: new Float32Array(bufferSize),
                mixCV: new Float32Array(bufferSize)
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
                    // Time: 0-1 param + CV (±5V maps to ±0.5)
                    const modulatedTime = Math.max(0, Math.min(1, time + (timeCV[i] / 10)));

                    // Feedback: 0-1 param + CV (±5V maps to ±0.5)
                    const modulatedFeedback = Math.max(0, Math.min(0.99, feedback + (feedbackCV[i] / 10)));

                    // Mix: 0-1 param + CV (±5V maps to ±0.5)
                    const modulatedMix = Math.max(0, Math.min(1, mix + (mixCV[i] / 10)));

                    // Convert time to samples (minimum 1 sample delay)
                    const delaySamples = Math.max(1, modulatedTime * sampleRate * MAX_DELAY_TIME);

                    // Read from delay buffer with linear interpolation for smooth modulation
                    const readIndexFloat = writeIndex - delaySamples;
                    const readIndexFloor = Math.floor(readIndexFloat);
                    const frac = readIndexFloat - readIndexFloor;

                    let idx0 = readIndexFloor;
                    let idx1 = readIndexFloor + 1;
                    if (idx0 < 0) idx0 += delayBufferSize;
                    if (idx1 < 0) idx1 += delayBufferSize;
                    idx0 = idx0 % delayBufferSize;
                    idx1 = idx1 % delayBufferSize;

                    // Linear interpolation between samples
                    const delayedSample = delayBuffer[idx0] * (1 - frac) + delayBuffer[idx1] * frac;

                    // Input sample
                    const inputSample = audioIn[i];

                    // Output: mix dry input with wet delayed signal (unfiltered)
                    out[i] = inputSample * (1 - modulatedMix) + delayedSample * modulatedMix;

                    // Apply lowpass to feedback path only (darkens repeats, not first echo)
                    dampState = dampState + dampCoeff * (delayedSample - dampState);

                    // Write to delay buffer: input + damped feedback
                    delayBuffer[writeIndex] = inputSample + (dampState * modulatedFeedback);

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
            { id: 'audio', label: 'In', port: 'audio', type: 'audio' },
            { id: 'timeCV', label: 'Time', port: 'timeCV', type: 'cv' },
            { id: 'feedbackCV', label: 'Fdbk', port: 'feedbackCV', type: 'cv' },
            { id: 'mixCV', label: 'Mix', port: 'mixCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
