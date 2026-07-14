import { compilePatchDescription } from './compiler.js';
import { getPatchScriptCompletions } from './completion.js';
import { evaluatePatchScript } from './evaluator.js';
import { formatPatchScript } from './formatter.js';
import { PatchScriptStore } from './storage.js';
import { highlightPatchScript } from './syntax-highlighter.js';

export const STARTER_SCRIPT_ID = '__starter__';
export const CURRENT_RACK_SCRIPT_ID = '__current_rack__';
export const PATCH_GUIDE_URL = 'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/docs/patch-workbench-guide.md';
export const PATCH_REFERENCE_URL = 'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/docs/patch-workbench.md';
export const STARTER_SCRIPT = `patch()
  .module('vco', 'osc', { coarse: 0.3 })
  .module('out', 'main', { volume: 0.65 })
  .connect('osc.triangle', 'main.L')
  .connect('osc.triangle', 'main.R')
`;

function stringify(value) {
    try {
        return JSON.stringify(value, (_key, item) => {
            if (item instanceof ArrayBuffer) return `<ArrayBuffer ${item.byteLength} bytes>`;
            if (ArrayBuffer.isView(item)) return `<${item.constructor.name} ${item.byteLength} bytes>`;
            return item;
        });
    } catch {
        return String(value);
    }
}

function patchFingerprint(patch) {
    return JSON.stringify(patch);
}

function caretCoordinates(textarea, documentRef) {
    const style = documentRef.defaultView?.getComputedStyle?.(textarea);
    const mirror = documentRef.createElement('div');
    const properties = [
        'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth',
        'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontFamily', 'lineHeight',
        'letterSpacing', 'textTransform', 'textIndent', 'textDecoration', 'tabSize'
    ];
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.left = '-9999px';
    properties.forEach(property => { if (style?.[property]) mirror.style[property] = style[property]; });
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
    const marker = documentRef.createElement('span');
    marker.textContent = textarea.value.slice(textarea.selectionStart, textarea.selectionStart + 1) || '.';
    mirror.appendChild(marker);
    documentRef.body.appendChild(mirror);
    const rect = textarea.getBoundingClientRect();
    const point = {
        left: rect.left + marker.offsetLeft - textarea.scrollLeft,
        top: rect.top + marker.offsetTop - textarea.scrollTop + (parseFloat(style?.lineHeight) || 18)
    };
    mirror.remove();
    return point;
}

export class PatchWorkbench {
    constructor({ app, document: documentRef = document, registry, store = null } = {}) {
        this.app = app;
        this.document = documentRef;
        this.registry = registry;
        this.store = store || new PatchScriptStore(documentRef.defaultView?.localStorage || globalThis.localStorage);
        this.lastCompiled = null;
        this.lastAppliedFingerprint = null;
        this.completion = null;
        this.completionIndex = 0;
        this.logEntries = [];
        this.autosaveTimer = null;
        this.unsubscribeHost = null;
        this.currentRackSource = null;
        this.sessionSeeded = false;
        this.sessionHasWork = false;
    }

    init() {
        this.createDrawer();
        this.bind();
        this.refreshScriptList();
        this.loadScript(this.store.data.activeScriptId || STARTER_SCRIPT_ID);
        this.unsubscribeHost = this.app.host.subscribe(event => this.handleHostEvent(event));
        return this;
    }

