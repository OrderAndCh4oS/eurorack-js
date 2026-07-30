/**
 * NSE - Noise Generator with Downsample Control
 *
 * Based on the 2hp Nse module specifications:
 * - White noise generator
 * - Adjustable sample rate (downsample for aliased/lo-fi noise)
 * - VCA mode: enveloped noise bursts on trigger
 *   - In VCA mode, rate knob controls decay length
 * - Output: ±5V (Eurorack standard)
 *
 * Source: https://www.twohp.com/modules/nse
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'nse',
    name: 'NSE',
    hp: 2,
    color: 'module-color-one',
    category: 'source',

    createDSP({ sampleRate = 44100, bufferSize = 512, random = Math.random } = {}) {
        const triggerInput = new Float32Array(bufferSize);
        const noiseOut = new Float32Array(bufferSize);
        const rng = typeof random === 'function' ? random : Math.random;

        // Downsample state
        let heldSample = 0;
        let sampleCounter = 0;

        // VCA envelope state
        let vcaLevel = 0;
        let attackStartLevel = 0;
        let lastTrigger = 0;
        const attackTime = Math.max(1, Math.round(0.001 * sampleRate));
        let envelopePhase = 0;
        let envelopeSamples = 0;
        let currentDecayTime = 0;
        let wasVcaEnabled = false;

        function nextNoiseSample() {
            const value = rng();
            const unit = Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
            return (unit * 2 - 1) * 5;
        }

        function rateToDownsample(rate) {
            const r = Number.isFinite(rate) ? clamp(rate, 0, 1) : 1;
            const maxHoldSamples = sampleRate * (501 / 44100);
            return Math.max(1, Math.round(
                1 + (1 - r) * (1 - r) * (maxHoldSamples - 1)
            ));
        }

        function rateToDecay(rate) {
            const minDecay = 0.01 * sampleRate;
            const maxDecay = 0.5 * sampleRate;
            const normalized = Number.isFinite(rate) ? clamp(rate, 0, 1) : 1;
            return Math.max(1, Math.round(
                minDecay + normalized * (maxDecay - minDecay)
            ));
        }

        return {
            params: {
                rate: 1,
                vcaMode: 0
            },

            inputs: {
                trigger: triggerInput
            },

            outputs: {
                noise: noiseOut
            },

            leds: {
                active: 0
            },

            process() {
                const vcaEnabled = this.params.vcaMode === 1;
                const rate = Number.isFinite(this.params.rate)
                    ? clamp(this.params.rate, 0, 1)
                    : 1;
                const downsampleFactor = vcaEnabled ? 1 : rateToDownsample(rate);

                if (!vcaEnabled && wasVcaEnabled) {
                    vcaLevel = 0;
                    attackStartLevel = 0;
                    envelopePhase = 0;
                    envelopeSamples = 0;
                    currentDecayTime = 0;
                }
                wasVcaEnabled = vcaEnabled;

                for (let i = 0; i < bufferSize; i++) {
                    sampleCounter++;
                    if (sampleCounter >= downsampleFactor) {
                        heldSample = nextNoiseSample();
                        sampleCounter = 0;
                    }

                    const trig = Number.isFinite(triggerInput[i]) ? triggerInput[i] : 0;
                    const trigEdge = trig >= 1 && lastTrigger < 1;
                    lastTrigger = trig;

                    if (vcaEnabled) {
                        if (trigEdge) {
                            attackStartLevel = vcaLevel;
                            envelopePhase = 1;
                            envelopeSamples = 0;
                            currentDecayTime = rateToDecay(rate);
                        }

                        if (envelopePhase === 1) {
                            const progress = envelopeSamples / attackTime;
                            vcaLevel = attackStartLevel +
                                (1 - attackStartLevel) * progress;
                            envelopeSamples++;
                            if (envelopeSamples >= attackTime) {
                                envelopePhase = 2;
                                envelopeSamples = 0;
                            }
                        } else if (envelopePhase === 2) {
                            vcaLevel = 1 - (envelopeSamples / currentDecayTime);
                            envelopeSamples++;
                            if (envelopeSamples >= currentDecayTime) {
                                envelopePhase = 0;
                                vcaLevel = 0;
                            }
                        }

                        noiseOut[i] = heldSample * clamp(vcaLevel, 0, 1);
                    } else {
                        noiseOut[i] = heldSample;
                    }
                }

                this.leds.active = vcaEnabled ? vcaLevel : 1;
            },

            reset() {
                heldSample = 0;
                sampleCounter = 0;
                vcaLevel = 0;
                envelopePhase = 0;
                envelopeSamples = 0;
                currentDecayTime = 0;
                attackStartLevel = 0;
                lastTrigger = 0;
                wasVcaEnabled = false;
                triggerInput.fill(0);
                noiseOut.fill(0);
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 1 }
        ],
        switches: [
            { id: 'vcaMode', label: 'VCA', param: 'vcaMode', default: 0 }
        ],
        inputs: [
            { id: 'trigger', label: 'Trig', port: 'trigger', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'noise', label: 'Out', port: 'noise', signal: 'audio', voltage: { min: -5, max: 5 } }
        ]
    }
};
