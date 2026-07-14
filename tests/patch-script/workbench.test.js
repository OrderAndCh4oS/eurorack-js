import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluatePatchScript } from '../../src/js/patch-script/evaluator.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';
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

function createWorkbench(initialPatch = null) {
    let currentPatch = initialPatch || {
        version: 3,
        plugins: { core: 1 },
        modules: [],
        params: {},
        cables: [],
        midiMappings: {}
    };
    let listener = null;
    const app = {
        host: {
            sampleRate: 44100,
            blockSize: 16,
            serializePatch: () => currentPatch,
            subscribe: next => { listener = next; return () => { listener = null; }; },
            engine: null
        },
        state: { getModule: () => null },
        loadPatchState: vi.fn(async patch => { currentPatch = patch; listener?.({ type: 'patch-loaded' }); return true; }),
        renderAllCables: vi.fn()
    };
    const workbench = new PatchWorkbench({ app, document, registry: pluginRegistry }).init();
    return { workbench, app };
}

describe('PatchWorkbench', () => {
    it('links the guide and reference to repository Markdown', () => {
        const { workbench } = createWorkbench();
        expect(workbench.drawer.querySelector('a[href*="patch-workbench-guide.md"]').href).toBe(PATCH_GUIDE_URL);
        expect(workbench.drawer.querySelector('a[href$="patch-workbench.md"]').href).toBe(PATCH_REFERENCE_URL);
        expect([...workbench.drawer.querySelectorAll('a')].every(link => !link.getAttribute('href').startsWith('./docs/'))).toBe(true);
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

describe('patch worker evaluation', () => {
    it('terminates an evaluation that exceeds its timeout', async () => {
        class SilentWorker {
            postMessage() {}
            terminate() { this.terminated = true; }
        }
        await expect(evaluatePatchScript('while (true) {}', { timeoutMs: 5, WorkerClass: SilentWorker }))
            .rejects.toThrow('evaluation limit');
    });
});
