import { createPcg32 } from '../../utils/pcg32.js';

const STEP_COUNT = 8;
const CLOCK_THRESHOLD = 2.5;
const TRIGGER_THRESHOLD = 1;
const DEFAULT_SEED = 0;
const DEFAULT_LENGTH = 8;
const DEFAULT_BPM = 120;
const DEFAULT_PROBABILITY = 100;
const DEFAULT_RATCHETS = 1;
const DEFAULT_CONDITION = 0;

const CONDITION_LABELS = Object.freeze([
    'ALWAYS', 'PRE', 'NOT PRE', 'FILL', 'NOT FILL',
    '1:2', '2:2', '1:4', '2:4', '3:4', '4:4'
]);

function createDefaultStep() {
    return {
        enabled: 1,
        probability: DEFAULT_PROBABILITY,
        ratchets: DEFAULT_RATCHETS,
        condition: DEFAULT_CONDITION
    };
}

function createDefaultSteps() {
    return Array.from({ length: STEP_COUNT }, createDefaultStep);
}

function finiteInteger(value, fallback, minimum, maximum) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function finiteSample(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function stepRecordAt(value, index) {
    if (!Array.isArray(value)) return null;
    const record = value[index];
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    return record;
}

function sanitizedStepField(record, field) {
    if (!record) {
        if (field === 'enabled') return 1;
        if (field === 'probability') return DEFAULT_PROBABILITY;
        if (field === 'ratchets') return DEFAULT_RATCHETS;
        return DEFAULT_CONDITION;
    }
    if (field === 'enabled') {
        return Number.isFinite(record.enabled) ? Number(record.enabled >= 0.5) : 1;
    }
    if (field === 'probability') {
        return finiteInteger(record.probability, DEFAULT_PROBABILITY, 0, 100);
    }
    if (field === 'ratchets') {
        return finiteInteger(record.ratchets, DEFAULT_RATCHETS, 1, 8);
    }
    return finiteInteger(record.condition, DEFAULT_CONDITION, 0, 10);
}

function sanitizeSteps(value) {
    const sanitized = new Array(STEP_COUNT);
    for (let index = 0; index < STEP_COUNT; index++) {
        const record = stepRecordAt(value, index);
        sanitized[index] = {
            enabled: sanitizedStepField(record, 'enabled'),
            probability: sanitizedStepField(record, 'probability'),
            ratchets: sanitizedStepField(record, 'ratchets'),
            condition: sanitizedStepField(record, 'condition')
        };
    }
    return sanitized;
}

function conditionPasses(condition, priorBaseResult, fillHigh, cycleNumber) {
    switch (condition) {
    case 1: return priorBaseResult;
    case 2: return !priorBaseResult;
    case 3: return fillHigh;
    case 4: return !fillHigh;
    case 5: return ((cycleNumber - 1) % 2) === 0;
    case 6: return ((cycleNumber - 1) % 2) === 1;
    case 7: return cycleNumber === 1;
    case 8: return cycleNumber === 2;
    case 9: return cycleNumber === 3;
    case 10: return cycleNumber === 4;
    default: return true;
    }
}

const PROB_SEQ_UI = {
    leds: [
        'step1', 'step2', 'step3', 'step4',
        'step5', 'step6', 'step7', 'step8',
        'hit', 'miss', 'eoc', 'pending'
    ],
    knobs: [
        { id: 'seed', label: 'Seed', param: 'seed', min: 0, max: 65535, default: 0, step: 1 },
        { id: 'length', label: 'Length', param: 'length', min: 1, max: 8, default: 8, step: 1 },
        { id: 'fallbackBpm', label: 'BPM', param: 'fallbackBpm', min: 30, max: 300, default: 120, step: 1 }
    ],
    state: [
        { param: 'steps', default: createDefaultSteps() }
    ],
    inputs: [
        { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'fill', label: 'Fill', port: 'fill', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'probabilityCv', label: 'Prob CV', port: 'probabilityCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
    ],
    outputs: [
        { id: 'gate', label: 'Gate', port: 'gate', signal: 'trigger', voltage: { min: 0, max: 10 } },
        { id: 'eoc', label: 'EOC', port: 'eoc', signal: 'trigger', voltage: { min: 0, max: 10 } }
    ]
};

function renderProbSeq(container, { instance, toolkit, onParamChange, onCleanup }) {
    const dsp = instance.dsp;
    const root = document.createElement('div');
    root.className = 'prob-seq-panel';

    const topRow = toolkit.createRow('prob-seq-top-row');
    PROB_SEQ_UI.knobs.forEach(knob => {
        topRow.appendChild(toolkit.createKnob({
            id: knob.id,
            label: knob.label,
            param: knob.param,
            value: dsp?.params?.[knob.param] ?? knob.default,
            min: knob.min,
            max: knob.max,
            step: knob.step,
            small: true
        }));
    });

    const telemetry = document.createElement('div');
    telemetry.className = 'prob-seq-telemetry';
    const activeSeed = document.createElement('strong');
    const activeLength = document.createElement('span');
    const cycle = document.createElement('span');
    activeSeed.dataset.field = 'activeSeed';
    activeLength.dataset.field = 'activeLength';
    cycle.dataset.field = 'cycleNumber';
    telemetry.append(activeSeed, activeLength, cycle);
    topRow.appendChild(telemetry);
    root.appendChild(topRow);

    let selectedStep = 0;
    let uiSteps = sanitizeSteps(dsp?.params?.steps);
    let observedStepsReference = dsp?.params?.steps;
    const stepGrid = toolkit.createRow('prob-seq-step-grid');
    const stepButtons = [];
    for (let index = 0; index < STEP_COUNT; index++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'prob-seq-step';
        button.dataset.step = String(index);
        stepGrid.appendChild(button);
        stepButtons.push(button);
    }
    root.appendChild(stepGrid);

    const editor = document.createElement('div');
    editor.className = 'prob-seq-editor';
    const editorTitle = document.createElement('strong');
    const enableButton = document.createElement('button');
    enableButton.type = 'button';
    enableButton.className = 'prob-seq-enable';
    const probabilityLabel = document.createElement('label');
    probabilityLabel.textContent = 'PROB';
    const probabilityInput = document.createElement('input');
    probabilityInput.type = 'range';
    probabilityInput.min = '0';
    probabilityInput.max = '100';
    probabilityInput.step = '1';
    probabilityInput.dataset.field = 'probability';
    probabilityLabel.appendChild(probabilityInput);
    const ratchetLabel = document.createElement('label');
    ratchetLabel.textContent = 'RATCH';
    const ratchetInput = document.createElement('input');
    ratchetInput.type = 'range';
    ratchetInput.min = '1';
    ratchetInput.max = '8';
    ratchetInput.step = '1';
    ratchetInput.dataset.field = 'ratchets';
    ratchetLabel.appendChild(ratchetInput);
    const conditionLabel = document.createElement('label');
    conditionLabel.textContent = 'COND';
    const conditionSelect = document.createElement('select');
    conditionSelect.dataset.field = 'condition';
    CONDITION_LABELS.forEach((label, value) => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = label;
        conditionSelect.appendChild(option);
    });
    conditionLabel.appendChild(conditionSelect);
    editor.append(editorTitle, enableButton, probabilityLabel, ratchetLabel, conditionLabel);
    root.appendChild(editor);

    const statusRow = toolkit.createRow('prob-seq-status-row');
    [['hit', 'HIT'], ['miss', 'MISS'], ['eoc', 'EOC'], ['pending', 'WAIT']]
        .forEach(([id, labelText]) => {
            const wrapper = document.createElement('span');
            const label = document.createElement('small');
            label.textContent = labelText;
            wrapper.append(toolkit.createLED({ id, color: 'green' }), label);
            statusRow.appendChild(wrapper);
        });
    root.appendChild(statusRow);

    const portRow = toolkit.createRow('prob-seq-port-row');
    PROB_SEQ_UI.inputs.forEach(input => {
        portRow.appendChild(toolkit.createJack({
            id: input.port,
            label: input.label,
            direction: 'input',
            signal: input.signal
        }));
    });
    PROB_SEQ_UI.outputs.forEach(output => {
        portRow.appendChild(toolkit.createJack({
            id: output.port,
            label: output.label,
            direction: 'output',
            signal: output.signal
        }));
    });
    root.appendChild(portRow);

    const replaceSelectedField = (field, value) => {
        const nextSteps = uiSteps.map(step => ({ ...step }));
        nextSteps[selectedStep][field] = value;
        uiSteps = nextSteps;
        observedStepsReference = nextSteps;
        onParamChange('steps', nextSteps);
        refreshEditor();
    };

    const refreshEditor = () => {
        const step = uiSteps[selectedStep];
        editorTitle.textContent = `STEP ${selectedStep + 1}`;
        enableButton.textContent = step.enabled ? 'ON' : 'SKIP';
        enableButton.classList.toggle('active', Boolean(step.enabled));
        enableButton.setAttribute('aria-pressed', String(Boolean(step.enabled)));
        probabilityInput.value = String(step.probability);
        probabilityInput.title = `${step.probability}%`;
        ratchetInput.value = String(step.ratchets);
        ratchetInput.title = `${step.ratchets} trigger${step.ratchets === 1 ? '' : 's'}`;
        conditionSelect.value = String(step.condition);
        stepButtons.forEach((button, index) => {
            const summary = uiSteps[index];
            button.textContent = `${index + 1}\n${summary.enabled ? `${summary.probability}% ×${summary.ratchets}` : 'SKIP'}\n${CONDITION_LABELS[summary.condition]}`;
            button.classList.toggle('selected', index === selectedStep);
            button.classList.toggle('disabled', !summary.enabled);
        });
    };

    const cleanup = [];
    const listen = (element, type, handler) => {
        element.addEventListener(type, handler);
        cleanup.push(() => element.removeEventListener(type, handler));
    };
    stepButtons.forEach((button, index) => {
        listen(button, 'mousedown', event => event.stopPropagation());
        listen(button, 'click', () => {
            selectedStep = index;
            refreshEditor();
        });
    });
    [enableButton, probabilityInput, ratchetInput, conditionSelect].forEach(control => {
        listen(control, 'mousedown', event => event.stopPropagation());
    });
    listen(enableButton, 'click', () => {
        replaceSelectedField('enabled', uiSteps[selectedStep].enabled ? 0 : 1);
    });
    listen(probabilityInput, 'input', () => {
        replaceSelectedField('probability', finiteInteger(Number(probabilityInput.value), 100, 0, 100));
    });
    listen(ratchetInput, 'input', () => {
        replaceSelectedField('ratchets', finiteInteger(Number(ratchetInput.value), 1, 1, 8));
    });
    listen(conditionSelect, 'change', () => {
        replaceSelectedField('condition', finiteInteger(Number(conditionSelect.value), 0, 0, 10));
    });
    const updateTelemetry = () => {
        if (dsp?.params?.steps !== observedStepsReference) {
            observedStepsReference = dsp?.params?.steps;
            uiSteps = sanitizeSteps(observedStepsReference);
            refreshEditor();
        }
        const seed = finiteInteger(dsp?.activeSeed, 0, 0, 65535);
        const length = finiteInteger(dsp?.activeLength, 8, 1, 8);
        const cycleNumber = finiteInteger(dsp?.cycleNumber, 1, 1, 4);
        activeSeed.textContent = `ACTIVE ${String(seed).padStart(5, '0')}`;
        activeLength.textContent = `LEN ${length}`;
        cycle.textContent = `CYCLE ${cycleNumber}`;
        stepButtons.forEach((button, index) => {
            button.classList.toggle('playing', dsp?.leds?.[`step${index + 1}`] === 1);
            button.classList.toggle('inactive', index >= length);
        });
    };

    refreshEditor();
    updateTelemetry();
    toolkit.animate(updateTelemetry);
    onCleanup?.(() => cleanup.forEach(dispose => dispose()));
    container.appendChild(root);
}

export default {
    id: 'prob-seq',
    name: 'PROB SEQ',
    hp: 14,
    color: 'module-color-eleven',
    category: 'sequencer',
    telemetry: {
        fields: ['activeSeed', 'activeLength', 'cycleNumber', 'lastDecisionCode'],
        methods: []
    },

    css: `
        .prob-seq-panel { display: grid; gap: 6px; padding: 4px; }
        .prob-seq-top-row { align-items: end; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .prob-seq-telemetry { align-items: center; display: flex; flex-direction: column; font-size: 8px; line-height: 1.3; }
        .prob-seq-step-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; }
        .prob-seq-step { background: rgba(0, 0, 0, .25); border: 1px solid currentColor; color: inherit; cursor: pointer; font: inherit; font-size: 7px; line-height: 1.2; min-height: 38px; padding: 2px; white-space: pre-line; }
        .prob-seq-step.selected { outline: 2px solid currentColor; }
        .prob-seq-step.playing { background: rgba(255, 255, 255, .28); }
        .prob-seq-step.disabled, .prob-seq-step.inactive { opacity: .55; }
        .prob-seq-editor { align-items: center; display: grid; gap: 3px; grid-template-columns: auto auto 1fr 1fr 1fr; font-size: 8px; }
        .prob-seq-editor label { display: flex; flex-direction: column; min-width: 0; }
        .prob-seq-editor input, .prob-seq-editor select { max-width: 100%; min-width: 0; }
        .prob-seq-enable { font: inherit; }
        .prob-seq-enable.active { font-weight: 700; }
        .prob-seq-status-row { justify-content: space-around; }
        .prob-seq-status-row > span { align-items: center; display: flex; flex-direction: column; }
        .prob-seq-port-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0
            ? sampleRate
            : 44100;
        const safeBufferSize = finiteInteger(bufferSize, 512, 1, 1048576);
        const inputs = {
            clock: new Float32Array(safeBufferSize),
            reset: new Float32Array(safeBufferSize),
            fill: new Float32Array(safeBufferSize),
            probabilityCv: new Float32Array(safeBufferSize)
        };
        const outputs = {
            gate: new Float32Array(safeBufferSize),
            eoc: new Float32Array(safeBufferSize)
        };
        const leds = {
            step1: 0,
            step2: 0,
            step3: 0,
            step4: 0,
            step5: 0,
            step6: 0,
            step7: 0,
            step8: 0,
            hit: 0,
            miss: 0,
            eoc: 0,
            pending: 0
        };
        const prng = createPcg32(DEFAULT_SEED);
        const ratchetStarts = new Float64Array(STEP_COUNT);

        let hydrated = false;
        let sampleCursor = 0;
        let activeSeedValue = DEFAULT_SEED;
        let requestedSeed = DEFAULT_SEED;
        let activeLengthValue = DEFAULT_LENGTH;
        let requestedLength = DEFAULT_LENGTH;
        let fallbackBpm = DEFAULT_BPM;
        let cycleNumberValue = 1;
        let lastDecisionCodeValue = 0;
        let currentStep = 0;
        let hasEvaluated = false;
        let priorBaseResult = false;
        let lastClockHigh = false;
        let lastResetHigh = false;
        let lastClockSample = -1;
        let gateSamplesRemaining = 0;
        let eocSamplesRemaining = 0;
        let hitHoldRemaining = 0;
        let missHoldRemaining = 0;
        let ratchetCount = 0;
        let ratchetIndex = 0;
        let ratchetPulseWidth = 1;
        let lastGateOutputHigh = false;

        const pulseSamples = Math.max(1, Math.round(safeSampleRate * 0.005));
        const activitySamples = Math.max(1, Math.round(safeSampleRate * 0.05));
        const maximumMeasuredPeriod = safeSampleRate * 10;

        const instance = {
            params: {
                seed: DEFAULT_SEED,
                length: DEFAULT_LENGTH,
                fallbackBpm: DEFAULT_BPM,
                steps: createDefaultSteps()
            },
            inputs,
            outputs,
            leds,
            activeSeed: DEFAULT_SEED,
            activeLength: DEFAULT_LENGTH,
            cycleNumber: 1,
            lastDecisionCode: 0,

            process() {
                requestedSeed = finiteInteger(this.params.seed, DEFAULT_SEED, 0, 65535);
                requestedLength = finiteInteger(this.params.length, DEFAULT_LENGTH, 1, 8);
                fallbackBpm = finiteInteger(this.params.fallbackBpm, DEFAULT_BPM, 30, 300);

                if (!hydrated) {
                    this.params.seed = requestedSeed;
                    this.params.length = requestedLength;
                    this.params.fallbackBpm = fallbackBpm;
                    this.params.steps = sanitizeSteps(this.params.steps);
                    activeSeedValue = requestedSeed;
                    activeLengthValue = requestedLength;
                    prng.reseed(activeSeedValue);
                    cycleNumberValue = 1;
                    lastDecisionCodeValue = 0;
                    currentStep = 0;
                    hasEvaluated = false;
                    priorBaseResult = false;
                    lastClockHigh = false;
                    lastResetHigh = false;
                    lastClockSample = -1;
                    gateSamplesRemaining = 0;
                    eocSamplesRemaining = 0;
                    hitHoldRemaining = 0;
                    missHoldRemaining = 0;
                    ratchetCount = 0;
                    ratchetIndex = 0;
                    lastGateOutputHigh = false;
                    hydrated = true;
                }

                let eocActivity = false;
                for (let sample = 0; sample < safeBufferSize; sample++) {
                    const clockVoltage = finiteSample(inputs.clock[sample]);
                    const resetVoltage = finiteSample(inputs.reset[sample]);
                    const clockHigh = clockVoltage > CLOCK_THRESHOLD;
                    const resetHigh = resetVoltage >= TRIGGER_THRESHOLD;
                    const clockRising = clockHigh && !lastClockHigh;
                    const resetRising = resetHigh && !lastResetHigh;

                    if (resetRising) {
                        activeSeedValue = requestedSeed;
                        activeLengthValue = requestedLength;
                        prng.reseed(activeSeedValue);
                        cycleNumberValue = 1;
                        lastDecisionCodeValue = 0;
                        currentStep = 0;
                        hasEvaluated = false;
                        priorBaseResult = false;
                        lastClockSample = -1;
                        gateSamplesRemaining = 0;
                        eocSamplesRemaining = 0;
                        hitHoldRemaining = 0;
                        missHoldRemaining = 0;
                        ratchetCount = 0;
                        ratchetIndex = 0;
                        lastGateOutputHigh = false;
                        eocActivity = false;
                    }

                    if (clockRising) {
                        let periodSamples = Math.max(1, Math.round(safeSampleRate * 60 / fallbackBpm));
                        if (lastClockSample >= 0) {
                            const measured = sampleCursor - lastClockSample;
                            if (measured >= 1 && measured <= maximumMeasuredPeriod) {
                                periodSamples = measured;
                            }
                        }
                        lastClockSample = sampleCursor;

                        const interruptedHigh = gateSamplesRemaining > 0 || lastGateOutputHigh;
                        gateSamplesRemaining = 0;
                        ratchetCount = 0;
                        ratchetIndex = 0;

                        if (!hasEvaluated) {
                            currentStep = 0;
                            hasEvaluated = true;
                        } else if (currentStep + 1 >= activeLengthValue) {
                            eocSamplesRemaining = pulseSamples;
                            eocActivity = true;
                            const seedChanged = requestedSeed !== activeSeedValue;
                            const lengthChanged = requestedLength !== activeLengthValue;
                            activeSeedValue = requestedSeed;
                            activeLengthValue = requestedLength;
                            if (seedChanged) prng.reseed(activeSeedValue);
                            if (seedChanged || lengthChanged) {
                                cycleNumberValue = 1;
                                priorBaseResult = false;
                            } else {
                                cycleNumberValue = 1 + (cycleNumberValue % 4);
                            }
                            currentStep = 0;
                        } else {
                            currentStep++;
                        }

                        const record = stepRecordAt(this.params.steps, currentStep);
                        const enabled = sanitizedStepField(record, 'enabled');
                        const probability = sanitizedStepField(record, 'probability');
                        const ratchets = sanitizedStepField(record, 'ratchets');
                        const condition = sanitizedStepField(record, 'condition');
                        const probabilityCv = Math.max(-5, Math.min(5,
                            finiteSample(inputs.probabilityCv[sample])
                        ));
                        const effectiveProbability = Math.max(0, Math.min(100,
                            Math.round(probability + probabilityCv * 20)
                        ));
                        // Fixed one-result-per-step consumption keeps later
                        // decisions stable when enable or condition changes.
                        const roll = prng.bounded(100);
                        const logicalCondition = conditionPasses(
                            condition,
                            priorBaseResult,
                            finiteSample(inputs.fill[sample]) >= TRIGGER_THRESHOLD,
                            cycleNumberValue
                        );
                        const fired = Boolean(
                            enabled && logicalCondition && roll < effectiveProbability
                        );
                        // PRE-family chains read but never overwrite history.
                        if (condition !== 1 && condition !== 2) priorBaseResult = fired;

                        if (fired) {
                            lastDecisionCodeValue = 1;
                            hitHoldRemaining = activitySamples;
                            missHoldRemaining = 0;
                            const subdivision = periodSamples / ratchets;
                            ratchetPulseWidth = Math.max(1, Math.min(
                                pulseSamples,
                                Math.floor(subdivision / 2)
                            ));
                            let previousStart = -1;
                            for (let ratchet = 0; ratchet < ratchets; ratchet++) {
                                const offset = ratchet === 0
                                    // Preserve a detectable edge when a new
                                    // clock interrupts an active pulse.
                                    ? (interruptedHigh ? 1 : 0)
                                    : Math.max(1, Math.round(
                                        ratchet * periodSamples / ratchets
                                    ));
                                if (ratchet > 0 && offset >= periodSamples) continue;
                                const start = sampleCursor + offset;
                                if (start <= previousStart) continue;
                                ratchetStarts[ratchetCount++] = start;
                                previousStart = start;
                            }
                        } else {
                            lastDecisionCodeValue = !enabled
                                ? 2
                                : (!logicalCondition ? 3 : 4);
                            hitHoldRemaining = 0;
                            missHoldRemaining = activitySamples;
                        }
                    }

                    while (
                        ratchetIndex < ratchetCount &&
                        ratchetStarts[ratchetIndex] <= sampleCursor
                    ) {
                        if (gateSamplesRemaining === 0 && !lastGateOutputHigh) {
                            gateSamplesRemaining = ratchetPulseWidth;
                        }
                        ratchetIndex++;
                    }

                    outputs.gate[sample] = gateSamplesRemaining > 0 ? 10 : 0;
                    outputs.eoc[sample] = eocSamplesRemaining > 0 ? 10 : 0;
                    if (gateSamplesRemaining > 0) gateSamplesRemaining--;
                    if (eocSamplesRemaining > 0) eocSamplesRemaining--;
                    if (hitHoldRemaining > 0) hitHoldRemaining--;
                    if (missHoldRemaining > 0) missHoldRemaining--;
                    lastGateOutputHigh = outputs.gate[sample] === 10;
                    lastClockHigh = clockHigh;
                    lastResetHigh = resetHigh;
                    sampleCursor++;
                }

                for (let index = 0; index < STEP_COUNT; index++) {
                    leds[`step${index + 1}`] = index === currentStep && index < activeLengthValue ? 1 : 0;
                }
                leds.hit = hitHoldRemaining > 0 ? 1 : 0;
                leds.miss = missHoldRemaining > 0 ? 1 : 0;
                leds.eoc = eocActivity || eocSamplesRemaining > 0 ? 1 : 0;
                leds.pending = requestedSeed !== activeSeedValue || requestedLength !== activeLengthValue ? 1 : 0;
                this.activeSeed = activeSeedValue;
                this.activeLength = activeLengthValue;
                this.cycleNumber = cycleNumberValue;
                this.lastDecisionCode = lastDecisionCodeValue;
            },

            reset() {
                Object.values(inputs).forEach(input => input.fill(0));
                Object.values(outputs).forEach(output => output.fill(0));
                Object.keys(leds).forEach(name => {
                    leds[name] = 0;
                });
                hydrated = false;
                sampleCursor = 0;
                activeSeedValue = DEFAULT_SEED;
                requestedSeed = DEFAULT_SEED;
                activeLengthValue = DEFAULT_LENGTH;
                requestedLength = DEFAULT_LENGTH;
                fallbackBpm = DEFAULT_BPM;
                cycleNumberValue = 1;
                lastDecisionCodeValue = 0;
                currentStep = 0;
                hasEvaluated = false;
                priorBaseResult = false;
                lastClockHigh = false;
                lastResetHigh = false;
                lastClockSample = -1;
                gateSamplesRemaining = 0;
                eocSamplesRemaining = 0;
                hitHoldRemaining = 0;
                missHoldRemaining = 0;
                ratchetCount = 0;
                ratchetIndex = 0;
                ratchetPulseWidth = 1;
                lastGateOutputHigh = false;
                this.activeSeed = DEFAULT_SEED;
                this.activeLength = DEFAULT_LENGTH;
                this.cycleNumber = 1;
                this.lastDecisionCode = 0;
            }
        };

        return instance;
    },

    ui: PROB_SEQ_UI,
    render: renderProbSeq
};
