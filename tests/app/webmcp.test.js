import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createRackTools, registerRackTools } from '../../src/js/app/webmcp.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(() => loadCorePlugin());
const id = '01M7BFD4Q75HAXTR0K74V5KMKP';
function fixture() {
    const rack = {revision: 3, patch: {modules: []}, source: 'patch()', diagnostics: {issues: [], moduleCount: 0, cableCount: 0}};
    const workbench = {
        drafts: {getRack: vi.fn(() => rack)},
        stageAgentScript: vi.fn(), validateDraft: vi.fn(async () => ({draftId: id})),
        applyDraft: vi.fn(async () => ({applied: true}))
    };
    const tools = Object.fromEntries(createRackTools({workbench, registry: pluginRegistry}).map(tool => [tool.name, tool]));
    return {tools, workbench, rack};
}

describe('Eurorack WebMCP tools', () => {
    it('reads rack and port contracts without changing state', async () => {
        const {tools, workbench} = fixture();
        expect((await tools.get_rack.execute({})).revision).toBe(3);
        expect((await tools.debug_rack.execute({})).issues).toEqual([]);
        const catalogue = await tools.describe_modules.execute({});
        expect(catalogue.modules.find(module => module.id === 'vco')).toBeTruthy();
        const details = await tools.describe_modules.execute({types:['vco', 'out']});
        expect(details.modules[0].outputs.some(port => port.port === 'triangle')).toBe(true);
        expect(details.modules[1].inputs.some(port => port.port === 'L')).toBe(true);
        expect(details.modules[0].parameters.find(param => param.param === 'coarse')).toHaveProperty('min');
        details.modules[0].outputs[0].port = 'changed';
        expect((await tools.describe_modules.execute({types:['vco']})).modules[0].outputs[0].port).not.toBe('changed');
        expect(workbench.stageAgentScript).not.toHaveBeenCalled();
        expect(workbench.applyDraft).not.toHaveBeenCalled();
    });

    it('validates visible source and forwards cancellation to both mutations', async () => {
        const {tools, workbench} = fixture();
        const controller = new AbortController();
        const result = await tools.validate_script.execute({source:'patch()', expectedRevision:3}, {signal:controller.signal});
        expect(result).toEqual({ok:true, draftId:id});
        expect(workbench.stageAgentScript).toHaveBeenCalledWith('patch()');
        expect(workbench.validateDraft).toHaveBeenCalledWith({signal:controller.signal, expectedRevision:3});
        expect(await tools.apply_draft.execute({draftId:id}, {signal:controller.signal})).toEqual({ok:true, applied:true});
        expect(workbench.applyDraft).toHaveBeenCalledWith(id, {signal:controller.signal});
        controller.abort();
        expect(await tools.apply_draft.execute({draftId:id}, {signal:controller.signal})).toMatchObject({ok:false,error:{code:'cancelled'}});
        expect(workbench.applyDraft).toHaveBeenCalledOnce();
    });

    it('rejects stale reads, unknown module IDs, malformed arguments and unexpected fields', async () => {
        const {tools, workbench} = fixture();
        expect(await tools.validate_script.execute({source:'patch()',expectedRevision:2})).toMatchObject({ok:false,error:{code:'rack-changed'}});
        expect(workbench.stageAgentScript).not.toHaveBeenCalled();
        expect(await tools.describe_modules.execute({types:['unknown']})).toMatchObject({ok:false,error:{code:'unknown-module'}});
        expect(await tools.describe_modules.execute({types:'vco'})).toMatchObject({ok:false,error:{code:'invalid-input'}});
        expect(await tools.apply_draft.execute({draftId:'bad'})).toMatchObject({ok:false,error:{code:'invalid-input'}});
        expect(await tools.get_rack.execute({publish:true})).toMatchObject({ok:false,error:{code:'invalid-input'}});
        expect(await tools.validate_script.execute({source:'patch()'})).toMatchObject({ok:false,error:{code:'invalid-input'}});
    });

    it('returns useful structured errors instead of rejected tool promises', async () => {
        const {tools, workbench} = fixture();
        workbench.applyDraft.mockRejectedValueOnce(Object.assign(new Error('The rack changed. Read it again.'),{code:'rack-changed'}));
        expect(await tools.apply_draft.execute({draftId:id})).toEqual({ok:false,error:{code:'rack-changed',message:'The rack changed. Read it again.'}});
    });

    it('uses document.modelContext and an AbortSignal to register and dispose all five tools', async () => {
        const {workbench} = fixture();
        const registerTool = vi.fn(async () => {});
        const adapter = await registerRackTools({document: {modelContext:{registerTool}}, workbench, registry:pluginRegistry});
        expect(adapter.supported).toBe(true);
        expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual(['get_rack','describe_modules','validate_script','apply_draft','debug_rack']);
        const signal = registerTool.mock.calls[0][1].signal;
        expect(signal.aborted).toBe(false);
        expect(registerTool.mock.calls.every(([,options]) => options.signal === signal)).toBe(true);
        adapter.dispose();
        expect(signal.aborted).toBe(true);
    });

    it('is inert without support and cleans up a partial registration failure', async () => {
        const {workbench} = fixture();
        expect((await registerRackTools({document:{},workbench,registry:pluginRegistry})).supported).toBe(false);
        const warn = vi.spyOn(console,'warn').mockImplementation(() => {});
        const registerTool = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('permission denied'));
        const adapter = await registerRackTools({document:{modelContext:{registerTool}},workbench,registry:pluginRegistry});
        expect(adapter.supported).toBe(false);
        expect(registerTool.mock.calls[0][1].signal.aborted).toBe(true);
        warn.mockRestore();
    });
});
