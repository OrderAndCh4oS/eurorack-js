/**
 * MIX - 4 Channel DC-Coupled Mixer
 *
 * Based on 2hp Mix module specifications.
 * - 4 inputs with individual level controls
 * - 1 summed output
 * - DC coupled for audio or CV signals
 * - Low noise floor
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

export default {
    id: 'mix',
    name: 'MIX',
    hp: 4,
    color: 'module-color-one',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { level: 0 };

        // Own input buffers for audio silence pattern
        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const ownIn3 = new Float32Array(bufferSize);
        const ownIn4 = new Float32Array(bufferSize);
        const levelSlews = [
            createSlew({ sampleRate, timeMs: 5 }),
            createSlew({ sampleRate, timeMs: 5 }),
            createSlew({ sampleRate, timeMs: 5 }),
            createSlew({ sampleRate, timeMs: 5 })
        ];
        let levelsInitialized = false;

        // LED decay coefficient (~100ms decay)
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        return {
            params: {
                lvl1: 0.8,
                lvl2: 0.8,
                lvl3: 0.8,
                lvl4: 0.8
            },
            inputs: {
                in1: ownIn1,
                in2: ownIn2,
                in3: ownIn3,
                in4: ownIn4
            },
            outputs: { out },
            leds,

            process() {
                const levels = [
                    Number.isFinite(this.params.lvl1) ? clamp(this.params.lvl1, 0, 1) : 0.8,
                    Number.isFinite(this.params.lvl2) ? clamp(this.params.lvl2, 0, 1) : 0.8,
                    Number.isFinite(this.params.lvl3) ? clamp(this.params.lvl3, 0, 1) : 0.8,
                    Number.isFinite(this.params.lvl4) ? clamp(this.params.lvl4, 0, 1) : 0.8
                ];
                if (!levelsInitialized) {
                    for (let channel = 0; channel < levelSlews.length; channel++) {
                        levelSlews[channel].reset(levels[channel]);
                    }
                    levelsInitialized = true;
                }

                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const l1 = levelSlews[0].process(levels[0]);
                    const l2 = levelSlews[1].process(levels[1]);
                    const l3 = levelSlews[2].process(levels[2]);
                    const l4 = levelSlews[3].process(levels[3]);
                    const sum =
                        (Number.isFinite(ownIn1[i]) ? ownIn1[i] : 0) * l1 +
                        (Number.isFinite(ownIn2[i]) ? ownIn2[i] : 0) * l2 +
                        (Number.isFinite(ownIn3[i]) ? ownIn3[i] : 0) * l3 +
                        (Number.isFinite(ownIn4[i]) ? ownIn4[i] : 0) * l4;

                    out[i] = softLimitVoltage(sum, 10);
                    peak = Math.max(peak, Math.abs(out[i]));
                }

                // Update LED with peak and decay
                leds.level = clamp(Math.max(peak / 10, leds.level * ledDecay));
            },

            reset() {
                ownIn1.fill(0);
                ownIn2.fill(0);
                ownIn3.fill(0);
                ownIn4.fill(0);
                out.fill(0);
                levelSlews.forEach(levelSlew => levelSlew.reset(0));
                levelsInitialized = false;
                leds.level = 0;
            }
        };
    },

    ui: {
        leds: ['level'],
        knobs: [
            { id: 'lvl1', label: '1', param: 'lvl1', min: 0, max: 1, default: 0.8 },
            { id: 'lvl2', label: '2', param: 'lvl2', min: 0, max: 1, default: 0.8 },
            { id: 'lvl3', label: '3', param: 'lvl3', min: 0, max: 1, default: 0.8 },
            { id: 'lvl4', label: '4', param: 'lvl4', min: 0, max: 1, default: 0.8 }
        ],
        inputs: [
            { id: 'in1', label: '1', port: 'in1', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in2', label: '2', port: 'in2', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in3', label: '3', port: 'in3', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in4', label: '4', port: 'in4', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'any', voltage: { min: -10, max: 10 } }
        ]
    }
};
