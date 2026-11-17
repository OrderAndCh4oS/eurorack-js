import { createAirwayKernel, prepareAirway } from '../../audio/chimera-kernel.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';
import { VOCAL_SOUNDS } from './sounds.js';
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
const control = (x, fallback, min, max) => clamp(finite(x, fallback), min, max);
const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const VOICE_CONTROLS = ['breath', 'tension', 'fry', 'brightness', 'roughness', 'voicing', 'nasal', 'twang', 'glide', 'morph'];

const UI = {
    leds: ['active', 'level'],
    knobs: [
        { id: 'pitch', label: 'Pitch', param: 'pitch', min: -24, max: 24, default: 0 },
        { id: 'glide', label: 'Glide', param: 'glide', min: 0, max: 1, default: .005, tooltip: 'Pitch slide time: 2 ms to 1 second' },
        { id: 'sound', label: 'Sound', param: 'sound', min: 0, max: 1, default: 0 },
        { id: 'vowel', label: 'Release', param: 'vowel', min: 0, max: 4, default: 0, tooltip: 'Vowel reached when Articulate releases a consonant' },
        { id: 'articulation', label: 'Articulate', param: 'articulation', min: 0, max: 1, default: 1 },
        { id: 'morph', label: 'Morph', param: 'morph', min: 0, max: 1, default: 0, tooltip: 'Mouth transitions: natural to 20× slower' },
        { id: 'pressure', label: 'Pressure', param: 'pressure', min: 0, max: 22, default: 8 },
        { id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0.8 },
        { id: 'breath', label: 'Breath', param: 'breath', min: 0, max: 1, default: 0.15 },
        { id: 'voicing', label: 'Voicing', param: 'voicing', min: 0, max: 1, default: 1, tooltip: 'Whispered airflow to full voiced tone' },
        { id: 'brightness', label: 'Bright', param: 'brightness', min: 0, max: 1, default: .25, tooltip: 'Soft to sharp vocal-fold closure' },
        { id: 'tension', label: 'Tension', param: 'tension', min: 0, max: 1, default: 0.5 },
        { id: 'roughness', label: 'Rough', param: 'roughness', min: 0, max: 1, default: 0, tooltip: 'Jitter, shimmer and period doubling' },
        { id: 'fry', label: 'Fry', param: 'fry', min: 0, max: 1, default: 0 },
        { id: 'nasal', label: 'Nasal', param: 'nasal', min: 0, max: 1, default: 0, tooltip: 'Open the nasal airway' },
        { id: 'twang', label: 'Twang', param: 'twang', min: 0, max: 1, default: 0, tooltip: 'Narrow the upper throat for a focused resonance' }
    ],
    buttons: VOCAL_SOUNDS.map(sound => ({ id: sound.param, label: sound.label, param: sound.param, values: [0, 1], default: 1 })),
    switches: [{ id: 'female', label: 'Female Tract', param: 'female', default: 0 }],
    inputs: [
        { id: 'vOct', label: 'V/Oct', port: 'vOct', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'vowelCV', label: 'Release', port: 'vowelCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'soundCV', label: 'Sound', port: 'soundCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'articulationCV', label: 'Artic', port: 'articulationCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
        { id: 'pressureCV', label: 'Press', port: 'pressureCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        ...VOICE_CONTROLS.map(param => ({ id: `${param}CV`, port: `${param}CV`,
            label: ({ brightness: 'Bright', roughness: 'Rough', voicing: 'Voice' })[param] || param[0].toUpperCase() + param.slice(1),
            signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }))
    ],
    outputs: [{ id: 'out', label: 'Out', port: 'out', signal: 'audio', voltage: { min: -5, max: 5 } }]
};
function createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
    // Prebuilt anatomies: never rebuild a physical network on the audio thread.
    const kernels = [createAirwayKernel(sampleRate), createAirwayKernel(sampleRate, 'female')];
    const out = new Float32Array(bufferSize);
    const inputs = Object.fromEntries(UI.inputs.map(port => [port.port, new Float32Array(bufferSize)]));
    const params = Object.fromEntries([...UI.knobs, ...UI.buttons, ...UI.switches].map(control => [control.param, control.default]));
    const enabled = new Int32Array(VOCAL_SOUNDS.length);
    const levelSlew = createSlew({ sampleRate, timeMs: 5 });
    const articulationSlew = createSlew({ sampleRate, timeMs: 5 });
    const voiceDefaults = VOICE_CONTROLS.map(param => UI.knobs.find(knob => knob.param === param).default);
    const voiceInputs = VOICE_CONTROLS.map(param => inputs[`${param}CV`]);
    const voiceSlews = VOICE_CONTROLS.map(() => createSlew({ sampleRate: sampleRate / 64, timeMs: 5 }));
    const voiceValues = new Float64Array(voiceDefaults);
    let voiceInitialized = false;
    const meterDecay = Math.exp(-1 / (sampleRate * 0.05));
    const releaseDecay = Math.exp(-1 / (sampleRate * 0.07));
    let controlPhase = 0, started = false, breathRequested = false;
    let initialized = false, meter = 0, active = 0, disposed = false;
    let levelTarget = 0.8, articulationTarget = 0, articulation = 0;
    let tractMix = 0, tractTarget = 0;
    const tractStep = 1 / (sampleRate * .08);
    function renderSpan(start, length) {
        if (!length) return;
        // Only the selected model renders in steady state. Both run during the
        // short crossfade; their isolated oscillator/tract histories stay intact.
        const male = started && (tractMix < 1 || tractTarget === 0) ? kernels[0].render(length) : null;
        const female = started && (tractMix > 0 || tractTarget === 1) ? kernels[1].render(length) : null;
        for (let j = 0; j < length; j++) {
            const gain = levelSlew.process(levelTarget);
            articulation = articulationSlew.process(articulationTarget);
            tractMix += clamp(tractTarget - tractMix, -tractStep, tractStep);
            const audio = (male ? male[j] * (1 - tractMix) : 0) + (female ? female[j] * tractMix : 0);
            const value = softLimitVoltage(5 * gain * audio, 5, 0.8);
            out[start + j] = value;
            meter = Math.max(Math.abs(value) / 5, meter * meterDecay);
        }
    }
    const dsp = {
        params, inputs, outputs: { out }, leds: { active: 0, level: 0 },
        pitchHz: 110, vowelPosition: 0, soundIndex: 0, enabledCount: 32, articulationValue: 0,
        pressureValue: 8, tractMix: 0, displayTick: 0,
        process() {
            if (disposed) { out.fill(0); return; }
            const nextTract = finite(params.female) >= .5 ? 1 : 0;
            // A dormant model can retain the last held breath. Clear it only
            // while completely inaudible and Gate is closed; otherwise preserve
            // physical history throughout the crossfade (including reversals).
            if (nextTract !== tractTarget && started && finite(inputs.gate[0]) < 1 && tractMix === 1 - nextTract) {
                kernels[nextTract].reset();
            }
            tractTarget = nextTract;
            if (!started) tractMix = tractTarget;
            let count = 0;
            for (const sound of VOCAL_SOUNDS) {
                if (finite(params[sound.param], 1) >= .5) enabled[count++] = sound.index;
            }
            dsp.enabledCount = count;
            levelTarget = count ? control(params.level, 0.8, 0, 1) : 0;
            if (!initialized) { levelSlew.reset(levelTarget); initialized = true; }
            let spanStart = 0;
            for (let i = 0; i < bufferSize; i++) {
                const gate = count > 0 && finite(inputs.gate[i]) >= 1;
                if (controlPhase === 0 || gate !== breathRequested) {
                    renderSpan(spanStart, i - spanStart);
                    spanStart = i;
                    dsp.pitchHz = clamp(110 * 2 ** (control(params.pitch, 0, -24, 24) / 12 + finite(inputs.vOct[i])), 40, 1100);
                    dsp.vowelPosition = clamp(control(params.vowel, 0, 0, 4) + 0.8 * finite(inputs.vowelCV[i]), 0, 4);
                    const address = clamp(control(params.sound, 0, 0, 1) + finite(inputs.soundCV[i]) / 5, 0, 1);
                    dsp.soundIndex = count ? enabled[Math.min(count - 1, Math.floor(address * count))] : -1;
                    articulationTarget = clamp(control(params.articulation, 1, 0, 1) + finite(inputs.articulationCV[i]) / 5, 0, 1);
                    dsp.pressureValue = clamp(control(params.pressure, 8, 0, 22) + 4 * finite(inputs.pressureCV[i]), 0, 22);
                    breathRequested = gate;
                    if (gate) started = true;
                    // Fixed control grid and 5 ms smoothing; no per-tick objects.
                    if (controlPhase === 0 || !voiceInitialized) {
                        for (let k = 0; k < VOICE_CONTROLS.length; k++) {
                            const param = VOICE_CONTROLS[k];
                            const target = clamp(control(params[param], voiceDefaults[k], 0, 1) + finite(voiceInputs[k][i]) / 5, 0, 1);
                            if (!voiceInitialized) voiceSlews[k].reset(target);
                            voiceValues[k] = voiceSlews[k].process(target);
                            // Reach canonical zero exactly: Twang's neutral target
                            // must not stay in its active range on a tiny slew tail.
                            if (Math.abs(voiceValues[k] - target) < 1e-9) {
                                voiceValues[k] = target;
                                voiceSlews[k].reset(target);
                            }
                        }
                        voiceInitialized = true;
                    }
                    for (const kernel of kernels) {
                        kernel.setVocalControls(voiceValues[3], voiceValues[4], voiceValues[5],
                            voiceValues[6], voiceValues[7], voiceValues[8], voiceValues[9]);
                        // Continuous physiological targets: never restore a hit state.
                        kernel.setPhoneme(dsp.pitchHz, dsp.vowelPosition, dsp.pressureValue,
                            voiceValues[0], voiceValues[1], voiceValues[2], gate, Math.max(0, dsp.soundIndex), articulation);
                    }
                }
                active = gate ? 1 : active * releaseDecay;
                controlPhase = (controlPhase + 1) & 63;
            }
            renderSpan(spanStart, bufferSize - spanStart);
            dsp.articulationValue = articulation;
            dsp.tractMix = tractMix;
            dsp.leds.active = active;
            dsp.leds.level = clamp(meter, 0, 1);
            dsp.displayTick = (dsp.displayTick + 1) >>> 0;
        },
        reset() {
            if (disposed) return;
            for (const kernel of kernels) kernel.reset();
            controlPhase = 0; started = false; breathRequested = false;
            initialized = false; meter = 0; active = 0; articulation = 0; articulationTarget = 0;
            levelSlew.reset(0); articulationSlew.reset(0); out.fill(0);
            voiceInitialized = false;
            for (let k = 0; k < voiceSlews.length; k++) { voiceSlews[k].reset(voiceDefaults[k]); voiceValues[k] = voiceDefaults[k]; }
            for (const input of Object.values(inputs)) input.fill(0);
            dsp.pitchHz = clamp(110 * 2 ** (control(params.pitch, 0, -24, 24) / 12), 40, 1100);
            dsp.vowelPosition = control(params.vowel, 0, 0, 4);
            let count = 0;
            for (const sound of VOCAL_SOUNDS) if (finite(params[sound.param], 1) >= .5) enabled[count++] = sound.index;
            dsp.enabledCount = count;
            dsp.soundIndex = count ? enabled[Math.min(count - 1, Math.floor(control(params.sound, 0, 0, 1) * count))] : -1;
            dsp.articulationValue = 0; dsp.pressureValue = control(params.pressure, 8, 0, 22);
            tractMix = tractTarget = finite(params.female) >= .5 ? 1 : 0; dsp.tractMix = tractMix;
            dsp.displayTick = 0; dsp.leds.active = 0; dsp.leds.level = 0;
        },
        dispose() { if (disposed) return; disposed = true; for (const kernel of kernels) kernel.dispose(); out.fill(0); dsp.leds.active = 0; dsp.leds.level = 0; }
    };
    return dsp;
}

