import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ulid } from 'ulid';
import { executePatchScript } from '../../src/js/patch-script/builder.js';
import { RackState } from '../../src/js/app/rack-state.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';
import { LocalModuleStore } from '../../src/js/local-modules/store.js';
import {
    CURRENT_RACK_SCRIPT_ID,
    PATCH_GUIDE_URL,
    PATCH_REFERENCE_URL,
    PatchWorkbench
} from '../../src/js/patch-script/workbench.js';

beforeAll(async () => {
    await loadCorePlugin();
});

beforeEach(() => {
    document.body.innerHTML = '<button id="patchWorkbenchToggle"></button>';
    localStorage.clear();
});

function createWorkbench(initialPatch = null, options = {}) {
    const state = new RackState();
    if (initialPatch) state.loadPatch(initialPatch, pluginRegistry);
    let listener = null;
    const app = {
        host: {
            sampleRate: 44100,
            blockSize: 16,
            state,
            serializePatch: () => state.serializePatch(pluginRegistry),
            subscribe: next => { listener = next; return () => { listener = null; }; },
            engine: null
        },
        state,
        loadPatchState: vi.fn(async patch => { state.loadPatch(patch, pluginRegistry); listener?.({ type: 'patch-loaded' }); return true; }),
        localModuleRuntime: { activate: vi.fn(async () => ({ type: 'local-test-module' })) },
        addModule: vi.fn(type => ({ id: 'added-module', type })),
        renderAllCables: vi.fn()
    };
    const workbench = new PatchWorkbench({ app, document, registry: pluginRegistry,
        evaluate: async source => executePatchScript(source), createId: async () => ulid(), ...options }).init();
    return { workbench, app };
}

