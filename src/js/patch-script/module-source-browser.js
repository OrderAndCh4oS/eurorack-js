import { MODULE_MANIFEST } from '../rack/module-manifest.js';
import { highlightPatchScript } from './syntax-highlighter.js';

const BUILTIN_IDS = new Set(MODULE_MANIFEST.map(module => module.id));
const GITHUB_SOURCE_ROOT = 'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/src/js/modules/';
const NEW_MODULE_SOURCE = `export default {
    id: 'my-module',
    name: 'My module',
    hp: 4,
    color: 'module-color-six',
    category: 'utility',
    createDSP({ bufferSize = 512 } = {}) {
        const input = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);
        return {
            params: { level: 0.5 },
            inputs: { audio: input },
            outputs: { out },
            leds: {},
            process() {
                for (let i = 0; i < bufferSize; i++) {
                    out[i] = input[i] * this.params.level;
                }
            },
            reset() { out.fill(0); }
        };
    },
    ui: {
        knobs: [{ id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0.5 }],
        inputs: [{ id: 'audio', label: 'In', port: 'audio', signal: 'audio' }],
        outputs: [{ id: 'out', label: 'Out', port: 'out', signal: 'audio' }]
    }
};
`;

function entryKey(entry) {
    return `${entry.kind}:${entry.id}`;
}

/** Built-in source viewer and local draft editor. Only onUse executes local code. */
export class ModuleSourceBrowser {
    constructor({ document = globalThis.document, registry, localStore, fetch = globalThis.fetch?.bind(globalThis), copy, onUse } = {}) {
        this.document = document;
        this.registry = registry;
        this.localStore = localStore;
        this.fetch = fetch;
        this.onUse = onUse;
        this.copy = copy || (async source => {
            const clipboard = this.document.defaultView?.navigator.clipboard;
            if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
            await clipboard.writeText(source);
        });
        this.entries = [];
        this.selectedKey = null;
        this.selectedSource = null;
        this.cache = new Map();
        this.pending = new Map();
        this.controllers = new Set();
        this.selectionVersion = 0;
        this.active = false;
        this.disposed = false;
        this.dirty = false;
        this.writingStore = false;
    }

