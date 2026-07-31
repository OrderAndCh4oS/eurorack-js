import { createPcg32 } from '../../utils/pcg32.js';

export { createPcg32 };

const CELL_COUNT = 8;
const LANE_COUNT = 4;
const CLOCKS_PER_CELL = 16;
const CLOCK_THRESHOLD = 2.5;
const TRIGGER_THRESHOLD = 1;
const SEED_OFFSETS_PER_VOLT = 12;

const DEFAULT_SEED = 0;
const DEFAULT_LENGTH = 4;
const DEFAULT_AMOUNT = 1;
const DEFAULT_CHANCE = 20;

const LANE_MINIMUMS = Object.freeze([-12, 0, -20, -20]);
const LANE_MAXIMUMS = Object.freeze([12, 20, 20, 20]);
const LANE_MAX_DELTAS = Object.freeze([4, 3, 4, 4]);

const REFRAIN_UI = {
    leds: [
        'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
        'substep', 'anchor', 'pending', 'seedPending', 'mutation'
    ],
    knobs: [
        { id: 'seed', label: 'Seed', param: 'seed', min: 0, max: 65535, default: 0, step: 1 },
        { id: 'length', label: 'Length', param: 'length', min: 1, max: 8, default: 4, step: 1 },
        { id: 'amount', label: 'Amount', param: 'amount', min: 1, max: 8, default: 1, step: 1 },
        { id: 'chance', label: 'Chance', param: 'chance', min: 0, max: 100, default: 20, step: 1 }
    ],
    buttons: [
        { id: 'mutateKey', label: 'Key', param: 'mutateKey', default: 1 },
        { id: 'mutateHarm', label: 'Harm', param: 'mutateHarm', default: 1 },
        { id: 'mutateEnergy', label: 'Energy', param: 'mutateEnergy', default: 1 },
        { id: 'mutateMod', label: 'Mod', param: 'mutateMod', default: 1 }
    ],
    switches: [
        { id: 'anchor', label: 'Anchor Run/Hold', param: 'anchor', default: 0 }
    ],
    actions: [
        { id: 'mutate', label: 'Mutate', param: 'mutate', mode: 'trigger', default: 0 },
        { id: 'recall', label: 'Recall', param: 'recall', mode: 'trigger', default: 0 }
    ],
    inputs: [
        { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'seedCV', label: 'Seed CV', port: 'seedCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'mutateTrig', label: 'Mutate', port: 'mutateTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'recallTrig', label: 'Recall', port: 'recallTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'hold', label: 'Hold', port: 'hold', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } }
    ],
    outputs: [
        { id: 'key', label: 'Key', port: 'key', signal: 'cv', voltage: { min: -1, max: 1 } },
        { id: 'harm', label: 'Harm', port: 'harm', signal: 'cv', voltage: { min: 0, max: 5 } },
        { id: 'energy', label: 'Energy', port: 'energy', signal: 'cv', voltage: { min: -5, max: 5 } },
        { id: 'mod', label: 'Mod', port: 'mod', signal: 'cv', voltage: { min: -5, max: 5 } }
    ]
};

function finiteInteger(value, fallback, minimum, maximum) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function finiteSwitch(value, fallback) {
    return Number.isFinite(value) ? value >= 0.5 : fallback;
}

export function mapRefrainSeed(panelSeed, seedCV) {
    const center = finiteInteger(panelSeed, DEFAULT_SEED, 0, 65535);
    const finiteCV = Number.isFinite(seedCV) ? seedCV : 0;
    const clampedCV = Math.max(-5, Math.min(5, finiteCV));
    const offset = Math.round(clampedCV * SEED_OFFSETS_PER_VOLT);
    return ((center + offset) % 65536 + 65536) % 65536;
}

function createPatternBuffers() {
    const key = new Int8Array(CELL_COUNT);
    const harm = new Int8Array(CELL_COUNT);
    const energy = new Int8Array(CELL_COUNT);
    const mod = new Int8Array(CELL_COUNT);
    return {
        key,
        harm,
        energy,
        mod,
        lanes: [key, harm, energy, mod]
    };
}

function copyPattern(source, destination) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
        destination.lanes[lane].set(source.lanes[lane]);
    }
}

function clearPattern(pattern) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
        pattern.lanes[lane].fill(0);
    }
}

function fillBasePattern(pattern, prng) {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        pattern.key[cell] = prng.bounded(25) - 12;
        pattern.harm[cell] = prng.bounded(21);
        pattern.energy[cell] = prng.bounded(41) - 20;
        pattern.mod[cell] = prng.bounded(41) - 20;
    }
}

function patternSnapshot(pattern) {
    return Array.from({ length: CELL_COUNT }, (_, cell) => ({
        key: pattern.key[cell],
        harm: pattern.harm[cell],
        energy: pattern.energy[cell],
        mod: pattern.mod[cell]
    }));
}

