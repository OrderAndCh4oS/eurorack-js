import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RackHost } from '../../src/js/app/rack-host.js';
import { EurorackApp } from '../../src/js/app/app.js';
import { AudioWorkletEngine } from '../../src/js/audio/worklet-engine.js';
import { CORE_MODULE_DEFINITIONS } from '../../src/js/rack/core-definitions.js';
import { cleanupRenderedModule, renderModule, syncParamToModuleUI } from '../../src/js/ui/renderer.js';
import { fillAuditInputs, withSeededRandom } from '../../scripts/lib/dsp-audit.js';

let Processor;
beforeAll(async () => {
    globalThis.sampleRate = 48000;
    globalThis.currentTime = 0;
    globalThis.AudioWorkletProcessor = class { port = {}; };
    globalThis.registerProcessor = (_name, implementation) => { Processor = implementation; };
    await import('../../src/js/audio/worklet/processor.js');
});

beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
        fillText() {}, setLineDash() {}, fill() {}, arc() {}, drawImage() {}, putImageData() {},
        measureText: () => ({ width: 10 }), save() {}, restore() {}, translate() {}, scale() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        createLinearGradient: () => ({ addColorStop() {} })
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

async function mount(definition) {
    const host = await new RackHost().init();
    const module = host.addModule(definition.id);
    const processor = new Processor();
    const engine = new AudioWorkletEngine({ registry: host.registry, onTelemetry: data => host.applyTelemetry(data) });
    // Only the MessagePort transport is synchronous. The production engine and
    // processor build the topology and independently apply each parameter write.
    engine.node = { port: { postMessage: data => processor.port.onmessage({ data: structuredClone(data) }) } };
    processor.port.postMessage = data => engine.handleMessage(structuredClone(data));
    host.engine = engine;
    await host.syncTopology({ throwOnError: true });
    const change = vi.fn(host.setParam.bind(host));
    const panel = renderModule(definition, module.id, {
        dsp: module.instance, getModule: () => module, onParamChange: change
    });
    panel.addEventListener('click', event => EurorackApp.prototype.handleClick.call({ setParam: change }, event));
    document.body.appendChild(panel);
    for (const [param, value] of Object.entries(module.params)) syncParamToModuleUI(panel, module.id, param, value);
    const audio = processor.modules[module.id].instance;

    function checkWrites(writes) {
        const label = `${definition.id} ${JSON.stringify(writes)}`;
        expect(change.mock.calls, label).toEqual(writes.map(([param, value]) => [module.id, param, value]));
        for (const [param, value] of writes) {
            expect(module.params[param], label).toBe(value);
            expect(audio.params[param], label).toBe(value);
        }
        change.mockClear();
    }
    function close() {
        cleanupRenderedModule(panel);
        host.disposeDSP(module);
        audio.dispose?.();
        host.unsubscribeRegistry?.();
        host.unsubscribeUsage?.();
        panel.remove();
    }
    const draws = window.requestAnimationFrame.mock.calls.map(([draw]) => draw);
    return { panel, audio, processor, draws, check: (param, value) => checkWrites([[param, value]]), checkWrites, close, module, host };
}

function drag(knob, dy) {
    knob.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 100 - dy }));
    document.dispatchEvent(new MouseEvent('mouseup'));
}

function exerciseKnob(rack, control) {
    const { panel, check } = rack;
    const el = panel.querySelector(`.knob[data-param="${control.param}"]`);
    if (!el && ['x', 'y'].includes(control.param) && panel.querySelector('.joystick-pad')) {
        const pad = panel.querySelector('.joystick-pad');
        vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 });
        for (const at of [0, 100]) {
            pad.dispatchEvent(new MouseEvent('pointerdown', { clientX: at, clientY: at }));
            pad.dispatchEvent(new MouseEvent('pointerup'));
            rack.checkWrites([['x', at / 50 - 1], ['y', 1 - at / 50]]);
        }
        return;
    }
    expect(el, control.param).toBeTruthy();
    expect([+el.dataset.min, +el.dataset.max, +el.dataset.step], control.param)
        .toEqual([control.min, control.max, control.step || 0]);
    drag(el, -200);
    check(control.param, control.min);
    drag(el, 200);
    check(control.param, control.max);
    if (control.step && control.min + control.step < control.max) {
        drag(el, -200);
        check(control.param, control.min);
        drag(el, 150 * control.step / (control.max - control.min));
        check(control.param, control.min + control.step);
    }
}