describe('PatchWorkbench', () => {
    it('links the guide and reference to in-app documentation', () => {
        const { workbench } = createWorkbench();
        expect(workbench.drawer.querySelector('a[href$="patch-workbench-guide"]').getAttribute('href')).toBe(PATCH_GUIDE_URL);
        expect(workbench.drawer.querySelector('a[href$="patch-workbench"]').getAttribute('href')).toBe(PATCH_REFERENCE_URL);
        expect([...workbench.drawer.querySelectorAll('a')].every(link => !link.getAttribute('href').startsWith('./docs/'))).toBe(true);
        workbench.dispose();
    });

    it('returns to the rack when opening Code for an agent from another view', () => {
        const { workbench, app } = createWorkbench();
        app.patchLibrary = { navigate: vi.fn() };
        workbench.stageAgentScript("patch().module('out', 'main')");
        expect(app.patchLibrary.navigate).toHaveBeenCalledWith('rack');
        expect(workbench.drawer.hidden).toBe(false);
        workbench.dispose();
    });

    it('gives every toolbar button a clear tooltip', () => {
        const { workbench } = createWorkbench();
        const buttons = [...workbench.drawer.querySelectorAll('.patch-workbench-toolbar button')];
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every(button => button.title.trim().length > 0)).toBe(true);
        expect(workbench.drawer.querySelector('[data-action="load"]').title).toContain('without running');
        expect(workbench.drawer.querySelector('[data-action="validate"]').title).toContain('without changing');
        expect(workbench.drawer.querySelector('[data-action="apply"]').title).toContain('atomically');
        workbench.dispose();
    });

    it('loads module source only after selecting Modules and supports keyboard tab navigation', async () => {
        const moduleFetch = vi.fn(async () => ({ ok: true, text: async () => '// source' }));
        const { workbench } = createWorkbench(null, { moduleFetch });
        workbench.toggle(true);
        const patchTab = workbench.drawer.querySelector('[data-tab="patch"]');
        const modulesTab = workbench.drawer.querySelector('[data-tab="modules"]');
        const patchPanel = document.getElementById(patchTab.getAttribute('aria-controls'));
        const modulesPanel = document.getElementById(modulesTab.getAttribute('aria-controls'));
        expect(moduleFetch).not.toHaveBeenCalled();
        expect(workbench.moduleBrowser).toBeUndefined();

        patchTab.focus();
        patchTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(workbench.moduleBrowser.code.textContent).toBe('// source'));
        expect(moduleFetch).toHaveBeenCalledOnce();
        expect(workbench.activeTab).toBe('modules');
        expect(document.activeElement).toBe(modulesTab);
        expect(modulesTab.getAttribute('aria-selected')).toBe('true');
        expect(modulesTab.tabIndex).toBe(0);
        expect(patchTab.tabIndex).toBe(-1);
        expect(modulesPanel.hidden).toBe(false);
        expect(patchPanel.hidden).toBe(true);
        expect(modulesPanel.getAttribute('aria-labelledby')).toBe(modulesTab.id);

        modulesTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        expect(workbench.activeTab).toBe('patch');
        expect(document.activeElement).toBe(patchTab);
        expect(patchPanel.hidden).toBe(false);
        expect(modulesPanel.hidden).toBe(true);
        patchTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(workbench.activeTab).toBe('modules');
        expect(document.activeElement).toBe(modulesTab);
        expect(moduleFetch).toHaveBeenCalledOnce();
        workbench.dispose();
    });

    it('retains patch text across tabs and persists a local module before leaving its editor', async () => {
        const moduleStore = new LocalModuleStore({ storage: localStorage, createId: async () => ulid() });
        const module = await moduleStore.create({ name: 'My gain', source: '// original' });
        const { workbench, app } = createWorkbench(null, { moduleStore });
        workbench.toggle(true);
        const patchSource = "patch().module('vco', 'osc')\n// keep this patch draft";
        workbench.editor.value = patchSource;
        workbench.editor.dispatchEvent(new Event('input', { bubbles: true }));

        workbench.showTab('modules');
        expect(workbench.moduleBrowser.editor.value).toBe('// original');
        workbench.moduleBrowser.editor.value = '// edited module';
        workbench.moduleBrowser.editor.dispatchEvent(new Event('input', { bubbles: true }));
        workbench.showTab('patch');
        expect(workbench.editor.value).toBe(patchSource);
        expect(moduleStore.get(module.id).source).toBe('// edited module');
        expect(app.localModuleRuntime.activate).not.toHaveBeenCalled();
        expect(app.addModule).not.toHaveBeenCalled();
        expect(app.loadPatchState).not.toHaveBeenCalled();

        workbench.showTab('modules');
        expect(workbench.moduleBrowser.editor.value).toBe('// edited module');
        workbench.toggle(false);
        workbench.toggle(true);
        expect(workbench.activeTab).toBe('modules');
        expect(workbench.editor.value).toBe(patchSource);
        expect(document.activeElement).toBe(workbench.moduleBrowser.search);
        workbench.dispose();
    });

    it('saves local module code and names with Ctrl/Cmd+S without applying the patch or executing the module', async () => {
        const moduleStore = new LocalModuleStore({ storage: localStorage, createId: async () => ulid() });
        const module = await moduleStore.create({ name: 'My module', source: '// original' });
        const { workbench, app } = createWorkbench(null, { moduleStore });
        workbench.toggle(true);
        workbench.showTab('modules');
        const saveAndApply = vi.spyOn(workbench, 'saveAndApply');
        const browser = workbench.moduleBrowser;
        browser.editor.value = 'globalThis.__mustNotRun = true;';
        browser.editor.dispatchEvent(new Event('input', { bubbles: true }));
        browser.editor.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(moduleStore.get(module.id).source).toBe('globalThis.__mustNotRun = true;');
        browser.nameInput.value = 'Renamed module';
        browser.nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        browser.nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }));
        expect(moduleStore.get(module.id).name).toBe('Renamed module');
        expect(globalThis.__mustNotRun).toBeUndefined();
        expect(saveAndApply).not.toHaveBeenCalled();
        expect(app.loadPatchState).not.toHaveBeenCalled();
        expect(app.localModuleRuntime.activate).not.toHaveBeenCalled();
        expect(app.addModule).not.toHaveBeenCalled();
        workbench.dispose();
    });

    it('routes Use module through the local runtime after saving, then adds the returned module type to the rack', async () => {
        const moduleStore = new LocalModuleStore({ storage: localStorage, createId: async () => ulid() });
        const module = await moduleStore.create({ name: 'My module', source: '// original' });
        const { workbench, app } = createWorkbench(null, { moduleStore });
        app.localModuleRuntime.activate.mockImplementation(async id => {
            expect(moduleStore.get(id).source).toBe('// ready to use');
            return { type: 'local-activated-revision' };
        });
        workbench.toggle(true);
        workbench.showTab('modules');
        const browser = workbench.moduleBrowser;
        browser.editor.value = '// ready to use';
        browser.editor.dispatchEvent(new Event('input', { bubbles: true }));
        browser.saveButton.click();
        expect(app.localModuleRuntime.activate).not.toHaveBeenCalled();
        browser.useButton.click();
        await vi.waitFor(() => expect(app.addModule).toHaveBeenCalledWith('local-activated-revision'));
        expect(app.localModuleRuntime.activate).toHaveBeenCalledWith(module.id);
        expect(app.loadPatchState).not.toHaveBeenCalled();
        expect(browser.status.textContent).toBe('Added to rack.');
        workbench.dispose();
    });

    it('keeps the editor open and its tab selected when browser storage refuses a draft save', async () => {
        let failWrites = false;
        const storage = {
            getItem: key => localStorage.getItem(key),
            setItem: (key, value) => {
                if (failWrites) throw new Error('Quota exceeded');
                localStorage.setItem(key, value);
            }
        };
        const moduleStore = new LocalModuleStore({ storage, createId: async () => ulid() });
        const module = await moduleStore.create({ name: 'My module', source: '// original' });
        const { workbench, app } = createWorkbench(null, { moduleStore });
        workbench.toggle(true);
        workbench.showTab('modules');
        const browser = workbench.moduleBrowser;
        browser.editor.value = '// unsaved but retained';
        browser.editor.dispatchEvent(new Event('input', { bubbles: true }));
        failWrites = true;
        workbench.drawer.querySelector('[data-action="close"]').click();
        expect(workbench.drawer.hidden).toBe(false);
        expect(browser.editor.value).toBe('// unsaved but retained');
        expect(browser.status.textContent).toContain('Could not save');
        const tab = workbench.drawer.querySelector('[data-tab="modules"]');
        tab.focus();
        tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(workbench.activeTab).toBe('modules');
        expect(document.activeElement).toBe(tab);
        expect(tab.getAttribute('aria-selected')).toBe('true');
        expect(moduleStore.get(module.id).source).toBe('// original');
        expect(app.localModuleRuntime.activate).not.toHaveBeenCalled();
        failWrites = false;
        workbench.toggle(false);
        expect(workbench.drawer.hidden).toBe(true);
        expect(moduleStore.get(module.id).source).toBe('// unsaved but retained');
        workbench.dispose();
    });

    it('restores own module drafts in a new workbench without activating them', async () => {
        const moduleStore = new LocalModuleStore({ storage: localStorage, createId: async () => ulid() });
        const module = await moduleStore.create({ name: 'My module', source: '// original' });
        const first = createWorkbench(null, { moduleStore });
        first.workbench.toggle(true);
        first.workbench.showTab('modules');
        first.workbench.moduleBrowser.editor.value = '// available for another patch';
        first.workbench.moduleBrowser.editor.dispatchEvent(new Event('input', { bubbles: true }));
        first.workbench.toggle(false);
        first.workbench.dispose();

        const nextStore = new LocalModuleStore({ storage: localStorage });
        const next = createWorkbench(null, { moduleStore: nextStore });
        next.workbench.toggle(true);
        next.workbench.showTab('modules');
        expect(next.workbench.moduleBrowser.selectedKey).toBe(`local:${module.id}`);
        expect(next.workbench.moduleBrowser.editor.value).toBe('// available for another patch');
        expect(next.app.localModuleRuntime.activate).not.toHaveBeenCalled();
        expect(next.app.addModule).not.toHaveBeenCalled();
        next.workbench.dispose();
    });

    it('opens with the current rack and creates a local script on edit', () => {
        const { workbench } = createWorkbench({
            version: 3,
            plugins: { core: 1 },
            modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }],
            params: { osc: {} },
            cables: [],
            midiMappings: {}
        });
        document.getElementById('patchWorkbenchToggle').click();
        expect(workbench.drawer.hidden).toBe(false);
        expect(workbench.scriptSelect.value).toBe(CURRENT_RACK_SCRIPT_ID);
        expect(workbench.editor.value).toContain('.module("vco", "osc", {}');

        workbench.editor.value += '\n// mine';
        workbench.editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(workbench.scriptSelect.value).not.toBe(CURRENT_RACK_SCRIPT_ID);
        expect(workbench.store.list()).toHaveLength(1);
        expect(workbench.syntaxCode.innerHTML).toContain('syntax-comment');
        workbench.dispose();
    });

    it('saves locally and applies with Ctrl+S', async () => {
        const { workbench, app } = createWorkbench();
        document.getElementById('patchWorkbenchToggle').click();
        workbench.editor.value = `patch().module('vco', 'osc').module('out', 'main')
            .connect('osc.ramp', 'main.L').connect('osc.ramp', 'main.R')`;

        const preventDefault = vi.fn();
        workbench.handleEditorKeyDown({ key: 's', ctrlKey: true, metaKey: false, preventDefault });

        await vi.waitFor(() => expect(app.loadPatchState).toHaveBeenCalledOnce());
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(workbench.store.list()).toHaveLength(1);
        expect(workbench.status.textContent).toBe('Saved and applied atomically');
        workbench.dispose();
    });

    it('preserves whitespace when loading a source file', async () => {
        const { workbench } = createWorkbench();
        const source = `patch()\n\n  .module('vco', 'osc', { coarse: 0.3 })\n`;
        const event = {
            target: {
                files: [{ name: 'spaced.js', text: async () => source }],
                value: 'spaced.js'
            }
        };

        await workbench.loadScriptFile(event);

        expect(workbench.editor.value).toBe(source);
        expect(workbench.store.list()[0].source).toBe(source);
        workbench.dispose();
    });

    it('validates and applies a script through the app atomic load boundary', async () => {
        const { workbench, app } = createWorkbench();
        workbench.editor.value = `patch().module('vco', 'osc').module('out', 'main')
            .connect('osc.ramp', 'main.L').connect('osc.ramp', 'main.R')`;

        expect(await workbench.apply()).toBe(true);
        expect(app.loadPatchState).toHaveBeenCalledOnce();
        expect(workbench.lastCompiled.patch.modules.map(module => module.id)).toEqual(['osc', 'main']);
        expect(workbench.status.textContent).toBe('Applied atomically');
        workbench.dispose();
    });

    it('does not call the app when validation fails', async () => {
        const { workbench, app } = createWorkbench();
        workbench.editor.value = `patch().module('vco', 'osc').connect('osc.missing', 'osc.sync')`;

        expect(await workbench.apply()).toBe(false);
        expect(app.loadPatchState).not.toHaveBeenCalled();
        expect(workbench.status.dataset.kind).toBe('error');
        workbench.dispose();
    });

    it('does not report success or replace the applied fingerprint when rack replacement is cancelled', async () => {
        const { workbench, app } = createWorkbench();
        workbench.editor.value = `patch().module('vco', 'osc')`;
        workbench.lastAppliedFingerprint = 'previous rack';
        app.loadPatchState.mockResolvedValue(false);

        expect(await workbench.apply()).toBe(false);
        expect(workbench.lastAppliedFingerprint).toBe('previous rack');
        expect(workbench.status.textContent).not.toContain('Applied atomically');
        expect(app.host.serializePatch().modules).toHaveLength(0);
        workbench.dispose();
    });

    it('renders contextual completion and accepts it with Tab', () => {
        const { workbench } = createWorkbench();
        workbench.editor.value = `patch().module('vco', 'osc').connect('osc.ra`;
        workbench.editor.selectionStart = workbench.editor.selectionEnd = workbench.editor.value.length;
        workbench.updateCompletions();
        const rampIndex = workbench.completion.items.findIndex(item => item.insertText === 'osc.ramp');
        workbench.completionIndex = rampIndex;
        workbench.handleEditorKeyDown({ key: 'Tab', preventDefault: vi.fn() });

        expect(workbench.editor.value).toContain("connect('osc.ramp");
        workbench.dispose();
    });

    it('replaces the remainder of a value when accepting completion mid-token', () => {
        const { workbench } = createWorkbench();
        workbench.editor.value = `patch().module('comp', 'compressor', { filterMode: 0 })`;
        const cursor = workbench.editor.value.indexOf('0');
        workbench.editor.selectionStart = workbench.editor.selectionEnd = cursor;
        workbench.updateCompletions();
        workbench.completionIndex = workbench.completion.items.findIndex(item => item.label === '2 — LP');
        workbench.handleEditorKeyDown({ key: 'Tab', preventDefault: vi.fn() });

        expect(workbench.editor.value).toBe(`patch().module('comp', 'compressor', { filterMode: 2 })`);
        workbench.dispose();
    });
});
