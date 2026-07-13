import { clamp, expMap } from '../../utils/math.js';
import { wrapPhase } from '../../utils/oscillator.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const MAX_VOICES = 16;
const FREEZE_THRESHOLD = 2.5;

const SCALE_GROUPS = Object.freeze([
    Object.freeze([
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 2, 4, 5, 7, 9, 11],
        [0, 2, 3, 5, 7, 8, 10],
        [0, 2, 3, 5, 7, 9, 10],
        [0, 2, 4, 7, 9],
        [0, 3, 5, 7, 10],
        [0, 2, 5, 7, 10],
        [0, 1, 4, 5, 7, 8, 11],
        [0, 2, 4, 6, 8, 10],
        [0, 3, 6, 9]
    ]),
    Object.freeze([
        [0, 12],
        [0, 7.02, 12],
        [0, 3.86, 7.02, 10.88, 12],
        [0, 5.04, 7.02, 12],
        [0, 2.04, 3.86, 5.51, 7.02, 8.41, 9.69, 10.88, 12],
        [0, 4.98, 9.69, 12],
        [0, 6, 12],
        [0, 2.31, 4.62, 6.93, 9.24, 12],
        [0, 1.12, 4.77, 7.31, 10.16, 12],
        [0, 0.14, 7.02, 7.16, 12]
    ]),
    Object.freeze([
        [0, 5, 9, 14],
        [0, 3, 7, 10, 15],
        [0, 4, 11, 16],
        [0, 2.5, 6.5, 10.5, 15],
        [0, 1.7, 5.4, 9.8, 14.3],
        [0, 6.8, 11.1, 17],
        [0, 3.2, 8.1, 13.7],
        [0, 2, 7, 12, 19],
        [0, 4.5, 9.5, 15.5],
        [0, 1, 4, 8, 13, 19]
    ])
]);

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function sanitizeScale(notes) {
    const clean = Array.isArray(notes)
        ? notes.filter(Number.isFinite).map(note => clamp(note, -48, 96))
        : [];
    clean.push(0);
    clean.sort((a, b) => a - b);
    const unique = [];
    for (const note of clean) {
        if (!unique.length || Math.abs(note - unique[unique.length - 1]) > 0.001) unique.push(note);
        if (unique.length === 16) break;
    }
    return unique;
}

function scaleSlot(group, scale) {
    return Math.round(clamp(group, 0, 2)) * 10 + Math.round(clamp(scale, 0, 9));
}

function quantizePosition(position, notes, group, crossfade) {
    const span = group === 2 ? Math.max(1, notes[notes.length - 1] - notes[0]) : 12;
    const octave = Math.floor(position / span);
    const local = position - octave * span;
    let lower = notes[0];
    let upper = notes[0] + span;
    for (let i = 0; i < notes.length; i++) {
        if (notes[i] <= local) lower = notes[i];
        if (notes[i] >= local) { upper = notes[i]; break; }
    }
    if (upper < lower) upper += span;
    const low = lower + octave * span;
    const high = upper + octave * span;
    if (crossfade <= 0.001 || high === low) return position - low < high - position ? low : high;
    const fraction = clamp((position - low) / (high - low));
    const smooth = fraction * fraction * (3 - 2 * fraction);
    const blend = clamp(crossfade);
    const snapped = fraction < 0.5 ? low : high;
    return snapped * (1 - blend) + (low + (high - low) * smooth) * blend;
}

function twistPhase(phase, amount, mode) {
    if (amount <= 0) return phase;
    if (mode === 0) {
        const exponent = 1 + amount * 5;
        return phase < 0.5
            ? 0.5 * ((phase * 2) ** exponent)
            : 1 - 0.5 * (((1 - phase) * 2) ** exponent);
    }
    if (mode === 1) {
        const width = 1 - amount * 0.9;
        return phase < width ? phase / width : 0;
    }
    const steps = Math.max(4, Math.round(64 - amount * 60));
    return Math.floor(phase * steps) / steps;
}

