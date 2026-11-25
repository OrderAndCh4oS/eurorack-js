import { createPcg32 } from '../../utils/pcg32.js';

const PORTS = ['a', 'b', 'c', 'd'];
const RATIOS = [-64, -32, -16, -8, -4, -3, -2, 1, 2, 3, 4];
const HITS = [1, 2, 3, 4, 6, 8, 12];
const STEPS = Array.from({ length: 64 }, (_, i) => i + 1);
const DEFAULTS = { length: 16, ratio: 1, gateLength: 25, swing: 50, delay: 0, probability: 100, rotation: 0, mute: 0 };
const RANGES = {
    length: [1, 64], gateLength: [1, 100], swing: [50, 78], delay: [0, 58],
    probability: [0, 100], rotation: [-63, 63], mute: [0, 1]
};

function integer(value, fallback, min, max) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function blankPattern() {
    return PORTS.map(() => ({ ...DEFAULTS, cells: Array(64).fill(-1) }));
}

// Cell magnitude is its ratchet count. The sign preserves that count while a step is off.
function copyPattern(source, target = blankPattern()) {
    for (let i = 0; i < 4; i++) {
        const src = Array.isArray(source) ? source[i] : null;
        const record = target[i];
        for (const key in RANGES) {
            const [min, max] = RANGES[key];
            record[key] = integer(src?.[key], DEFAULTS[key], min, max);
        }
        record.ratio = RATIOS.includes(src?.ratio) ? src.ratio : 1;
        for (let j = 0; j < 64; j++) {
            const cell = src?.cells?.[j];
            record.cells[j] = Number.isInteger(cell) && HITS.includes(Math.abs(cell)) ? cell : -1;
        }
    }
    return target;
}

