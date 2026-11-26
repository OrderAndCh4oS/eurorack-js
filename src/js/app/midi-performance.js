import { mappedControlValue } from '../midi/midi-manager.js';
import { draftError } from '../patch-script/draft-service.js';
import { controlRange, getControlDomain, inRange, legalControlValue, snapControlValue } from '../rack/control-domain.js';
import { delay } from '../utils/abortable-delay.js';

export const MAX_PERFORMANCE_CONTROLS = 16;
export const MAX_GESTURE_SECONDS = 30;
const curves = {
    linear: t => t,
    'ease-in': t => t * t,
    'ease-out': t => t * (2 - t),
    'ease-in-out': t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2
};
export const EASING_NAMES = Object.keys(curves);

function invalid(message) { throw draftError('invalid-input', message); }

function checkRack({ app, drafts }, expectedRevision) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) invalid('Provide the revision from get_rack.');
    drafts.requireEditor();
    if (app.patchLibrary?.replacing) throw draftError('busy', 'A patch is opening.');
    if (drafts.observe().revision !== expectedRevision) throw draftError('rack-changed', 'The rack changed. Read it again before performing.');
}

function midiKey(channel, cc) {
    if (!Number.isInteger(channel) || !inRange(channel, 1, 16) || !Number.isInteger(cc) || !inRange(cc, 0, 127)) {
        invalid('Use MIDI channel 1–16 and CC number 0–127.');
    }
    return `${channel - 1}:${cc}`;
}

function panelDomain(app, moduleId, paramId) {
    if (typeof moduleId !== 'string' || !moduleId || typeof paramId !== 'string' || !paramId) {
        invalid('Provide a module instance ID and a panel parameter ID.');
    }
    const module = app.state.getModule(moduleId);
    if (!module) throw draftError('unknown-module', `Module "${moduleId}" is missing from the rack.`);
    const domain = getControlDomain(app.host.registry.get(module.type), paramId);
    if (!domain) invalid(`Unknown panel control "${moduleId}.${paramId}". Check describe_modules for its parameters.`);
    return domain;
}

export function mapMidiCC(workbench, { expectedRevision, channel, cc, moduleId, paramId, min, max }) {
    const { app, drafts } = workbench;
    return drafts.exclusive(() => {
        checkRack(workbench, expectedRevision);
        const key = midiKey(channel, cc);
        const range = controlRange(panelDomain(app, moduleId, paramId));
        const mapping = { moduleId, paramId, min: min === undefined ? range.min : min, max: max === undefined ? range.max : max };
        if (!inRange(mapping.min, range.min, range.max) || !inRange(mapping.max, mapping.min, range.max)) {
            invalid(`Choose mapping endpoints in ascending order from ${range.min} to ${range.max}.`);
        }
        app.midiManager.assignMapping(channel - 1, cc, mapping);
        app.syncMidiMappings();
        return { revision: drafts.observe().revision, key, mapping };
    });
}

function prepareMove(app, control) {
    if (!control || typeof control !== 'object' || Array.isArray(control)) invalid('Each control must be an object.');
    const { channel, cc, value, durationSeconds = 0, easing = 'linear' } = control;
    const viaMidi = Object.hasOwn(control, 'channel') || Object.hasOwn(control, 'cc');
    const fields = ['value', 'durationSeconds', 'easing', ...(viaMidi ? ['channel', 'cc'] : ['moduleId', 'paramId'])];
    if (Object.keys(control).some(key => !fields.includes(key))) invalid('Address each control by moduleId and paramId, or by channel and cc.');
    if (!inRange(durationSeconds, 0, MAX_GESTURE_SECONDS) || typeof easing !== 'string' || !Object.hasOwn(curves, easing)) {
        invalid(`Choose a duration of 0–${MAX_GESTURE_SECONDS} seconds and a supported easing curve.`);
    }
    const move = { control, durationMs: durationSeconds * 1000, curve: curves[easing] };
    let target = control;
    if (viaMidi) {
        const key = midiKey(channel, cc);
        if (!Number.isInteger(value) || !inRange(value, 0, 127)) invalid('A MIDI CC target value must be an integer from 0 to 127.');
        const current = app.midiManager.getCCValue(channel - 1, cc);
        move.midi = { key, channel: channel - 1, cc, from: current, to: value, last: current, sent: false };
        target = app.state.midiMappings[key];
        if (target === undefined) return move; // Raw CC for MIDI-CC, mod wheel, or a plugin listening on this channel.
        if (!target || !Number.isFinite(target.min) || !Number.isFinite(target.max)) invalid(`Map MIDI CC ${key} to a valid panel range first.`);
    }
    const { moduleId, paramId } = target;
    const domain = panelDomain(app, moduleId, paramId);
    const from = app.state.getParam(moduleId, paramId);
    const to = viaMidi ? mappedControlValue(target, value) : value;
    if (!viaMidi && !legalControlValue(domain, to)) invalid(`Choose a declared control setting for "${moduleId}.${paramId}".`);
    if (!Number.isFinite(from) || !Number.isFinite(to)) invalid(`"${moduleId}.${paramId}" needs a finite control value.`);
    move.panel = { moduleId, paramId, domain, from, to, last: from };
    return move;
}

