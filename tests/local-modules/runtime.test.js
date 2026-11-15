import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { LocalModuleStore } from '../../src/js/local-modules/store.js';
import { LocalModuleRuntime, assertSelfContainedSource } from '../../src/js/local-modules/runtime.js';
import { PluginRegistry } from '../../src/js/rack/registry.js';

const SOURCE = 'export default { id: "author-id" };';
function definition() {
    return {
        id: 'author-id', name: 'My utility', hp: 2, color: 'module-color-one', category: 'utility',
        createDSP({ bufferSize = 4 } = {}) {
            return { params: {}, inputs: { in: new Float32Array(bufferSize) },
                outputs: { out: new Float32Array(bufferSize) }, process() {} };
        },
        ui: { inputs: [{ id: 'in', port: 'in', signal: 'any' }], outputs: [{ id: 'out', port: 'out', signal: 'any' }] }
    };
}
function fixture() {
    const data = new Map();
    let next = 0;
    const store = new LocalModuleStore({ storage: {
        getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)
    }, createId: async () => String(++next).padStart(26, '0') });
    const registry = new PluginRegistry({ blockSize: 4 });
    const blobs = new Map();
    let url = 0;
    const createObjectURL = vi.fn(blob => { const key = `blob:local-${++url}`; blobs.set(key, blob); return key; });
    const revokeObjectURL = vi.fn();
    const importModule = vi.fn(async () => ({ default: definition() }));
    const options = { store, registry, createObjectURL, revokeObjectURL, importModule };
    return { ...options, blobs, runtime: new LocalModuleRuntime(options) };
}
beforeEach(() => { vi.stubGlobal('Blob', NodeBlob); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('local module source contract', () => {
    it.each([
        '/* import x from "elsewhere"; export * from "x" */ export default {};',
        '// import("remote")\nexport default { name: "import is just text" };',
        'const message = `an import from another place`; export default {};',
        'const test = /import|export/gi; export default {};',
        'if ((false)) /import/.test("text"); export default {};',
        'export /* keep this */ default { process() { return /import/.test("text"); } };',
        'const text = `nested ${`safe ${1 + 2}`} strings`; export default {};'
    ])('accepts comments and literal text without confusing them with dependencies', source => {
        expect(() => assertSelfContainedSource(source)).not.toThrow();
    });
    it.each([
        'import definition from "./module.js"; export default definition;',
        'export { default } from "./module.js";',
        'export * from "./module.js";',
        'export const helper = 1; export default {};',
        'const dependency = import("https://example.test/dsp.js"); export default {};',
        'const text = `${import("remote")}`; export default {};',
        'const here = import.meta.url; export default {};'
    ])('rejects unsupported imports or re-exports before execution', source => {
        expect(() => assertSelfContainedSource(source)).toThrow('self-contained');
    });
    it('requires a default definition export', () => {
        expect(() => assertSelfContainedSource('const note = "export default";')).toThrow('Export one default');
        expect(() => assertSelfContainedSource('')).toThrow('Write a module');
    });
});

describe('LocalModuleRuntime', () => {
    it('does not import drafts until explicit use and registers the same immutable ID in both threads', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        f.store.list(); f.store.get(draft.id);
        expect(f.importModule).not.toHaveBeenCalled();
        const result = await f.runtime.activate(draft.id);
        expect(result.type).toBe(`local-${result.revision.id.toLowerCase()}`);
        expect(result.definition.id).toBe(result.type);
        expect(result.definition.name).toBe('Utility');
        expect(f.registry.getPluginForModule(result.type)).toBe(result.type);
        expect(f.registry.getPatchDependencies([result.type])).toEqual({ [result.type]: 1 });
        const manifest = f.registry.getPlugin(result.type).manifest;
        expect(await f.blobs.get('blob:local-1').text()).toBe(SOURCE);
        const wrapper = await f.blobs.get(manifest.workletUrl).text();
        expect(wrapper).toContain('import source from "blob:local-1"');
        expect(wrapper).toContain(`id: "${result.type}"`);
        expect(wrapper).toContain('name: "Utility"');
        expect(wrapper).toContain(`new Map([["${result.type}", definition]])`);
        expect(wrapper).toContain('registerEurorackWorkletPlugin');
        expect(await f.runtime.activate(draft.id)).toBe(result);
        expect(f.importModule).toHaveBeenCalledOnce();
        expect(f.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('keeps older revisions registered and reloads their exact source after the draft changes', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        const first = await f.runtime.activate(draft.id);
        f.store.save(draft.id, { source: `${SOURCE}\n// next revision` });
        const second = await f.runtime.activate(draft.id);
        expect(second.type).not.toBe(first.type);
        expect(f.registry.has(first.type)).toBe(true);
        const reloadedRegistry = new PluginRegistry({ blockSize: 4 });
        const fresh = new LocalModuleRuntime({ ...f, registry: reloadedRegistry });
        const state = { plugins: { core: 1, [first.pluginId]: 1 } };
        expect(await fresh.preparePatch({ state })).toBe(state);
        expect(reloadedRegistry.has(first.type)).toBe(true);
        expect(reloadedRegistry.has(second.type)).toBe(false);
        const lastImported = f.importModule.mock.calls.at(-1)[0];
        expect(await f.blobs.get(lastImported).text()).toBe(SOURCE);
    });

    it('rejects missing own revisions and unknown external dependencies without importing any code', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        const revision = await f.store.saveRevision(draft.id);
        const ownId = `local-${revision.id.toLowerCase()}`;
        await expect(f.runtime.preparePatch({ plugins: { [ownId]: 1, 'local-00000000000000000000000999': 1 } })).rejects.toThrow('not saved in this browser');
        await expect(f.runtime.preparePatch({ plugins: { 'https://example.test/code.js': 1 } })).rejects.toThrow('unavailable plugin');
        await expect(f.runtime.preparePatch({ plugins: { [ownId]: 2 } })).rejects.toThrow('unsupported patch contract');
        expect(f.importModule).not.toHaveBeenCalled();
        expect(f.createObjectURL).not.toHaveBeenCalled();
    });

    it('preserves explicitly registered trusted plugins without downloading anything', async () => {
        const f = fixture();
        await f.registry.registerPlugin({ id: 'trusted', name: 'Trusted', version: '1.0.0', apiVersion: 1,
            patchVersion: 2, workletUrl: '/trusted.js', modules: [{ id: 'author-id', definition: definition() }] });
        await f.runtime.preparePatch({ plugins: { core: 1, trusted: 2 } });
        expect(f.importModule).not.toHaveBeenCalled();
    });

    it('does not adopt a same-ID definition registered outside this runtime', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        await f.runtime.activate(draft.id);
        const secondRuntime = new LocalModuleRuntime(f);
        await expect(secondRuntime.activate(draft.id)).rejects.toThrow('outside this library');
        expect(f.importModule).toHaveBeenCalledOnce();
    });

    it('deduplicates overlapping activations', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        const [a, b] = await Promise.all([f.runtime.activate(draft.id), f.runtime.activate(draft.id)]);
        expect(a).toBe(b);
        expect(f.importModule).toHaveBeenCalledOnce();
        expect(f.store.get(draft.id).revisions).toHaveLength(1);
    });

    it('preserves a broken source draft and revision while cleaning up failed imports', async () => {
        const f = fixture();
        const source = 'export default { broken syntax';
        const draft = await f.store.create({ name: 'Broken', source });
        f.importModule.mockRejectedValueOnce(new SyntaxError('Unexpected end of input'));
        await expect(f.runtime.activate(draft.id)).rejects.toThrow('Unexpected end');
        expect(f.store.get(draft.id).source).toBe(source);
        expect(f.store.get(draft.id).revisions).toHaveLength(1);
        expect(f.registry.count).toBe(0);
        expect(f.revokeObjectURL).toHaveBeenCalledWith('blob:local-1');
        f.store.save(draft.id, { source: SOURCE });
        expect((await f.runtime.activate(draft.id)).type).toMatch(/^local-/);
    });

    it('rejects invalid definitions without marking them active or losing source', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Broken', source: SOURCE });
        f.importModule.mockResolvedValueOnce({ default: { ...definition(), hp: 99 } });
        await expect(f.runtime.activate(draft.id)).rejects.toThrow('invalid hp');
        expect(f.registry.count).toBe(0);
        expect(f.runtime.loaded.size).toBe(0);
        expect(f.revokeObjectURL).toHaveBeenCalledTimes(2);
        expect(f.store.get(draft.id).source).toBe(SOURCE);
        await f.runtime.activate(draft.id);
        expect(f.registry.count).toBe(1);
    });

    it('rejects imports before any authored source executes', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Import', source: 'import x from "./remote.js"; export default x;' });
        await expect(f.runtime.activate(draft.id)).rejects.toThrow('self-contained');
        expect(f.importModule).not.toHaveBeenCalled();
        expect(f.store.get(draft.id).source).toContain('import x');
    });

    it('retains live URLs until disposal, and stops delayed imports from registering after disposal', async () => {
        const f = fixture();
        const draft = await f.store.create({ name: 'Utility', source: SOURCE });
        await f.runtime.activate(draft.id);
        f.runtime.dispose(); f.runtime.dispose();
        expect(f.revokeObjectURL).toHaveBeenCalledTimes(2);
        await expect(f.runtime.activate(draft.id)).rejects.toThrow('closed');
        const g = fixture();
        const waitingDraft = await g.store.create({ name: 'Waiting', source: SOURCE });
        let finishImport;
        g.importModule.mockImplementationOnce(() => new Promise(resolve => { finishImport = resolve; }));
        const pending = g.runtime.activate(waitingDraft.id);
        await vi.waitFor(() => expect(finishImport).toBeTypeOf('function'));
        g.runtime.dispose(); finishImport({ default: definition() });
        await expect(pending).rejects.toThrow('closed');
        expect(g.registry.count).toBe(0);
        expect(g.revokeObjectURL).toHaveBeenCalledOnce();
    });
});