const LEDS = ['clock', 'reset', ...PORTS];
const UI = {
    leds: LEDS,
    switches: [
        { id: 'fillFirst', param: 'fillFirst', label: 'Fill first', values: STEPS, default: 1 },
        { id: 'fillLast', param: 'fillLast', label: 'Fill last', values: STEPS, default: 1 }
    ],
    actions: [{ id: 'fill', param: 'fill', label: 'Hold fill', mode: 'momentary', default: 0 }],
    state: [
        { param: 'pattern', default: blankPattern() },
        { param: 'presets', default: Array(8).fill(null) }
    ],
    inputs: [
        { id: 'clock', label: 'CLK', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'reset', label: 'RST', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
    ],
    outputs: PORTS.map(port => ({ id: port, label: port.toUpperCase(), port, signal: 'gate', voltage: { min: 0, max: 10 } }))
};

function resetTransport(track, previousHigh = false) {
    track.normal = -1;
    track.fillStep = -1;
    track.offbeat = false;
    track.divideCountdown = 0;
    track.prediction = Infinity;
    track.subdivision = 0;
    track.startCount = 0;
    track.nextStart = 0;
    track.end = 0;
    track.high = previousHigh;
    track.tie = false;
}

function createTrack(index) {
    const track = { random: createPcg32(index + 1), starts: new Float64Array(12), ends: new Float64Array(12),
        ratio: 1, ledEnd: 0 };
    resetTransport(track);
    return track;
}

function scheduleGate(track, frame, period, delay, hits, gateLength) {
    const window = period - delay;
    const canTie = hits === 1 && gateLength === 100;
    const interrupted = track.high && !(track.tie && canTie);
    track.tie = canTie;
    const width = hits === 1 ? Math.round(period * gateLength / 100) : Math.round(period / 24);
    let previousOffset = -2;
    for (let i = 0; i < hits; i++) {
        let offset = delay + Math.round(i * window / hits);
        if (i === 0 && interrupted) offset = Math.max(offset, 1);
        if (offset >= period || offset - previousOffset < 2) continue;
        track.starts[track.startCount++] = frame + offset;
        previousOffset = offset;
    }
    for (let i = 0; i < track.startCount; i++) {
        const next = i + 1 < track.startCount ? track.starts[i + 1] : frame + period;
        const start = track.starts[i];
        // A tie follows the next actual step. An external clock can slow down or pause.
        track.ends[i] = canTie ? Infinity
            : Math.min(start + Math.max(1, width), Math.max(start + 1, next - 1));
    }
}

function visit(track, settings, frame, period, fill, first, last) {
    track.normal = (track.normal + 1) % settings.length;
    let position = track.normal;
    if (fill) {
        track.fillStep = track.fillStep < first || track.fillStep >= last ? first : track.fillStep + 1;
        position = track.fillStep;
    }
    // Live fills can address positions outside the rotated normal ring.
    if (position < settings.length) position = (position - settings.rotation + 64 * settings.length) % settings.length;
    const hits = settings.cells[position];
    track.end = frame;
    track.startCount = 0;
    track.nextStart = 0;
    if (!settings.mute && hits > 0 && (settings.probability === 100 ||
        (settings.probability > 0 && track.random.bounded(100) < settings.probability))) {
        const swingOffset = track.offbeat ? 2 * settings.swing - 100 : 0;
        const delay = Math.min(period - 1, Math.round(period * (settings.delay + swingOffset) / 100));
        scheduleGate(track, frame, period, delay, hits, settings.gateLength);
    } else {
        track.tie = false;
    }
    track.offbeat = !track.offbeat;
    return position;
}

function createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const tracks = PORTS.map((_, index) => createTrack(index));
    const inputs = { clock: new Float32Array(bufferSize), reset: new Float32Array(bufferSize) };
    const outputs = Object.fromEntries(PORTS.map(name => [name, new Float32Array(bufferSize)]));
    const buffers = Object.values(outputs);
    const leds = Object.fromEntries(LEDS.map(name => [name, 0]));
    const positions = [-1, -1, -1, -1];
    const params = { pattern: blankPattern(), presets: Array(8).fill(null), fillFirst: 1, fillLast: 1, fill: 0 };
    const decoded = blankPattern();
    const fallback = Math.max(1, Math.round(sampleRate * .125));
    const hold = Math.max(1, Math.round(sampleRate * .05));
    let patternReference;
    let frame = 0;
    let priorClock = false;
    let priorReset = false;
    let lastClock = -1;
    let measuredPeriod = 0;
    let clockLedEnd = 0;
    let resetLedEnd = 0;
    let filling = false;
    let fillFirst = -1;
    let fillLast = -1;

    return {
        params, inputs, outputs, leds, positions,
        process() {
            if (patternReference !== params.pattern) {
                copyPattern(params.pattern, decoded);
                patternReference = params.pattern;
            }
            const fill = params.fill === 1;
            const endpoint1 = integer(params.fillFirst, 1, 1, 64) - 1;
            const endpoint2 = integer(params.fillLast, 1, 1, 64) - 1;
            const first = Math.min(endpoint1, endpoint2);
            const last = Math.max(endpoint1, endpoint2);
            for (let i = 0; i < 4; i++) {
                const track = tracks[i];
                if (fill !== filling || first !== fillFirst || last !== fillLast) track.fillStep = -1;
                if (track.ratio !== decoded[i].ratio) {
                    track.ratio = decoded[i].ratio;
                    track.divideCountdown = 0;
                    track.prediction = Infinity;
                }
                if (decoded[i].mute) {
                    track.end = frame;
                    track.startCount = 0;
                    track.tie = false;
                    track.ledEnd = 0;
                }
            }
            filling = fill;
            fillFirst = first;
            fillLast = last;

            for (let sample = 0; sample < bufferSize; sample++, frame++) {
                const clock = Number.isFinite(inputs.clock[sample]) && inputs.clock[sample] > 2.5;
                const reset = Number.isFinite(inputs.reset[sample]) && inputs.reset[sample] >= 1;
                const clockEdge = clock && !priorClock;
                if (reset && !priorReset) {
                    lastClock = -1;
                    resetLedEnd = frame + hold;
                    positions.fill(-1);
                    for (const track of tracks) {
                        // A coincident trigger interrupts a tie; preserve one low sample before its new attack.
                        resetTransport(track, track.high);
                        track.ledEnd = 0;
                    }
                }
                if (clockEdge) {
                    if (lastClock >= 0) measuredPeriod = frame - lastClock;
                    lastClock = frame;
                    clockLedEnd = frame + hold;
                }
                priorClock = clock;
                priorReset = reset;
                for (let i = 0; i < 4; i++) {
                    const track = tracks[i];
                    const ratio = track.ratio;
                    let due = false;
                    if (clockEdge) {
                        due = track.divideCountdown === 0;
                        track.divideCountdown = due ? Math.max(0, -ratio - 1) : track.divideCountdown - 1;
                        track.subdivision = 0;
                        track.prediction = Infinity;
                    } else if (frame === track.prediction) {
                        due = true;
                    }
                    if (due) {
                        if (ratio > 1 && measuredPeriod > 0) {
                            // Ignore sub-sample predictions already represented by this frame.
                            do {
                                track.subdivision++;
                                track.prediction = lastClock + Math.round(track.subdivision * measuredPeriod / ratio);
                            } while (track.prediction <= frame && track.subdivision < ratio);
                            if (track.subdivision >= ratio || track.prediction >= lastClock + measuredPeriod) track.prediction = Infinity;
                        }
                        let period = ratio < 0 ? fallback * -ratio : fallback;
                        if (measuredPeriod > 0) {
                            // Adjacent rounded subdivision boundaries can differ by one sample.
                            const nextBoundary = Math.min(track.prediction, lastClock + measuredPeriod);
                            period = ratio < 0 ? measuredPeriod * -ratio : nextBoundary - frame;
                        }
                        positions[i] = visit(track, decoded[i], frame, period, fill, first, last);
                    }
                    if (track.nextStart < track.startCount && track.starts[track.nextStart] === frame) {
                        track.end = track.ends[track.nextStart++];
                    }
                    track.high = frame < track.end;
                    buffers[i][sample] = track.high ? 10 : 0;
                    if (track.high) track.ledEnd = frame + hold;
                }
            }
            leds.clock = Number(clockLedEnd >= frame);
            leds.reset = Number(resetLedEnd >= frame);
            for (let i = 0; i < 4; i++) leds[PORTS[i]] = Number(tracks[i].ledEnd >= frame);
        },
        reset() {
            frame = 0;
            priorClock = priorReset = filling = false;
            lastClock = -1;
            measuredPeriod = clockLedEnd = resetLedEnd = 0;
            fillFirst = fillLast = -1;
            patternReference = undefined;
            tracks.forEach((track, i) => {
                resetTransport(track);
                track.ledEnd = 0;
                track.random.reseed(i + 1);
            });
            positions.fill(-1);
            for (const buffer of [...Object.values(inputs), ...buffers]) buffer.fill(0);
            for (const key of LEDS) leds[key] = 0;
        }
    };
}

