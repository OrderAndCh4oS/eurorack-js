import { clamp } from '../utils/math.js';

/**
 * 2HP Nse – Noise Generator with Downsample Control
 *
 * Based on the 2hp Nse module specifications:
 * - White noise generator
 * - Adjustable sample rate (downsample for aliased/lo-fi noise)
 * - VCA mode: enveloped noise bursts on trigger
 *   - In VCA mode, rate knob controls decay length (per 2hp spec)
 * - Output: ±5V (Eurorack standard)
 *
 * Normal mode:
 *   rate: 1 = full white noise, 0 = heavily downsampled rumble
 *
 * VCA mode:
 *   rate: controls decay time (10ms to 500ms) for percussion sounds
 *
 * Params:
 *   rate: 0-1 (downsample in normal mode, decay in VCA mode)
 *   vcaMode: 0/1 (VCA mode toggle)
 *
 * Inputs:
 *   trigger: 0-10V (VCA mode trigger, ≥1V threshold)
 *
 * Outputs:
 *   noise: ±5V white noise
 *
 * Source: https://www.twohp.com/modules/nse
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} Nse module
 */
export function createNse({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const noiseOut = new Float32Array(bufferSize);

    // Downsample state
    let heldSample = 0;
    let sampleCounter = 0;

    // VCA envelope state
    let vcaLevel = 0;
    let lastTrigger = 0;
    const attackTime = Math.floor(0.001 * sampleRate);  // 1ms attack (snappy)
    let envelopePhase = 0; // 0=idle, 1=attack, 2=decay
    let envelopeSamples = 0;
    let currentDecayTime = 0;

    /**
     * Map rate knob to downsample factor (normal mode)
     * 1 = full rate (white noise), 0 = heavy downsample (rumble)
     */
    function rateToDownsample(rate) {
        // Exponential mapping for more useful range
        // rate=1: factor=1 (no downsample)
        // rate=0: factor=500 (heavy downsample, ~88Hz at 44100)
        const r = clamp(rate, 0, 1);
        return Math.floor(1 + (1 - r) * (1 - r) * 500);
    }

    /**
     * Map rate knob to decay time (VCA mode)
     * Per 2hp spec: rate knob controls decay length in VCA mode
     * 0 = short decay (10ms, hi-hats), 1 = long decay (500ms, snares)
     */
    function rateToDecay(rate) {
        // 10ms to 500ms range
        const minDecay = 0.01 * sampleRate;   // 10ms
        const maxDecay = 0.5 * sampleRate;    // 500ms
        return Math.floor(minDecay + clamp(rate, 0, 1) * (maxDecay - minDecay));
    }

    return {
        params: {
            rate: 0.5,      // Rate knob (downsample or decay depending on mode)
            vcaMode: 0      // VCA mode (0 = continuous, 1 = triggered bursts)
        },

        inputs: {
            trigger: new Float32Array(bufferSize)  // Trigger input for VCA mode
        },

        outputs: {
            noise: noiseOut
        },

        leds: {
            active: 0
        },

        process() {
            const vcaEnabled = this.params.vcaMode === 1;
            const triggerIn = this.inputs.trigger;

            // In VCA mode, rate controls decay; otherwise controls downsample
            const downsampleFactor = vcaEnabled ? 1 : rateToDownsample(this.params.rate);

            for (let i = 0; i < bufferSize; i++) {
                // Generate white noise with optional downsample
                sampleCounter++;
                if (sampleCounter >= downsampleFactor) {
                    heldSample = (Math.random() * 2 - 1) * 5; // ±5V
                    sampleCounter = 0;
                }

                // VCA mode envelope
                if (vcaEnabled) {
                    const trig = triggerIn[i];
                    const trigEdge = trig >= 1 && lastTrigger < 1;
                    lastTrigger = trig;

                    if (trigEdge) {
                        envelopePhase = 1; // Start attack
                        envelopeSamples = 0;
                        // Capture decay time at trigger (rate knob controls decay)
                        currentDecayTime = rateToDecay(this.params.rate);
                    }

                    if (envelopePhase === 1) {
                        // Attack phase (very fast, 1ms)
                        vcaLevel = envelopeSamples / attackTime;
                        envelopeSamples++;
                        if (envelopeSamples >= attackTime) {
                            envelopePhase = 2;
                            envelopeSamples = 0;
                        }
                    } else if (envelopePhase === 2) {
                        // Decay phase (controlled by rate knob)
                        vcaLevel = 1 - (envelopeSamples / currentDecayTime);
                        envelopeSamples++;
                        if (envelopeSamples >= currentDecayTime) {
                            envelopePhase = 0;
                            vcaLevel = 0;
                        }
                    }

                    noiseOut[i] = heldSample * clamp(vcaLevel, 0, 1);
                } else {
                    // Continuous mode - just output downsampled noise
                    noiseOut[i] = heldSample;
                }
            }

            // LED shows output level
            this.leds.active = vcaEnabled ? vcaLevel : 1;
        },

        reset() {
            heldSample = 0;
            sampleCounter = 0;
            vcaLevel = 0;
            envelopePhase = 0;
            envelopeSamples = 0;
            currentDecayTime = 0;
            lastTrigger = 0;
            this.leds.active = 0;
        }
    };
}