function interpolate(from, to, amount) {
    return amount === 1 ? to : from + (to - from) * amount;
}

function advanceMove(app, { panel, midi }, amount) {
    if (midi) {
        const byte = Math.round(interpolate(midi.from, midi.to, amount));
        if (!midi.sent || byte !== midi.last) {
            app.midiManager.receivePerformanceCC(midi.channel, midi.cc, byte);
            midi.last = byte;
            midi.sent = true;
        }
    }
    if (panel) {
        const next = snapControlValue(panel.domain, interpolate(panel.from, panel.to, amount));
        if (next !== panel.last) {
            app.setPanelControl(panel.moduleId, panel.paramId, next);
            panel.last = next;
        }
    }
}

export function performControls(workbench, { expectedRevision, controls }, signal) {
    const { app, drafts } = workbench;
    return drafts.exclusive(async () => {
        checkRack(workbench, expectedRevision);
        if (!Array.isArray(controls) || !inRange(controls.length, 1, MAX_PERFORMANCE_CONTROLS)) {
            invalid(`Provide 1–${MAX_PERFORMANCE_CONTROLS} controls per gesture.`);
        }
        const moves = controls.map(control => prepareMove(app, control));
        const addresses = new Set();
        for (const { panel, midi } of moves) {
            const keys = [];
            if (midi) keys.push(midi.key);
            if (panel) keys.push(JSON.stringify([panel.moduleId, panel.paramId]));
            for (const key of keys) {
                if (addresses.has(key)) invalid('Each CC and panel parameter can appear only once in a gesture.');
                addresses.add(key);
            }
        }
        const { host, state, patchLibrary } = app;
        const engine = host.engine;
        const topology = host.topologyActivation;
        const mappings = state.midiMappings;
        const record = patchLibrary?.active;
        const account = patchLibrary?.accountGeneration;
        const started = performance.now();
        let pending = moves;
        try {
            while (pending.length) {
                signal?.throwIfAborted();
                drafts.requireEditor();
                if (!engine?.running || host.audioCtx?.state !== 'running' || host.stoppingAudio) {
                    throw draftError('audio-not-running', 'Press Start in the rack and keep audio running during the gesture.');
                }
                if (host.engine !== engine || host.topologyActivation !== topology || engine.preparingTopologies ||
                    engine.activeRevision !== engine.revision || state.midiMappings !== mappings || patchLibrary?.replacing ||
                    patchLibrary?.active !== record || patchLibrary?.accountGeneration !== account) {
                    throw draftError('rack-changed', 'The rack or its MIDI mappings changed. Read it again before continuing.');
                }
                // A musician can take over a moving knob. Unrelated controls remain independently playable.
                for (const { panel, midi } of pending) {
                    if ((panel && state.getParam(panel.moduleId, panel.paramId) !== panel.last) ||
                        (midi && app.midiManager.getCCValue(midi.channel, midi.cc) !== midi.last)) {
                        throw draftError('rack-changed', 'A control in the gesture was moved. Read the rack before continuing.');
                    }
                }
                const elapsed = performance.now() - started;
                for (const move of pending) {
                    const progress = elapsed >= move.durationMs ? 1 : elapsed / move.durationMs;
                    advanceMove(app, move, move.curve(progress));
                }
                pending = pending.filter(move => elapsed < move.durationMs);
                if (pending.length) {
                    const nextEnd = Math.min(...pending.map(move => move.durationMs));
                    await delay(Math.min(1000 / 60, nextEnd - elapsed), signal);
                }
            }
            const results = moves.map(({ control, panel }) => {
                if (!panel) return { ...control };
                const { moduleId, paramId } = panel;
                return { ...control, moduleId, paramId, paramValue: state.getParam(moduleId, paramId) };
            });
            return { revision: drafts.observe().revision, controls: results };
        } finally {
            app.patchLibrary?.updateActiveLabel();
        }
    });
}