function renderPanel(container, { instance, toolkit, onParamChange, onCleanup }) {
    const dsp = instance.dsp;
    const root = document.createElement('div');
    root.className = 'vocal-panel';
    const display = document.createElement('div');
    display.className = 'vocal-display';
    const heading = document.createElement('span');
    const name = document.createElement('strong');
    const detail = document.createElement('span');
    display.append(heading, name, detail);
    root.append(display);
    const lights = toolkit.createRow('vocal-lights');
    const tract = document.createElement('div');
    const tractControls = [];
    tract.className = 'vocal-tract';
    tract.setAttribute('role', 'group'); tract.setAttribute('aria-label', 'Vocal tract');
    tract.append(document.createTextNode('TRACT'));
    for (const [label, value] of [['MALE', 0], ['FEMALE', 1]]) {
        const option = button(label, `${label.toLowerCase()} vocal tract — pitch stays independently patchable`,
            () => onParamChange('female', value), 'vocal-bank-action vocal-tract-option');
        option.setAttribute('aria-label', `${label === 'MALE' ? 'Male' : 'Female'} vocal tract`);
        const sync = selected => {
            const active = (finite(selected) >= .5 ? 1 : 0) === value;
            option.classList.toggle('active', active);
            option.setAttribute('aria-pressed', String(active));
        };
        toolkit.registerParamControl('female', option, sync);
        tractControls.push(sync);
        sync(dsp.params.female);
        tract.append(option);
    }
    lights.append(tract);
    for (const id of UI.leds) {
        const lamp = document.createElement('span');
        lamp.append(toolkit.createLED({ id, color: 'green' }), document.createTextNode(id === 'active' ? 'ACTIVITY' : 'OUT'));
        lights.append(lamp);
    }
    root.append(lights);
    const knobs = toolkit.createRow('vocal-knobs');
    for (const definition of UI.knobs) {
        const control = toolkit.createKnob({ ...definition, value: dsp.params[definition.param], small: true });
        if (definition.tooltip) control.title = definition.tooltip;
        knobs.append(control);
    }
    root.append(knobs);

    function button(label, title, callback, className) {
        const element = document.createElement('button');
        element.type = 'button'; element.className = className;
        element.textContent = label; element.title = title;
        const stopDrag = event => event.stopPropagation();
        element.addEventListener('mousedown', stopDrag);
        element.addEventListener('click', callback);
        onCleanup(() => { element.removeEventListener('mousedown', stopDrag); element.removeEventListener('click', callback); });
        return element;
    }
    const bankHeader = toolkit.createRow('vocal-bank-header');
    const bankLabel = document.createElement('span');
    bankLabel.textContent = 'LIT = ENABLED · OUTLINE = CURRENT';
    bankHeader.append(bankLabel);
    for (const [label, value] of [['ALL', 1], ['NONE', 0]]) {
        const element = button(label, value ? 'Enable all sounds' : 'Disable all sounds', () => {
            for (const sound of VOCAL_SOUNDS) onParamChange(sound.param, value);
        }, 'vocal-bank-action');
        element.setAttribute('aria-label', value ? 'Enable all sounds' : 'Disable all sounds');
        bankHeader.append(element);
    }
    root.append(bankHeader);
    const bank = toolkit.createRow('vocal-sounds');
    bank.setAttribute('role', 'group'); bank.setAttribute('aria-label', 'Enabled vocal sounds');
    const buttons = VOCAL_SOUNDS.map(sound => {
        const cell = document.createElement('div');
        cell.className = 'vocal-sound-cell';
        const label = document.createElement('span');
        label.className = 'vocal-sound-label';
        label.textContent = sound.label;
        const element = button('', `${sound.label} /${sound.ipa}/ — ${sound.description}`, () => {
            onParamChange(sound.param, finite(dsp.params[sound.param], 1) >= .5 ? 0 : 1);
        }, 'vocal-sound toggle-btn seq-gate-btn');
        element.dataset.sound = sound.label;
        element.dataset.rendererManaged = 'true';
        toolkit.registerParamControl(sound.param, element, value => {
            element.classList.toggle('enabled', value >= .5);
            element.classList.toggle('active', value >= .5);
            element.setAttribute('aria-pressed', String(value >= .5));
        });
        element.setAttribute('aria-label', `${sound.label} sound`);
        cell.append(label, element);
        bank.append(cell);
        return element;
    });
    root.append(bank);
    const note = document.createElement('div');
    note.className = 'vocal-note';
    note.textContent = 'SOUND CV SCANS LIT SOUNDS · ARTICULATE CLOSES / RELEASES';
    root.append(note);
    const sockets = toolkit.createRow('vocal-sockets');
    for (const port of UI.inputs) sockets.append(toolkit.createJack({ id: port.port, label: port.label, signal: port.signal, direction: 'input' }));
    sockets.append(toolkit.createJack({ id: 'out', label: 'Out', signal: 'audio', direction: 'output' }));
    root.append(sockets);
    container.append(root);
    let lastTick = 0, lastTelemetryAt = -Infinity;
    function update() {
        for (const sync of tractControls) sync(dsp.params.female);
        const now = performance.now();
        if (lastTick !== dsp.displayTick) {
            lastTick = dsp.displayTick;
            lastTelemetryAt = lastTick === 0 ? -Infinity : now;
        }
        const live = now - lastTelemetryAt < 250;
        const enabled = VOCAL_SOUNDS.filter(sound => finite(dsp.params[sound.param], 1) >= .5);
        const slot = Math.min(enabled.length - 1, Math.floor(control(dsp.params.sound, 0, 0, 1) * enabled.length));
        const selected = live ? VOCAL_SOUNDS[dsp.soundIndex] : enabled[slot];
        const amount = live ? dsp.articulationValue : control(dsp.params.articulation, 1, 0, 1);
        const hz = live ? dsp.pitchHz : clamp(110 * 2 ** (control(dsp.params.pitch, 0, -24, 24) / 12), 40, 1100);
        const position = live ? dsp.vowelPosition : control(dsp.params.vowel, 0, 0, 4);
        heading.textContent = `VOCAL · ${Math.round(hz)} Hz · ${enabled.length}/32 ENABLED`;
        name.textContent = selected ? `${selected.label} · /${selected.ipa}/` : 'NO SOUNDS ENABLED';
        detail.textContent = selected ? `ARTIC ${Math.round(amount * 100)}% · RELEASE ${VOWELS[Math.round(position)]}` : 'Turn on a sound button to resume';
        for (let i = 0; i < buttons.length; i++) {
            const enabled = finite(dsp.params[VOCAL_SOUNDS[i].param], 1) >= .5;
            buttons[i].classList.toggle('enabled', enabled);
            buttons[i].classList.toggle('active', enabled);
            buttons[i].classList.toggle('selected', enabled && selected?.index === i);
            buttons[i].setAttribute('aria-pressed', String(enabled));
            buttons[i].setAttribute('aria-current', enabled && selected?.index === i ? 'true' : 'false');
        }
    }
    update();
    toolkit.animate(update);
}

