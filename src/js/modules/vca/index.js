/**
 * VCA - Dual DC-Coupled Linear VCA (SSM2164 architecture)
 *
 * Passes audio or control voltage and uses linear CV response per 2HP hardware specs.
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
    color: 'module-color-eleven',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ch1Out = new Float32Array(bufferSize);
        const ch2Out = new Float32Array(bufferSize);
        const leds = { ch1: 0, ch2: 0 };

        const ownCh1In = new Float32Array(bufferSize);
        const ownCh2In = new Float32Array(bufferSize);
        const ownCh1CV = new Float32Array(bufferSize).fill(5);
        const ownCh2CV = new Float32Array(bufferSize).fill(5);

        const cv1Slew = createSlew({ sampleRate, timeMs: 3 });
        const cv2Slew = createSlew({ sampleRate, timeMs: 3 });
        cv1Slew.reset(5);
        cv2Slew.reset(5);
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        function linearResponse(cv) {
            return clamp(cv, 0, 5) / 5;
        }

        return {
            params: { ch1Gain: 0.8, ch2Gain: 0.8 },
            inputs: {
                ch1In: ownCh1In,
                ch2In: ownCh2In,
                ch1CV: ownCh1CV,
                ch2CV: ownCh2CV
            },
            outputs: { ch1Out, ch2Out },
            leds,

            process() {
                const g1 = Number.isFinite(this.params.ch1Gain)
                    ? clamp(this.params.ch1Gain)
                    : 0.8;
                const g2 = Number.isFinite(this.params.ch2Gain)
                    ? clamp(this.params.ch2Gain)
                    : 0.8;
                let pk1 = 0, pk2 = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const cv1Val = Number.isFinite(ownCh1CV[i]) ? ownCh1CV[i] : 5;
                    const cv2Val = Number.isFinite(ownCh2CV[i]) ? ownCh2CV[i] : 5;
                    const smoothedCV1 = cv1Slew.process(cv1Val);
                    const smoothedCV2 = cv2Slew.process(cv2Val);
                    const cv1Gain = linearResponse(smoothedCV1);
                    const cv2Gain = linearResponse(smoothedCV2);

                    const input1 = Number.isFinite(ownCh1In[i]) ? ownCh1In[i] : 0;
                    const input2 = Number.isFinite(ownCh2In[i]) ? ownCh2In[i] : 0;
                    const s1 = input1 * g1 * cv1Gain;
                    const s2 = input2 * g2 * cv2Gain;
                    ch1Out[i] = s1;
                    ch2Out[i] = s2;
                    pk1 = Math.max(pk1, Math.abs(s1));
                    pk2 = Math.max(pk2, Math.abs(s2));
                }

                leds.ch1 = clamp(Math.max(pk1 / 10, leds.ch1 * ledDecay));
                leds.ch2 = clamp(Math.max(pk2 / 10, leds.ch2 * ledDecay));
            },

            reset() {
                ownCh1In.fill(0);
                ownCh2In.fill(0);
                ownCh1CV.fill(5);
                ownCh2CV.fill(5);
                ch1Out.fill(0);
                ch2Out.fill(0);
                cv1Slew.reset(5);
                cv2Slew.reset(5);
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
            { id: 'ch1In', label: 'In 1', port: 'ch1In', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'ch1CV', label: 'CV 1', port: 'ch1CV', signal: 'cv', voltage: { min: 0, max: 5, normal: 5 } },
            { id: 'ch2In', label: 'In 2', port: 'ch2In', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'ch2CV', label: 'CV 2', port: 'ch2CV', signal: 'cv', voltage: { min: 0, max: 5, normal: 5 } }
        ],
        outputs: [
            { id: 'ch1Out', label: 'Out1', port: 'ch1Out', signal: 'any', voltage: { min: -10, max: 10 } },
            { id: 'ch2Out', label: 'Out2', port: 'ch2Out', signal: 'any', voltage: { min: -10, max: 10 } }
        ]
    }
};