export function createRefrainBaseSnapshot(seed = DEFAULT_SEED) {
    const prng = createPcg32(seed);
    const pattern = createPatternBuffers();
    fillBasePattern(pattern, prng);
    return {
        cells: patternSnapshot(pattern),
        prngState: prng.getStateWords()
    };
}

export function applyRefrainDelta(value, delta, minimum, maximum) {
    const forward = Math.max(minimum, Math.min(maximum, value + delta));
    if (forward !== value) return forward;

    const reflected = Math.max(minimum, Math.min(maximum, value - delta));
    if (reflected !== value) return reflected;

    return value >= maximum ? maximum - 1 : minimum + 1;
}

function mutatePattern(
    source,
    candidate,
    activeLength,
    amount,
    laneMask,
    prng,
    shuffle,
    lastMutationIndices,
    lastMutationDeltas
) {
    copyPattern(source, candidate);
    for (let cell = 0; cell < activeLength; cell++) shuffle[cell] = cell;

    const selectedCount = Math.min(amount, activeLength);
    lastMutationIndices.fill(-1);
    lastMutationDeltas.fill(0);

    for (let selection = 0; selection < selectedCount; selection++) {
        const swapIndex = selection + prng.bounded(activeLength - selection);
        const selectedCell = shuffle[swapIndex];
        shuffle[swapIndex] = shuffle[selection];
        shuffle[selection] = selectedCell;
        lastMutationIndices[selection] = selectedCell;
    }

    for (let selection = 0; selection < selectedCount; selection++) {
        const cell = lastMutationIndices[selection];
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const magnitude = 1 + prng.bounded(LANE_MAX_DELTAS[lane]);
            const signedDelta = prng.bounded(2) === 0 ? -magnitude : magnitude;
            const current = source.lanes[lane][cell];
            if (laneMask & (1 << lane)) {
                candidate.lanes[lane][cell] = applyRefrainDelta(
                    current,
                    signedDelta,
                    LANE_MINIMUMS[lane],
                    LANE_MAXIMUMS[lane]
                );
            }
            lastMutationDeltas[selection * LANE_COUNT + lane] = signedDelta;
        }
    }

    return selectedCount;
}

function fillHeldOutputs(outputs, pattern, cellIndex) {
    outputs.key.fill(pattern.key[cellIndex] / 12);
    outputs.harm.fill(pattern.harm[cellIndex] / 4);
    outputs.energy.fill(pattern.energy[cellIndex] / 4);
    outputs.mod.fill(pattern.mod[cellIndex] / 4);
}

function laneMaskFromParams(params) {
    let mask = 0;
    if (finiteSwitch(params.mutateKey, true)) mask |= 1;
    if (finiteSwitch(params.mutateHarm, true)) mask |= 2;
    if (finiteSwitch(params.mutateEnergy, true)) mask |= 4;
    if (finiteSwitch(params.mutateMod, true)) mask |= 8;
    return mask;
}

function formatSeed(value) {
    return String(finiteInteger(value, 0, 0, 65535)).padStart(5, '0');
}