export default {
    id: 'vocal', name: 'VOCAL', hp: 28, color: 'module-color-six', category: 'voice',
    prepareDSP({ sampleRate = 44100 } = {}) { prepareAirway(sampleRate); return prepareAirway(sampleRate, 'female'); },
    createDSP, ui: UI, render: renderPanel,
    telemetry: { fields: ['pitchHz', 'vowelPosition', 'soundIndex', 'enabledCount', 'articulationValue', 'pressureValue', 'tractMix', 'displayTick'], methods: [] },
    css: `
        .module-type-vocal .module-content { gap: 0; min-height: 0; }
        .vocal-panel { display: flex; flex-direction: column; gap: 3px; width: 100%; height: 100%; min-height: 0; }
        .vocal-display { display: flex; flex-direction: column; justify-content: center; min-height: 40px; padding: 3px 9px; background: #14221f; color: #d4f2da; border: 1px solid #426251; border-radius: 4px; }
        .vocal-display > span { font-size: 8px; letter-spacing: .5px; opacity: .8; }
        .vocal-display > strong { font-size: 19px; line-height: 1.2; font-weight: 500; }
        .vocal-lights { display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 7px; }
        .vocal-lights > span { display: flex; align-items: center; gap: 4px; }
        .vocal-tract { display: flex; align-items: center; gap: 5px; }
        .vocal-tract .vocal-tract-option { padding: 1px 5px; }
        .vocal-tract-option.active { background: var(--factory-orange, #ff5a1f); color: var(--factory-ink, #171717); }
        .vocal-knobs { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 7px 5px; padding: 2px 5px; }
        .vocal-knobs .knob-container { gap: 3px; }
        .vocal-knobs .knob-label { font-size: 8px; }
        .vocal-bank-header { display: flex; align-items: center; gap: 5px; padding: 3px 5px 0; font-size: 7px; }
        .vocal-bank-header > span { flex: 1; }
        .vocal-bank-action { border: 1px solid currentColor; background: transparent; color: inherit; font: inherit; padding: 3px 8px; cursor: pointer; }
        .vocal-sounds { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px 8px; padding: 2px 5px; }
        .vocal-sound-cell { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 5px; }
        .vocal-sound-label { text-align: right; font-size: 10px; line-height: 18px; }
        .vocal-sound { justify-self: end; }
        .vocal-sound.selected { outline: 2px solid currentColor; outline-offset: 2px; }
        .vocal-sound:focus-visible, .vocal-bank-action:focus-visible { outline: 2px solid #53a9ff; outline-offset: 1px; }
        .vocal-note { text-align: center; font-size: 7px; letter-spacing: .3px; opacity: .8; }
        .vocal-sockets { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px 2px; margin-top: auto; padding: 5px 3px 0; border-top: 1px solid #8885; }
        .vocal-sockets > :last-child { grid-column: 9; }
        .vocal-sockets .jack-label { font-size: 8px; }
    `
};
