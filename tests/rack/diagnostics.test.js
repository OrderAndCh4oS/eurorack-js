import { describe, expect, it, vi } from 'vitest';
import { CORE_MODULE_DEFINITIONS } from '../../src/js/rack/core-definitions.js';
import { analyseRackConnections } from '../../src/js/rack/diagnostics.js';

const registry = new Map(CORE_MODULE_DEFINITIONS.map(definition => [definition.id, definition]));

function rack(modules, connections = []) {
    return {
        version: 3,
        plugins: { core: 1 },
        modules: Object.entries(modules).map(([id, type], index) => ({ id, type, row: 1, index })),
        params: {},
        cables: connections.map(([fromModule, fromPort, toModule, toPort]) => ({ fromModule, fromPort, toModule, toPort }))
    };
}

function issueCodes(report) {
    return report.issues.map(issue => [issue.code, issue.moduleIds]);
}

describe('rack connection diagnostics', () => {
    it('leaves an empty rack clear', () => {
        expect(analyseRackConnections(rack({}), registry)).toEqual({ issues: [], moduleCount: 0, cableCount: 0 });
    });

    it('accepts optional inputs, unused waveforms, and a single OUT channel', () => {
        const report = analyseRackConnections(rack({ osc: 'vco', main: 'out' }, [
            ['osc', 'ramp', 'main', 'L']
        ]), registry);
        expect(report).toEqual({ issues: [], moduleCount: 2, cableCount: 1 });
    });

    it('follows CV, trigger, audio, and fan-out paths to an output', () => {
        const report = analyseRackConnections(rack({ clock: 'clk', seq: 'seq', osc: 'vco', main: 'out' }, [
            ['clock', 'clock', 'seq', 'clock'],
            ['seq', 'cv', 'osc', 'vOct'],
            ['osc', 'ramp', 'main', 'L'],
            ['osc', 'ramp', 'main', 'R']
        ]), registry);
        expect(report.issues).toEqual([]);
    });

    it('reports one primary problem for each disconnected module', () => {
        const report = analyseRackConnections(rack({ osc: 'vco', main: 'out' }), registry);
        expect(issueCodes(report)).toEqual([
            ['module-unconnected', ['osc']],
            ['output-unconnected', ['main']]
        ]);
        expect(report.issues.every(issue => issue.severity === 'warning')).toBe(true);
        expect(report.issues[1].ports).toEqual([
            { moduleId: 'main', direction: 'input', port: 'L' },
            { moduleId: 'main', direction: 'input', port: 'R' }
        ]);
    });

    it('distinguishes an unused module output from the upstream disconnected path', () => {
        const report = analyseRackConnections(rack({ osc: 'vco', filter: 'vcf', main: 'out' }, [
            ['osc', 'ramp', 'filter', 'audio']
        ]), registry);
        expect(issueCodes(report)).toEqual([
            ['no-output-route', ['osc']],
            ['outputs-unconnected', ['filter']],
            ['output-unconnected', ['main']]
        ]);
        expect(report.issues[1].ports.every(port => port.moduleId === 'filter' && port.direction === 'output')).toBe(true);
    });

    it('accepts feedback with a route out and identifies a closed feedback island', () => {
        const isolated = rack({ loop: 'loop', main: 'out' }, [['loop', 'out', 'loop', 'in']]);
        expect(issueCodes(analyseRackConnections(isolated, registry))).toEqual([
            ['no-output-route', ['loop']], ['output-unconnected', ['main']]
        ]);
        isolated.cables.push({ fromModule: 'loop', fromPort: 'out', toModule: 'main', toPort: 'L' });
        expect(analyseRackConnections(isolated, registry).issues).toEqual([]);
    });

    it.each([
        ['scope', 'in1'], ['spectrum', 'audio'], ['plot', 'audio'],
        ['spectrogram', 'audio'], ['db', 'L'], ['rec', 'L']
    ])('accepts %s as a useful destination with unused pass-through outputs', (type, input) => {
        const report = analyseRackConnections(rack({ osc: 'vco', monitor: type }, [
            ['osc', 'ramp', 'monitor', input]
        ]), registry);
        expect(report.issues).toEqual([
            { code: 'missing-output', severity: 'info', message: 'No OUT module', moduleIds: [] }
        ]);
    });

    it('does not treat a monitor trigger as a signal to monitor', () => {
        const report = analyseRackConnections(rack({ clock: 'clk', monitor: 'plot' }, [
            ['clock', 'clock', 'monitor', 'trig']
        ]), registry);
        expect(issueCodes(report)).toEqual([
            ['missing-output', []], ['no-output-route', ['clock']], ['outputs-unconnected', ['monitor']]
        ]);
    });

    it('accepts monitor trigger controls when there is a signal to display', () => {
        const report = analyseRackConnections(rack({ clock: 'clk', osc: 'vco', monitor: 'plot' }, [
            ['clock', 'clock', 'monitor', 'trig'],
            ['osc', 'ramp', 'monitor', 'audio']
        ]), registry);
        expect(issueCodes(report)).toEqual([['missing-output', []]]);
    });

    it('supports plugin terminal inputs without constructing DSP or mutating the patch', () => {
        const createDSP = vi.fn(() => { throw new Error('Must not construct DSP'); });
        const pluginRegistry = new Map([
            ['source', { createDSP, ui: { outputs: [{ port: 'voltage' }] } }],
            ['meter', { createDSP, diagnostics: { terminalInputs: ['signal'] }, ui: { inputs: [{ port: 'signal' }] } }]
        ]);
        const patch = rack({ source: 'source', meter: 'meter' }, [['source', 'voltage', 'meter', 'signal']]);
        const before = JSON.stringify(patch);
        const report = analyseRackConnections(patch, pluginRegistry);
        expect(issueCodes(report)).toEqual([['missing-output', []]]);
        expect(JSON.stringify(patch)).toBe(before);
        expect(createDSP).not.toHaveBeenCalled();
    });
});
