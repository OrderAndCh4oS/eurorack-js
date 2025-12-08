/**
 * CMP2 - Dual Window Comparator
 *
 * Based on Joranalogue Audio Design Compare 2
 * https://joranalogue.com/products/compare-2
 *
 * Two independent window comparators that check if input voltage
 * falls between two thresholds (the "window"). Includes logic section
 * combining both comparators' outputs.
 *
 * Features:
 * - Two window comparators with Shift and Size controls
 * - Complementary gate outputs (Out and Not)
 * - Logic outputs: AND, OR, XOR, Flip-Flop (FF toggles on XOR rising edge)
 * - 10V gate outputs (system standard)
 * - Normalization from left to right section
 * - Multi-color LEDs: blue=below, white=inside, red=above, off=negative window
 * - Negative window size via CV (window never triggers)
 */

export default {
    id: 'cmp2',
    name: 'CMP2',
    hp: 8,
    color: '#4a3a6a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Flip-flop state - toggles on XOR rising edge per manual
        let ffState = 0;
        let lastXor = 0;

        // Own input buffers
        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const ownShiftCV1 = new Float32Array(bufferSize);
        const ownSizeCV1 = new Float32Array(bufferSize);
        const ownShiftCV2 = new Float32Array(bufferSize);
        const ownSizeCV2 = new Float32Array(bufferSize);

        return {
            params: {
                shift1: 0,    // -5 to +5V window center
                size1: 5,     // 0 to 10V window width
                shift2: 0,
                size2: 5
            },

            inputs: {
                in1: ownIn1,
                in2: ownIn2,
                shiftCV1: ownShiftCV1,
                sizeCV1: ownSizeCV1,
                shiftCV2: ownShiftCV2,
                sizeCV2: ownSizeCV2
            },

            outputs: {
                out1: new Float32Array(bufferSize),
                not1: new Float32Array(bufferSize),
                out2: new Float32Array(bufferSize),
                not2: new Float32Array(bufferSize),
                and: new Float32Array(bufferSize),
                or: new Float32Array(bufferSize),
                xor: new Float32Array(bufferSize),
                ff: new Float32Array(bufferSize)
            },

            leds: {
                state1: 0.5,
                state2: 0.5,
                and: 0,
                or: 0,
                xor: 0,
                ff: 0
            },

            process() {
                const { shift1, size1, shift2, size2 } = this.params;
                const { in1, in2, shiftCV1, sizeCV1, shiftCV2, sizeCV2 } = this.inputs;
                const { out1, not1, out2, not2, and, or, xor, ff } = this.outputs;

                // Check if in2 has any non-zero values (indicates it's being used)
                let in2HasSignal = false;
                for (let i = 0; i < bufferSize; i++) {
                    if (in2[i] !== 0) {
                        in2HasSignal = true;
                        break;
                    }
                }

                for (let i = 0; i < bufferSize; i++) {
                    // Get input values with normalization
                    const input1 = in1[i];
                    // in2 normalized from in1 if in2 has no signal
                    const input2 = in2HasSignal ? in2[i] : input1;

                    // Calculate effective shift and size with CV
                    // Shift CV normalized from left to right
                    const effShift1 = shift1 + (shiftCV1[i] || 0);
                    // Size can go negative via CV - negative window never triggers
                    const effSize1 = size1 + (sizeCV1[i] || 0);

                    const effShift2 = shift2 + (shiftCV2[i] || shiftCV1[i] || 0);
                    const effSize2 = size2 + (sizeCV2[i] || sizeCV1[i] || 0);

                    // Comparator 1
                    const halfSize1 = effSize1 / 2;
                    const lower1 = effShift1 - halfSize1;
                    const upper1 = effShift1 + halfSize1;
                    // Negative or zero size means window never triggers
                    // For positive size: inside when input >= lower AND input <= upper
                    const inside1 = effSize1 > 0 && input1 >= lower1 && input1 <= upper1;

                    out1[i] = inside1 ? 10 : 0;
                    not1[i] = inside1 ? 0 : 10;

                    // Comparator 2
                    const halfSize2 = effSize2 / 2;
                    const lower2 = effShift2 - halfSize2;
                    const upper2 = effShift2 + halfSize2;
                    // Negative or zero size means window never triggers
                    const inside2 = effSize2 > 0 && input2 >= lower2 && input2 <= upper2;

                    out2[i] = inside2 ? 10 : 0;
                    not2[i] = inside2 ? 0 : 10;

                    // Logic section
                    and[i] = (inside1 && inside2) ? 10 : 0;
                    or[i] = (inside1 || inside2) ? 10 : 0;
                    xor[i] = (inside1 !== inside2) ? 10 : 0;

                    // Flip-flop: toggle on rising edge of XOR (per manual)
                    const currentXor = xor[i];
                    if (currentXor > 0 && lastXor === 0) {
                        ffState = ffState === 0 ? 10 : 0;
                    }
                    lastXor = currentXor;
                    ff[i] = ffState;
                }

                // Update LEDs with final sample state
                const finalIn1 = in1[bufferSize - 1];
                // Use in2HasSignal (computed at start of process) for correct normalization
                const finalIn2 = in2HasSignal ? in2[bufferSize - 1] : finalIn1;

                const effShift1Led = shift1 + (shiftCV1[bufferSize - 1] || 0);
                const effSize1Led = size1 + (sizeCV1[bufferSize - 1] || 0);
                const lower1Led = effShift1Led - effSize1Led / 2;
                const upper1Led = effShift1Led + effSize1Led / 2;

                // LED values: 0 = below (blue), 0.5 = inside (white), 1 = above (red)
                // Special case: -1 = off (negative window and signal in that range)
                if (effSize1Led <= 0) {
                    // Negative or zero window - check if signal would be in "negative window"
                    // For negative size, lower > upper, so "inside" means input > upper && input < lower
                    if (finalIn1 > upper1Led && finalIn1 < lower1Led) {
                        this.leds.state1 = -1; // Off - in negative window
                    } else if (finalIn1 <= upper1Led) {
                        this.leds.state1 = 0; // Below
                    } else {
                        this.leds.state1 = 1; // Above
                    }
                } else if (finalIn1 < lower1Led) {
                    this.leds.state1 = 0; // Below (blue)
                } else if (finalIn1 > upper1Led) {
                    this.leds.state1 = 1; // Above (red)
                } else {
                    this.leds.state1 = 0.5; // Inside (white)
                }

                const effShift2Led = shift2 + (shiftCV2[bufferSize - 1] || shiftCV1[bufferSize - 1] || 0);
                const effSize2Led = size2 + (sizeCV2[bufferSize - 1] || sizeCV1[bufferSize - 1] || 0);
                const lower2Led = effShift2Led - effSize2Led / 2;
                const upper2Led = effShift2Led + effSize2Led / 2;

                if (effSize2Led <= 0) {
                    // Negative or zero window
                    if (finalIn2 > upper2Led && finalIn2 < lower2Led) {
                        this.leds.state2 = -1; // Off - in negative window
                    } else if (finalIn2 <= upper2Led) {
                        this.leds.state2 = 0; // Below
                    } else {
                        this.leds.state2 = 1; // Above
                    }
                } else if (finalIn2 < lower2Led) {
                    this.leds.state2 = 0; // Below (blue)
                } else if (finalIn2 > upper2Led) {
                    this.leds.state2 = 1; // Above (red)
                } else {
                    this.leds.state2 = 0.5; // Inside (white)
                }

                this.leds.and = and[bufferSize - 1] > 0 ? 1 : 0;
                this.leds.or = or[bufferSize - 1] > 0 ? 1 : 0;
                this.leds.xor = xor[bufferSize - 1] > 0 ? 1 : 0;
                this.leds.ff = ff[bufferSize - 1] > 0 ? 1 : 0;

                // Reset own inputs if replaced by routing
                if (this.inputs.in1 !== ownIn1) {
                    ownIn1.fill(0);
                    this.inputs.in1 = ownIn1;
                }
                if (this.inputs.in2 !== ownIn2) {
                    ownIn2.fill(0);
                    this.inputs.in2 = ownIn2;
                }
                if (this.inputs.shiftCV1 !== ownShiftCV1) {
                    ownShiftCV1.fill(0);
                    this.inputs.shiftCV1 = ownShiftCV1;
                }
                if (this.inputs.sizeCV1 !== ownSizeCV1) {
                    ownSizeCV1.fill(0);
                    this.inputs.sizeCV1 = ownSizeCV1;
                }
                if (this.inputs.shiftCV2 !== ownShiftCV2) {
                    ownShiftCV2.fill(0);
                    this.inputs.shiftCV2 = ownShiftCV2;
                }
                if (this.inputs.sizeCV2 !== ownSizeCV2) {
                    ownSizeCV2.fill(0);
                    this.inputs.sizeCV2 = ownSizeCV2;
                }
            },

            reset() {
                ffState = 0;
                lastXor = 0;

                this.outputs.out1.fill(0);
                this.outputs.not1.fill(0);
                this.outputs.out2.fill(0);
                this.outputs.not2.fill(0);
                this.outputs.and.fill(0);
                this.outputs.or.fill(0);
                this.outputs.xor.fill(0);
                this.outputs.ff.fill(0);

                this.leds.state1 = 0.5;
                this.leds.state2 = 0.5;
                this.leds.and = 0;
                this.leds.or = 0;
                this.leds.xor = 0;
                this.leds.ff = 0;
            }
        };
    },

    ui: {
        leds: ['state1', 'state2', 'and', 'or', 'xor', 'ff'],
        knobs: [
            { id: 'shift1', label: 'Shift', param: 'shift1', min: -5, max: 5, default: 0 },
            { id: 'size1', label: 'Size', param: 'size1', min: 0, max: 10, default: 5 },
            { id: 'shift2', label: 'Shift', param: 'shift2', min: -5, max: 5, default: 0 },
            { id: 'size2', label: 'Size', param: 'size2', min: 0, max: 10, default: 5 }
        ],
        switches: [],
        inputs: [
            { id: 'in1', label: 'In', port: 'in1', type: 'cv' },
            { id: 'shiftCV1', label: 'Sh', port: 'shiftCV1', type: 'cv' },
            { id: 'sizeCV1', label: 'Sz', port: 'sizeCV1', type: 'cv' },
            { id: 'in2', label: 'In', port: 'in2', type: 'cv' },
            { id: 'shiftCV2', label: 'Sh', port: 'shiftCV2', type: 'cv' },
            { id: 'sizeCV2', label: 'Sz', port: 'sizeCV2', type: 'cv' }
        ],
        outputs: [
            { id: 'out1', label: 'Out', port: 'out1', type: 'gate' },
            { id: 'not1', label: 'Not', port: 'not1', type: 'gate' },
            { id: 'out2', label: 'Out', port: 'out2', type: 'gate' },
            { id: 'not2', label: 'Not', port: 'not2', type: 'gate' },
            { id: 'and', label: 'AND', port: 'and', type: 'gate' },
            { id: 'or', label: 'OR', port: 'or', type: 'gate' },
            { id: 'xor', label: 'XOR', port: 'xor', type: 'gate' },
            { id: 'ff', label: 'FF', port: 'ff', type: 'gate' }
        ]
    }
};