function exerciseChoices(rack, control, values) {
    const { panel, check } = rack;
    const selector = `[data-param="${control.param}"]`;
    const select = panel.querySelector(`select${selector}`);
    if (select) {
        expect([...select.options].map(option => Number(option.value))).toEqual(values);
        for (const value of values) {
            select.value = String(value);
            select.dispatchEvent(new Event('change', { bubbles: true }));
            check(control.param, value);
        }
        return;
    }
    const choices = [...panel.querySelectorAll(`button${selector}[data-value], ${selector} button[data-value]`)];
    if (choices.length) {
        expect(choices.map(button => Number(button.dataset.value))).toEqual(values);
        for (const button of choices) {
            button.click();
            check(control.param, Number(button.dataset.value));
        }
        return;
    }
    const element = panel.querySelector(`.switch${selector}, button${selector}`) ?? panel.querySelector(selector);
    expect(element, control.param).toBeTruthy();
    const start = values.indexOf(control.default ?? values[0]);
    for (let i = 1; i <= values.length; i++) {
        element.click();
        check(control.param, values[(start + i) % values.length]);
    }
}

function unreadControls(rack, definition) {
    const ui = definition.ui;
    const controls = ['knobs', 'switches', 'buttons', 'actions'].flatMap(group => ui[group] || []);
    const unread = new Set(controls.map(c => c.param));
    // Track reads only during actual processing, drawing, or a declared state
    // edit. Serializing params for telemetry would otherwise read every key.
    let observing = false;
    for (const instance of [rack.audio, rack.module.instance]) {
        for (const { param } of controls) {
            let value = instance.params[param];
            Object.defineProperty(instance.params, param, {
                configurable: true, enumerable: true,
                get() { if (observing) unread.delete(param); return value; },
                set(next) { value = next; }
            });
        }
    }
    const output = [[new Float32Array(128), new Float32Array(128)]];
    for (const extreme of ['default', 'max', 'min']) {
        for (const c of controls) {
            const choices = c.values ?? c.positions?.map((_, index) => index) ?? [0, 1];
            const value = extreme === 'default' ? c.default : c[extreme] ?? (extreme === 'min' ? choices[0] : choices.at(-1));
            rack.audio.params[c.param] = rack.module.instance.params[c.param] = value;
        }
        rack.processor.midi.push([0x90, 60, 100], 0);
        const blocks = definition.telemetry?.history ? 20 : 4;
        for (let block = 0; block < blocks; block++) {
            fillAuditInputs(definition, rack.audio, { sampleRate: 48000, blockSize: 128, blockIndex: block });
            // Clock SWING without a coincident reset. Record, play, and overdub
            // a short LOOP so its playback controls have material to act on.
            if (definition.id === 'swing') rack.audio.inputs.reset.fill(0);
            if (definition.id === 'loop') {
                rack.audio.inputs.recTrig.fill(0);
                rack.audio.params.clear = 0;
                rack.audio.params.record = block === 1 ? 0 : 1;
            }
            rack.processor.telemetryFrames = 0;
            observing = true;
            rack.processor.process([], output);
            observing = false;
        }
        // Deliver a real snapshot with observation disabled during serialization.
        rack.processor.telemetryFrames = 48000;
        rack.processor.process([], output);
        observing = true;
        rack.draws.forEach(draw => draw());
        observing = false;
    }
    // A command can change persisted state without being read each sample.
    for (const c of ui.actions || []) {
        if (!c.editState) continue;
        rack.host.setParam(rack.module.id, c.param, 0);
        observing = true;
        rack.host.setParam(rack.module.id, c.param, 1);
        observing = false;
    }
    expect(rack.processor.disabled.size, definition.id).toBe(0);
    return [...unread];
}

