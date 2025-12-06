/**
 * VCA - Dual Linear VCA (SSM2164 architecture)
 *
 * Uses linear CV response per 2HP hardware specs.
 * CV input is capacitor-smoothed to prevent clicks/pops.
 * LED meters have smooth decay like real hardware.
 * 0V = silence, 5V = unity gain (linear relationship)
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'vca',
    name: 'VCA',
    hp: 4,
    color: '#4a4a8a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ch1Out = new Float32Array(bufferSize);
        const ch2Out = new Float32Array(bufferSize);
        const leds = { ch1: 0, ch2: 0 };

        const ownCh1In = new Float32Array(bufferSize);
        const ownCh2In = new Float32Array(bufferSize);

        const cvSlew = createSlew({ sampleRate, timeMs: 3 });
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        function linearResponse(cv) {
            return clamp(cv, 0, 5) / 5;
        }

        return {
            params: { ch1Gain: 1, ch2Gain: 1 },
            inputs: {
                ch1In: ownCh1In,
                ch2In: ownCh2In,
                ch2CV: new Float32Array(bufferSize).fill(5)  // Default to fully open
            },
            outputs: { ch1Out, ch2Out },
            leds,

            clearAudioInputs() {
                ownCh1In.fill(0);
                ownCh2In.fill(0);
                this.inputs.ch1In = ownCh1In;
                this.inputs.ch2In = ownCh2In;
            },

            process() {
                const g1 = clamp(this.params.ch1Gain);
                const g2 = clamp(this.params.ch2Gain);
                let pk1 = 0, pk2 = 0;

                const in1 = this.inputs.ch1In;
                const in2 = this.inputs.ch2In;

                for (let i = 0; i < bufferSize; i++) {
                    const cvVal = this.inputs.ch2CV[i];
                    const smoothedCV = cvSlew.process(cvVal);
                    const cvGain = linearResponse(smoothedCV);

                    const s1 = in1[i] * g1;
                    const s2 = in2[i] * g2 * cvGain;
                    ch1Out[i] = s1;
                    ch2Out[i] = s2;
                    pk1 = Math.max(pk1, Math.abs(s1));
                    pk2 = Math.max(pk2, Math.abs(s2));
                }

                leds.ch1 = Math.max(pk1 / 10, leds.ch1 * ledDecay);
                leds.ch2 = Math.max(pk2 / 10, leds.ch2 * ledDecay);

                if (this.inputs.ch1In !== ownCh1In) {
                    ownCh1In.fill(0);
                    this.inputs.ch1In = ownCh1In;
                }
                if (this.inputs.ch2In !== ownCh2In) {
                    ownCh2In.fill(0);
                    this.inputs.ch2In = ownCh2In;
                }
            },

            reset() {
                ch1Out.fill(0);
                ch2Out.fill(0);
                leds.ch1 = 0;
                leds.ch2 = 0;
            }
        };
    },

    ui: {
        leds: ['ch1', 'ch2'],
        knobs: [
            { id: 'ch1Gain', label: 'Ch1', param: 'ch1Gain', min: 0, max: 1, default: 0.8 },
            { id: 'ch2Gain', label: 'Ch2', param: 'ch2Gain', min: 0, max: 1, default: 0.8 }
        ],
        inputs: [
            { id: 'ch1In', label: 'In 1', port: 'ch1In', type: 'buffer' },
            { id: 'ch2In', label: 'In 2', port: 'ch2In', type: 'buffer' },
            { id: 'ch2CV', label: 'CV', port: 'ch2CV', type: 'cv' }
        ],
        outputs: [
            { id: 'ch1Out', label: 'Out1', port: 'ch1Out', type: 'buffer' },
            { id: 'ch2Out', label: 'Out2', port: 'ch2Out', type: 'buffer' }
        ]
    }
};