function warpSample(value, amount, mode) {
    if (amount <= 0) return value;
    if (mode === 0) {
        const drive = 1 + amount * 6;
        const folded = Math.abs((((value * drive + 1) % 4) + 4) % 4 - 2) - 1;
        return value * (1 - amount) + folded * amount;
    }
    if (mode === 1) {
        const order = Math.max(1, Math.round(1 + amount * 15));
        return Math.cos(order * Math.acos(clamp(value, -1, 1)));
    }
    const segments = Math.max(2, Math.round(2 + amount * 6));
    const stepped = Math.round(value * segments) / segments;
    return value * (1 - amount) + stepped * amount;
}

function renderPanel(container, { instance, toolkit, onParamChange }) {
    const dsp = instance.dsp;
    const root = toolkit.createRow('ensemble-grid');
    const knobs = [
        ['root', 'Root', 0, 1], ['spread', 'Spread', 0, 1], ['pitch', 'Pitch', -2, 2],
        ['fine', 'Fine', -1, 1], ['scale', 'Scale', 0, 9], ['balance', 'Balance', 0, 1],
        ['detune', 'Detune', 0, 1], ['oscillatorCount', 'Voices', 1, 16], ['crossfade', 'XFade', 0, 1],
        ['crossFm', 'Cross FM', 0, 1], ['twist', 'Twist', 0, 1], ['warp', 'Warp', 0, 1],
        ['learnNote', 'Note', -24, 48]
    ];
    knobs.forEach(([param, label, min, max]) => root.appendChild(toolkit.createKnob({
        id: param, label, param, min, max, value: dsp?.params[param], small: true
    })));
    container.appendChild(root);

    const modes = toolkit.createRow('ensemble-mode-grid');
    [
        ['scaleGroup', 'Scale Group'],
        ['crossFmMode', 'Cross FM'],
        ['twistMode', 'Twist'],
        ['warpMode', 'Warp'],
        ['stereoMode', 'Stereo'],
        ['freezeMode', 'Freeze Set']
    ].forEach(([param, label]) => modes.appendChild(toolkit.createButtonBank({
        id: param, label, param, values: [0, 1, 2], defaultValue: dsp?.params[param] || 0
    })));
    container.appendChild(modes);

    const actions = toolkit.createRow('ensemble-actions');
    actions.appendChild(toolkit.createActionButton({
        id: 'learnMode', label: 'Learn', param: 'learnMode', mode: 'toggle', value: dsp?.params.learnMode || 0
    }));
    actions.appendChild(toolkit.createActionButton({
        id: 'freeze', label: 'Freeze', param: 'freeze', mode: 'toggle', value: dsp?.params.freeze || 0
    }));
    actions.appendChild(toolkit.createActionButton({
        id: 'addNote', label: 'Add', param: 'addNote', mode: 'trigger', value: 0,
        onChange(value) {
            if (value) {
                dsp?.addLearnedNote();
                onParamChange('scaleMemory', dsp.params.scaleMemory);
            }
        }
    }));
    actions.appendChild(toolkit.createActionButton({
        id: 'deleteNote', label: 'Delete', param: 'deleteNote', mode: 'trigger', value: 0,
        onChange(value) {
            if (value) {
                dsp?.deleteLearnedNote();
                onParamChange('scaleMemory', dsp.params.scaleMemory);
            }
        }
    }));
    actions.appendChild(toolkit.createActionButton({
        id: 'resetScale', label: 'Factory', param: 'resetScale', mode: 'trigger', value: 0,
        onChange(value) {
            if (value) {
                dsp?.resetFactoryScale();
                onParamChange('scaleMemory', dsp.params.scaleMemory);
            }
        }
    }));
    container.appendChild(actions);

    container.appendChild(toolkit.createSection('Out'));
    const outputs = toolkit.createRow('ensemble-output-row');
    ['mono', 'outA', 'outB'].forEach(port => outputs.appendChild(toolkit.createJack({
        id: port, label: port === 'mono' ? 'Mono' : port === 'outA' ? 'A' : 'B', direction: 'output', signal: 'audio'
    })));
    container.appendChild(outputs);

    container.appendChild(toolkit.createSection('CV'));
    const inputs = toolkit.createRow('ensemble-input-grid');
    [
        ['root', 'Root'], ['pitch', 'Pitch'], ['scaleCv', 'Scale'], ['spreadCv', 'Spread'],
        ['balanceCv', 'Bal'], ['crossFmCv', 'XFM'], ['twistCv', 'Twist'], ['warpCv', 'Warp'],
        ['learn', 'Learn'], ['freeze', 'Freeze']
    ].forEach(([port, label]) => inputs.appendChild(toolkit.createJack({ id: port, label, direction: 'input' })));
    container.appendChild(inputs);
}

