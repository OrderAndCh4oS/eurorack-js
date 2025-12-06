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
    color: '#5a5a5a',
    category: 'source',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const noiseOut = new Float32Array(bufferSize);

        // Downsample state
        let heldSample = 0;
        let sampleCounter = 0;

        // VCA envelope state
        let vcaLevel = 0;
        let lastTrigger = 0;
        const attackTime = Math.floor(0.001 * sampleRate);
        let envelopePhase = 0;
        let envelopeSamples = 0;
        let currentDecayTime = 0;

        function rateToDownsample(rate) {
            const r = clamp(rate, 0, 1);
            return Math.floor(1 + (1 - r) * (1 - r) * 500);
        }

        function rateToDecay(rate) {
            const minDecay = 0.01 * sampleRate;
            const maxDecay = 0.5 * sampleRate;
            return Math.floor(minDecay + clamp(rate, 0, 1) * (maxDecay - minDecay));
        }

        return {
            params: {
                rate: 0.5,
                vcaMode: 0
            },

            inputs: {
                trigger: new Float32Array(bufferSize)
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
                const downsampleFactor = vcaEnabled ? 1 : rateToDownsample(this.params.rate);

                for (let i = 0; i < bufferSize; i++) {
                    sampleCounter++;
                    if (sampleCounter >= downsampleFactor) {
                        heldSample = (Math.random() * 2 - 1) * 5;
                        sampleCounter = 0;
                    }

                    if (vcaEnabled) {
                        const trig = triggerIn[i];
                        const trigEdge = trig >= 1 && lastTrigger < 1;
                        lastTrigger = trig;

                        if (trigEdge) {
                            envelopePhase = 1;
                            envelopeSamples = 0;
                            currentDecayTime = rateToDecay(this.params.rate);
                        }

                        if (envelopePhase === 1) {
                            vcaLevel = envelopeSamples / attackTime;
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
                lastTrigger = 0;
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
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' }
        ],
        outputs: [
            { id: 'noise', label: 'Out', port: 'noise', type: 'buffer' }
        ]
    }
};
