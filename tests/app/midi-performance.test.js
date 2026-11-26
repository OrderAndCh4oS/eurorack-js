import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';
import { RackState } from '../../src/js/app/rack-state.js';
import { createRackTools } from '../../src/js/app/webmcp.js';
import { RackActivity } from '../../src/js/app/rack-activity.js';
import { createMidiManager } from '../../src/js/midi/midi-manager.js';
import { PatchDraftService } from '../../src/js/patch-script/draft-service.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(() => loadCorePlugin());
afterEach(() => vi.useRealTimers());

function instrument() {
    const registry = pluginRegistry;
    const state = new RackState();
    state.addModule('vcf', registry, {id: 'filter', params: {cutoff: 0, resonance: 0}});
    state.addModule('arp', registry, {id: 'arp'});
    const engine = {running: true, revision: 1, activeRevision: 1};
    const host = {state, registry, engine, audioCtx: {state: 'running'}, emit: vi.fn(),
        serializePatch: () => state.serializePatch(registry), setParam: vi.fn((...args) => state.setParam(...args))};
    const midi = createMidiManager();
    const raw = vi.fn();
    midi.setOnRawMidiMessage(raw);
    const app = Object.assign(Object.create(EurorackApp.prototype), {host, state, midiManager: midi, document});
    const drafts = new PatchDraftService({app, registry});
    const activity = new RackActivity();
    const tools = Object.fromEntries(createRackTools({workbench: {app, drafts}, registry, activity}).map(tool => [tool.name, tool]));
    const revision = () => drafts.observe().revision;
    const map = args => tools.map_midi_cc.execute({expectedRevision: revision(), ...args});
    const perform = (controls, options) => tools.perform_controls.execute({expectedRevision: revision(), controls}, options);
    return {app, state, host, midi, raw, tools, map, perform, revision, activity};
}

const cutoff = {moduleId: 'filter', paramId: 'cutoff'};
const resonance = {moduleId: 'filter', paramId: 'resonance'};
const cc74 = {channel: 1, cc: 74};
const fakeTime = () => vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});