export default {
    id: 'ensemble-vco',
    name: 'ENSEMBLE',
    hp: 16,
    color: 'module-color-seven',
    category: 'source',
    telemetry: { fields: [], methods: [] },

    css: `
        .module-type-ensemble-vco .module-content {
            min-height: 0;
            gap: 3px;
            overflow: hidden;
        }
        .ensemble-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            align-items: start;
            justify-items: center;
            gap: 4px 5px;
            width: 100%;
        }
        .ensemble-grid .knob-container {
            min-width: 0;
        }
        .ensemble-grid .knob-label {
            font-size: 6px;
            line-height: 1;
            white-space: nowrap;
        }
        .ensemble-mode-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2px 6px;
            width: 100%;
        }
        .ensemble-mode-grid > div {
            min-width: 0;
        }
        .ensemble-mode-grid .section-label {
            border-top: 0;
            margin: 0;
            padding: 0;
            font-size: 6px;
            line-height: 1;
            white-space: nowrap;
        }
        .ensemble-mode-grid .button-bank {
            justify-content: center;
            padding: 2px 0 0;
        }
        .ensemble-actions,
        .ensemble-output-row,
        .ensemble-input-grid {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            width: 100%;
        }
        .ensemble-actions {
            gap: 3px;
        }
        .ensemble-actions .action-btn {
            height: 18px;
            min-width: 0;
            padding: 0 5px;
            border: 1px solid currentColor;
            border-radius: 0;
            background: transparent;
            color: inherit;
            font: inherit;
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            cursor: pointer;
        }
        .ensemble-actions .action-btn.active {
            color: var(--factory-orange, #f05a28);
        }
        .ensemble-input-grid {
            display: grid;
            grid-template-columns: repeat(10, minmax(0, 1fr));
            gap: 2px;
        }
        .ensemble-output-row .jack,
        .ensemble-input-grid .jack {
            width: 20px;
            height: 20px;
        }
        .ensemble-output-row .jack-container,
        .ensemble-input-grid .jack-container {
            min-width: 0;
        }
        .ensemble-input-grid .jack-label {
            font-size: 5px;
            white-space: nowrap;
        }
        .ensemble-grid,
        .ensemble-mode-grid,
        .ensemble-actions,
        .ensemble-output-row,
        .ensemble-input-grid {
            flex-shrink: 0;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const inputs = {
            root: new Float32Array(bufferSize),
            pitch: new Float32Array(bufferSize),
            scaleCv: new Float32Array(bufferSize),
            spreadCv: new Float32Array(bufferSize),
            balanceCv: new Float32Array(bufferSize),
            crossFmCv: new Float32Array(bufferSize),
            twistCv: new Float32Array(bufferSize),
            warpCv: new Float32Array(bufferSize),
            learn: new Float32Array(bufferSize),
            freeze: new Float32Array(bufferSize)
        };
        const mono = new Float32Array(bufferSize);
        const outA = new Float32Array(bufferSize);
        const outB = new Float32Array(bufferSize);
        const phases = new Float64Array(MAX_VOICES);
        const frequencies = new Float64Array(MAX_VOICES);
        const frozenFrequencies = new Float64Array(MAX_VOICES);
        const previousSines = new Float64Array(MAX_VOICES);
        const weights = new Float64Array(MAX_VOICES);
        const frozenVoices = new Uint8Array(MAX_VOICES);
        let lastLearn = 0;
        let lastFreeze = 0;
        let frozen = false;
        let lastScaleSlot = -1;

        const dsp = {
            params: {
                root: 0.35,
                pitch: 0,
                fine: 0,
                spread: 0.4,
                scale: 1,
                scaleGroup: 0,
                detune: 0.08,
                oscillatorCount: 8,
                balance: 0.5,
                crossfade: 0.75,
                crossFm: 0,
                crossFmMode: 0,
                twist: 0,
                twistMode: 0,
                warp: 0,
                warpMode: 0,
                stereoMode: 0,
                freezeMode: 0,
                freeze: 0,
                learnMode: 0,
                learnNote: 7,
                addNote: 0,
                deleteNote: 0,
                resetScale: 0,
                scaleMemory: {}
            },
            inputs,
            outputs: { mono, outA, outB },
            leds: { learn: 0, freeze: 0, scale: 0 },

            currentScale(group, scale) {
                const slot = scaleSlot(group, scale);
                const learned = this.params.scaleMemory?.[slot];
                return learned ? sanitizeScale(learned) : SCALE_GROUPS[group][scale];
            },

            addLearnedNote(note = this.params.learnNote) {
                const group = Math.round(clamp(finite(this.params.scaleGroup), 0, 2));
                const scale = Math.round(clamp(finite(this.params.scale), 0, 9));
                const slot = scaleSlot(group, scale);
                const current = this.params.scaleMemory?.[slot] || [0];
                this.params.scaleMemory = { ...this.params.scaleMemory, [slot]: sanitizeScale([...current, finite(note)]) };
            },

            deleteLearnedNote() {
                const slot = scaleSlot(this.params.scaleGroup, this.params.scale);
                const current = sanitizeScale(this.params.scaleMemory?.[slot] || [0]);
                if (current.length > 1) current.pop();
                this.params.scaleMemory = { ...this.params.scaleMemory, [slot]: current };
            },

            resetFactoryScale() {
                const slot = scaleSlot(this.params.scaleGroup, this.params.scale);
                const next = { ...this.params.scaleMemory };
                delete next[slot];
                this.params.scaleMemory = next;
            },

            toggleFreeze(count) {
                frozen = !frozen;
                frozenVoices.fill(0);
                if (frozen) {
                    const mode = Math.round(clamp(finite(this.params.freezeMode), 0, 2));
                    for (let voice = 0; voice < count; voice++) {
                        const shouldFreeze = mode === 0 ? voice === 0 : mode === 1 ? voice < Math.ceil(count / 2) : voice % 2 === 0;
                        if (shouldFreeze) {
                            frozenVoices[voice] = 1;
                            frozenFrequencies[voice] = frequencies[voice];
                        }
                    }
                }
                this.params.freeze = frozen ? 1 : 0;
            },

            process() {
                const count = Math.round(clamp(finite(this.params.oscillatorCount, 8), 1, MAX_VOICES));
                const group = Math.round(clamp(finite(this.params.scaleGroup), 0, 2));
                const selectedScale = clamp(
                    Math.round(finite(this.params.scale, 1) + finite(inputs.scaleCv[0]) / 5 * 9), 0, 9
                );
                const notes = this.currentScale(group, selectedScale);
                const slot = scaleSlot(group, selectedScale);
                if (slot !== lastScaleSlot) {
                    this.leds.scale = 1;
                    lastScaleSlot = slot;
                } else {
                    this.leds.scale *= 0.9;
                }

                const rootFrequency = expMap(clamp(finite(this.params.root, 0.35)), 27.5, 440);
                const spread = clamp(finite(this.params.spread, 0.4) + finite(inputs.spreadCv[0]) / 5);
                const rootSemitones = finite(inputs.root[0]) * 12;
                const pitchSemitones = finite(this.params.pitch) * 24 + finite(inputs.pitch[0]) * 12 + finite(this.params.fine);
                const crossfade = clamp(finite(this.params.crossfade, 0.75));
                const detune = clamp(finite(this.params.detune, 0.08)) * 0.4;
                const balance = clamp(finite(this.params.balance, 0.5) + finite(inputs.balanceCv[0]) / 5);

                let weightEnergy = 0;
                for (let voice = 0; voice < count; voice++) {
                    const position = rootSemitones + spread * voice * 2.5;
                    const gridSemitone = quantizePosition(position, notes, group, crossfade);
                    const detuneOffset = count === 1 ? 0 : (voice / (count - 1) * 2 - 1) * detune;
                    const target = rootFrequency * 2 ** ((gridSemitone + pitchSemitones + detuneOffset) / 12);
                    if (!(frozen && frozenVoices[voice])) frequencies[voice] = clamp(target, 0.01, sampleRate * 0.45);
                    else frequencies[voice] = frozenFrequencies[voice];
                    const normalized = count === 1 ? 0 : voice / (count - 1);
                    const tilt = balance < 0.5
                        ? Math.exp(-normalized * (0.5 - balance) * 8)
                        : Math.exp(-(1 - normalized) * (balance - 0.5) * 8);
                    weights[voice] = tilt;
                    weightEnergy += tilt * tilt;
                }
                const normalization = 1 / Math.sqrt(Math.max(1e-9, weightEnergy));

                for (let i = 0; i < bufferSize; i++) {
                    const learnValue = finite(inputs.learn[i]);
                    const freezeValue = finite(inputs.freeze[i]);
                    if (learnValue > FREEZE_THRESHOLD && lastLearn <= FREEZE_THRESHOLD && finite(this.params.learnMode) >= 0.5) {
                        this.addLearnedNote(finite(inputs.pitch[i]) * 12);
                    }
                    if (freezeValue > FREEZE_THRESHOLD && lastFreeze <= FREEZE_THRESHOLD) this.toggleFreeze(count);
                    lastLearn = learnValue;
                    lastFreeze = freezeValue;

                    const crossFm = clamp(finite(this.params.crossFm) + finite(inputs.crossFmCv[i]) / 5);
                    const twist = clamp(finite(this.params.twist) + finite(inputs.twistCv[i]) / 5);
                    const warp = clamp(finite(this.params.warp) + finite(inputs.warpCv[i]) / 5);
                    const crossMode = Math.round(clamp(finite(this.params.crossFmMode), 0, 2));
                    const twistMode = Math.round(clamp(finite(this.params.twistMode), 0, 2));
                    const warpMode = Math.round(clamp(finite(this.params.warpMode), 0, 2));
                    const stereoMode = Math.round(clamp(finite(this.params.stereoMode), 0, 2));
                    let monoSample = 0;
                    let aSample = 0;
                    let bSample = 0;

                    for (let voice = 0; voice < count; voice++) {
                        let modulator;
                        if (crossMode === 0) modulator = previousSines[0];
                        else if (crossMode === 1) modulator = previousSines[(voice + count - 1) % count];
                        else modulator = previousSines[count - 1];
                        const increment = frequencies[voice] / sampleRate * (1 + modulator * crossFm * 0.45);
                        phases[voice] = wrapPhase(phases[voice] + increment);
                        const shapedPhase = twistPhase(phases[voice], twist, twistMode);
                        const sine = Math.sin(2 * Math.PI * shapedPhase);
                        previousSines[voice] = sine;
                        const shaped = warpSample(sine, warp, warpMode) * weights[voice] * normalization;
                        monoSample += shaped;
                        const toA = stereoMode === 0 ? voice % 2 === 0 : stereoMode === 1 ? voice < Math.ceil(count / 2) : voice === 0;
                        if (toA) aSample += shaped;
                        else bSample += shaped;
                    }
                    mono[i] = softLimitVoltage(monoSample * 4, 5);
                    outA[i] = softLimitVoltage(aSample * 4, 5);
                    outB[i] = softLimitVoltage(bSample * 4, 5);
                }

                this.leds.learn = finite(this.params.learnMode) >= 0.5 ? 1 : 0;
                this.leds.freeze = frozen ? 1 : 0;
            },

            getVoiceFrequencies() {
                return Array.from(frequencies);
            },

            getFrozen() {
                return frozen;
            },

            reset() {
                phases.fill(0);
                frequencies.fill(0);
                frozenFrequencies.fill(0);
                previousSines.fill(0);
                weights.fill(0);
                frozenVoices.fill(0);
                mono.fill(0);
                outA.fill(0);
                outB.fill(0);
                lastLearn = 0;
                lastFreeze = 0;
                frozen = false;
                lastScaleSlot = -1;
                this.params.freeze = 0;
                this.leds.learn = 0;
                this.leds.freeze = 0;
                this.leds.scale = 0;
            }
        };
        return dsp;
    },

    render: renderPanel,

    ui: {
        leds: ['learn', 'freeze', 'scale'],
        knobs: [
            { id: 'root', label: 'Root', param: 'root', min: 0, max: 1, default: 0.35 },
            { id: 'pitch', label: 'Pitch', param: 'pitch', min: -2, max: 2, default: 0 },
            { id: 'fine', label: 'Fine', param: 'fine', min: -1, max: 1, default: 0 },
            { id: 'spread', label: 'Spread', param: 'spread', min: 0, max: 1, default: 0.4 },
            { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: 9, default: 1 },
            { id: 'detune', label: 'Detune', param: 'detune', min: 0, max: 1, default: 0.08 },
            { id: 'oscillatorCount', label: 'Voices', param: 'oscillatorCount', min: 1, max: 16, default: 8 },
            { id: 'balance', label: 'Balance', param: 'balance', min: 0, max: 1, default: 0.5 },
            { id: 'crossfade', label: 'XFade', param: 'crossfade', min: 0, max: 1, default: 0.75 },
            { id: 'crossFm', label: 'Cross FM', param: 'crossFm', min: 0, max: 1, default: 0 },
            { id: 'twist', label: 'Twist', param: 'twist', min: 0, max: 1, default: 0 },
            { id: 'warp', label: 'Warp', param: 'warp', min: 0, max: 1, default: 0 },
            { id: 'learnNote', label: 'Note', param: 'learnNote', min: -24, max: 48, default: 7 }
        ],
        buttons: [
            { id: 'scaleGroup', label: 'Group', param: 'scaleGroup', values: [0, 1, 2], default: 0 },
            { id: 'crossFmMode', label: 'FM Mode', param: 'crossFmMode', values: [0, 1, 2], default: 0 },
            { id: 'twistMode', label: 'Twist Mode', param: 'twistMode', values: [0, 1, 2], default: 0 },
            { id: 'warpMode', label: 'Warp Mode', param: 'warpMode', values: [0, 1, 2], default: 0 },
            { id: 'stereoMode', label: 'Stereo', param: 'stereoMode', values: [0, 1, 2], default: 0 },
            { id: 'freezeMode', label: 'Freeze Mode', param: 'freezeMode', values: [0, 1, 2], default: 0 }
        ],
        actions: [
            { id: 'freeze', label: 'Freeze', param: 'freeze', mode: 'toggle', default: 0 },
            { id: 'learnMode', label: 'Learn', param: 'learnMode', mode: 'toggle', default: 0 },
            { id: 'addNote', label: 'Add', param: 'addNote', mode: 'trigger', default: 0 },
            { id: 'deleteNote', label: 'Delete', param: 'deleteNote', mode: 'trigger', default: 0 },
            { id: 'resetScale', label: 'Factory', param: 'resetScale', mode: 'trigger', default: 0 }
        ],
        state: [
            { param: 'scaleMemory', default: {} }
        ],
        inputs: [
            { id: 'root', label: 'Root', port: 'root', signal: 'cv' },
            { id: 'pitch', label: 'Pitch', port: 'pitch', signal: 'cv' },
            { id: 'scaleCv', label: 'Scale', port: 'scaleCv', signal: 'cv' },
            { id: 'spreadCv', label: 'Spread', port: 'spreadCv', signal: 'cv' },
            { id: 'balanceCv', label: 'Balance', port: 'balanceCv', signal: 'cv' },
            { id: 'crossFmCv', label: 'Cross FM', port: 'crossFmCv', signal: 'cv' },
            { id: 'twistCv', label: 'Twist', port: 'twistCv', signal: 'cv' },
            { id: 'warpCv', label: 'Warp', port: 'warpCv', signal: 'cv' },
            { id: 'learn', label: 'Learn', port: 'learn', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'freeze', label: 'Freeze', port: 'freeze', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'mono', label: 'Mono', port: 'mono', signal: 'audio' },
            { id: 'outA', label: 'A', port: 'outA', signal: 'audio' },
            { id: 'outB', label: 'B', port: 'outB', signal: 'audio' }
        ]
    }
};