describe('panel to audio worklet', () => {
    it.each(CORE_MODULE_DEFINITIONS)('$id delivers every declared control value', async definition => {
        const rack = await mount(definition);
        vi.useFakeTimers();
        try {
            for (const c of definition.ui.knobs || []) exerciseKnob(rack, c);
            for (const c of definition.ui.switches || []) {
                exerciseChoices(rack, c, c.values ?? c.positions?.map((_, i) => i) ?? [0, 1]);
            }
            for (const c of definition.ui.buttons || []) exerciseChoices(rack, c, c.values ?? [0, 1]);
            for (const c of definition.ui.actions || []) {
                if (c.mode === 'toggle' || !c.mode) {
                    exerciseChoices(rack, c, [0, 1]);
                    continue;
                }
                const button = rack.panel.querySelector(`button[data-param="${c.param}"]`);
                if (c.mode === 'momentary') button.dispatchEvent(new MouseEvent('pointerdown'));
                else button.click();
                rack.check(c.param, 1);
                if (c.mode === 'momentary') button.dispatchEvent(new MouseEvent('pointerup'));
                else vi.runOnlyPendingTimers();
                rack.check(c.param, 0);
            }
            const app = { host: rack.host, state: rack.host.state };
            for (const group of ['knobs', 'switches', 'buttons', 'actions']) {
                for (const c of definition.ui[group] || []) {
                    const element = rack.panel.querySelector(`[data-module][data-param="${c.param}"]`);
                    expect(element, `${definition.id}.${c.param} MIDI Learn target`).toBeTruthy();
                    const values = c.values ?? c.positions?.map((_, i) => i) ?? [0, 1];
                    const range = { min: c.min ?? Math.min(...values), max: c.max ?? Math.max(...values) };
                    expect(EurorackApp.prototype.getMidiControlRange.call(app, element)).toEqual(range);
                }
            }
            const unread = withSeededRandom(() => unreadControls(rack, definition));
            expect(unread, `${definition.id} controls without a consumer`).toEqual([]);
        } finally {
            rack.close();
        }
    });

    it('plays the second octave of a major triad when the Oct switch is engaged', async () => {
        const rack = await mount(CORE_MODULE_DEFINITIONS.find(d => d.id === 'arp'));
        try {
            drag(rack.panel.querySelector('.knob[data-param="chord"]'), -200);
            const octave = rack.panel.querySelector('.switch[data-param="octaves"]');
            rack.audio.inputs.trigger.set([0, 10, 0, 10, 0, 10, 0]);
            for (const fourth of [0, 1, 0]) {
                rack.audio.reset();
                rack.audio.process();
                expect(rack.audio.outputs.cv[6]).toBe(fourth);
                octave.click();
            }
        } finally {
            rack.close();
        }
    });

    it('applies learned-scale edits once per press in the saved rack and on the audio thread', async () => {
        const rack = await mount(CORE_MODULE_DEFINITIONS.find(d => d.id === 'ensemble-vco'));
        vi.useFakeTimers();
        try {
            const expectScale = notes => {
                expect(rack.module.params.scaleMemory['1']).toEqual(notes);
                expect(rack.audio.params.scaleMemory['1']).toEqual(notes);
            };
            const press = name => rack.panel.querySelector(`button[data-param="${name}"]`).click();
            press('addNote');
            expectScale([0, 7]);
            vi.runOnlyPendingTimers();
            rack.host.setParam(rack.module.id, 'learnNote', 12);
            press('addNote');
            expectScale([0, 7, 12]);
            press('deleteNote');
            expectScale([0, 7]);
            rack.host.setParam(rack.module.id, 'deleteNote', 1);
            expectScale([0, 7]);
            press('deleteNote'); // A second click before the first pulse timer expires.
            expectScale([0]);
            press('resetScale');
            expectScale(undefined);
        } finally {
            rack.close();
        }
    });

    it('detects wired gain knobs when the amplifier stops consuming their values', async () => {
        const vca = CORE_MODULE_DEFINITIONS.find(d => d.id === 'vca');
        const rack = await mount(vca);
        try {
            rack.audio.process = () => {};
            expect(unreadControls(rack, vca)).toEqual(['ch1Gain', 'ch2Gain']);
        } finally {
            rack.close();
        }
    });

    it('maps MIDI to actual octave values and snaps a stepped knob before posting it', async () => {
        const rack = await mount(CORE_MODULE_DEFINITIONS.find(d => d.id === 'arp'));
        const app = { host: rack.host, state: rack.host.state, setParam: rack.host.setParam.bind(rack.host), applyParamsToDOM() {} };
        const send = (paramId, value) => EurorackApp.prototype.applyMidiControl.call(app, { moduleId: rack.module.id, paramId, value });
        try {
            expect(EurorackApp.prototype.getMidiControlRange.call(app, rack.panel.querySelector('.switch'))).toEqual({ min: 1, max: 2 });
            send('octaves', 1.495);
            expect(rack.audio.params.octaves).toBe(1);
            send('octaves', 1.505);
            expect(rack.audio.params.octaves).toBe(2);
            send('chord', 6.7);
            expect(rack.audio.params.chord).toBe(7);
            expect(() => rack.host.setParam(rack.module.id, 'chord', 6.7)).toThrow(/control settings/);
            expect(rack.module.params.chord).toBe(7);
        } finally {
            rack.close();
        }
    });
});
