import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';
import { loadCorePlugin } from '../../src/js/rack/registry.js';

const patch = { version: 3, plugins: {core: 1}, modules: [], params: {}, cables: [], midiMappings: {} };
beforeAll(() => loadCorePlugin());

describe('local module preparation in the app', () => {
    it('waits for dependencies, then rechecks the edit before applying', async () => {
        const app = new EurorackApp(document);
        const steps = [];
        app.localModuleRuntime.preparePatch = vi.fn(async () => { await Promise.resolve(); steps.push('prepared'); });
        app.host.loadPatch = vi.fn(async () => steps.push('loaded'));
        app.rerenderRack = vi.fn();
        const beforeApply = vi.fn(() => steps.push('checked'));
        await app.loadPatchState(patch, {beforeApply, managed: true});
        expect(steps).toEqual(['prepared', 'checked', 'loaded']);
        expect(beforeApply).toHaveBeenCalledOnce();
    });

    it('leaves the rack unchanged if cancellation arrives during preparation', async () => {
        const app = new EurorackApp(document);
        const controller = new AbortController();
        app.localModuleRuntime.preparePatch = vi.fn(async () => controller.abort());
        app.host.loadPatch = vi.fn();
        app.rerenderRack = vi.fn();
        await expect(app.loadPatchState(patch, {signal: controller.signal, managed: true})).rejects.toMatchObject({name: 'AbortError'});
        expect(app.host.loadPatch).not.toHaveBeenCalled();
        expect(app.rerenderRack).not.toHaveBeenCalled();
    });

    it('does not load a patch after missing dependencies or a stale edit', async () => {
        const app = new EurorackApp(document);
        app.localModuleRuntime.preparePatch = vi.fn().mockRejectedValueOnce(new Error('Missing local revision')).mockResolvedValueOnce(patch);
        app.host.loadPatch = vi.fn();
        await expect(app.loadPatchState(patch, {managed: true})).rejects.toThrow('Missing local revision');
        await expect(app.loadPatchState(patch, {managed: true, beforeApply: () => { throw new Error('Rack changed'); }})).rejects.toThrow('Rack changed');
        expect(app.host.loadPatch).not.toHaveBeenCalled();
    });
});