describe('live rack performance', () => {
    it('maps and reassigns CCs in place using the patch and MIDI Learn control range', async () => {
        const {map, midi, state, revision, tools} = instrument();
        const initial = revision();
        expect(await map({...cc74, ...cutoff})).toEqual({ok: true, revision: initial + 1, key: '0:74',
            mapping: {...cutoff, min: 0, max: 1}});
        await map({channel: 16, cc: 1, ...resonance});
        expect(await map({...cc74, ...resonance, max: 0.9})).toMatchObject({ok: true});
        expect(midi.getMappings()).toEqual({'0:74': {...resonance, min: 0, max: 0.9}});
        expect(state.midiMappings).toEqual(midi.getMappings());
        expect((await tools.get_rack.execute({})).source).toContain('.midi("0:74"');
        const stale = await tools.map_midi_cc.execute({expectedRevision: initial, ...cc74, ...cutoff});
        expect(stale).toMatchObject({ok: false, error: {code: 'rack-changed'}});
        for (const spec of [{...cc74, ...cutoff, min: -1}, {...cc74, ...cutoff, min: 1, max: 0},
            {...cc74, ...cutoff, max: null}, {...cutoff, channel: 0, cc: 74}, {...cc74, ...cutoff, paramId: 'state'}]) {
            expect(await map(spec)).toMatchObject({ok: false, error: {code: 'invalid-input'}});
        }
        expect(state.midiMappings).toEqual({'0:74': {...resonance, min: 0, max: 0.9}});
    });

    it.each([['linear', 0.25], ['ease-in', 0.0625], ['ease-out', 0.4375], ['ease-in-out', 0.125]])(
        'interpolates a %s sweep from the current knob value to an exact native endpoint', async (easing, quarter) => {
            fakeTime();
            const {state, perform, revision} = instrument();
            state.setParam('filter', 'cutoff', 0.2);
            const target = 0.914321;
            const gesture = perform([{...cutoff, value: target, durationSeconds: 1.024, easing}]);
            await vi.advanceTimersByTimeAsync(256);
            expect(state.getParam('filter', 'cutoff')).toBeCloseTo(0.2 + (target - 0.2) * quarter, 2);
            await vi.advanceTimersByTimeAsync(768);
            expect(await gesture).toMatchObject({ok: true, revision: revision(), controls: [{paramValue: target}]});
            expect(state.getParam('filter', 'cutoff')).toBe(target);
            expect(vi.getTimerCount()).toBe(0);
        });

    it('runs independent moves together, snaps stepped controls and sends whole CC bytes to MIDI modules', async () => {
        fakeTime();
        const {state, midi, raw, map, perform} = instrument();
        await map({...cc74, ...cutoff, min: 0.25, max: 0.75});
        // MIDI modules can hold a different starting value after a panel knob was turned by hand.
        midi.receivePerformanceCC(0, 74, 64);
        raw.mockClear();
        midi.setLearnMode(true);
        midi.startLearning({...resonance, min: 0, max: 1});
        const gesture = perform([
            {...cc74, value: 127, durationSeconds: 1.024, easing: 'ease-in'},
            {...resonance, value: 0.42, durationSeconds: 0.256},
            {moduleId: 'arp', paramId: 'octaves', value: 2, durationSeconds: 1.024},
            {channel: 16, cc: 1, value: 99}
        ]);
        expect(midi.getModWheel(15)).toBe(99);
        await vi.advanceTimersByTimeAsync(256);
        expect(state.getParam('filter', 'resonance')).toBe(0.42);
        // Starting below the mapped range still produces a continuous native sweep.
        expect(state.getParam('filter', 'cutoff')).toBeCloseTo(0.75 / 16, 3);
        expect(state.getParam('arp', 'octaves')).toBe(1);
        state.setParam('filter', 'resonance', 0.9); // The shorter gesture has released this knob.
        await vi.advanceTimersByTimeAsync(768);
        expect(await gesture).toMatchObject({ok: true, controls: [{paramValue: 0.75}, {paramValue: 0.9}, {paramValue: 2}, {value: 99}]});
        expect(state.getParam('filter', 'cutoff')).toBe(0.75);
        expect(state.getParam('filter', 'resonance')).toBe(0.9);
        expect(state.getParam('arp', 'octaves')).toBe(2);
        expect(raw.mock.calls[0][0]).toEqual([0xb0, 74, 64]);
        expect(raw.mock.calls.at(-1)[0]).toEqual([0xb0, 74, 127]);
        expect(raw.mock.calls.every(([[status, cc, byte]]) => status >= 0xb0 && Number.isInteger(cc) && Number.isInteger(byte))).toBe(true);
        expect(midi.isLearning).toBe(true);
        expect(midi.getMappings()).toEqual({'0:74': {...cutoff, min: 0.25, max: 0.75}});
    });

    it('preflights the complete gesture before any panel or MIDI write', async () => {
        const {state, raw, host, map, perform, tools, revision} = instrument();
        await map({...cc74, ...cutoff});
        const snapshot = host.serializePatch();
        for (const bad of [null, {...cc74, ...cutoff, value: 1}, {...cc74, value: 128}, {...cc74, value: 3.2},
            {...resonance, value: NaN}, {...resonance, value: 2}, {...resonance, value: 0.5, durationSeconds: 31},
            {...resonance, value: 0.5, easing: 'constructor'}, {...resonance, value: 0.5, extra: true},
            {...cc74, value: 0}, {...cutoff, value: 0}, {moduleId: 'arp', paramId: 'octaves', value: 1.5}]) {
            expect(await perform([{...cc74, value: 64}, bad])).toMatchObject({ok: false, error: {code: 'invalid-input'}});
        }
        expect(await perform([{moduleId: 'missing', paramId: 'rate', value: 0.3}])).toMatchObject({ok: false, error: {code: 'unknown-module'}});
        state.setParam('filter', 'resonance', 0.7);
        expect(await tools.perform_controls.execute({expectedRevision: revision() - 1, controls: [{...cc74, value: 64}]}))
            .toMatchObject({ok: false, error: {code: 'rack-changed'}});
        expect(raw).not.toHaveBeenCalled();
        expect(host.setParam).not.toHaveBeenCalled();
        expect(state.midiMappings).toEqual(snapshot.midiMappings);
    });

    it('keeps the caption with the gesture and releases each panel highlight at its own endpoint', async () => {
        fakeTime();
        const {activity, map, tools, revision, state} = instrument();
        await map({...cc74, ...cutoff});
        const stages = [];
        activity.addEventListener('change', ({detail}) => {
            if (detail.phase === 'performing' && detail.status === 'running') stages.push(detail.step);
        });
        const gesture = tools.perform_controls.execute({expectedRevision: revision(), caption: '  Opening the filter  ', moduleId: 'filter',
            controls: [{...cc74, value: 127, durationSeconds: 1}, {...resonance, value: 0.8, durationSeconds: 0.25},
                {channel: 2, cc: 1, value: 63, durationSeconds: 1}]});
        const cue = {caption: 'Opening the filter', moduleId: 'filter'};
        expect(stages).toEqual([{...cue, controls: [cutoff, resonance]}]);
        await vi.advanceTimersByTimeAsync(300);
        expect(stages).toEqual([{...cue, controls: [cutoff, resonance]}, {...cue, controls: [cutoff]}]);
        expect(state.getParam('filter', 'cutoff')).toBeGreaterThan(0);
        expect(activity.entries[0].status).toBe('running');
        await vi.advanceTimersByTimeAsync(700);
        expect(await gesture).toMatchObject({ok: true});
        expect(activity.entries[0].status).toBe('complete');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects invalid captions and module targets before changing a control or sending MIDI', async () => {
        const {tools, raw, host, revision} = instrument();
        for (const [cue, code] of [[{caption: '  '}, 'invalid-input'], [{caption: 'x'.repeat(241)}, 'invalid-input'],
            [{moduleId: 1}, 'invalid-input'], [{moduleId: 'missing'}, 'unknown-module']]) {
            const res = await tools.perform_controls.execute({expectedRevision: revision(), ...cue,
                controls: [{...cutoff, value: 0.5}, {...cc74, value: 64}]});
            expect(res).toMatchObject({ok: false, error: {code}});
        }
        expect(host.setParam).not.toHaveBeenCalled();
        expect(raw).not.toHaveBeenCalled();
    });

    it('shares one caption with walkthroughs while allowing an uncaptioned sweep under a held step', async () => {
        fakeTime();
        const {tools, revision, perform} = instrument();
        const present = tools.present_step.execute;
        const controls = [{...cutoff, value: 0.6, durationSeconds: 0.5}];
        const narratedSweep = () => tools.perform_controls.execute({expectedRevision: revision(), caption: 'Opening', controls});
        const hold = present({caption: 'Listen', holdSeconds: 0.5});
        expect(await narratedSweep()).toMatchObject({ok: false, error: {code: 'busy'}});
        const sweep = perform(controls);
        await vi.advanceTimersByTimeAsync(500);
        expect(await hold).toMatchObject({ok: true});
        expect(await sweep).toMatchObject({ok: true});
        const next = narratedSweep();
        expect(await present({caption: 'Another view'})).toMatchObject({ok: false, error: {code: 'busy'}});
        await vi.advanceTimersByTimeAsync(500);
        expect(await next).toMatchObject({ok: true});
    });

    it('leaves the current value on cancellation and releases the rack for a subsequent gesture', async () => {
        fakeTime();
        const {state, perform} = instrument();
        const controller = new AbortController();
        const gesture = perform([{...cutoff, value: 1, durationSeconds: 2}], {signal: controller.signal});
        await vi.advanceTimersByTimeAsync(400);
        expect(await perform([{...cutoff, value: 0}])).toMatchObject({ok: false, error: {code: 'busy'}});
        controller.abort();
        expect(await gesture).toMatchObject({ok: false, error: {code: 'cancelled'}});
        const held = state.getParam('filter', 'cutoff');
        expect(held).toBeCloseTo(0.2, 2);
        await vi.advanceTimersByTimeAsync(2000);
        expect(state.getParam('filter', 'cutoff')).toBe(held);
        expect(vi.getTimerCount()).toBe(0);
        expect(await perform([{...cutoff, value: 0.8}])).toMatchObject({ok: true, controls: [{paramValue: 0.8}]});
    });

    it.each([
        ['manual takeover', ({state}) => state.setParam('filter', 'cutoff', 0.3), 'rack-changed'],
        ['MIDI Learn reassignment', ({state}) => { state.midiMappings = {}; }, 'rack-changed'],
        ['patch replacement', ({host}) => { host.topologyActivation = Promise.resolve(); }, 'rack-changed'],
        ['audio stop', ({host}) => { host.engine.running = false; }, 'audio-not-running'],
        ['phone player', ({app}) => Object.defineProperty(app, 'inPlayerView', {value: true}), 'player-read-only']
    ])('ends a sweep on %s before the next write', async (_label, interrupt, code) => {
        fakeTime();
        const rack = instrument();
        const gesture = rack.perform([{...cutoff, value: 1, durationSeconds: 1}]);
        await vi.advanceTimersByTimeAsync(160);
        interrupt(rack);
        const held = rack.state.getParam('filter', 'cutoff');
        await vi.advanceTimersByTimeAsync(1000);
        expect(await gesture).toMatchObject({ok: false, error: {code}});
        expect(rack.state.getParam('filter', 'cutoff')).toBe(held);
        expect(vi.getTimerCount()).toBe(0);
    });
});
