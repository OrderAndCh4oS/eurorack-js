import { beforeAll, describe, expect, it } from 'vitest';
import { getPatchScriptCompletions, scanLiteralPatchSource } from '../../src/js/patch-script/completion.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(async () => {
    await loadCorePlugin();
});

function complete(source, lastPatch = null) {
    return getPatchScriptCompletions({ source, cursor: source.length, registry: pluginRegistry, lastPatch });
}

function completeAt(markedSource) {
    const cursor = markedSource.indexOf('|');
    const source = markedSource.slice(0, cursor) + markedSource.slice(cursor + 1);
    return {
        source,
        completion: getPatchScriptCompletions({ source, cursor, registry: pluginRegistry })
    };
}

function accept(source, completion, insertText) {
    return source.slice(0, completion.from) + insertText + source.slice(completion.to);
}

describe('patch script completion', () => {
    it('scans literal modules and connections without executing source', () => {
        const result = scanLiteralPatchSource(`patch().module('vco', {}, { name: 'osc' }).connect('osc.ramp', 'main.L')`);
        expect(result.modules.get('osc').type).toBe('vco');
        expect(result.connections).toEqual([{ from: 'osc.ramp', to: 'main.L' }]);
    });

    it('estimates auto-incremented names and scans named overloads', () => {
        const modern = scanLiteralPatchSource(`patch().module('vco').module('vco').module('vcf', {}, { name: 'filter' })`);
        expect([...modern.modules.keys()]).toEqual(['vco_1', 'vco_2', 'filter']);
        expect(modern.modules.get('vco_1').provenance).toBe('draft estimate');

        const named = scanLiteralPatchSource(`patch().module('vco', 'osc')`);
        expect(named.modules.get('osc').type).toBe('vco');
    });

    it('completes module types and direction-specific sockets', () => {
        const types = complete(`patch().module('vc`);
        expect(types.items.some(item => item.insertText === 'vco')).toBe(true);

        const outputs = complete(`patch().module('vco', {}, { name: 'osc' }).module('vcf', {}, { name: 'filter' }).connect('osc.`);
        expect(outputs.items.map(item => item.insertText)).toContain('osc.ramp');
        expect(outputs.items.map(item => item.insertText)).not.toContain('filter.audio');

        const inputs = complete(`patch().module('vco', {}, { name: 'osc' }).module('vcf', {}, { name: 'filter' }).connect('osc.ramp', 'filter.`);
        expect(inputs.items.map(item => item.insertText)).toContain('filter.audio');
        expect(inputs.items.map(item => item.insertText)).not.toContain('filter.lpf');

        const addedType = complete(`const p = patch(); const osc = p.add('vc`);
        expect(addedType.items.some(item => item.insertText === 'vco')).toBe(true);

    });

    it('marks occupied inputs and exposes voltage metadata', () => {
        const source = `patch().module('vco', {}, { name: 'a' }).module('vco', {}, { name: 'b' }).module('out', {}, { name: 'main' }).connect('a.ramp', 'main.L').connect('b.ramp', 'main.`;
        const completion = complete(source);
        const left = completion.items.find(item => item.insertText === 'main.L');
        expect(left.unavailable).toBe(true);
        expect(left.detail).toContain('occupied by a.ramp');
        expect(left.detail).toContain('normal 0V');
    });

    it('completes parameter keys and labelled switch, button, and trigger states', () => {
        const keys = complete(`patch().module('comp', { fil`);
        expect(keys.items.some(item => item.label === 'filterMode')).toBe(true);

        const switchValues = complete(`patch().module('comp', { filterMode: `);
        expect(switchValues.items.map(item => item.label)).toEqual(expect.arrayContaining(['0 — Off', '1 — HP', '2 — LP']));

        const buttonValues = complete(`patch().module('loop', { mode: `);
        expect(buttonValues.items.map(item => item.insertText)).toEqual(expect.arrayContaining(['0', '1', '2', '3']));

        const triggerValues = complete(`patch().module('loop', { clear: `);
        expect(triggerValues.items.some(item => item.label.includes('Fire on Apply'))).toBe(true);

        const scalarSwitch = complete(`patch().module('comp', 'compressor').set('compressor', 'filterMode', `);
        expect(scalarSwitch.items.map(item => item.label)).toEqual(expect.arrayContaining(['0 — Off', '1 — HP', '2 — LP']));
    });

    it('replaces complete existing parameter keys and values', () => {
        const value = completeAt(`patch().module('comp', { filterMode: |0 })`);
        const lp = value.completion.items.find(item => item.label === '2 — LP');
        expect(accept(value.source, value.completion, lp.insertText))
            .toBe(`patch().module('comp', { filterMode: 2 })`);

        const key = completeAt(`patch().module('comp', { fil|terMode: 0 })`);
        const filterMode = key.completion.items.find(item => item.label === 'filterMode');
        expect(accept(key.source, key.completion, filterMode.insertText))
            .toBe(`patch().module('comp', { "filterMode": 0 })`);

        const quotedKey = completeAt(`patch().module('comp', { "fil|terMode": 0 })`);
        const quotedFilterMode = quotedKey.completion.items.find(item => item.label === 'filterMode');
        expect(accept(quotedKey.source, quotedKey.completion, quotedFilterMode.insertText))
            .toBe(`patch().module('comp', { "filterMode": 0 })`);
    });

    it('replaces a complete existing socket token', () => {
        const socket = completeAt(`patch().module('vco', 'osc').connect('osc.|ramp', 'osc.sync')`);
        const triangle = socket.completion.items.find(item => item.insertText === 'osc.triangle');
        expect(accept(socket.source, socket.completion, triangle.insertText))
            .toBe(`patch().module('vco', 'osc').connect('osc.triangle', 'osc.sync')`);
    });

    it('completes lossless endpoint objects, placement, and MIDI fields', () => {
        const objectPort = complete(`patch().module('vco', {}, { name: 'osc' }).connect({ module: 'osc', port: 'ra`);
        expect(objectPort.items.some(item => item.insertText === 'ramp')).toBe(true);

        const placement = complete(`patch().module('vco', {}, { `);
        expect(placement.items.some(item => item.insertText === 'name: ')).toBe(true);
        expect(placement.items.some(item => item.insertText === 'row: ')).toBe(true);

        const midiModule = complete(`patch().module('vco', {}, { name: 'osc' }).midi('0:74', { moduleId: 'os`);
        expect(midiModule.items.some(item => item.insertText === 'osc')).toBe(true);

        const midiParam = complete(`patch().module('vco', {}, { name: 'osc' }).midi('0:74', { moduleId: 'osc', paramId: 'co`);
        expect(midiParam.items.some(item => item.insertText === 'coarse')).toBe(true);
    });

    it('uses a validated graph for dynamically generated module IDs', () => {
        const lastPatch = {
            modules: [{ id: 'dynamic3', type: 'lfo' }],
            cables: []
        };
        const completion = complete(`patch().connect('dynamic3.`, lastPatch);
        expect(completion.items.some(item => item.insertText === 'dynamic3.primary')).toBe(true);
        expect(completion.items.find(item => item.insertText === 'dynamic3.primary').detail).toContain('validated');
    });
});
