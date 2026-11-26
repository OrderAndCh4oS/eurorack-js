import { beforeAll, describe, expect, it, vi } from 'vitest';
import { executePatchScript } from '../../src/js/patch-script/builder.js';
import { RackState } from '../../src/js/app/rack-state.js';
import { PatchDraftService } from '../../src/js/patch-script/draft-service.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(() => loadCorePlugin());
const source = `patch().module('vco', 'osc', {coarse: Math.random()})
  .module('out', 'main').connect('osc.triangle', 'main.L')`;
const empty = () => new RackState().serializePatch(pluginRegistry);
function fixture(options = {}) {
    const state = new RackState();
    const edit = patch => state.loadPatch(patch, pluginRegistry);
    let id = 0;
    const app = {
        host: { state, serializePatch: () => state.serializePatch(pluginRegistry), sampleRate: 44100, blockSize: 16 },
        loadPatchState: vi.fn(async (patch, {beforeApply} = {}) => { beforeApply?.(); edit(patch); return true; })
    };
    const evaluate = vi.fn(async code => executePatchScript(code));
    const service = new PatchDraftService({app, registry: pluginRegistry, evaluate, createId: async () => String(++id), ...options});
    return {app, service, evaluate, edit};
}

describe('retained patch drafts', () => {
    it('reports space on empty rows and revises the layout when one is added', () => {
        const {app, service} = fixture();
        const first = service.getRack();
        expect(first.rows).toEqual([1, 2].map(row => ({row, usedHP:0, freeHP:84})));
        app.host.state.addRow();
        const next = service.getRack();
        expect(next.revision).toBeGreaterThan(first.revision);
        expect(next.rows.at(-1)).toEqual({row:3, usedHP:0, freeHP:84});
    });
    it('applies the exact validated random result once, without evaluating again', async () => {
        const {service, evaluate, app} = fixture();
        const result = await service.validate(source, {expectedRevision: service.getRack().revision});
        const coarse = result.patch.params.osc.coarse;
        result.patch.params.osc.coarse = -99;
        expect(await service.apply(result.draftId)).toEqual({applied: true});
        expect(evaluate).toHaveBeenCalledOnce();
        expect(app.host.serializePatch().params.osc.coarse).toBe(coarse);
        await expect(service.apply(result.draftId)).rejects.toMatchObject({code: 'draft-not-found'});
    });

    it('rejects stale reads, edits during validation, and edits before apply', async () => {
        const {service, edit, evaluate, app} = fixture();
        const revision = service.getRack().revision;
        edit({...empty(), modules: [{id:'x',type:'vco',row:1,index:0}], params:{x:{}}});
        await expect(service.validate(source, {expectedRevision: revision})).rejects.toMatchObject({code:'rack-changed'});
        expect(evaluate).not.toHaveBeenCalled();
        const draft = await service.validate(source);
        edit(empty());
        await expect(service.apply(draft.draftId)).rejects.toMatchObject({code:'rack-changed'});
        expect(app.loadPatchState).not.toHaveBeenCalled();
        evaluate.mockImplementationOnce(async code => {
            edit({...empty(), modules:[{id:'y',type:'out',row:1,index:0}], params:{y:{}}});
            return executePatchScript(code);
        });
        await expect(service.validate(source)).rejects.toMatchObject({code:'rack-changed'});
    });

    it('checks again after the unsaved-changes dialog and respects cancellation', async () => {
        const {service, app, edit} = fixture();
        const draft = await service.validate(source);
        app.loadPatchState.mockImplementationOnce(async (_patch, {beforeApply}) => {
            edit({...empty(), modules:[{id:'out',type:'out',row:1,index:0}], params:{out:{}}});
            beforeApply();
        });
        await expect(service.apply(draft.draftId)).rejects.toMatchObject({code:'rack-changed'});
        const fresh = await service.validate(source);
        app.loadPatchState.mockResolvedValueOnce(false);
        expect(await service.apply(fresh.draftId)).toEqual({applied:false});
        expect(await service.apply(fresh.draftId)).toEqual({applied:true});
    });

    it('keeps unsaved edits and the exact draft for a noninteractive retry', async () => {
        const {service, app, evaluate} = fixture();
        app.patchLibrary = {isDirty: () => true};
        expect(service.getRack().hasUnsavedChanges).toBe(true);
        const draft = await service.validate(source);
        await expect(service.apply(draft.draftId, {onUnsavedChanges:'keep'}))
            .rejects.toMatchObject({code:'unsaved-changes'});
        expect(app.loadPatchState).not.toHaveBeenCalled();
        await expect(service.apply(draft.draftId, {onUnsavedChanges:'discard'})).resolves.toEqual({applied:true});
        expect(app.loadPatchState).toHaveBeenCalledWith(draft.patch, expect.objectContaining({edit:true, skipPrompt:true}));
        expect(evaluate).toHaveBeenCalledOnce();
    });

    it('rechecks the saved patch identity before a confirmed noninteractive load', async () => {
        const {service, app} = fixture();
        app.patchLibrary = {active:{source:'local', id:'first'}, accountGeneration:0, isDirty: () => true};
        const draft = await service.validate(source);
        app.loadPatchState.mockImplementationOnce(async (_patch, {beforeApply}) => {
            app.patchLibrary.active.id = 'second';
            beforeApply();
        });
        await expect(service.apply(draft.draftId, {onUnsavedChanges:'discard'})).rejects.toMatchObject({code:'rack-changed'});
        expect(app.host.serializePatch()).toEqual(empty());
    });

    it('does not apply when cancelled or when the editor changed during confirmation', async () => {
        const {service, app} = fixture();
        const draft = await service.validate(source);
        const controller = new AbortController();
        app.loadPatchState.mockImplementationOnce(async (_patch, {beforeApply}) => {controller.abort(); beforeApply();});
        await expect(service.apply(draft.draftId, {signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
        expect(app.host.serializePatch()).toEqual(empty());
        const isCurrent = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
        await expect(service.apply(draft.draftId, {isCurrent})).rejects.toMatchObject({code:'source-changed'});
        expect(app.host.serializePatch()).toEqual(empty());
    });

    it('expires drafts and bounds retained drafts', async () => {
        let now = 0;
        const {service} = fixture({now: () => now, ttlMs: 100, maxDrafts: 2});
        const first = await service.validate(source);
        await service.validate(source);
        const third = await service.validate(source);
        await expect(service.apply(first.draftId)).rejects.toMatchObject({code:'draft-not-found'});
        now = 101;
        await expect(service.apply(third.draftId)).rejects.toMatchObject({code:'draft-not-found'});
    });

    it('refuses a different saved patch with identical content, but allows Save during confirmation', async () => {
        const {service, app} = fixture();
        app.patchLibrary = {active: {source:'local', id:'first'}, accountGeneration:0};
        const first = await service.validate(source);
        app.patchLibrary.active.id = 'second';
        await expect(service.apply(first.draftId)).rejects.toMatchObject({code:'rack-changed'});
        const second = await service.validate(source);
        app.loadPatchState.mockImplementationOnce(async (_patch, {beforeApply}) => {
            app.patchLibrary.active = {source:'cloud',id:'saved'};
            beforeApply();
            return true;
        });
        expect(await service.apply(second.draftId)).toEqual({applied:true});
    });

    it('rechecks expiry at the load boundary after a pending confirmation', async () => {
        let now = 0;
        const {service, app} = fixture({now: () => now, ttlMs:100});
        const draft = await service.validate(source);
        app.loadPatchState.mockImplementationOnce(async (_patch, {beforeApply}) => { now = 101; beforeApply(); });
        await expect(service.apply(draft.draftId)).rejects.toMatchObject({code:'draft-not-found'});
        expect(app.host.serializePatch()).toEqual(empty());
    });

    it('accepts public rack placement indices and rejects declarations beyond the rack limits', async () => {
        const {service} = fixture();
        await expect(service.validate("patch().module('out', {}, {row: 32, index: 255})")).resolves.toHaveProperty('draftId');
        await expect(service.validate("patch().module('out', {}, {row: 33})")).rejects.toMatchObject({code: 'patch-limit'});
        await expect(service.validate("patch().module('out', {}, {index: 256})")).rejects.toMatchObject({code: 'patch-limit'});
        await expect(service.validate("const p = patch(); for (let i = 0; i < 257; i++) p.module('out')"))
            .rejects.toMatchObject({code: 'patch-limit'});
    });

    it('rejects a rack that needs a 33rd row during automatic placement', async () => {
        const {service} = fixture();
        // Five 16 HP scopes fit in each 84 HP row.
        await expect(service.validate("const p = patch(); for (let i = 0; i < 161; i++) p.module('scope')"))
            .rejects.toMatchObject({code: 'patch-limit', message: expect.stringContaining('32 rows')});
    });

    it('serializes mutations and frees its lock after an evaluation failure', async () => {
        let release;
        const {service, evaluate} = fixture();
        evaluate.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = service.validate(source);
        await expect(service.validate(source)).rejects.toMatchObject({code:'busy'});
        release(executePatchScript(source));
        await pending;
        evaluate.mockRejectedValueOnce(new Error('bad source'));
        await expect(service.validate(source)).rejects.toThrow('bad source');
        await expect(service.validate(source)).resolves.toHaveProperty('draftId');
    });
});
