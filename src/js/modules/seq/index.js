/**
 * SEQ - 8 Step Analog Sequencer
 *
 * Based on Doepfer A-155-2 specifications.
 * A compact 8-step CV/Gate sequencer with per-step controls.
 *
 * Features:
 * - 8 step CV knobs (0-1V / 0-2V / 0-4V range selectable)
 * - Per-step gate on/off buttons
 * - 8 direction modes (up, down, 2x up, 2x down, pendulum1, 2x pendulum1, pendulum2, random)
 * - Adjustable sequence length (1-8 steps)
 * - Clock input (+3V threshold)
 * - Reset input (+3V threshold)
 * - CV output (unquantized, 0-1V / 0-2V / 0-4V)
 * - Gate output (0V / +10V)
 */

// Direction mode names
const DIRECTION_NAMES = ['up', 'down', '2xUp', '2xDown', 'pend1', '2xPend1', 'pend2', 'random'];

// CV range multipliers
const RANGE_MULTIPLIERS = [1, 2, 4]; // 1V, 2V, 4V

export default {
    id: 'seq',
    name: 'SEQ',
    hp: 6,
    color: '#4a6b8a',
    category: 'sequencer',

    css: `
        .seq-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 4px 2px;
            gap: 2px;
        }
        .seq-steps {
            display: flex;
            gap: 12px;
            flex: 1;
            justify-content: center;
        }
        .seq-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
        }
        .seq-step-row {
            display: flex;
            align-items: center;
            gap: 3px;
        }
        .seq-step-row .knob-container {
            flex-direction: row;
            align-items: center;
            gap: 3px;
        }
        .seq-step-row .knob-label {
            width: 8px;
            text-align: left;
        }
        .seq-controls {
            display: flex;
            justify-content: center;
            gap: 4px;
            padding: 2px 0 8px 0;
        }
        .seq-io {
            display: flex;
            justify-content: space-around;
            padding: 2px 0;
        }
        .seq-io-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
        }
        .seq-io-label {
            font-size: 6px;
            color: #888;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const cvOut = new Float32Array(bufferSize);
        const gateOut = new Float32Array(bufferSize);

        let currentStep = 0;
        let lastClockState = false;
        let lastResetState = false;
        let pendulumDirection = 1; // 1 = forward, -1 = backward

        return {
            params: {
                // Step CV values (0-1 normalized)
                step1: 0, step2: 0, step3: 0, step4: 0,
                step5: 0, step6: 0, step7: 0, step8: 0,
                // Step gates (0 = off, 1 = on)
                gate1: 1, gate2: 1, gate3: 1, gate4: 1,
                gate5: 1, gate6: 1, gate7: 1, gate8: 1,
                // Global params
                range: 1,      // 0=1V, 1=2V, 2=4V
                length: 8,     // 1-8 steps
                direction: 0   // 0-7 direction modes
            },

            inputs: {
                clock: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize)
            },

            outputs: {
                cv: cvOut,
                gate: gateOut
            },

            leds: {
                step1: 1, step2: 0, step3: 0, step4: 0,
                step5: 0, step6: 0, step7: 0, step8: 0
            },

            process() {
                const { range, length, direction } = this.params;
                const clockIn = this.inputs.clock;
                const resetIn = this.inputs.reset;

                const rangeMultiplier = RANGE_MULTIPLIERS[Math.floor(range)] || 2;
                const seqLength = Math.max(1, Math.min(8, Math.floor(length)));

                // Get step values array
                const stepValues = [
                    this.params.step1, this.params.step2, this.params.step3, this.params.step4,
                    this.params.step5, this.params.step6, this.params.step7, this.params.step8
                ];
                const gateValues = [
                    this.params.gate1, this.params.gate2, this.params.gate3, this.params.gate4,
                    this.params.gate5, this.params.gate6, this.params.gate7, this.params.gate8
                ];

                for (let i = 0; i < bufferSize; i++) {
                    // Check reset (>3V threshold)
                    const resetActive = resetIn[i] >= 3;
                    if (resetActive && !lastResetState) {
                        currentStep = 0;
                        pendulumDirection = 1;
                    }
                    lastResetState = resetActive;

                    // Check clock (>3V threshold)
                    const clockActive = clockIn[i] >= 3;
                    if (clockActive && !lastClockState) {
                        // Advance based on direction mode
                        this.advanceStep(seqLength, direction);
                    }
                    lastClockState = clockActive;

                    // Output current step CV and gate
                    // Gate is high while on a step with gate enabled (stays high for step duration)
                    const stepCV = stepValues[currentStep] || 0;
                    const stepGate = gateValues[currentStep] || 0;

                    cvOut[i] = stepCV * rangeMultiplier;
                    gateOut[i] = stepGate ? 10 : 0;
                }

                // Update LEDs
                for (let s = 1; s <= 8; s++) {
                    this.leds[`step${s}`] = (s - 1 === currentStep) ? 1 : 0;
                }
            },

            advanceStep(seqLength, direction) {
                const dir = Math.floor(direction) % 8;

                switch (dir) {
                    case 0: // up (forward)
                        currentStep = (currentStep + 1) % seqLength;
                        break;

                    case 1: // down (backward)
                        currentStep = (currentStep - 1 + seqLength) % seqLength;
                        break;

                    case 2: // 2x up (forward, each step twice)
                        currentStep = (currentStep + 1) % seqLength;
                        break;

                    case 3: // 2x down (backward, each step twice)
                        currentStep = (currentStep - 1 + seqLength) % seqLength;
                        break;

                    case 4: // pendulum1 (up then down, hitting ends once)
                        currentStep += pendulumDirection;
                        if (currentStep >= seqLength - 1) {
                            currentStep = seqLength - 1;
                            pendulumDirection = -1;
                        } else if (currentStep <= 0) {
                            currentStep = 0;
                            pendulumDirection = 1;
                        }
                        break;

                    case 5: // 2x pendulum1
                        currentStep += pendulumDirection;
                        if (currentStep >= seqLength - 1) {
                            currentStep = seqLength - 1;
                            pendulumDirection = -1;
                        } else if (currentStep <= 0) {
                            currentStep = 0;
                            pendulumDirection = 1;
                        }
                        break;

                    case 6: // pendulum2 (up then down, not hitting ends)
                        currentStep += pendulumDirection;
                        if (currentStep >= seqLength) {
                            currentStep = seqLength - 2;
                            pendulumDirection = -1;
                        } else if (currentStep < 0) {
                            currentStep = 1;
                            pendulumDirection = 1;
                        }
                        break;

                    case 7: // random
                        currentStep = Math.floor(Math.random() * seqLength);
                        break;

                    default:
                        currentStep = (currentStep + 1) % seqLength;
                }
            },

            reset() {
                currentStep = 0;
                lastClockState = false;
                lastResetState = false;
                pendulumDirection = 1;
                cvOut.fill(0);
                gateOut.fill(0);

                // Reset LEDs
                for (let s = 1; s <= 8; s++) {
                    this.leds[`step${s}`] = s === 1 ? 1 : 0;
                }
            },

            getCurrentStep() {
                return currentStep;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        const mainContainer = document.createElement('div');
        mainContainer.className = 'seq-container';

        // === Steps area: two columns (knobs | buttons) ===
        const stepsArea = document.createElement('div');
        stepsArea.className = 'seq-steps';

        // Left column: LEDs + Knobs (vertical)
        const knobColumn = document.createElement('div');
        knobColumn.className = 'seq-column';

        // Right column: Gate buttons (vertical)
        const btnColumn = document.createElement('div');
        btnColumn.className = 'seq-column';

        // Create 8 step rows
        for (let i = 1; i <= 8; i++) {
            // LED + Knob
            const stepRow = document.createElement('div');
            stepRow.className = 'seq-step-row';

            const led = toolkit.createLED({ id: `step${i}`, color: 'green' });
            stepRow.appendChild(led);

            const knob = toolkit.createKnob({
                id: `step${i}`,
                label: `${i}`,
                param: `step${i}`,
                value: 0,
                min: 0,
                max: 1,
                step: 0,
                small: true
            });
            stepRow.appendChild(knob);
            knobColumn.appendChild(stepRow);

            // Gate button
            const gateBtn = document.createElement('button');
            gateBtn.className = 'toggle-btn active';
            gateBtn.dataset.module = instance.id;
            gateBtn.dataset.param = `gate${i}`;
            gateBtn.title = `G${i}`;
            btnColumn.appendChild(gateBtn);
        }

        stepsArea.appendChild(knobColumn);
        stepsArea.appendChild(btnColumn);
        mainContainer.appendChild(stepsArea);

        // === Control knobs: Len, Rng, Dir ===
        const controls = document.createElement('div');
        controls.className = 'seq-controls';

        controls.appendChild(toolkit.createKnob({
            id: 'length',
            label: 'Len',
            param: 'length',
            value: 8,
            min: 1,
            max: 8,
            step: 1,
            small: true
        }));
        controls.appendChild(toolkit.createKnob({
            id: 'range',
            label: 'Rng',
            param: 'range',
            value: 1,
            min: 0,
            max: 2,
            step: 1,
            small: true
        }));
        controls.appendChild(toolkit.createKnob({
            id: 'direction',
            label: 'Dir',
            param: 'direction',
            value: 0,
            min: 0,
            max: 7,
            step: 1,
            small: true
        }));

        mainContainer.appendChild(controls);

        // === I/O: Inputs and Outputs ===
        const io = document.createElement('div');
        io.className = 'seq-io';

        // Inputs
        const inGroup = document.createElement('div');
        inGroup.className = 'seq-io-group';
        const inLabel = document.createElement('div');
        inLabel.className = 'seq-io-label';
        inLabel.textContent = 'IN';
        inGroup.appendChild(inLabel);
        inGroup.appendChild(toolkit.createJack({ id: 'clock', label: 'Clk', direction: 'input', type: 'trigger' }));
        inGroup.appendChild(toolkit.createJack({ id: 'reset', label: 'Rst', direction: 'input', type: 'trigger' }));
        io.appendChild(inGroup);

        // Outputs
        const outGroup = document.createElement('div');
        outGroup.className = 'seq-io-group';
        const outLabel = document.createElement('div');
        outLabel.className = 'seq-io-label';
        outLabel.textContent = 'OUT';
        outGroup.appendChild(outLabel);
        outGroup.appendChild(toolkit.createJack({ id: 'cv', label: 'CV', direction: 'output', type: 'cv' }));
        outGroup.appendChild(toolkit.createJack({ id: 'gate', label: 'Gate', direction: 'output', type: 'gate' }));
        io.appendChild(outGroup);

        mainContainer.appendChild(io);
        container.appendChild(mainContainer);
    },

    ui: {
        leds: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8'],
        knobs: [
            { id: 'step1', label: '1', param: 'step1', min: 0, max: 1, default: 0 },
            { id: 'step2', label: '2', param: 'step2', min: 0, max: 1, default: 0 },
            { id: 'step3', label: '3', param: 'step3', min: 0, max: 1, default: 0 },
            { id: 'step4', label: '4', param: 'step4', min: 0, max: 1, default: 0 },
            { id: 'step5', label: '5', param: 'step5', min: 0, max: 1, default: 0 },
            { id: 'step6', label: '6', param: 'step6', min: 0, max: 1, default: 0 },
            { id: 'step7', label: '7', param: 'step7', min: 0, max: 1, default: 0 },
            { id: 'step8', label: '8', param: 'step8', min: 0, max: 1, default: 0 },
            { id: 'length', label: 'Len', param: 'length', min: 1, max: 8, default: 8, step: 1 },
            { id: 'range', label: 'Rng', param: 'range', min: 0, max: 2, default: 1, step: 1 },
            { id: 'direction', label: 'Dir', param: 'direction', min: 0, max: 7, default: 0, step: 1 }
        ],
        switches: [],
        buttons: [
            { id: 'gate1', label: 'G1', param: 'gate1', default: 1 },
            { id: 'gate2', label: 'G2', param: 'gate2', default: 1 },
            { id: 'gate3', label: 'G3', param: 'gate3', default: 1 },
            { id: 'gate4', label: 'G4', param: 'gate4', default: 1 },
            { id: 'gate5', label: 'G5', param: 'gate5', default: 1 },
            { id: 'gate6', label: 'G6', param: 'gate6', default: 1 },
            { id: 'gate7', label: 'G7', param: 'gate7', default: 1 },
            { id: 'gate8', label: 'G8', param: 'gate8', default: 1 }
        ],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', type: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', type: 'trigger' }
        ],
        outputs: [
            { id: 'cv', label: 'CV', port: 'cv', type: 'cv' },
            { id: 'gate', label: 'Gate', port: 'gate', type: 'gate' }
        ]
    }
};
