import { beforeAll, describe, expect, it, vi } from 'vitest';
import spacer from '../../src/js/modules/spacer/index.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';
import { RackHost } from '../../src/js/app/rack-host.js';
import { assertModuleParam } from '../../src/js/rack/module-contract.js';
import { analyseRackConnections } from '../../src/js/rack/diagnostics.js';
import { compilePatchDescription } from '../../src/js/patch-script/compiler.js';
import { validateState } from '../../server/validation.js';

beforeAll(() => loadCorePlugin());

describe('spacer panels', () => {
    it('has six prints, defaults to a 4 HP Contour and owns no signal buffers', () => {
        const blank = spacer.createDSP();
        expect(blank.params).toEqual({ hp: 4, style: 'contour' });
        expect(spacer.ui.state.find(field => field.param === 'style').values).toEqual([
            'contour', 'orbit', 'weave', 'dunes', 'prism', 'pulse'
        ]);
        blank.process();
        blank.reset();
        expect([blank.inputs, blank.outputs, blank.leds]).toEqual([{}, {}, {}]);
        for (let hp = 1; hp <= 84; hp++) expect(() => assertModuleParam(spacer, 'hp', hp)).not.toThrow();
        for (const hp of [0, -1, 1.5, 85, '4', null]) expect(() => assertModuleParam(spacer, 'hp', hp)).toThrow();
        expect(() => assertModuleParam(spacer, 'style', 'unknown')).toThrow();
    });

    it('counts each actual width when placing, moving, resizing, pasting and saving panels', async () => {
        const host = new RackHost();
        const add = (id, hp, style, row) => host.addModule('spacer', { id, row, params: { hp, style } });
        add('left', 83, 'weave', 1);
        add('stripe', 1, 'pulse', 1);
        add('wide', 84, 'dunes');
        expect(host.state.getModule('wide').row).toBe(2);
        expect(() => host.state.moveModule('left', pluginRegistry, { row: 2 })).toThrow(/fit/);
        expect(host.state.getRow(1)).toEqual(['left', 'stripe']);
        expect(() => host.setParam('stripe', 'hp', 2)).toThrow(/fit/);
        const copy = await host.pasteModules(host.copyModules(['left', 'stripe']));
        expect(copy.modules.map(mod => [mod.row, mod.params])).toEqual([
            [3, { hp: 83, style: 'weave' }], [3, { hp: 1, style: 'pulse' }]
        ]);
        host.setParam('stripe', 'style', 'orbit');
        const patch = host.serializePatch();
        const restored = new RackHost();
        await restored.loadPatch(validateState(patch).state);
        expect(restored.serializePatch()).toEqual(patch);
        expect(restored.state.getRowHP(1, pluginRegistry)).toBe(84);
        expect(restored.state.getModule(copy.modules[1].id).params.style).toBe('pulse');
        patch.params.stripe.hp = 2;
        expect(() => validateState(patch)).toThrow(/84 HP/);
    });

    it('leaves the playing audio graph alone and omits blanks from wiring diagnostics', async () => {
        const host = new RackHost();
        host.engine = { setPatchState: vi.fn(() => Promise.resolve()), setParam: vi.fn() };
        host.addModule('spacer', { id: 'plate' });
        host.setParam('plate', 'style', 'prism');
        await host.pasteModules(host.copyModules(['plate']));
        expect(analyseRackConnections(host.serializePatch(), pluginRegistry).issues).toEqual([]);
        expect(host.createRuntimePatchState()).toMatchObject({ modules: [], params: {} });
        host.removeModule('plate');
        expect(host.engine.setPatchState).not.toHaveBeenCalled();
        expect(host.engine.setParam).not.toHaveBeenCalled();
    });

    it('packs scripted spacers by their requested widths and compiles only audio modules', () => {
        const modules = [
            { id: 'cover', type: 'spacer', params: { hp: 80 } },
            { id: 'art', type: 'spacer', params: { hp: 7 } }
        ];
        const { patch, diagnostics } = compilePatchDescription({ modules }, { registry: pluginRegistry });
        expect(patch.modules.map(mod => mod.row)).toEqual([1, 2]);
        expect(diagnostics.processOrder).toEqual([]);
    });
});