function renderRefrain(container, { instance, toolkit }) {
    const dsp = instance.dsp;
    const root = document.createElement('div');
    root.className = 'refrain-panel';

    const seedDisplay = document.createElement('div');
    seedDisplay.className = 'refrain-seed-display';
    seedDisplay.title = 'Seed status display; pending targets activate at the next cell boundary';
    seedDisplay.addEventListener('mousedown', event => event.stopPropagation());

    const createSeedField = (label, field) => {
        const wrapper = document.createElement('div');
        const labelEl = document.createElement('span');
        const valueEl = document.createElement('strong');
        wrapper.className = `refrain-seed-field refrain-seed-${field}`;
        labelEl.textContent = label;
        valueEl.dataset.seedField = field;
        valueEl.textContent = field === 'next' ? '—' : '00000';
        wrapper.append(labelEl, valueEl);
        return { valueEl, wrapper };
    };

    const activeField = createSeedField('ACTIVE', 'active');
    const nextField = createSeedField('NEXT', 'next');
    const seedStatus = document.createElement('span');
    seedStatus.className = 'refrain-seed-status';
    seedStatus.dataset.state = 'equal';
    seedStatus.textContent = 'SET';
    seedDisplay.append(activeField.wrapper, nextField.wrapper, seedStatus);
    root.appendChild(seedDisplay);

    const cellLedRow = toolkit.createRow('refrain-cell-leds');
    for (let cell = 1; cell <= CELL_COUNT; cell++) {
        const wrapper = document.createElement('span');
        const label = document.createElement('small');
        wrapper.className = 'refrain-cell-led';
        label.textContent = String(cell);
        wrapper.append(
            toolkit.createLED({ id: `cell${cell}`, color: 'green' }),
            label
        );
        cellLedRow.appendChild(wrapper);
    }
    root.appendChild(cellLedRow);

    const statusLedRow = toolkit.createRow('refrain-status-leds');
    [
        ['substep', 'CLK'],
        ['anchor', 'ANCH'],
        ['pending', 'WAIT'],
        ['seedPending', 'SEED'],
        ['mutation', 'MUT']
    ].forEach(([id, labelText]) => {
        const wrapper = document.createElement('span');
        const label = document.createElement('small');
        wrapper.className = 'refrain-status-led';
        label.textContent = labelText;
        wrapper.append(toolkit.createLED({ id, color: 'green' }), label);
        statusLedRow.appendChild(wrapper);
    });
    root.appendChild(statusLedRow);

    const knobGrid = toolkit.createRow('refrain-knob-grid');
    REFRAIN_UI.knobs.forEach(knob => {
        knobGrid.appendChild(toolkit.createKnob({
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
    root.appendChild(knobGrid);

    const laneRow = toolkit.createRow('refrain-lane-row');
    const laneDescriptions = {
        mutateKey: 'the tonal center and pitch-offset sequence',
        mutateHarm: 'the chord and harmonic-selector sequence',
        mutateEnergy: 'the rhythmic-density and accent sequence',
        mutateMod: 'the general-purpose timbre and motion sequence'
    };
    REFRAIN_UI.buttons.forEach(button => {
        const initialValue = dsp?.params?.[button.param] ?? button.default;
        const control = toolkit.createActionButton({
            id: button.id,
            label: button.label,
            param: button.param,
            mode: 'toggle',
            value: initialValue
        });
        const updateLaneState = (element, value) => {
            const enabled = value === 1 || value === true;
            element.classList.toggle('active', enabled);
            element.title = `${button.label.toUpperCase()} · ${enabled ? 'ON' : 'OFF'} — Mutate ${enabled ? 'may change' : 'will preserve'} ${laneDescriptions[button.param]}. Click to turn ${enabled ? 'OFF' : 'ON'}.`;
            element.setAttribute('aria-pressed', String(enabled));
        };
        control.classList.add('refrain-lane-toggle');
        updateLaneState(control, initialValue);
        control.addEventListener('click', () => {
            updateLaneState(control, control.classList.contains('active'));
        });
        toolkit.registerParamControl(button.param, control, (value, element) => {
            updateLaneState(element, value);
        });
        laneRow.appendChild(control);
    });
    root.appendChild(laneRow);

    const actionRow = toolkit.createRow('refrain-action-row');
    const hold = toolkit.createSwitch({
        id: 'anchor',
        label: 'Run / Hold',
        param: 'anchor',
        value: dsp?.params?.anchor ?? 0
    });
    const updateHoldState = (value, element = hold) => {
        const held = value === 1 || value === true;
        element.title = held
            ? 'RUN / HOLD · HOLD — The volatile Anchor is captured and automatic mutation plus unattended Seed CV changes are paused. Clock, Mutate, and Recall remain active. Click for RUN.'
            : 'RUN / HOLD · RUN — Automatic mutation and Seed CV changes may proceed. Click for HOLD to capture or replace the volatile Anchor.';
    };
    updateHoldState(dsp?.params?.anchor ?? 0);
    toolkit.registerParamControl('anchor', hold, (value, element) => {
        element.querySelector('.switch')?.classList.toggle('on', value === 1 || value === true);
        updateHoldState(value, element);
    });
    actionRow.appendChild(hold);
    const actionControls = new Map();
    REFRAIN_UI.actions.forEach(action => {
        const control = toolkit.createActionButton({
            id: action.id,
            label: action.label,
            param: action.param,
            mode: action.mode,
            value: 0
        });
        actionControls.set(action.id, control);
        actionRow.appendChild(control);
    });
    root.appendChild(actionRow);

    const outputRow = toolkit.createRow('refrain-output-row');
    REFRAIN_UI.outputs.forEach(output => {
        outputRow.appendChild(toolkit.createJack({
            id: output.port,
            label: output.label,
            direction: 'output',
            signal: output.signal
        }));
    });
    root.appendChild(outputRow);

    const inputRows = [
        REFRAIN_UI.inputs.slice(0, 3),
        REFRAIN_UI.inputs.slice(3)
    ];
    inputRows.forEach((inputs, rowIndex) => {
        const row = toolkit.createRow(`refrain-input-row refrain-input-row-${rowIndex + 1}`);
        inputs.forEach(input => {
            row.appendChild(toolkit.createJack({
                id: input.port,
                label: input.label,
                direction: 'input',
                signal: input.signal
            }));
        });
        root.appendChild(row);
    });

    const note = document.createElement('div');
    note.className = 'refrain-note';
    note.textContent = 'HARM → destination at 0 · Anchor is volatile';
    note.title = 'Set a HARM destination knob to zero for an absolute target. Anchor and live mutations are volatile and are not saved with patches.';
    root.appendChild(note);

    const updatePanelFeedback = () => {
        const activeSeed = dsp?.activeSeed ?? 0;
        const nextSeed = dsp?.nextSeed ?? activeSeed;
        const state = finiteInteger(dsp?.seedPendingState, 0, 0, 2);
        activeField.valueEl.textContent = formatSeed(activeSeed);
        nextField.valueEl.textContent = state === 0 || nextSeed === activeSeed
            ? '—'
            : formatSeed(nextSeed);
        seedStatus.classList.toggle('is-armed', state === 1);
        seedStatus.classList.toggle('is-held', state === 2);
        seedStatus.dataset.state = state === 2 ? 'held' : (state === 1 ? 'armed' : 'equal');
        seedStatus.textContent = state === 2 ? 'HELD' : (state === 1 ? 'PEND' : 'SET');
        seedStatus.title = state === 2
            ? 'Pending Seed CV is held; release Hold to activate it at a cell boundary'
            : (state === 1
                ? 'Pending seed will activate at the next cell boundary'
                : 'The displayed ACTIVE seed is currently selected');

        const pendingAction = finiteInteger(dsp?.pendingActionState, 0, 0, 2);
        const anchorAvailable = Number.isFinite(dsp?.leds?.anchor) && dsp.leds.anchor > 0;
        actionControls.forEach((control, id) => {
            const queued = pendingAction === (id === 'mutate' ? 1 : 2);
            const unavailable = id === 'recall' && !anchorAvailable && !queued;
            control.classList.toggle('active', queued);
            control.classList.toggle('is-pending', queued);
            control.dataset.state = queued ? 'queued' : (unavailable ? 'unavailable' : 'ready');
            control.setAttribute('aria-pressed', String(queued));
            control.setAttribute('aria-disabled', String(unavailable));
            if (id === 'mutate') {
                control.title = queued
                    ? 'MUTATE · QUEUED — The captured AMOUNT and ON-lane selection will commit at the next cell boundary. Click again to replace that queued snapshot.'
                    : 'MUTATE · READY — Queue a change at the next cell boundary: AMOUNT selects how many active cells change and the lane buttons marked ON select which lanes may change.';
            } else if (queued) {
                control.title = 'RECALL · QUEUED — All four lanes will restore from the latest volatile Anchor at the next cell boundary.';
            } else if (unavailable) {
                control.title = 'RECALL · NO ANCHOR — Nothing can be recalled yet. Enter HOLD to capture the current loop as the volatile Anchor.';
            } else {
                control.title = 'RECALL · READY — Queue restoration of all four lanes from the latest volatile Anchor at the next cell boundary.';
            }
        });
    };

    updatePanelFeedback();
    toolkit.animate(updatePanelFeedback);
    container.appendChild(root);
}

export default {
    id: 'refrain',
    name: 'REFRAIN',
    hp: 12,
    color: 'module-color-ten',
    category: 'sequencer',
    telemetry: {
        fields: ['activeSeed', 'nextSeed', 'seedPendingState', 'pendingActionState'],
        methods: []
    },

    css: `
        .module-type-refrain .module-content {
            min-height: 0;
            gap: 2px;
            overflow: hidden;
        }
        .refrain-panel {
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 3px;
            width: 100%;
            height: 100%;
            min-height: 0;
        }
        .refrain-panel .jack-row {
            margin: 0;
        }
        .refrain-seed-display {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            align-items: stretch;
            gap: 3px;
            width: 100%;
            cursor: default;
            user-select: none;
        }
        .refrain-seed-field {
            display: grid;
            gap: 1px;
            min-width: 0;
            padding: 3px 4px;
            border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
            background: color-mix(in srgb, #000 74%, transparent);
            color: #bfffc9;
            font-variant-numeric: tabular-nums;
            text-align: center;
        }
        .refrain-seed-field span {
            color: #a5b5a7;
            font-size: 6px;
            letter-spacing: 0.08em;
        }
        .refrain-seed-field strong {
            min-width: 5ch;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11px;
            line-height: 1;
            letter-spacing: 0.05em;
        }
        .refrain-seed-status {
            align-self: stretch;
            display: grid;
            place-items: center;
            min-width: 23px;
            border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
            font-size: 6px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }
        .refrain-seed-status.is-armed {
            background: rgba(70, 190, 100, 0.35);
        }
        .refrain-seed-status.is-held {
            background: rgba(230, 170, 60, 0.42);
        }
        .refrain-cell-leds,
        .refrain-status-leds {
            display: grid;
            width: 100%;
            align-items: center;
            justify-items: center;
        }
        .refrain-cell-leds {
            grid-template-columns: repeat(8, 1fr);
        }
        .refrain-status-leds {
            grid-template-columns: repeat(5, 1fr);
        }
        .refrain-cell-led,
        .refrain-status-led {
            display: grid;
            justify-items: center;
            gap: 1px;
            font-size: 6px;
        }
        .refrain-cell-led small,
        .refrain-status-led small {
            font-size: 5px;
            line-height: 1;
            opacity: 0.78;
        }
        .refrain-knob-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            align-items: start;
            justify-items: center;
            width: 100%;
            gap: 1px;
        }
        .refrain-knob-grid .knob-container {
            min-width: 0;
        }
        .refrain-lane-row,
        .refrain-action-row {
            display: grid;
            width: 100%;
            gap: 3px;
        }
        .refrain-lane-row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .refrain-action-row {
            grid-template-columns: 1.25fr 1fr 1fr;
            align-items: end;
        }
        .refrain-lane-row .action-btn,
        .refrain-action-row .action-btn {
            min-width: 0;
            width: 100%;
            padding-left: 2px;
            padding-right: 2px;
        }
        .refrain-action-row .knob-container {
            min-width: 0;
        }
        .refrain-output-row,
        .refrain-input-row {
            display: grid;
            align-items: end;
            justify-items: center;
            width: 100%;
            gap: 2px;
        }
        .refrain-output-row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .refrain-input-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .refrain-output-row .jack-container,
        .refrain-input-row .jack-container {
            min-width: 0;
        }
        .refrain-note {
            margin-top: auto;
            overflow: hidden;
            font-size: 5px;
            line-height: 1.15;
            opacity: 0.76;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const seedCV = new Float32Array(bufferSize);
        const mutateTrig = new Float32Array(bufferSize);
        const recallTrig = new Float32Array(bufferSize);
        const hold = new Float32Array(bufferSize);
        const key = new Float32Array(bufferSize);
        const harm = new Float32Array(bufferSize);
        const energy = new Float32Array(bufferSize);
        const mod = new Float32Array(bufferSize);
        const outputs = { key, harm, energy, mod };

        const basePattern = createPatternBuffers();
        const livePattern = createPatternBuffers();
        const candidatePattern = createPatternBuffers();
        const anchorPattern = createPatternBuffers();
        const shuffle = new Uint8Array(CELL_COUNT);
        const lastMutationIndices = new Int8Array(CELL_COUNT);
        const lastMutationDeltas = new Int8Array(CELL_COUNT * LANE_COUNT);
        const prngStateScratch = new Uint32Array(2);
        const prng = createPcg32(DEFAULT_SEED);
        const ledHoldSamples = Math.max(1, Math.round(sampleRate * 0.05));

        let activeSeed = DEFAULT_SEED;
        let activePanelSeed = DEFAULT_SEED;
        let nextSeed = DEFAULT_SEED;
        let seedPendingState = 0;
        let activeLength = DEFAULT_LENGTH;
        let cellIndex = 0;
        let substepIndex = 0;
        let restartPending = true;
        let lastClockHigh = false;
        let lastResetHigh = false;
        let lastPanelMutateHigh = false;
        let lastPanelRecallHigh = false;
        let lastMutateTrigHigh = false;
        let lastRecallTrigHigh = false;
        let lastEffectiveHold = false;
        let anchorValid = false;
        let pendingMutate = false;
        let pendingRecall = false;
        let pendingAmount = DEFAULT_AMOUNT;
        let pendingMask = 0;
        let changeAutoGuard = false;
        let lastMutationCount = 0;
        let firstProcessPending = true;
        let clockLedCounter = 0;
        let mutationLedCounter = 0;

        prng.reseed(activeSeed);
        fillBasePattern(basePattern, prng);
        copyPattern(basePattern, livePattern);
        copyPattern(basePattern, candidatePattern);
        clearPattern(anchorPattern);
        lastMutationIndices.fill(-1);
        fillHeldOutputs(outputs, livePattern, cellIndex);

        let instance;

        const regenerate = (seed, panelSeed) => {
            activeSeed = seed;
            activePanelSeed = panelSeed;
            prng.reseed(activeSeed);
            fillBasePattern(basePattern, prng);
            copyPattern(basePattern, livePattern);
            copyPattern(basePattern, candidatePattern);
            lastMutationIndices.fill(-1);
            lastMutationDeltas.fill(0);
            lastMutationCount = 0;
        };

        const captureAnchor = () => {
            copyPattern(livePattern, anchorPattern);
            anchorValid = true;
        };

        const requestMutation = (amount, mask) => {
            if (mask === 0) {
                pendingMutate = false;
                pendingAmount = DEFAULT_AMOUNT;
                pendingMask = 0;
                return;
            }
            pendingMutate = true;
            pendingAmount = amount;
            pendingMask = mask;
        };

        const commitMutation = (amount, mask) => {
            lastMutationCount = mutatePattern(
                livePattern,
                candidatePattern,
                activeLength,
                Math.min(amount, activeLength),
                mask,
                prng,
                shuffle,
                lastMutationIndices,
                lastMutationDeltas
            );
            copyPattern(candidatePattern, livePattern);
            mutationLedCounter = ledHoldSamples;
        };

        const updateSeedFeedback = (target, effectiveHold, panelSeed) => {
            nextSeed = target;
            if (target === activeSeed) {
                seedPendingState = 0;
            } else if (effectiveHold && panelSeed === activePanelSeed) {
                seedPendingState = 2;
            } else {
                seedPendingState = 1;
            }
            instance.activeSeed = activeSeed;
            instance.nextSeed = nextSeed;
            instance.seedPendingState = seedPendingState;
        };

        const commitBoundary = (
            targetSeed,
            effectiveHold,
            naturalBoundary,
            forceRestart,
            ordinaryCell,
            requestedPanelSeed,
            requestedLength,
            requestedAmount,
            requestedChance,
            requestedLaneMask
        ) => {
            let enteredCell = forceRestart ? 0 : ordinaryCell;
            let deliberateCommit = false;
            let manualWinner = false;
            const explicitPanelIntent = requestedPanelSeed !== activePanelSeed;

            if (
                targetSeed !== activeSeed &&
                (!effectiveHold || explicitPanelIntent)
            ) {
                regenerate(targetSeed, requestedPanelSeed);
                enteredCell = 0;
                deliberateCommit = true;
            } else if (
                targetSeed === activeSeed &&
                explicitPanelIntent
            ) {
                activePanelSeed = requestedPanelSeed;
            }

            if (naturalBoundary && requestedLength !== activeLength) {
                activeLength = requestedLength;
                deliberateCommit = true;
            }

            if (pendingRecall && anchorValid) {
                copyPattern(anchorPattern, livePattern);
                pendingRecall = false;
                pendingMutate = false;
                pendingAmount = DEFAULT_AMOUNT;
                pendingMask = 0;
                deliberateCommit = true;
                manualWinner = true;
            } else if (pendingMutate) {
                commitMutation(pendingAmount, pendingMask);
                pendingMutate = false;
                pendingAmount = DEFAULT_AMOUNT;
                pendingMask = 0;
                deliberateCommit = true;
                manualWinner = true;
            }

            if (deliberateCommit) changeAutoGuard = true;

            if (naturalBoundary) {
                if (
                    !manualWinner &&
                    !effectiveHold &&
                    requestedLaneMask !== 0 &&
                    !changeAutoGuard &&
                    prng.bounded(100) < requestedChance
                ) {
                    commitMutation(requestedAmount, requestedLaneMask);
                }
                changeAutoGuard = false;
            }

            cellIndex = enteredCell;
            substepIndex = 0;
            restartPending = false;
            updateSeedFeedback(targetSeed, effectiveHold, requestedPanelSeed);
        };

        instance = {
            params: {
                seed: DEFAULT_SEED,
                length: DEFAULT_LENGTH,
                amount: DEFAULT_AMOUNT,
                chance: DEFAULT_CHANCE,
                mutateKey: 1,
                mutateHarm: 1,
                mutateEnergy: 1,
                mutateMod: 1,
                mutate: 0,
                anchor: 0,
                recall: 0
            },

            inputs: { clock, reset, seedCV, mutateTrig, recallTrig, hold },
            outputs,
            leds: {
                cell1: 1,
                cell2: 0,
                cell3: 0,
                cell4: 0,
                cell5: 0,
                cell6: 0,
                cell7: 0,
                cell8: 0,
                substep: 1 / 64,
                anchor: 0,
                pending: 0,
                seedPending: 0,
                mutation: 0
            },
            activeSeed,
            nextSeed,
            seedPendingState,
            pendingActionState: 0,

            process() {
                const requestedPanelSeed = finiteInteger(
                    this.params.seed,
                    activePanelSeed,
                    0,
                    65535
                );
                const requestedLength = finiteInteger(
                    this.params.length,
                    activeLength,
                    1,
                    CELL_COUNT
                );
                const requestedAmount = finiteInteger(
                    this.params.amount,
                    DEFAULT_AMOUNT,
                    1,
                    CELL_COUNT
                );
                const requestedChance = finiteInteger(
                    this.params.chance,
                    DEFAULT_CHANCE,
                    0,
                    100
                );
                const requestedLaneMask = laneMaskFromParams(this.params);
                const panelHold = finiteSwitch(this.params.anchor, false);
                const panelMutateHigh = Number.isFinite(this.params.mutate) &&
                    this.params.mutate >= 0.5;
                const panelRecallHigh = Number.isFinite(this.params.recall) &&
                    this.params.recall >= 0.5;
                let panelMutateRising = false;
                let panelRecallRising = false;

                if (firstProcessPending) {
                    firstProcessPending = false;
                    activeLength = requestedLength;
                    const hydrationTarget = mapRefrainSeed(
                        requestedPanelSeed,
                        seedCV[0]
                    );
                    regenerate(hydrationTarget, requestedPanelSeed);
                    cellIndex = 0;
                    substepIndex = 0;
                    restartPending = true;
                    lastPanelMutateHigh = panelMutateHigh;
                    lastPanelRecallHigh = panelRecallHigh;
                    lastEffectiveHold = panelHold || (
                        Number.isFinite(hold[0]) &&
                        hold[0] >= TRIGGER_THRESHOLD
                    );
                    if (lastEffectiveHold) captureAnchor();
                    updateSeedFeedback(
                        hydrationTarget,
                        lastEffectiveHold,
                        requestedPanelSeed
                    );
                } else {
                    panelMutateRising = panelMutateHigh && !lastPanelMutateHigh;
                    panelRecallRising = panelRecallHigh && !lastPanelRecallHigh;
                    lastPanelMutateHigh = panelMutateHigh;
                    lastPanelRecallHigh = panelRecallHigh;
                }

                let acceptedClockThisBlock = false;
                for (let sample = 0; sample < bufferSize; sample++) {
                    const holdInputHigh = Number.isFinite(hold[sample]) &&
                        hold[sample] >= TRIGGER_THRESHOLD;
                    const effectiveHold = panelHold || holdInputHigh;
                    if (effectiveHold && !lastEffectiveHold) captureAnchor();
                    lastEffectiveHold = effectiveHold;

                    const mutateInputHigh = Number.isFinite(mutateTrig[sample]) &&
                        mutateTrig[sample] >= TRIGGER_THRESHOLD;
                    const recallInputHigh = Number.isFinite(recallTrig[sample]) &&
                        recallTrig[sample] >= TRIGGER_THRESHOLD;
                    const mutateInputRising = mutateInputHigh && !lastMutateTrigHigh;
                    const recallInputRising = recallInputHigh && !lastRecallTrigHigh;
                    lastMutateTrigHigh = mutateInputHigh;
                    lastRecallTrigHigh = recallInputHigh;

                    if (
                        (sample === 0 && panelMutateRising) ||
                        mutateInputRising
                    ) {
                        requestMutation(requestedAmount, requestedLaneMask);
                    }
                    if (
                        ((sample === 0 && panelRecallRising) ||
                            recallInputRising) &&
                        anchorValid
                    ) {
                        pendingRecall = true;
                    }

                    const targetSeed = mapRefrainSeed(
                        requestedPanelSeed,
                        seedCV[sample]
                    );
                    updateSeedFeedback(
                        targetSeed,
                        effectiveHold,
                        requestedPanelSeed
                    );

                    const resetHigh = Number.isFinite(reset[sample]) &&
                        reset[sample] >= TRIGGER_THRESHOLD;
                    const clockHigh = Number.isFinite(clock[sample]) &&
                        clock[sample] > CLOCK_THRESHOLD;
                    const resetRising = resetHigh && !lastResetHigh;
                    const clockRising = clockHigh && !lastClockHigh;
                    lastResetHigh = resetHigh;
                    lastClockHigh = clockHigh;

                    if (resetRising) restartPending = true;

                    if (clockRising) {
                        acceptedClockThisBlock = true;
                        clockLedCounter = ledHoldSamples;

                        if (resetRising || restartPending) {
                            commitBoundary(
                                targetSeed,
                                effectiveHold,
                                false,
                                true,
                                0,
                                requestedPanelSeed,
                                requestedLength,
                                requestedAmount,
                                requestedChance,
                                requestedLaneMask
                            );
                        } else if (substepIndex === CLOCKS_PER_CELL - 1) {
                            const naturalBoundary = cellIndex === activeLength - 1;
                            commitBoundary(
                                targetSeed,
                                effectiveHold,
                                naturalBoundary,
                                false,
                                naturalBoundary ? 0 : cellIndex + 1,
                                requestedPanelSeed,
                                requestedLength,
                                requestedAmount,
                                requestedChance,
                                requestedLaneMask
                            );
                        } else {
                            substepIndex++;
                        }
                    }

                    key[sample] = livePattern.key[cellIndex] / 12;
                    harm[sample] = livePattern.harm[cellIndex] / 4;
                    energy[sample] = livePattern.energy[cellIndex] / 4;
                    mod[sample] = livePattern.mod[cellIndex] / 4;
                    if (clockLedCounter > 0) clockLedCounter--;
                    if (mutationLedCounter > 0) mutationLedCounter--;
                }

                this.activeSeed = activeSeed;
                this.nextSeed = nextSeed;
                this.seedPendingState = seedPendingState;
                this.pendingActionState = pendingRecall ? 2 : (pendingMutate ? 1 : 0);
                this.leds.cell1 = cellIndex === 0 ? 1 : 0;
                this.leds.cell2 = cellIndex === 1 && activeLength > 1 ? 1 : 0;
                this.leds.cell3 = cellIndex === 2 && activeLength > 2 ? 1 : 0;
                this.leds.cell4 = cellIndex === 3 && activeLength > 3 ? 1 : 0;
                this.leds.cell5 = cellIndex === 4 && activeLength > 4 ? 1 : 0;
                this.leds.cell6 = cellIndex === 5 && activeLength > 5 ? 1 : 0;
                this.leds.cell7 = cellIndex === 6 && activeLength > 6 ? 1 : 0;
                this.leds.cell8 = cellIndex === 7 && activeLength > 7 ? 1 : 0;
                this.leds.substep = acceptedClockThisBlock || clockLedCounter > 0
                    ? 1
                    : ((substepIndex + 1) / CLOCKS_PER_CELL) * 0.25;
                this.leds.anchor = anchorValid ? (lastEffectiveHold ? 1 : 0.5) : 0;
                this.leds.pending = pendingRecall ? 1 : (pendingMutate ? 0.5 : 0);
                this.leds.seedPending = seedPendingState === 2
                    ? 0.5
                    : seedPendingState;
                this.leds.mutation = mutationLedCounter > 0 ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                reset.fill(0);
                seedCV.fill(0);
                mutateTrig.fill(0);
                recallTrig.fill(0);
                hold.fill(0);
                activeSeed = DEFAULT_SEED;
                activePanelSeed = DEFAULT_SEED;
                nextSeed = DEFAULT_SEED;
                seedPendingState = 0;
                activeLength = DEFAULT_LENGTH;
                prng.reseed(activeSeed);
                fillBasePattern(basePattern, prng);
                copyPattern(basePattern, livePattern);
                copyPattern(basePattern, candidatePattern);
                clearPattern(anchorPattern);
                shuffle.fill(0);
                lastMutationIndices.fill(-1);
                lastMutationDeltas.fill(0);
                cellIndex = 0;
                substepIndex = 0;
                restartPending = true;
                lastClockHigh = false;
                lastResetHigh = false;
                lastPanelMutateHigh = false;
                lastPanelRecallHigh = false;
                lastMutateTrigHigh = false;
                lastRecallTrigHigh = false;
                lastEffectiveHold = false;
                anchorValid = false;
                pendingMutate = false;
                pendingRecall = false;
                pendingAmount = DEFAULT_AMOUNT;
                pendingMask = 0;
                changeAutoGuard = false;
                lastMutationCount = 0;
                firstProcessPending = true;
                clockLedCounter = 0;
                mutationLedCounter = 0;
                this.params.mutate = 0;
                this.params.recall = 0;
                fillHeldOutputs(outputs, livePattern, cellIndex);
                this.activeSeed = activeSeed;
                this.nextSeed = nextSeed;
                this.seedPendingState = seedPendingState;
                this.pendingActionState = 0;
                this.leds.cell1 = 1;
                this.leds.cell2 = 0;
                this.leds.cell3 = 0;
                this.leds.cell4 = 0;
                this.leds.cell5 = 0;
                this.leds.cell6 = 0;
                this.leds.cell7 = 0;
                this.leds.cell8 = 0;
                this.leds.substep = 1 / 64;
                this.leds.anchor = 0;
                this.leds.pending = 0;
                this.leds.seedPending = 0;
                this.leds.mutation = 0;
            },

            getDebugState() {
                prng.getStateWords(prngStateScratch);
                const mutationIndices = [];
                const mutationDeltas = [];
                for (let selection = 0; selection < lastMutationCount; selection++) {
                    mutationIndices.push(lastMutationIndices[selection]);
                    const deltaOffset = selection * LANE_COUNT;
                    mutationDeltas.push([
                        lastMutationDeltas[deltaOffset],
                        lastMutationDeltas[deltaOffset + 1],
                        lastMutationDeltas[deltaOffset + 2],
                        lastMutationDeltas[deltaOffset + 3]
                    ]);
                }
                return {
                    activeSeed,
                    activePanelSeed,
                    nextSeed,
                    seedPendingState,
                    activeLength,
                    cellIndex,
                    substepIndex,
                    restartPending,
                    effectiveHold: lastEffectiveHold,
                    anchorValid,
                    pendingMutate,
                    pendingRecall,
                    pendingAmount,
                    pendingMask,
                    changeAutoGuard,
                    firstProcessPending,
                    prngState: [prngStateScratch[0], prngStateScratch[1]],
                    basePattern: patternSnapshot(basePattern),
                    livePattern: patternSnapshot(livePattern),
                    anchorPattern: patternSnapshot(anchorPattern),
                    lastMutationIndices: mutationIndices,
                    lastMutationDeltas: mutationDeltas
                };
            }
        };

        return instance;
    },

    ui: REFRAIN_UI,
    render: renderRefrain
};
