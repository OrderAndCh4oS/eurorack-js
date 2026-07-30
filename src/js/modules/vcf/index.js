/**
 * VCF - Moog-style Transistor Ladder Filter
 *
 * 24dB/octave low-pass filter with resonance (self-oscillates)
 * Based on the classic transistor ladder topology
 */

import { clamp } from '../../utils/math.js';
import { softLimitVoltage } from '../../utils/voltage.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'vcf',
    name: 'VCF',
    hp: 4,
    color: 'module-color-three',
    category: 'filter',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const lpf = new Float32Array(bufferSize);
        const bpf = new Float32Array(bufferSize);
        const hpf = new Float32Array(bufferSize);

        const ownAudio = new Float32Array(bufferSize);
        const ownCutoffCV = new Float32Array(bufferSize);
        const ownResCV = new Float32Array(bufferSize);

        let stage = [0, 0, 0, 0];
        let delay = [0, 0, 0, 0];

        const cutoffSlew = createSlew({ sampleRate, timeMs: 2 });
        let selfOscillationSeeded = false;

        return {
            params: { cutoff: 0.5, resonance: 0.3 },
            inputs: {
                audio: ownAudio,
                cutoffCV: ownCutoffCV,
                resCV: ownResCV
            },
            outputs: { lpf, bpf, hpf },
            leds: { cutoff: 0 },

            process() {
                const audioIn = this.inputs.audio;
                const cutoffCV = this.inputs.cutoffCV;
                const resCV = this.inputs.resCV;

                const cutoffKnob = clamp(this.params.cutoff);
                const cutoffHz = 20 * Math.pow(1000, cutoffKnob);
                const baseRes = this.params.resonance;

                for (let i = 0; i < bufferSize; i++) {
                    // Per-sample CV tracking for audio-rate filter modulation
                    const cvModVal = cutoffCV[i] || 0;
                    const cvMod = clamp(cvModVal, 0, 5) / 5;
                    const modulatedHz = cutoffHz * Math.pow(4, cvMod);

                    const resCVVal = resCV[i] || 0;
                    const res = clamp(baseRes + resCVVal / 10, 0, 1.1);
                    const k = res * 4;

                    const cutoffSmooth = cutoffSlew.process(modulatedHz);

                    const fc = clamp(cutoffSmooth / sampleRate, 0.0001, 0.45);
                    const g = Math.tan(Math.PI * fc);
                    const G = g / (1 + g);

                    // Resonance gain compensation - boost input to maintain level at high resonance
                    const compensation = 1 + k * 0.5;
                    let input = (audioIn[i] / 5) * compensation;
                    if (res >= 0.98 && !selfOscillationSeeded) {
                        input += 1e-9;
                        selfOscillationSeeded = true;
                    } else if (res < 0.9) {
                        selfOscillationSeeded = false;
                    }
                    const feedback = delay[3];

                    const clipFeedback = Math.tanh(feedback * k);
                    const u = input - clipFeedback;

                    for (let p = 0; p < 4; p++) {
                        const prevStage = p === 0 ? u : stage[p - 1];
                        const v = G * (prevStage - delay[p]);
                        stage[p] = v + delay[p];
                        delay[p] = stage[p] + v;
                    }

                    lpf[i] = softLimitVoltage(stage[3] * 5, 5);
                    bpf[i] = softLimitVoltage((stage[1] - stage[3]) * 5, 5);
                    hpf[i] = softLimitVoltage((u - stage[1]) * 5, 5);
                }

                this.leds.cutoff = cutoffKnob;
            },

            reset() {
                stage = [0, 0, 0, 0];
                delay = [0, 0, 0, 0];
                cutoffSlew.reset(0);
                selfOscillationSeeded = false;
                ownAudio.fill(0);
                ownCutoffCV.fill(0);
                ownResCV.fill(0);
                lpf.fill(0);
                bpf.fill(0);
                hpf.fill(0);
                this.leds.cutoff = 0;
            }
        };
    },

    ui: {
        leds: ['cutoff'],
        knobs: [
            { id: 'cutoff', label: 'Freq', param: 'cutoff', min: 0, max: 1, default: 0.5 },
            { id: 'resonance', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0.3 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
            { id: 'cutoffCV', label: 'Freq', port: 'cutoffCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'resCV', label: 'Res', port: 'resCV', signal: 'cv', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'lpf', label: 'LP', port: 'lpf', signal: 'audio' },
            { id: 'bpf', label: 'BP', port: 'bpf', signal: 'audio' },
            { id: 'hpf', label: 'HP', port: 'hpf', signal: 'audio' }
        ]
    }
};