    createDrawer() {
        const drawer = this.document.createElement('section');
        drawer.id = 'patch-workbench';
        drawer.className = 'patch-workbench';
        drawer.hidden = true;
        drawer.setAttribute('aria-label', 'Patch workbench');
        drawer.innerHTML = `
            <div class="patch-workbench-resizer" title="Resize workbench"></div>
            <header class="patch-workbench-toolbar">
                <select data-role="scripts" aria-label="Patch script"></select>
                <input data-role="script-name" aria-label="Script name" value="Starter Voice">
                <button data-action="new" title="Create a new local patch script">New</button>
                <button data-action="delete" title="Delete the selected local patch script">Delete</button>
                <button data-action="copy" title="Copy the current patch script to the clipboard">Copy</button>
                <button data-action="load" title="Load a patch script file without running it">Load</button>
                <button data-action="save" class="primary" title="Save the script locally and apply it (Ctrl/Cmd+S)">Save</button>
                <input data-role="load-file" type="file" accept="text/javascript,.js,.txt" hidden>
                <span class="patch-workbench-spacer"></span>
                <a href="${PATCH_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Guide</a>
                <a href="${PATCH_REFERENCE_URL}" target="_blank" rel="noopener noreferrer">Reference</a>
                <button data-action="snapshot" title="Replace the editor with a snapshot of the current rack">Snapshot</button>
                <button data-action="validate" title="Validate without changing the live rack (Ctrl/Cmd+Shift+Enter)">Validate</button>
                <button data-action="apply" class="primary" title="Validate and apply atomically (Ctrl/Cmd+Enter)">Apply</button>
                <button data-action="close" title="Close the Patch Workbench (Ctrl/Cmd+\`)">×</button>
            </header>
            <div class="patch-workbench-main">
                <div class="patch-editor-pane">
                    <div class="patch-editor-code">
                        <pre data-role="syntax-highlight" aria-hidden="true"><code></code></pre>
                        <textarea data-role="editor" spellcheck="false" aria-label="Patch script editor"></textarea>
                    </div>
                    <div data-role="completions" class="patch-completions" role="listbox" hidden></div>
                    <div data-role="status" class="patch-workbench-status">Ready</div>
                </div>
                <div class="patch-console-pane">
                    <pre data-role="output" aria-live="polite"></pre>
                    <input data-role="command" aria-label="Workbench command" placeholder=":help">
                </div>
            </div>`;
        this.document.body.appendChild(drawer);
        this.drawer = drawer;
        this.editor = drawer.querySelector('[data-role="editor"]');
        this.syntaxHighlight = drawer.querySelector('[data-role="syntax-highlight"]');
        this.syntaxCode = this.syntaxHighlight.querySelector('code');
        this.output = drawer.querySelector('[data-role="output"]');
        this.status = drawer.querySelector('[data-role="status"]');
        this.scriptSelect = drawer.querySelector('[data-role="scripts"]');
        this.scriptName = drawer.querySelector('[data-role="script-name"]');
        this.completionEl = drawer.querySelector('[data-role="completions"]');
        this.command = drawer.querySelector('[data-role="command"]');
    }