    element(tag, className, text) {
        const element = this.document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    mount(container) {
        if (this.root || this.disposed) return this;
        this.root = this.element('div', 'module-source-browser');
        const sidebar = this.element('div', 'module-source-sidebar');
        const actions = this.element('div', 'module-source-actions');
        this.newButton = this.element('button', '', 'New module');
        this.newButton.type = 'button';
        this.newButton.title = 'Create your own module in this browser';
        this.newButton.disabled = !this.localStore?.create;
        this.newButton.addEventListener('click', () => this.createModule());
        this.importButton = this.element('button', '', 'Import own module');
        this.importButton.type = 'button';
        this.importButton.title = 'Open your own JavaScript module as a local draft';
        this.importButton.disabled = !this.localStore?.create;
        this.importButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput = this.element('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.js,.mjs,text/javascript,application/javascript';
        this.fileInput.hidden = true;
        this.fileInput.addEventListener('change', () => this.importFile(this.fileInput.files?.[0]));
        actions.append(this.newButton, this.importButton, this.fileInput);
        this.search = this.element('input', 'module-source-search');
        this.search.type = 'search';
        this.search.placeholder = 'Search modules';
        this.search.setAttribute('aria-label', 'Search modules');
        this.search.addEventListener('input', () => this.renderList());
        this.list = this.element('div', 'module-source-list');
        this.list.setAttribute('aria-label', 'Modules');
        sidebar.append(actions, this.search, this.list);

        this.pane = this.element('div', 'module-source-pane');
        this.toolbar = this.element('div', 'module-source-toolbar');
        const heading = this.element('div', 'module-source-heading');
        this.name = this.element('strong', 'module-source-name', 'Module source');
        this.nameInput = this.element('input', 'module-source-name-input');
        this.nameInput.type = 'text';
        this.nameInput.setAttribute('aria-label', 'Module name');
        this.nameInput.hidden = true;
        this.nameInput.addEventListener('input', () => this.markDirty());
        this.path = this.element('span', 'module-source-path');
        heading.append(this.name, this.nameInput, this.path);
        this.copyButton = this.element('button', '', 'Copy code');
        this.copyButton.type = 'button';
        this.copyButton.title = 'Copy this module’s source code';
        this.copyButton.disabled = true;
        this.copyButton.addEventListener('click', () => this.copySource());
        this.githubLink = this.element('a', '', 'View on GitHub');
        this.githubLink.target = '_blank';
        this.githubLink.rel = 'noopener noreferrer';
        this.githubLink.hidden = true;
        const guide = this.element('a', '', 'Creating modules');
        guide.href = '/docs/creating-modules';
        this.saveButton = this.element('button', '', 'Save');
        this.saveButton.type = 'button';
        this.saveButton.title = 'Save this module’s code in this browser without running it';
        this.saveButton.hidden = true;
        this.saveButton.addEventListener('click', () => this.saveDraft());
        this.useButton = this.element('button', '', 'Use module');
        this.useButton.type = 'button';
        this.useButton.title = 'Save and run your module, then add it to the rack';
        this.useButton.hidden = true;
        this.useButton.addEventListener('click', () => this.useModule());
        this.toolbar.append(heading, this.saveButton, this.useButton, this.copyButton, this.githubLink, guide);
        this.status = this.element('div', 'module-source-status', 'Select a module to view its code.');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.retryButton = this.element('button', 'module-source-retry', 'Retry');
        this.retryButton.type = 'button';
        this.retryButton.title = 'Try loading this module’s source again';
        this.retryButton.hidden = true;
        this.retryButton.addEventListener('click', () => {
            const entry = this.entries.find(item => entryKey(item) === this.selectedKey);
            if (entry) this.select(entry.id, entry.kind);
        });
        this.pre = this.element('pre', 'module-source-code');
        this.pre.tabIndex = 0;
        this.pre.setAttribute('aria-label', 'Module source');
        this.code = this.element('code');
        this.pre.append(this.code);
        this.localNotice = this.element('p', 'module-source-notice', 'Module code runs in this browser. Only use code you wrote or trust.');
        this.localNotice.hidden = true;
        this.editor = this.element('textarea', 'module-source-editor');
        this.editor.setAttribute('aria-label', 'Your module source');
        this.editor.spellcheck = false;
        this.editor.autocapitalize = 'off';
        this.editor.hidden = true;
        this.editor.addEventListener('input', () => this.markDirty());
        this.editor.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                event.stopPropagation();
                this.saveDraft();
            }
        });
        this.pane.append(this.toolbar, this.localNotice, this.status, this.retryButton, this.pre, this.editor);
        this.root.append(sidebar, this.pane);
        container.append(this.root);
        this.unsubscribe = this.localStore?.subscribe?.(() => this.refresh());
        this.refresh();
        return this;
    }

    activate() {
        if (this.disposed || !this.root || this.writingStore) return Promise.resolve(false);
        this.active = true;
        return this.refresh();
    }

    refresh() {
        if (this.disposed || !this.root || this.writingStore) return Promise.resolve(false);
        let records = [];
        try {
            records = this.localStore?.list?.() || [];
        } catch {
            // Built-in source remains available if browser storage is unavailable.
        }
        const localIds = new Set();
        const local = (Array.isArray(records) ? records : []).flatMap(record => {
            if (!record || typeof record.id !== 'string' || !record.id || typeof record.source !== 'string' || localIds.has(record.id)) return [];
            localIds.add(record.id);
            return [{
                id: record.id,
                kind: 'local',
                name: typeof record.name === 'string' && record.name ? record.name : record.id,
                moduleId: typeof record.moduleId === 'string' ? record.moduleId : '',
                source: record.source
            }];
        });
        const builtin = MODULE_MANIFEST.map(({ id }) => {
            const definition = this.registry?.get(id);
            return { id, kind: 'builtin', name: definition?.name || id };
        });
        this.entries = [...local, ...builtin];
        this.renderList();
        if (!this.active) return Promise.resolve(false);
        // Storage notifications must not replace edits still in the textarea.
        if (this.dirty || this.usingModule) return Promise.resolve(false);
        const selected = this.entries.find(entry => entryKey(entry) === this.selectedKey) || this.entries[0];
        return selected ? this.select(selected.id, selected.kind) : Promise.resolve(false);
    }

    renderList() {
        if (!this.list || this.disposed) return;
        this.list.replaceChildren();
        const query = this.search.value.trim().toLowerCase();
        const matches = this.entries.filter(entry => `${entry.name} ${entry.id} ${entry.moduleId || ''}`.toLowerCase().includes(query));
        if (!matches.length) {
            this.list.append(this.element('p', '', 'No matching modules.'));
            return;
        }
        for (const [kind, label] of [['local', 'Your modules'], ['builtin', 'Built-in modules']]) {
            const entries = matches.filter(entry => entry.kind === kind);
            if (!entries.length && query) continue;
            const group = this.element('section', 'module-source-group');
            group.append(this.element('h3', '', label));
            if (!entries.length) group.append(this.element('p', 'module-source-empty', 'No saved modules.'));
            for (const entry of entries) {
                const button = this.element('button', 'module-source-item');
                button.type = 'button';
                button.dataset.moduleSource = entry.id;
                button.dataset.sourceKind = kind;
                button.setAttribute('aria-pressed', String(entryKey(entry) === this.selectedKey));
                button.append(this.element('span', 'module-source-item-name', entry.name));
                if (entry.name !== entry.id) button.append(this.element('span', 'module-source-item-id', entry.moduleId || entry.id));
                button.addEventListener('click', () => this.select(entry.id, kind));
                group.append(button);
            }
            this.list.append(group);
        }
    }

    async select(id, kind = 'builtin') {
        if (this.disposed || !this.root) return false;
        const entry = this.entries.find(item => item.id === id && item.kind === kind);
        if (!entry || (kind === 'builtin' && !BUILTIN_IDS.has(id))) return false;
        if (entryKey(entry) === this.selectedKey && this.dirty) return true;
        if (!this.saveDraft(false)) return false;
        this.active = true;
        const version = ++this.selectionVersion;
        this.selectedKey = entryKey(entry);
        this.selectedSource = null;
        this.name.textContent = entry.name;
        this.name.hidden = kind === 'local';
        this.nameInput.hidden = kind !== 'local';
        this.nameInput.value = entry.name;
        this.saveButton.hidden = kind !== 'local';
        this.saveButton.disabled = true;
        this.useButton.hidden = kind !== 'local';
        this.useButton.disabled = !this.onUse || Boolean(this.usingModule);
        this.editor.hidden = kind !== 'local';
        this.pre.hidden = kind === 'local';
        this.localNotice.hidden = kind !== 'local';
        this.path.textContent = kind === 'builtin' ? `src/js/modules/${id}/index.js` : 'Saved in this browser';
        this.githubLink.hidden = kind !== 'builtin';
        if (kind === 'builtin') this.githubLink.href = `${GITHUB_SOURCE_ROOT}${id}/index.js`;
        else this.githubLink.removeAttribute('href');
        this.copyButton.disabled = true;
        this.retryButton.hidden = true;
        this.code.textContent = '';
        for (const button of this.list.querySelectorAll('[data-module-source]')) {
            button.setAttribute('aria-pressed', String(button.dataset.moduleSource === id && button.dataset.sourceKind === kind));
        }
        this.pane.setAttribute('aria-busy', String(kind === 'builtin' && !this.cache.has(id)));
        this.setStatus(kind === 'builtin' && !this.cache.has(id) ? 'Loading source…' : '');
        try {
            const source = kind === 'local' ? entry.source : await this.fetchSource(id);
            if (this.disposed || version !== this.selectionVersion) return false;
            this.selectedSource = source;
            if (kind === 'local') this.editor.value = source;
            // The highlighter escapes every source token before adding its own spans.
            this.code.innerHTML = highlightPatchScript(source);
            this.copyButton.disabled = false;
            this.pane.setAttribute('aria-busy', 'false');
            this.setStatus('');
            return true;
        } catch {
            if (this.disposed || version !== this.selectionVersion) return false;
            this.pane.setAttribute('aria-busy', 'false');
            this.setStatus('Could not load source.', 'error');
            this.retryButton.hidden = false;
            return false;
        }
    }

    markDirty() {
        if (!this.selectedKey?.startsWith('local:')) return;
        this.dirty = true;
        this.selectedSource = this.editor.value;
        this.saveButton.disabled = false;
        this.setStatus('Unsaved changes.');
    }

    saveDraft(notify = true) {
        if (!this.dirty) return true;
        const entry = this.entries.find(item => entryKey(item) === this.selectedKey);
        if (!entry || entry.kind !== 'local') return false;
        try {
            this.writingStore = true;
            const record = this.localStore.save(entry.id, { name: this.nameInput.value.trim() || 'My module', source: this.editor.value });
            entry.name = record.name;
            entry.source = record.source;
            this.nameInput.value = record.name;
            this.selectedSource = record.source;
            this.dirty = false;
            this.saveButton.disabled = true;
            this.renderList();
            if (notify) this.setStatus('Saved in this browser.');
            return true;
        } catch (error) {
            this.setStatus(error?.message || 'Could not save module.', 'error');
            return false;
        } finally {
            this.writingStore = false;
        }
    }

    async createModule({ name = 'My module', source = NEW_MODULE_SOURCE } = {}) {
        if (this.disposed || this.writingStore || !this.localStore?.create || !this.saveDraft(false)) return false;
        try {
            this.writingStore = true;
            const record = await this.localStore.create({ name, source });
            this.writingStore = false;
            if (this.disposed) return false;
            this.search.value = '';
            // Refresh the catalogue without fetching a previously selected built-in.
            const active = this.active;
            this.active = false;
            this.refresh();
            this.active = active;
            await this.select(record.id, 'local');
            this.list.scrollTop = 0;
            this.nameInput.focus();
            this.nameInput.select();
            return true;
        } catch (error) {
            if (!this.disposed) this.setStatus(error?.message || 'Could not create module.', 'error');
            return false;
        } finally {
            this.writingStore = false;
        }
    }

    async importFile(file) {
        if (!file || this.disposed) return false;
        try {
            if (file.size > 256 * 1024) throw new Error('Module code must be under 256 KB.');
            const source = await file.text();
            return await this.createModule({ name: file.name.replace(/\.(m?js)$/i, ''), source });
        } catch (error) {
            if (!this.disposed) this.setStatus(error?.message || 'Could not import module.', 'error');
            return false;
        } finally {
            this.fileInput.value = '';
        }
    }

    async useModule() {
        const entry = this.entries.find(item => entryKey(item) === this.selectedKey);
        if (!entry || entry.kind !== 'local' || this.usingModule || !this.onUse || !this.saveDraft(false)) return false;
        const version = this.selectionVersion;
        this.usingModule = true;
        this.useButton.disabled = true;
        this.setStatus('Adding module…');
        try {
            await this.onUse(entry.id);
            if (!this.disposed && version === this.selectionVersion) this.setStatus('Added to rack.');
            return true;
        } catch (error) {
            if (!this.disposed && version === this.selectionVersion) this.setStatus(error?.message || 'Could not use module.', 'error');
            return false;
        } finally {
            this.usingModule = false;
            if (!this.disposed) this.useButton.disabled = !this.onUse;
        }
    }

    async fetchSource(id) {
        if (!BUILTIN_IDS.has(id)) throw new Error('Unknown built-in module');
        if (this.cache.has(id)) return this.cache.get(id);
        if (this.pending.has(id)) return this.pending.get(id);
        const controller = new AbortController();
        this.controllers.add(controller);
        const request = (async () => {
            // Only the repository manifest can select a first-party source file.
            const response = await this.fetch(new URL(`../modules/${id}/index.js`, import.meta.url), { signal: controller.signal });
            if (!response.ok) throw new Error('Source request failed');
            if (response.headers?.get('content-type')?.includes('text/html')) throw new Error('Source file unavailable');
            const source = await response.text();
            if (!this.disposed) this.cache.set(id, source);
            return source;
        })();
        this.pending.set(id, request);
        try {
            return await request;
        } finally {
            this.pending.delete(id);
            this.controllers.delete(controller);
        }
    }

    async copySource() {
        if (this.selectedSource === null || this.disposed) return false;
        const version = this.selectionVersion;
        try {
            await this.copy(this.selectedSource);
            if (this.disposed || version !== this.selectionVersion) return false;
            this.setStatus('Copied code.');
            return true;
        } catch {
            if (this.disposed || version !== this.selectionVersion) return false;
            this.setStatus('Could not copy code.', 'error');
            return false;
        }
    }

    setStatus(message, kind = '') {
        this.status.textContent = message;
        this.status.dataset.kind = kind;
    }

    focus() {
        this.search?.focus();
    }

    dispose() {
        if (this.disposed) return;
        this.saveDraft(false);
        this.disposed = true;
        this.selectionVersion++;
        if (typeof this.unsubscribe === 'function') this.unsubscribe();
        for (const controller of this.controllers) controller.abort();
        this.controllers.clear();
        this.pending.clear();
        this.cache.clear();
        this.root?.remove();
    }
}