function button(label, text, click) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'hardware-button';
    element.setAttribute('aria-label', label);
    element.title = label;
    element.textContent = text;
    element.addEventListener('click', click);
    return element;
}

function select(label, values, format, change) {
    const element = document.createElement('select');
    element.className = 'hardware-select';
    element.setAttribute('aria-label', label);
    for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = format(value);
        element.append(option);
    }
    element.addEventListener('change', () => change(element.value));
    return element;
}

function labeled(text, control) {
    const field = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = text;
    field.append(caption, control);
    return field;
}

function pressed(element, active) {
    element.classList.toggle('active', active);
    element.setAttribute('aria-pressed', String(active));
}

function render(container, { instance, toolkit, onParamChange, onCleanup }) {
    const dsp = instance.dsp;
    const params = dsp?.params || {};
    let trackIndex = 0;
    let page = 0;
    let selectedCell = 0;
    let view = 'Steps';
    let mode = 'gates';
    let slot = 0;
    let observedPattern;
    let pattern = blankPattern();
    let lastPosition = -1;
    let observedBank;

    const row = name => toolkit.createRow('gs-' + name);
    const root = row('panel');
    const tabs = row('tabs');
    const steps = row('steps');
    const settings = row('settings');
    const memory = row('memory');
    const mutes = row('mutes');
    const live = row('fill');
    const jacks = row('jacks');
    const nav = row('nav');
    const grid = row('grid');
    function chooseView(next) {
        view = next;
        refresh();
    }
    const pages = {
        Steps: [steps, button('Steps', 'Steps', () => chooseView('Steps'))],
        Track: [settings, button('Track settings', 'Settings', () => chooseView('Track'))],
        Memory: [memory, button('Memory', 'Memory', () => chooseView('Memory'))]
    };
    tabs.append(...Object.values(pages).map(([, tab]) => tab));

    function writePattern(next) {
        onParamChange('pattern', next);
        observedPattern = next;
        pattern = next;
        refresh();
    }
    function editTrack(index, edits) {
        const next = pattern.slice();
        next[index] = { ...next[index], ...edits };
        writePattern(next);
    }
    function editCell(value) {
        const cells = pattern[trackIndex].cells.slice();
        cells[selectedCell] = value;
        editTrack(trackIndex, { cells });
    }
    const trackSelector = select('Track', PORTS, key => key.toUpperCase(), value => {
        trackIndex = PORTS.indexOf(value);
        refresh();
    });
    const pageSelector = select('Page', [1, 2, 3, 4], String, value => {
        page = Number(value) - 1;
        selectedCell = page * 16 + selectedCell % 16;
        refresh();
    });
    const modeSelector = select('Edit mode', ['gates', 'ratchets'], value => value === 'gates' ? 'Gates' : 'Ratchets', value => {
        mode = value;
        refresh();
    });
    const ratchets = select('Ratchet hits', HITS, value => '×' + value, value => {
        editCell(Math.sign(pattern[trackIndex].cells[selectedCell]) * Number(value));
    });
    const pageField = labeled('Page', pageSelector);
    const modeField = labeled('Edit', modeSelector);
    const ratchetField = labeled('Hits', ratchets);
    nav.append(labeled('Track', trackSelector), pageField, modeField, ratchetField);
    const stepButtons = [];
    for (let i = 0; i < 16; i++) {
        const pad = button('Step ' + (i + 1), '', () => {
            selectedCell = page * 16 + i;
            if (mode === 'gates') editCell(-pattern[trackIndex].cells[selectedCell]);
            else refresh();
        });
        grid.append(pad);
        stepButtons.push(pad);
    }
    steps.append(grid);

    const trackFields = {};
    for (const [key, name, caption] of [
        ['length', 'Length', 'Length'], ['ratio', 'Rate', 'Clock rate'], ['gateLength', 'Gate length', 'Gate %'],
        ['swing', 'Swing', 'Swing %'], ['delay', 'Delay', 'Delay %'], ['probability', 'Probability', 'Chance %'],
        ['rotation', 'Rotation', 'Rotation']
    ]) {
        let control;
        if (key === 'ratio') {
            control = select(name, RATIOS, v => v < 0 ? '÷' + -v : '×' + v, v => editTrack(trackIndex, { ratio: Number(v) }));
        } else {
            control = document.createElement('input');
            control.type = 'number';
            const [min, max] = RANGES[key];
            Object.assign(control, { min, max, step: 1 });
            control.setAttribute('aria-label', name);
            control.addEventListener('change', () => {
                const value = integer(control.valueAsNumber, pattern[trackIndex][key], min, max);
                control.value = String(value);
                editTrack(trackIndex, { [key]: value });
            });
        }
        trackFields[key] = control;
        settings.append(labeled(caption, control));
    }

    const slotSelector = select('Preset slot', STEPS.slice(0, 8), v => 'Slot ' + v, v => {
        slot = Number(v) - 1;
        refresh();
    });
    const occupied = document.createElement('output');
    const save = button('Save preset', 'Save', () => {
        const bank = Array.from({ length: 8 }, (_, i) => Array.isArray(params.presets?.[i]) ? copyPattern(params.presets[i]) : null);
        bank[slot] = copyPattern(pattern);
        onParamChange('presets', bank);
        refresh();
    });
    const load = button('Load preset', 'Load', () => {
        if (Array.isArray(params.presets?.[slot])) writePattern(copyPattern(params.presets[slot]));
    });
    memory.append(labeled('Preset memory', slotSelector), occupied, save, load);

    const muteTitle = document.createElement('span');
    muteTitle.textContent = 'Mute';
    const muteButtons = PORTS.map((port, i) => button('Mute ' + port.toUpperCase(), port.toUpperCase(),
        () => editTrack(i, { mute: 1 - pattern[i].mute })));
    mutes.append(muteTitle, ...muteButtons);
    for (const [i, control] of UI.switches.entries()) {
        const endpoint = select(control.label, STEPS, String, value => onParamChange(control.param, Number(value)));
        endpoint.value = String(params[control.param] ?? control.default);
        toolkit.registerParamControl(control.param, endpoint, value => { endpoint.value = String(value); });
        live.append(labeled(i === 0 ? 'Fill from' : 'Through', endpoint));
    }
    let holding = false;
    function hold(value) {
        if (holding !== Boolean(value)) {
            holding = Boolean(value);
            onParamChange('fill', value);
        }
        pressed(fill, holding);
    }
    const fill = toolkit.createActionButton({ ...UI.actions[0], onChange: hold });
    fill.classList.add('hardware-button');
    fill.setAttribute('aria-label', 'Hold fill');
    fill.setAttribute('aria-pressed', 'false');
    fill.title = 'Loopy fill: hold to loop between the two endpoints';
    for (const [type, value] of [['keydown', 1], ['keyup', 0]]) {
        fill.addEventListener(type, event => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault();
            hold(value);
        });
    }
    const release = () => hold(0);
    fill.addEventListener('blur', release);
    window.addEventListener('blur', release);
    onCleanup(() => {
        window.removeEventListener('blur', release);
        if (holding) release();
    });
    live.append(fill);
    const ledElements = [];
    for (const port of [...UI.inputs, ...UI.outputs]) {
        const column = row('socket');
        const led = toolkit.createLED({ id: port.port, color: port.port === 'reset' ? 'red' : 'green' });
        ledElements.push(led);
        column.append(led, toolkit.createJack({ ...port, direction: port.signal === 'gate' ? 'output' : 'input' }));
        jacks.append(column);
    }
    function showPosition() {
        const position = dsp?.positions?.[trackIndex] ?? -1;
        stepButtons.forEach((element, i) => {
            const current = page * 16 + i === position;
            element.classList.toggle('playing', current);
            if (current) element.setAttribute('aria-current', 'step');
            else element.removeAttribute('aria-current');
        });
        lastPosition = position;
    }
    function refresh() {
        if (observedPattern !== params.pattern) {
            observedPattern = params.pattern;
            pattern = copyPattern(observedPattern);
        }
        observedBank = params.presets;
        for (const [name, [section, tab]] of Object.entries(pages)) {
            section.hidden = name !== view;
            pressed(tab, name === view);
        }
        nav.hidden = view === 'Memory';
        modeField.hidden = pageField.hidden = view !== 'Steps';
        ratchetField.hidden = view !== 'Steps' || mode !== 'ratchets';
        const track = pattern[trackIndex];
        for (const [key, field] of Object.entries(trackFields)) {
            if (field.value !== String(track[key]) && document.activeElement !== field) field.value = String(track[key]);
        }
        ratchets.value = String(Math.abs(track.cells[selectedCell]));
        stepButtons.forEach((element, i) => {
            const index = page * 16 + i;
            const cell = track.cells[index];
            const name = 'Step ' + (index + 1);
            element.setAttribute('aria-label', name);
            element.title = name + (cell > 0 ? ' on' : ' off') + ', ' + Math.abs(cell) + ' hit(s)' +
                (index >= track.length ? ', beyond track length' : '');
            element.textContent = (cell > 0 ? '● ' : '○ ') + (index + 1) + (Math.abs(cell) > 1 ? ' ×' + Math.abs(cell) : '');
            pressed(element, cell > 0);
            element.classList.toggle('outside', index >= track.length);
            element.classList.toggle('selected', mode === 'ratchets' && index === selectedCell);
        });
        muteButtons.forEach((element, i) => pressed(element, Boolean(pattern[i].mute)));
        load.disabled = !Array.isArray(observedBank?.[slot]);
        occupied.textContent = load.disabled ? 'Empty' : 'Saved';
        showPosition();
    }

    root.addEventListener('mousedown', event => {
        if (event.target.closest('button, select, input')) event.stopPropagation();
    });
    root.append(tabs, nav, steps, settings, memory, mutes, live, jacks);
    container.append(root);
    refresh();
    toolkit.animate(() => {
        if (params.pattern !== observedPattern || params.presets !== observedBank) refresh();
        else if ((dsp?.positions?.[trackIndex] ?? -1) !== lastPosition) showPosition();
        ledElements.forEach((led, i) => led.classList.toggle('active', Boolean(dsp?.leds?.[LEDS[i]])));
    });
}

