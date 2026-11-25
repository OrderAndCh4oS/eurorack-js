import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { executePatchScript } from '../../src/js/patch-script/builder.js';
import { compilePatchDescription } from '../../src/js/patch-script/compiler.js';
import { formatPatchScript } from '../../src/js/patch-script/formatter.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(async () => {
    await loadCorePlugin();
});

function compile(source) {
    return compilePatchDescription(executePatchScript(source), { registry: pluginRegistry, blockSize: 16 });
}

describe('patch script builder and compiler', () => {
    it('builds a canonical patch with loops, settings, fan-out, and automatic placement', () => {
        const result = compile(`
            const p = patch()
            for (let index = 0; index < 2; index++) p.module('vco', 'osc' + index)
            p.module('out', 'main').set('osc0', 'coarse', 0.25)
            p.connect('osc0.ramp', 'main.L').connect('osc1.triangle', 'main.R')
        `);

        expect(result.patch.version).toBe(3);
        expect(result.patch.plugins).toEqual({ core: 1 });
        expect(result.patch.modules.map(module => module.id)).toEqual(['osc0', 'osc1', 'main']);
        expect(result.patch.params.osc0.coarse).toBe(0.25);
        expect(result.diagnostics.processOrder.indexOf('osc0')).toBeLessThan(result.diagnostics.processOrder.indexOf('main'));
    });

    it('auto-increments module IDs and accepts naming overrides', () => {
        const result = compile(`
            const p = patch()
            p.module('vco').module('vco', 'lead', { coarse: 0.15 })
            const second = p.add('vco', { coarse: 0.2 })
            const bass = p.add('vco', { coarse: 0.1 }, { name: 'bassOsc' })
            p.module('out', 'main')
            const first = 'vco_1'
            p.connect(p.port(first, 'ramp'), 'main.L').connect(p.port(second, 'ramp'), 'main.R')
        `);

        expect(result.patch.modules.map(module => module.id)).toEqual(['vco_1', 'lead', 'vco_2', 'bassOsc', 'main']);
        expect(result.patch.params.vco_2).toMatchObject({ coarse: 0.2 });
    });

    it('supports unnamed, named, and options-object module overloads', () => {
        const result = compile(`patch()
            .module('vco')
            .module('vco', 'lead', { coarse: 0.2 })
            .module('out', {}, { name: 'main' })`);
        expect(result.patch.modules.map(module => module.id)).toEqual(['vco_1', 'lead', 'main']);
    });

    it('rejects conflicting module name aliases', () => {
        expect(() => executePatchScript(`patch().module('vco', {}, { name: 'lead', id: 'bass' })`))
            .toThrow('different name and id');
    });

    it('rejects ambiguous scripts and occupied inputs', () => {
        expect(() => executePatchScript('patch(); patch()')).toThrow('exactly one');
        expect(() => executePatchScript('const value = 1')).toThrow('call patch()');
        expect(() => compile(`patch()
            .module('vco', 'a').module('vco', 'b').module('out', 'main')
            .connect('a.ramp', 'main.L').connect('b.ramp', 'main.L')`)
        ).toThrow('more than one source');
    });

    it('compiles Octo trunks, preserves scalar cross-patching, and reports the effective feedback edge', () => {
        const base = "patch().module('octo-send','A').module('octo-receive','B').module('loop','loop').module('clk','clk')";
        const result = compile(base + ".connect('A.link','B.link').connect('loop.out','A.in5')" +
            ".connect('B.out5','loop.in').connect('clk.clock','A.in3')");
        expect(result.patch.cables).toHaveLength(4);
        expect(result.diagnostics.feedbackRoutes).toEqual(['loop.out -> loop.in']);
        expect(() => compile(base + ".connect('A.link','loop.in')")).toThrow(/LINK/);
        expect(() => compile(base + ".connect('clk.clock','B.link')")).toThrow(/LINK/);
    });

    it('reports feedback delays and transient action warnings', () => {
        const result = compile(`patch()
            .module('loop', 'loop1', { clear: 1 })
            .connect('loop1.out', 'loop1.in')`);

        expect(result.diagnostics.feedbackRoutes).toEqual(['loop1.out -> loop1.in']);
        expect(result.diagnostics.warnings.some(message => message.includes('trigger action'))).toBe(true);
        expect(result.diagnostics.warnings).toContain('No OUT module');
        expect(result.diagnostics.issues).toContainEqual({
            code: 'no-output-route', severity: 'warning',
            message: 'No route to an output or monitor', moduleIds: ['loop1']
        });
    });

    it('includes structured connection diagnostics without rejecting incomplete patches', () => {
        const result = compile(`patch().module('vco', 'osc').module('out', 'main')`);
        expect(result.diagnostics.issues.map(issue => issue.code)).toEqual(['module-unconnected', 'output-unconnected']);
        expect(result.diagnostics.warnings).toContain('osc: No cables connected');
        expect(result.patch.modules).toHaveLength(2);
    });

    it('keeps monitoring patches free of unused output warnings', () => {
        const result = compile(`patch().module('vco', 'osc').module('scope', 'monitor')
            .connect('osc.ramp', 'monitor.in1')`);
        expect(result.diagnostics.issues.map(issue => issue.code)).toEqual(['missing-output']);
        expect(result.diagnostics.warnings).toEqual(['No OUT module']);
    });

    it('formats and recompiles the complete patch contract', () => {
        const first = compile(`patch()
            .module('vco', 'osc', { coarse: 0.31 }, { row: 2, index: 0 })
            .module('out', 'main', {}, { row: 2, index: 1 })
            .connect('osc.ramp', 'main.L')
            .midi('0:74', { moduleId: 'osc', paramId: 'coarse', min: 0, max: 1 })`);
        const source = formatPatchScript(first.patch, pluginRegistry);
        const second = compile(source);

        expect(source).toContain(`.module("vco", "osc", { "coarse": 0.31 }, { row: 2, index: 0 })`);
        expect(source).toContain(`.midi("0:74", { "moduleId": "osc", "paramId": "coarse", "min": 0, "max": 1 })`);
        expect(source).not.toContain('{"row":');
        expect(source.split('\n').filter(line => line.includes('.module('))).toHaveLength(first.patch.modules.length);
        expect(source.split('\n').filter(line => line.includes('.module(')).every(line => line.trimStart().startsWith('.module('))).toBe(true);
        expect(second.patch).toEqual(first.patch);
    });

    it('rounds snapshot values to five decimal places', () => {
        const result = compile(`patch().module('vco', 'osc', { coarse: 0.314159265 })`);
        const source = formatPatchScript(result.patch, pluginRegistry);
        const roundTrip = compile(source);

        expect(source).toContain(`"coarse": 0.31416`);
        expect(roundTrip.patch.params.osc.coarse).toBe(0.31416);
    });

    it('keeps a 256-call snapshot chained and switches to statements when a MIDI mapping takes it over', () => {
        const { patch } = compile(`const rack = patch()
            for (let i = 0; i < 128; i++) rack.module('mix', 'mix' + i)
            for (let i = 0; i < 128; i++) rack.connect('mix0.out', 'mix' + i + '.in1')`);
        const compact = formatPatchScript(patch, pluginRegistry);
        expect(compact).toMatch(/^patch\(\)\n  \.module/);
        patch.midiMappings['0:74'] = { moduleId: 'mix0', paramId: 'lvl1', min: 0, max: 1 };
        const source = formatPatchScript(patch, pluginRegistry);
        expect(source.split('\n')[0]).toBe('const rack = patch()');
        expect(source.match(/^rack\.module\(/gm)).toHaveLength(128);
        expect(source.match(/^rack\.connect\(/gm)).toHaveLength(128);
        expect(source).toContain('\nrack.midi(');
        expect(compile(source).patch).toEqual(patch);
    });

    it('executes older fluent snapshots on a small JS stack and preserves argument expressions', () => {
        const source = '// older snapshot\npatch().module("mix", "m")' +
            '\n/* ).set( */ .set("m", "lvl1", /[()]/.test("(") ? Math.abs(-1) : 0)'.repeat(1200) +
            '\n.midi("0:4", { label: `).connect(${String(4)})` });';
        const result = execFileSync(process.execPath, ['--stack-size=192', '--input-type=module', '-e', `
            import { readFileSync } from 'node:fs';
            import { executePatchScript } from './src/js/patch-script/builder.js';
            const result = executePatchScript(readFileSync(0, 'utf8'));
            process.stdout.write(JSON.stringify([result.modules[0].params.lvl1, result.midiMappings['0:4'].label]));
        `], { input: source, encoding: 'utf8' });
        expect(JSON.parse(result)).toEqual([1, ').connect(4)']);
    });
});