    bind() {
        this.document.getElementById('patchWorkbenchToggle')?.addEventListener('click', () => this.toggle());
        this.drawer.querySelector('[data-action="close"]').addEventListener('click', () => this.toggle(false));
        this.drawer.querySelector('[data-action="validate"]').addEventListener('click', () => { void this.validate(); });
        this.drawer.querySelector('[data-action="apply"]').addEventListener('click', () => { void this.apply(); });
        this.drawer.querySelector('[data-action="snapshot"]').addEventListener('click', () => this.snapshot());
        this.drawer.querySelector('[data-action="new"]').addEventListener('click', () => this.newScript());
        this.drawer.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteScript());
        this.drawer.querySelector('[data-action="copy"]').addEventListener('click', () => { void this.copyScript(); });
        this.drawer.querySelector('[data-action="load"]').addEventListener('click', () => this.drawer.querySelector('[data-role="load-file"]').click());
        this.drawer.querySelector('[data-action="save"]').addEventListener('click', () => { void this.saveAndApply(); });
        this.drawer.querySelector('[data-role="load-file"]').addEventListener('change', event => { void this.loadScriptFile(event); });
        this.scriptSelect.addEventListener('change', () => {
            this.sessionHasWork = true;
            this.loadScript(this.scriptSelect.value);
        });
        this.scriptName.addEventListener('change', () => this.renameScript());
        this.editor.addEventListener('input', () => this.handleEditorInput());
        this.editor.addEventListener('scroll', () => this.syncEditorScroll());
        this.editor.addEventListener('click', () => this.updateCompletions());
        this.editor.addEventListener('keyup', event => {
            if (!['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(event.key)) this.updateCompletions();
        });
        this.editor.addEventListener('keydown', event => this.handleEditorKeyDown(event));
        this.command.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void this.runCommand(this.command.value);
                this.command.value = '';
            }
        });
        this.document.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' &&
                !this.drawer.hidden && this.drawer.contains(event.target) && event.target !== this.editor) {
                event.preventDefault();
                void this.saveAndApply();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === '`') {
                event.preventDefault();
                this.toggle();
            }
        });
        this.bindResize();
    }

    bindResize() {
        const handle = this.drawer.querySelector('.patch-workbench-resizer');
        handle.addEventListener('pointerdown', event => {
            event.preventDefault();
            const startY = event.clientY;
            const startHeight = this.drawer.getBoundingClientRect().height;
            const move = next => {
                const height = Math.max(180, Math.min(this.document.defaultView.innerHeight * 0.7, startHeight + startY - next.clientY));
                this.drawer.style.height = `${height}px`;
            };
            const stop = () => {
                this.document.removeEventListener('pointermove', move);
                this.document.removeEventListener('pointerup', stop);
            };
            this.document.addEventListener('pointermove', move);
            this.document.addEventListener('pointerup', stop);
        });
    }

    toggle(force = this.drawer.hidden) {
        if (force && !this.sessionSeeded && !this.sessionHasWork) this.loadCurrentRack();
        this.drawer.hidden = !force;
        this.document.body.classList.toggle('patch-workbench-open', force);
        this.document.getElementById('patchWorkbenchToggle')?.classList.toggle('active', force);
        if (force) this.editor.focus();
        this.app.renderAllCables?.();
    }

    refreshScriptList() {
        const active = this.scriptSelect?.value || this.store.data.activeScriptId || STARTER_SCRIPT_ID;
        this.scriptSelect.innerHTML = this.currentRackSource === null
            ? '<option value="__starter__">Starter Voice (read only)</option>'
            : '<option value="__current_rack__">Current Rack (session)</option><option value="__starter__">Starter Voice (read only)</option>';
        this.store.list().sort((a, b) => a.name.localeCompare(b.name)).forEach(script => {
            const option = this.document.createElement('option');
            option.value = script.id;
            option.textContent = script.name;
            this.scriptSelect.appendChild(option);
        });
        this.scriptSelect.value = [...this.scriptSelect.options].some(option => option.value === active) ? active : STARTER_SCRIPT_ID;
    }

    loadScript(id) {
        const script = id === CURRENT_RACK_SCRIPT_ID
            ? { id, name: 'Current Rack', source: this.currentRackSource ?? formatPatchScript(this.app.host.serializePatch(), this.registry) }
            : id === STARTER_SCRIPT_ID
                ? { id, name: 'Starter Voice', source: STARTER_SCRIPT }
                : this.store.get(id);
        if (!script) return this.loadScript(STARTER_SCRIPT_ID);
        if (![CURRENT_RACK_SCRIPT_ID, STARTER_SCRIPT_ID].includes(id)) this.store.setActive(id);
        this.scriptSelect.value = id;
        this.scriptName.value = script.name;
        this.scriptName.disabled = [CURRENT_RACK_SCRIPT_ID, STARTER_SCRIPT_ID].includes(id);
        this.editor.value = script.source;
        this.renderSyntax();
        this.lastCompiled = null;
        this.hideCompletions();
        this.setStatus(id === CURRENT_RACK_SCRIPT_ID
            ? 'Current rack snapshot — editing creates a local script'
            : id === STARTER_SCRIPT_ID ? 'Starter script — editing creates a local copy' : 'Saved locally');
    }

    loadCurrentRack() {
        this.currentRackSource = formatPatchScript(this.app.host.serializePatch(), this.registry);
        this.sessionSeeded = true;
        this.lastAppliedFingerprint = patchFingerprint(this.app.host.serializePatch());
        this.refreshScriptList();
        this.loadScript(CURRENT_RACK_SCRIPT_ID);
    }

    ensureEditableScript() {
        if (![CURRENT_RACK_SCRIPT_ID, STARTER_SCRIPT_ID].includes(this.scriptSelect.value)) return this.scriptSelect.value;
        const name = this.scriptSelect.value === CURRENT_RACK_SCRIPT_ID ? 'Current Rack Script' : 'Starter Voice Copy';
        const script = this.store.create(name, this.editor.value);
        this.refreshScriptList();
        this.scriptSelect.value = script.id;
        this.scriptName.value = script.name;
        this.scriptName.disabled = false;
        return script.id;
    }

    handleEditorInput() {
        this.renderSyntax();
        this.sessionHasWork = true;
        const id = this.ensureEditableScript();
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.store.update(id, { source: this.editor.value });
            this.setStatus(this.isRackDrifted() ? 'Saved · rack differs from last Apply' : 'Saved locally');
        }, 300);
        this.updateCompletions();
    }

    newScript() {
        this.sessionHasWork = true;
        const script = this.store.create('Untitled Script', 'patch()\n');
        this.refreshScriptList();
        this.loadScript(script.id);
    }

    renameScript() {
        const id = this.scriptSelect.value;
        if ([CURRENT_RACK_SCRIPT_ID, STARTER_SCRIPT_ID].includes(id)) return;
        this.store.update(id, { name: this.scriptName.value });
        this.refreshScriptList();
        this.scriptSelect.value = id;
    }

    deleteScript() {
        const id = this.scriptSelect.value;
        if ([CURRENT_RACK_SCRIPT_ID, STARTER_SCRIPT_ID].includes(id)) return;
        if (!(this.document.defaultView?.confirm?.(`Delete "${this.scriptName.value}"?`) ?? true)) return;
        this.store.remove(id);
        this.refreshScriptList();
        this.loadScript(this.store.data.activeScriptId || STARTER_SCRIPT_ID);
    }

    async copyScript() {
        try {
            await this.document.defaultView?.navigator?.clipboard?.writeText(this.editor.value);
            this.log('success', 'Patch script copied to the clipboard');
        } catch {
            this.log('error', 'Clipboard access was not available');
        }
    }

    async loadScriptFile(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        this.sessionHasWork = true;
        const script = this.store.create(file.name.replace(/\.(?:js|txt)$/i, ''), await file.text());
        this.refreshScriptList();
        this.loadScript(script.id);
        this.log('info', `Loaded ${file.name}; source was not evaluated`);
    }

    async saveAndApply() {
        this.sessionHasWork = true;
        clearTimeout(this.autosaveTimer);
        const id = this.ensureEditableScript();
        this.store.update(id, { name: this.scriptName.value, source: this.editor.value });
        const applied = await this.apply();
        if (applied) this.setStatus('Saved and applied atomically', 'success');
        return applied;
    }

    setStatus(message, kind = '') {
        this.status.textContent = message;
        this.status.dataset.kind = kind;
    }

    renderSyntax() {
        const source = this.editor.value;
        this.syntaxCode.innerHTML = highlightPatchScript(source) + (source.endsWith('\n') ? ' ' : '');
        this.syncEditorScroll();
    }

    syncEditorScroll() {
        this.syntaxHighlight.scrollTop = this.editor.scrollTop;
        this.syntaxHighlight.scrollLeft = this.editor.scrollLeft;
    }

    async compileEditor() {
        const description = await evaluatePatchScript(this.editor.value);
        return compilePatchDescription(description, {
            registry: this.registry,
            sampleRate: this.app.host.sampleRate,
            blockSize: this.app.host.blockSize
        });
    }

    async validate() {
        this.setStatus('Validating…');
        try {
            this.lastCompiled = await this.compileEditor();
            const diagnostics = this.lastCompiled.diagnostics;
            this.log('success', `Valid: ${diagnostics.moduleCount} modules, ${diagnostics.cableCount} cables`);
            this.log('info', `Processing order: ${diagnostics.processOrder.join(' → ') || '(empty)'}`);
            diagnostics.feedbackRoutes.forEach(route => this.log('info', `Feedback delay: ${route}`));
            diagnostics.warnings.forEach(warning => this.log('warning', warning));
            this.setStatus(`Valid · ${diagnostics.moduleCount} modules · ${diagnostics.warnings.length} warnings`, 'success');
            this.updateCompletions();
            return this.lastCompiled;
        } catch (error) {
            this.log('error', error.message);
            this.setStatus(error.message, 'error');
            return null;
        }
    }

    async apply() {
        const compiled = await this.validate();
        if (!compiled) return false;
        try {
            await this.app.loadPatchState(compiled.patch);
            this.lastAppliedFingerprint = patchFingerprint(this.app.host.serializePatch());
            this.setStatus('Applied atomically', 'success');
            this.log('success', 'Patch applied and topology acknowledged');
            return true;
        } catch (error) {
            this.log('error', `Apply failed: ${error.message}`);
            this.setStatus(`Apply failed: ${error.message}`, 'error');
            return false;
        }
    }

    snapshot() {
        const source = formatPatchScript(this.app.host.serializePatch(), this.registry);
        if (this.editor.value.trim() && this.editor.value !== source &&
            !(this.document.defaultView?.confirm?.('Replace the editor with a snapshot of the current rack?') ?? true)) return;
        this.editor.value = source;
        this.handleEditorInput();
        this.lastAppliedFingerprint = patchFingerprint(this.app.host.serializePatch());
        this.setStatus('Snapshot captured from rack', 'success');
        this.log('success', 'Current rack converted to patch script');
    }

    isRackDrifted() {
        return !!this.lastAppliedFingerprint && patchFingerprint(this.app.host.serializePatch()) !== this.lastAppliedFingerprint;
    }

    handleHostEvent(event) {
        if (['module-event', 'module-error', 'audio-error', 'audio-started', 'audio-stopped'].includes(event.type)) {
            this.log(event.type.includes('error') ? 'error' : 'event', `${event.type}: ${stringify(event.diagnostic || event.error || event.event || '')}`);
        }
        if (['module-added', 'module-removed', 'cables-changed', 'param-changed', 'patch-loaded'].includes(event.type) && this.isRackDrifted()) {
            this.setStatus('Saved · rack differs from last Apply', 'warning');
        }
    }

    log(kind, message) {
        const stamp = new Date().toLocaleTimeString();
        this.logEntries.push({ kind, message: String(message), stamp });
        if (this.logEntries.length > 500) this.logEntries.splice(0, this.logEntries.length - 500);
        this.output.textContent = this.logEntries.map(entry => `[${entry.stamp}] ${entry.kind.toUpperCase()} ${entry.message}`).join('\n');
        this.output.scrollTop = this.output.scrollHeight;
    }

    async runCommand(rawCommand) {
        const command = rawCommand.trim();
        if (!command) return;
        this.log('command', command);
        const [name, ...args] = command.split(/\s+/);
        if (name === ':help') {
            this.log('info', ':modules :describe :rack :json :validate :apply :snapshot :profile start|stop|report :clear');
            this.log('info', `Guide: ${PATCH_GUIDE_URL} · Reference: ${PATCH_REFERENCE_URL}`);
        } else if (name === ':modules') {
            const filter = args.join(' ').toLowerCase();
            this.registry.getAllDefinitions().filter(def => !filter || `${def.id} ${def.name}`.toLowerCase().includes(filter))
                .forEach(def => this.log('info', `${def.id} — ${def.name} · ${def.category} · ${def.hp}HP`));
        } else if (name === ':describe') {
            const id = args[0];
            const state = this.app.state.getModule(id);
            const def = this.registry.get(state?.type || id);
            if (!def) this.log('error', `Unknown module type or instance "${id || ''}"`);
            else this.log('info', stringify({ id: state?.id, type: def.id, params: state?.params, ui: def.ui }));
        } else if (name === ':rack') {
            this.log('info', stringify(this.app.host.serializePatch()));
        } else if (name === ':json') {
            this.log('info', JSON.stringify(this.app.host.serializePatch(), null, 2));
        } else if (name === ':validate') {
            await this.validate();
        } else if (name === ':apply') {
            await this.apply();
        } else if (name === ':snapshot') {
            this.snapshot();
        } else if (name === ':profile') {
            await this.profile(args[0]);
        } else if (name === ':clear') {
            this.logEntries = [];
            this.output.textContent = '';
        } else {
            this.log('error', `Unknown command "${name}"; use :help`);
        }
    }

    async profile(action) {
        const engine = this.app.host.engine;
        if (!engine) return this.log('error', 'Audio must be running to use profiling');
        if (action === 'start') {
            engine.setProfiling(true, { reset: true });
            this.log('success', 'Profiling started and counters reset');
        } else if (action === 'stop') {
            engine.setProfiling(false);
            this.log('success', 'Profiling stopped');
        } else if (action === 'report') {
            const report = await engine.requestProfilingReport();
            this.log('info', `Deadline ${report.deadlineMs.toFixed(3)}ms · blocks p50 ${report.blocks.p50.toFixed(3)} p95 ${report.blocks.p95.toFixed(3)} p99 ${report.blocks.p99.toFixed(3)}ms · ${(report.blocks.p99Utilization * 100).toFixed(1)}%`);
            Object.entries(report.modules).sort((a, b) => b[1].p99 - a[1].p99).forEach(([id, stats]) => {
                this.log('info', `${id}: ${stats.samples} samples · p50 ${stats.p50.toFixed(3)} · p95 ${stats.p95.toFixed(3)} · p99 ${stats.p99.toFixed(3)}ms`);
            });
        } else this.log('error', 'Use :profile start, :profile stop, or :profile report');
    }

    handleEditorKeyDown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            void this.saveAndApply();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) void this.validate();
            else void this.apply();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
            event.preventDefault();
            this.updateCompletions(true);
            return;
        }
        if (!this.completion?.items.length) {
            if (event.key === 'Tab') {
                event.preventDefault();
                this.insertText('  ');
            }
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            this.completionIndex = (this.completionIndex + delta + this.completion.items.length) % this.completion.items.length;
            this.renderCompletions();
        } else if (event.key === 'Tab' || event.key === 'Enter') {
            const item = this.completion.items[this.completionIndex];
            if (item?.unavailable) return;
            event.preventDefault();
            this.acceptCompletion(item);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.hideCompletions();
        }
    }

    insertText(text) {
        const start = this.editor.selectionStart;
        this.editor.setRangeText(text, start, this.editor.selectionEnd, 'end');
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    updateCompletions(force = false) {
        const completion = getPatchScriptCompletions({
            source: this.editor.value,
            cursor: this.editor.selectionStart,
            registry: this.registry,
            lastPatch: this.lastCompiled?.patch || null
        });
        if (!completion.items.length && !force) return this.hideCompletions();
        this.completion = completion;
        this.completionIndex = 0;
        this.renderCompletions();
    }

    renderCompletions() {
        if (!this.completion?.items.length) return this.hideCompletions();
        const point = caretCoordinates(this.editor, this.document);
        this.completionEl.style.left = `${Math.max(8, point.left)}px`;
        this.completionEl.style.top = `${Math.max(8, point.top)}px`;
        this.completionEl.innerHTML = '';
        this.completion.items.slice(0, 50).forEach((item, index) => {
            const option = this.document.createElement('div');
            option.className = `patch-completion${index === this.completionIndex ? ' selected' : ''}${item.unavailable ? ' unavailable' : ''}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', index === this.completionIndex ? 'true' : 'false');
            const label = this.document.createElement('strong');
            label.textContent = item.label;
            const detail = this.document.createElement('small');
            detail.textContent = item.detail || '';
            option.append(label, detail);
            option.addEventListener('mousedown', event => {
                event.preventDefault();
                if (!item.unavailable) this.acceptCompletion(item);
            });
            this.completionEl.appendChild(option);
        });
        this.completionEl.hidden = false;
    }

    acceptCompletion(item) {
        const { from, to } = this.completion;
        this.editor.setRangeText(item.insertText, from, to, 'end');
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.hideCompletions();
        this.editor.focus();
    }

    hideCompletions() {
        this.completion = null;
        this.completionEl.hidden = true;
        this.completionEl.innerHTML = '';
    }

    dispose() {
        clearTimeout(this.autosaveTimer);
        this.unsubscribeHost?.();
        this.drawer?.remove();
    }
}

export function createPatchWorkbench(options) {
    return new PatchWorkbench(options);
}