const css = `
.gs-panel { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 5px;
    padding: 1px 4px; color: var(--hw-ink); font-size: 10px; line-height: 1.1; }
.gs-panel [hidden] { display: none; }
.gs-tabs, .gs-nav, .gs-fill, .gs-mutes, .gs-jacks { display: flex; align-items: center; gap: 4px; }
.gs-tabs > *, .gs-fill > *, .gs-mutes button, .gs-nav label { flex: 1; }
.gs-panel button, .gs-panel select, .gs-panel input { min-width: 0; font-family: inherit; }
.gs-panel button { font-size: 10px; min-height: 23px; }
.gs-panel label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gs-panel label > span, .gs-mutes > span { font-size: 9px; font-weight: 700; }
.gs-panel select, .gs-panel input { width: 100%; font-size: 10px; }
.gs-panel input { min-height: 22px; background: var(--hw-face-top); color: var(--hw-ink); border: 1px solid var(--hw-edge);
    border-radius: var(--hw-radius); padding: 1px 4px; user-select: text; }
.gs-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.gs-grid button { position: relative; min-height: 25px; white-space: nowrap; }
.gs-panel .gs-grid button.outside { border-style: dashed; }
.gs-grid .selected { outline: 2px solid currentColor; outline-offset: -3px; }
.gs-grid .playing::after { content: ''; position: absolute; height: 3px; bottom: 2px; left: 15%; right: 15%;
    background: currentColor; }
.gs-settings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.gs-memory { display: grid; grid-template-columns: 1fr 1fr; align-items: end; gap: 8px; }
.gs-memory output { font-size: 11px; margin: auto 0; }
.gs-mutes { margin-top: auto; padding-top: 4px; border-top: 1px solid var(--hw-edge); }
.gs-fill { align-items: end; }
.gs-fill button { white-space: nowrap; }
.gs-jacks { justify-content: space-around; padding: 4px 0 0; border-top: 1px solid var(--hw-edge); }
.gs-socket { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.gs-socket .led { width: 5px; height: 5px; }
`;

export default {
    id: 'gate-seq', name: 'GATE SEQ', hp: 16, color: 'module-color-eleven', category: 'sequencer',
    ui: UI, telemetry: { params: [], fields: ['positions'], methods: [] }, createDSP, render, css
};
