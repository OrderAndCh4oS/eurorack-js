import {
    pluginRegistry,
    DEFAULT_MODULE_ORDER,
    CATEGORY_ORDER,
    CATEGORY_LABELS
} from '../index.js';
import { CABLE_COLORS } from '../config/constants.js';
import { TEST_PATCHES } from '../config/test-patches.js';
import { PatchLibrary, isIntroductionDemoLocation } from '../ui/patch-library.js';
import { LocalPatchStore } from '../patches/local-patch-store.js';
import { LocalModuleStore } from '../local-modules/store.js';
import { LocalModuleRuntime } from '../local-modules/runtime.js';
import { parsePatchLocation } from '../patches/cloud-client.js';
import { createCablePath, getJackCenter } from '../cables/cable-manager.js';
import { createMidiManager } from '../midi/midi-manager.js';
import { cleanupRenderedModule, renderModule, syncParamToModuleUI, updateModuleLEDs } from '../ui/renderer.js';
import { setSwitchValue, updateKnobRotation } from '../ui/toolkit/components.js';
import { RackSelection } from '../ui/rack-selection.js';
import { controlRange, getControlDomain, snapControlValue } from '../rack/control-domain.js';
import { RackState } from './rack-state.js';
import { createRackHost } from './rack-host.js';
import { createPatchWorkbench } from '../patch-script/workbench.js';
import { createRackDebugger } from '../ui/rack-debugger.js';
import { registerRackTools } from './webmcp.js';
import { createAudioAnalysis } from '../audio/audio-analysis.js';
import { RackActivity } from './rack-activity.js';
import { initRackAnalysis } from '../ui/rack-analysis.js';
import {
    PATCH_VERSION,
    createPatchUrlHash,
    normalizePatch,
    parsePatchUrlHash
} from './patch-format.js';
import { adjustColor, getModuleColorToken, isHexColor } from '../utils/color.js';

export const PATCH_EXPORT_SCHEMA = 'eurorack-js/patch-export';
export const PATCH_EXPORT_VERSION = 1;
export const CABLE_OPACITY_STORAGE_KEY = 'eurorack-cables-full-opacity';
const DRAG_THRESHOLD_PX = 4;
const PANEL_CONTROLS = '.jack, .knob, [data-param], button, input, select, textarea, a, canvas, [contenteditable], [role="slider"], [role="button"]:not(.module-label)';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPatchStateLike(value) {
    return isPlainObject(value) && (
        value.version === PATCH_VERSION &&
        Array.isArray(value.modules) &&
        isPlainObject(value.params) &&
        Array.isArray(value.cables) &&
        isPlainObject(value.midiMappings) &&
        isPlainObject(value.plugins)
    );
}

function isPatchLike(value) {
    return isPlainObject(value) && (isPatchStateLike(value.state) || isPatchStateLike(value));
}

function stripJsonExtension(filename) {
    return (filename || '').replace(/\.json$/i, '');
}

function normalizePatchName(name, fallback = 'Imported Patch') {
    const trimmed = stripJsonExtension(name).trim();
    return trimmed || fallback;
}

function sanitizeFilename(name) {
    return normalizePatchName(name, 'eurorack-patch')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'eurorack-patch';
}

function createUserPatch(name, rawPatch) {
    const patchName = normalizePatchName(rawPatch?.name || name);
    const created = rawPatch?.created || new Date().toISOString();
    return {
        name: patchName,
        factory: false,
        created,
        state: normalizePatch(rawPatch?.state || rawPatch),
        ...(rawPatch?.provenance ? { provenance: { ...rawPatch.provenance, verified: false } } : {})
    };
}

function createCanonicalPatch(name, rawPatchOrState, {
    factory = false,
    created = null
} = {}) {
    const rawPatch = rawPatchOrState?.state ? rawPatchOrState : { state: rawPatchOrState };
    const patchName = normalizePatchName(rawPatch?.name || name);
    return {
        name: patchName,
        factory,
        created: created || rawPatch?.created || new Date().toISOString(),
        state: normalizePatch(rawPatch?.state || rawPatch),
        ...(rawPatch?.provenance ? { provenance: { ...rawPatch.provenance, verified: false } } : {})
    };
}

function assertSupportedPatchExport(parsed) {
    const version = parsed.version ?? 1;
    if (!Number.isInteger(version) || version < 1) {
        throw new Error(`Invalid patch export version: ${parsed.version}`);
    }
    if (version > PATCH_EXPORT_VERSION) {
        throw new Error(`Unsupported patch export version: ${version}`);
    }
}

function parseVersionedPatchExport(parsed, options) {
    assertSupportedPatchExport(parsed);

    if (isPatchLike(parsed.patch)) {
        const name = normalizePatchName(parsed.patch.name || options.suggestedName);
        const patch = createUserPatch(name, parsed.patch);
        return {
            type: 'single',
            patches: { [patch.name]: patch },
            names: [patch.name]
        };
    }

    if (isPlainObject(parsed.patches)) return parsePatchCollection(parsed.patches);

    throw new Error('Patch export must contain a patch or patch collection');
}

function parsePatchCollection(collection) {
    const entries = Object.entries(collection);
    if (entries.length === 0 || entries.some(([, patch]) => !isPatchLike(patch))) {
        throw new Error('Patch JSON must contain a patch or patch collection');
    }

    const patches = {};
    const names = [];
    entries.forEach(([key, rawPatch]) => {
        const patch = createUserPatch(rawPatch.name || key, rawPatch);
        Object.defineProperty(patches, patch.name, { value: patch, enumerable: true, writable: true, configurable: true });
        names.push(patch.name);
    });

    return { type: 'collection', patches, names };
}

export function createPatchExport(patch, {
    exportedAt = new Date().toISOString()
} = {}) {
    const canonicalPatch = createCanonicalPatch(patch?.name || 'Untitled', patch, {
        factory: patch?.factory === true,
        created: patch?.created
    });
    return {
        schema: PATCH_EXPORT_SCHEMA,
        version: PATCH_EXPORT_VERSION,
        patchVersion: PATCH_VERSION,
        exportedAt,
        patch: canonicalPatch
    };
}

export function parseImportedPatchJson(json, { suggestedName = '' } = {}) {
    const parsed = JSON.parse(json);
    if (!isPlainObject(parsed)) {
        throw new Error('Patch JSON must contain an object');
    }

    if (parsed.schema === PATCH_EXPORT_SCHEMA) {
        return parseVersionedPatchExport(parsed, { suggestedName });
    }

    if (isPatchLike(parsed)) {
        const name = normalizePatchName(parsed.name || suggestedName);
        const patch = createUserPatch(name, parsed);
        return {
            type: 'single',
            patches: { [patch.name]: patch },
            names: [patch.name]
        };
    }

    return parsePatchCollection(parsed);
}

export class EurorackApp {
    constructor(documentRef = document) {
        this.document = documentRef;
        this.host = createRackHost({
            registry: pluginRegistry,
            state: new RackState(),
            onLedUpdate: ledStates => this.updateLEDs(ledStates),
            onModuleError: ({ moduleId, error }) => console.error(`Module "${moduleId}" disabled:`, error)
        });
        this.state = this.host.state;
        this.selection = new RackSelection(this);
        this.audioCtx = null;
        this.engine = null;
        this.midiManager = null;
        this.visualCables = [];
        this.colorIndex = 0;
        this.dragState = null;
        this.previewPath = null;
        this.draggedModule = null;
        this.pendingModuleDrag = null;
        this.draggedModuleEl = null;
        this.dropIndicator = null;
        this.lastCtrlClickJack = null;
        this.ctrlClickCycleIndex = 0;
        this.theme = 'industrial';
        this.themeMode = 'light';
        this.cablesFullOpacity = true;
        this.patchWorkbench = null;
        this.rackDebugger = null;
        this.patchLibrary = null;
        this.localPatches = new LocalPatchStore();
        this.localModules = new LocalModuleStore();
        this.localModuleRuntime = new LocalModuleRuntime({ store: this.localModules, registry: pluginRegistry });
    }

    async init() {
        await this.host.init();
        this.cacheElements();
        this.applySkin();
        this.applySavedCableOpacity();
        this.populateSidebar();
        this.host.subscribe(event => {
            if (event.type === 'registry') this.populateSidebar();
        });
        this.bindEvents();
        // MIDI permission can remain pending until the browser/user resolves it.
        // Rack startup and client-side tools must not wait on that external prompt.
        void this.initMidi().catch(error => console.error('Failed to initialize MIDI:', error));
        this.initPatchBank();
        const recovered = await this.patchLibrary?.run(() => this.patchLibrary.restoreDraft());
        if (!recovered) {
            if (this.patchLibrary) await this.patchLibrary.run(() => {
                if (isIntroductionDemoLocation(window.location)) return this.patchLibrary.loadLocation();
                const location = parsePatchLocation(window.location.hash, window.location.pathname);
                if (location?.source === 'cloud' || location?.source === 'local') { void this.patchLibrary.run(() => this.patchLibrary.loadLocation()); return; }
                return this.loadPatchFromUrlHash();
            });
            else await this.loadPatchFromUrlHash();
        }
        this.patchWorkbench = createPatchWorkbench({
            app: this,
            document: this.document,
            registry: pluginRegistry,
            moduleStore: this.localModules
        }).init();
        this.rackDebugger = createRackDebugger({
            app: this,
            document: this.document,
            registry: pluginRegistry
        }).init();
        // Feature detection keeps the normal instrument independent of experimental browser support.
        this.audioAnalysis = createAudioAnalysis({host: this.host, getRevision: () => this.patchWorkbench.drafts.observe().revision});
        const activity = new RackActivity();
        const panel = initRackAnalysis({document: this.document, host: this.host, analysis: this.audioAnalysis, activity,
            redrawCables: () => this.renderAllCables()});
        this.document.defaultView?.addEventListener('pagehide', event => {
            if (event.persisted) return;
            this.audioAnalysis.dispose();
            panel?.dispose();
        });
        void registerRackTools({document: this.document, workbench: this.patchWorkbench, registry: pluginRegistry, analysis: this.audioAnalysis, activity})
            .then(adapter => { this.webmcp = adapter; });
        this.markEmptyRows();
    }

    cacheElements() {
        this.cableSvg = this.document.getElementById('cable-svg');
        this.rackContainer = this.document.getElementById('rack-container');
        this.startButton = this.document.getElementById('startButton');
        this.cableOpacityToggle = this.document.getElementById('cableOpacityToggle');
        this.syncRowElements();
    }

    getRackRowElements() {
        const rows = {};
        const containerRows = this.rackContainer
            ? [...this.rackContainer.querySelectorAll('[id^="rack-row-"]')]
            : [];
        const elements = containerRows.length
            ? containerRows
            : [...this.document.querySelectorAll('[id^="rack-row-"]')];

        elements.forEach(rowEl => {
            const row = this.getRowNumberFromElement(rowEl);
            if (!row) return;
            rowEl.classList.add('rack', 'rack-row');
            rowEl.dataset.row = row;
            rows[row] = rowEl;
        });

        return rows;
    }

    createRackRowElement(row) {
        const rowEl = this.document.createElement('div');
        rowEl.className = 'rack rack-row';
        rowEl.id = `rack-row-${row}`;
        rowEl.dataset.row = row;
        rowEl.setAttribute('aria-label', `Rack row ${row}`);
        return rowEl;
    }

    syncRowElements() {
        if (!this.rackContainer) {
            this.rows = this.getRackRowElements();
            return;
        }

        const wantedRows = new Set(this.state.getRowNumbers());
        [...this.rackContainer.querySelectorAll('[id^="rack-row-"]')].forEach(rowEl => {
            const row = this.getRowNumberFromElement(rowEl);
            if (row && !wantedRows.has(row)) rowEl.remove();
        });

        const anchor = this.rackContainer.querySelector('.rack-bottom-bar')
            || this.rackContainer.querySelector('.cable-hints')
            || this.rackContainer.querySelector('.app-footer');
        this.state.getRowNumbers().forEach(row => {
            let rowEl = this.rackContainer.querySelector(`#rack-row-${row}`);
            if (!rowEl) {
                rowEl = this.document.getElementById(`rack-row-${row}`) || this.createRackRowElement(row);
            }
            rowEl.classList.add('rack', 'rack-row');
            rowEl.dataset.row = row;
            if (rowEl.parentNode !== this.rackContainer) {
                this.rackContainer.insertBefore(rowEl, anchor);
            }
        });

        this.rows = this.getRackRowElements();
    }

    getRowNumberFromElement(rowEl) {
        const row = parseInt(rowEl?.dataset?.row || rowEl?.id?.match(/^rack-row-(\d+)$/)?.[1], 10);
        return Number.isFinite(row) ? row : null;
    }

    populateSidebar() {
        const sidebar = this.document.getElementById('sidebar');
        sidebar.innerHTML = '';

        const grouped = {};
        CATEGORY_ORDER.forEach(category => { grouped[category] = []; });

        pluginRegistry.getAllDefinitions().forEach(def => {
            const category = CATEGORY_ORDER.includes(def.category) ? def.category : 'other';
            grouped[category].push(def);
        });

        CATEGORY_ORDER.forEach(category => {
            const defs = grouped[category];
            if (!defs?.length) return;

            const heading = this.document.createElement('div');
            heading.className = 'sidebar-category';
            heading.textContent = CATEGORY_LABELS[category] || category;
            sidebar.appendChild(heading);

            defs.forEach(def => {
                const item = this.document.createElement('div');
                const colorToken = getModuleColorToken(def.color);
                item.className = ['sidebar-module', colorToken].filter(Boolean).join(' ');
                item.dataset.moduleType = def.id;
                if (!colorToken && isHexColor(def.color)) {
                    item.style.setProperty('--module-color', def.color);
                    item.style.setProperty('--module-color-dark', adjustColor(def.color, -30));
                    item.style.setProperty('--factory-module-bg', def.color);
                    item.style.setProperty('--factory-module-header', adjustColor(def.color, 18));
                    item.style.setProperty('--factory-module-dark-bg', adjustColor(def.color, -30));
                    item.style.setProperty('--factory-module-dark-header', def.color);
                }
                item.innerHTML = `
                    <div class="sidebar-module-color"></div>
                    <div class="sidebar-module-name">${def.name}</div>
                    <div class="sidebar-module-hp">${def.hp}hp</div>
                `;
                item.addEventListener('click', () => this.addModule(def.id));
                sidebar.appendChild(item);
            });
        });
    }

    bindEvents() {
        // Capture the whole assignment gesture before a pad, momentary button,
        // binary switch, or native select can change its value.
        const learnGesture = event => {
            if (!this.midiManager?.isLearnMode) return;
            const control = event.target.closest?.('[data-module][data-param]');
            if (control) this.handleParamMidiLearn(control, event);
        };
        for (const type of ['pointerdown', 'pointerup', 'pointerleave', 'pointercancel', 'mousedown', 'click', 'change']) {
            this.document.addEventListener(type, learnGesture, true);
        }
        this.document.addEventListener('mousedown', event => this.handleMouseDown(event), true);
        this.document.addEventListener('click', event => this.handleClick(event));
        this.document.addEventListener('mousemove', event => this.handleMouseMove(event));
        this.document.addEventListener('mouseup', event => this.handleMouseUp(event));
        this.document.addEventListener('contextmenu', event => {
            const panelToggle = event.ctrlKey && event.target.closest('.rack-row .module') && !event.target.closest(PANEL_CONTROLS);
            if (event.target.closest('.jack') || panelToggle) event.preventDefault();
        });
        this.document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.dragState) {
                event.preventDefault();
                this.cancelCableDrag();
                return;
            }
            if (event.key === 'Escape' && (this.draggedModule || this.pendingModuleDrag)) {
                event.preventDefault();
                this.cancelModuleDrag();
                return;
            }
            if (event.key === 'Escape' && this.midiManager?.isLearnMode) {
                this.toggleMidiLearnMode();
            }
        });
        this.selection.bind(this.rackContainer);

        window.addEventListener('resize', () => this.renderAllCables());
        window.addEventListener('blur', () => {
            this.cancelCableDrag();
            this.cancelModuleDrag();
        });
        this.rackContainer?.addEventListener('scroll', () => this.renderAllCables(), { passive: true });

        this.startButton.addEventListener('click', () => { void this.toggleAudio(); });
        this.document.getElementById('clearCables').addEventListener('click', () => { void this.confirmClearAllCables(); });
        this.document.getElementById('sharePatch')?.addEventListener('click', () => this.sharePatchUrl());
        this.document.getElementById('midiLearnBtn').addEventListener('click', () => this.toggleMidiLearnMode());
        this.document.getElementById('midiControllerBtn').addEventListener('click', () => this.openMidiTool('/midi-controller.html'));
        this.document.getElementById('midiDrumControllerBtn').addEventListener('click', () => this.openMidiTool('/midi-drum-controller.html'));
        this.cableOpacityToggle?.addEventListener('click', () => this.toggleCableOpacity());
        this.document.getElementById('addRackRow')?.addEventListener('click', () => this.addRackRow());
        this.document.getElementById('removeRackRow')?.addEventListener('click', () => this.removeRackRow());
    }

    applySkin() {
        this.document.body.classList.remove('theme-classic', 'theme-dark');
        this.document.body.classList.add('theme-industrial', 'theme-light', 'skin-factory');
        try {
            localStorage.removeItem('eurorack-theme');
            localStorage.removeItem('eurorack-theme-mode');
        } catch {
            // Retired preferences never affect the fixed Industrial Light appearance.
        }
    }

    applySavedCableOpacity() {
        let fullOpacity = true;
        try {
            fullOpacity = localStorage.getItem(CABLE_OPACITY_STORAGE_KEY) !== 'false';
        } catch {
            fullOpacity = true;
        }
        this.setCableOpacity(fullOpacity, { persist: false });
    }

    setCableOpacity(fullOpacity, { persist = true } = {}) {
        this.cablesFullOpacity = fullOpacity !== false;
        this.document.body.classList.toggle('cables-dimmed', !this.cablesFullOpacity);
        if (this.cableOpacityToggle) {
            this.cableOpacityToggle.classList.toggle('active', this.cablesFullOpacity);
            this.cableOpacityToggle.textContent = this.cablesFullOpacity ? 'Cables: Full' : 'Cables: Dim';
            this.cableOpacityToggle.setAttribute('aria-pressed', this.cablesFullOpacity ? 'true' : 'false');
        }
        if (persist) {
            try {
                localStorage.setItem(CABLE_OPACITY_STORAGE_KEY, String(this.cablesFullOpacity));
            } catch {
                // Ignore storage failures; opacity still applies for this session.
            }
        }
    }

    toggleCableOpacity() {
        this.setCableOpacity(!this.cablesFullOpacity);
    }

    markEmptyRows() {
        this.syncRowElements();
        this.state.getRowNumbers().forEach(row => {
            this.rows[row]?.classList.toggle('empty', this.state.getRow(row).length === 0);
        });
    }

    addRackRow() {
        const row = this.state.addRow();
        this.syncRowElements();
        this.markEmptyRows();
        this.renderAllCables();
        return row;
    }

    removeRackRow(row = null) {
        const rowNumbers = this.state.getRowNumbers();
        const targetRow = row ?? rowNumbers[rowNumbers.length - 1];
        if (!targetRow) return false;

        const moduleCount = this.state.getRow(targetRow).length;
        if (moduleCount > 0) {
            const ok = this.document.defaultView?.confirm?.(
                `Remove rack row ${targetRow} and ${moduleCount} module${moduleCount === 1 ? '' : 's'}?`
            ) ?? true;
            if (!ok) return false;
        }

        try {
            this.state.removeRow(targetRow);
        } catch (error) {
            console.warn(error.message);
            return false;
        }

        this.rerenderRack();
        return true;
    }

    addModule(type, options = {}) {
        let moduleState;
        try {
            moduleState = this.host.addModule(type, options);
        } catch (error) {
            console.warn(error.message);
            return null;
        }

        this.renderModule(moduleState.id);
        this.markEmptyRows();
        this.syncEngineModules();
        return moduleState.id;
    }

    async pasteModules(fragment, destination) {
        await this.localModuleRuntime.preparePatch(fragment);
        let mounting = false;
        const mountPanels = ({ modules, cables }) => {
            mounting = true;
            this.markEmptyRows();
            for (const module of modules) {
                if (!module.element?.isConnected) this.renderModule(module.id);
            }
            this.renderStateCables(cables);
            this.renderAllCables();
        };
        try {
            const { modules } = await this.host.pasteModules(fragment, { ...destination, onApplied: mountPanels });
            if (modules.length) this.patchLibrary?.updateActiveLabel();
            return modules;
        } catch (error) {
            if (mounting) this.rerenderRack();
            throw error;
        }
    }

    renderModule(id) {
        const moduleState = this.state.getModule(id);
        const definition = pluginRegistry.get(moduleState.type);
        const dsp = this.getDSP(id);
        const element = renderModule(definition, id, {
            dsp,
            getModule: () => this.state.getModule(id),
            onParamChange: (moduleId, param, value) => {
                // A retiring panel may release a held control after the rack has loaded a different instance.
                if (this.state.getModule(moduleId) === moduleState) this.setParam(moduleId, param, value);
            }
        });

        element.dataset.instanceId = id;
        element.dataset.row = moduleState.row;
        const label = element.querySelector('.module-label');
        label.tabIndex = 0;
        label.setAttribute('role', 'button');
        label.setAttribute('aria-label', `Select ${definition.name}`);
        label.setAttribute('aria-pressed', 'false');

        const removeBtn = this.document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'x';
        removeBtn.addEventListener('click', event => {
            event.stopPropagation();
            this.removeModule(id);
        });
        element.appendChild(removeBtn);
        element.addEventListener('mousedown', event => this.handleModuleMouseDown(event));

        moduleState.element = element;
        if (!this.rows[moduleState.row]) this.syncRowElements();
        const rowEl = this.rows[moduleState.row];
        if (!rowEl) return;
        const rowIds = this.state.getRow(moduleState.row);
        const position = rowIds.indexOf(id);
        const beforeId = rowIds.slice(position + 1).find(next => this.state.getModule(next)?.element?.parentNode === rowEl);
        const beforeEl = this.state.getModule(beforeId)?.element ?? null;
        rowEl.insertBefore(element, beforeEl);
        this.applyParamsToDOM(id);
    }

    rerenderRack() {
        this.cancelModuleDrag();
        this.selection.clear();
        this.clearVisualCables();
        Object.values(this.rows).forEach(row => {
            row.querySelectorAll('.module:not(.drop-indicator)').forEach(el => {
                cleanupRenderedModule(el);
                el.remove();
            });
        });

        this.syncRowElements();
        this.state.getRowNumbers().forEach(row => {
            this.state.getRow(row).forEach(id => this.renderModule(id));
        });

        this.markEmptyRows();
        this.renderStateCables();
        this.updateMidiMappedIndicators();
        this.syncEngineModules();
        this.rackDebugger?.scheduleRefresh();
    }

    removeModule(id) {
        const mod = this.state.getModule(id);
        if (!mod) return;

        if (id === this.draggedModule || this.pendingModuleDrag?.element === mod.element) this.cancelModuleDrag();
        this.selection.remove(id);
        cleanupRenderedModule(mod.element);
        mod.element?.remove();
        this.host.removeModule(id);
        this.visualCables
            .filter(cable => cable.fromModule === id || cable.toModule === id)
            .forEach(cable => cable.pathEl?.remove());
        this.visualCables = this.visualCables.filter(cable => cable.fromModule !== id && cable.toModule !== id);
        this.markConnectedJacks();
        this.markEmptyRows();
        this.syncEngineModules();
        this.renderAllCables();
    }

    setParam(moduleId, param, value) {
        this.host.setParam(moduleId, param, value);
    }

    getDSP(moduleId) {
        return this.state.getModule(moduleId)?.instance || null;
    }

    createDSP(moduleState) {
        return this.host.createDSP(moduleState);
    }

    syncEngineModules() {
        this.host.syncTopology();
        this.engine = this.host.engine;
    }

    async toggleAudio() {
        if (this.host.engine) {
            const context = await this.host.stopAudio();
            this.engine = null;
            await context?.close();
            this.audioCtx = null;
            this.startButton.textContent = 'Start';
            this.startButton.classList.remove('active');
            return;
        }

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
            await this.audioCtx.resume();
            this.engine = await this.host.startAudio(this.audioCtx);
        } catch (error) {
            await this.audioCtx.close();
            this.audioCtx = null;
            this.engine = null;
            alert(error.message);
            return;
        }
        this.startButton.textContent = 'Stop';
        this.startButton.classList.add('active');
    }

    updateLEDs(ledStates) {
        Object.entries(ledStates).forEach(([moduleId, leds]) => updateModuleLEDs(moduleId, leds));
    }

    handleMouseDown(event) {
        const jack = event.target.closest('.jack');
        if (jack) {
            event.preventDefault();
            if (event.button === 2) {
                const cable = this.visualCables.find(c => c.fromEl === jack || c.toEl === jack);
                if (cable) this.removeCable(cable);
            } else if (event.button === 0) {
                this.startCableDrag(jack, event);
            }
        }
    }

    handleClick(event) {
        const toggleBtn = event.target.closest('.toggle-btn');
        if (!toggleBtn || toggleBtn.dataset.rendererManaged === 'true') return;

        event.preventDefault();
        const moduleId = toggleBtn.dataset.module;
        const param = toggleBtn.dataset.param;
        const value = toggleBtn.classList.toggle('active') ? 1 : 0;
        this.setParam(moduleId, param, value);
    }

    handleMouseMove(event) {
        if (this.dragState) this.updateCablePreview(event);
        const pending = this.pendingModuleDrag;
        if (pending && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= DRAG_THRESHOLD_PX) {
            this.pendingModuleDrag = null;
            this.startModuleDrag(pending.element);
        }
        if (this.draggedModule) this.handleModuleDragMove(event);
    }

    handleMouseUp(event) {
        this.pendingModuleDrag = null;
        if (this.dragState) {
            this.endCableDrag(event.target?.closest?.('.jack') || null);
        }
        if (this.draggedModule) {
            this.handleModuleDragEnd();
        }
    }

    handleModuleMouseDown(event) {
        if (event.button !== 0 && !(event.ctrlKey && event.button === 2)) return;
        if (event.target.closest(PANEL_CONTROLS)) return;

        const moduleEl = event.target.closest('.module');
        if (!moduleEl) return;
        event.preventDefault();
        event.stopPropagation();
        this.selection.select(moduleEl.dataset.instanceId, event);
        moduleEl.querySelector('.module-label')?.focus({ preventScroll: true });
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            this.pendingModuleDrag = { element: moduleEl, x: event.clientX, y: event.clientY };
        }
    }

    startModuleDrag(moduleEl) {
        if (!moduleEl.isConnected) return;
        this.draggedModule = moduleEl.dataset.instanceId;
        this.draggedModuleEl = moduleEl;
        this.dropIndicator = moduleEl.cloneNode(true);
        this.dropIndicator.className = 'module drop-indicator';
        this.dropIndicator.id = '';
        this.dropIndicator.style.width = `${moduleEl.offsetWidth}px`;
        this.dropIndicator.querySelectorAll('.remove-btn').forEach(el => el.remove());
        moduleEl.parentNode.insertBefore(this.dropIndicator, moduleEl);
        moduleEl.classList.add('dragging');
    }

    findDropPosition(rowEl, clientX) {
        const modules = [...rowEl.querySelectorAll('.module:not(.drop-indicator)')]
            .filter(el => el.dataset.instanceId !== this.draggedModule);
        const beforeEl = modules.find(el => {
            const rect = el.getBoundingClientRect();
            return clientX < rect.left + rect.width / 2;
        });
        return beforeEl || null;
    }

    handleModuleDragMove(event) {
        const targetRow = Object.values(this.rows).find(row => {
            const rect = row.getBoundingClientRect();
            return event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        if (!targetRow || !this.dropIndicator) return;

        const beforeEl = this.findDropPosition(targetRow, event.clientX);
        if (beforeEl) targetRow.insertBefore(this.dropIndicator, beforeEl);
        else targetRow.appendChild(this.dropIndicator);
        this.renderAllCables();
    }

    handleModuleDragEnd() {
        if (this.dropIndicator?.parentNode && this.dropIndicator.nextElementSibling !== this.draggedModuleEl) {
            const row = this.getRowNumberFromElement(this.dropIndicator.parentNode);
            const beforeEl = this.dropIndicator.nextElementSibling;
            const beforeId = beforeEl?.dataset?.instanceId;
            const rowIds = this.state.getRow(row).filter(id => id !== this.draggedModule);
            const index = beforeId ? rowIds.indexOf(beforeId) : rowIds.length;

            try {
                this.state.moveModule(this.draggedModule, pluginRegistry, { row, index });
                this.dropIndicator.parentNode.insertBefore(this.draggedModuleEl, this.dropIndicator);
                this.draggedModuleEl.dataset.row = row;
            } catch (error) {
                console.warn(error.message);
            }
        }

        this.finishModuleDrag();
    }

    cancelModuleDrag() {
        this.pendingModuleDrag = null;
        if (!this.draggedModule) return;
        this.finishModuleDrag();
    }

    finishModuleDrag() {
        this.draggedModuleEl?.classList.remove('dragging');
        this.dropIndicator?.remove();
        this.dropIndicator = null;
        this.draggedModule = null;
        this.draggedModuleEl = null;
        this.markEmptyRows();
        this.renderAllCables();
    }

    startCableDrag(jackEl, event) {
        const existing = this.visualCables.filter(c => c.fromEl === jackEl || c.toEl === jackEl);
        const pointerStart = { x: event.clientX, y: event.clientY };
        if (event.shiftKey || existing.length === 0) {
            this.dragState = {
                startJack: jackEl,
                startDir: jackEl.dataset.dir,
                detachedCable: null,
                detachedJack: null,
                pointerStart,
                moved: false
            };
            this.createCablePreview(CABLE_COLORS[this.colorIndex++ % CABLE_COLORS.length]);
        } else {
            let cable = existing[0];
            if (event.ctrlKey || event.metaKey) {
                if (this.lastCtrlClickJack === jackEl) {
                    this.ctrlClickCycleIndex = (this.ctrlClickCycleIndex + 1) % existing.length;
                } else {
                    this.lastCtrlClickJack = jackEl;
                    this.ctrlClickCycleIndex = 0;
                }
                cable = existing[this.ctrlClickCycleIndex];
            }
            const anchor = cable.fromEl === jackEl ? cable.toEl : cable.fromEl;
            const color = cable.pathEl.style.stroke;
            cable.pathEl.classList.add('cable-detached');
            this.dragState = {
                startJack: anchor,
                startDir: anchor.dataset.dir,
                detachedCable: cable,
                detachedJack: jackEl,
                pointerStart,
                moved: false
            };
            this.createCablePreview(color);
        }
        this.document.body.classList.add('cable-drag-active');
        this.updateCablePreview(event);
    }

    createCablePreview(color) {
        this.previewPath = this.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.previewPath.classList.add('cable', 'cable-preview');
        this.previewPath.style.stroke = color;
        this.cableSvg.appendChild(this.previewPath);
    }

    updateCablePreview(event) {
        if (!this.previewPath || !this.dragState) return;
        const deltaX = event.clientX - this.dragState.pointerStart.x;
        const deltaY = event.clientY - this.dragState.pointerStart.y;
        if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) this.dragState.moved = true;
        const start = getJackCenter(this.dragState.startJack);
        this.previewPath.setAttribute('d', createCablePath(start.x, start.y, event.clientX, event.clientY));
    }

    endCableDrag(targetJack) {
        const dragState = this.dragState;
        if (!dragState) return;
        const color = this.previewPath?.style.stroke;
        this.previewPath?.remove();
        this.previewPath = null;

        const validTarget = targetJack &&
            targetJack !== dragState.startJack &&
            targetJack.dataset.dir !== dragState.startDir;
        const restoreDetached = () => dragState.detachedCable?.pathEl?.classList.remove('cable-detached');

        if (!dragState.detachedCable) {
            if (validTarget) {
                const fromJack = dragState.startDir === 'output' ? dragState.startJack : targetJack;
                const toJack = dragState.startDir === 'input' ? dragState.startJack : targetJack;
                this.addCable(fromJack, toJack, { color });
            }
        } else if (!dragState.moved || targetJack === dragState.detachedJack || targetJack === dragState.startJack) {
            restoreDetached();
        } else if (!targetJack) {
            this.removeCable(dragState.detachedCable);
        } else if (!validTarget) {
            restoreDetached();
        } else {
            const fromJack = dragState.startDir === 'output' ? dragState.startJack : targetJack;
            const toJack = dragState.startDir === 'input' ? dragState.startJack : targetJack;
            const original = dragState.detachedCable;
            try {
                const movedCable = this.moveCable(original, fromJack, toJack);
                if (!movedCable) throw new Error('Cable move was rejected');
            } catch (error) {
                restoreDetached();
                console.warn(error.message);
            }
        }

        this.dragState = null;
        this.document.body.classList.remove('cable-drag-active');
    }

    cancelCableDrag() {
        this.previewPath?.remove();
        this.previewPath = null;
        this.dragState?.detachedCable?.pathEl?.classList.remove('cable-detached');
        this.dragState = null;
        this.document.body.classList.remove('cable-drag-active');
    }

    addCable(fromJack, toJack, { color = null, updateState = true, cableState = null } = {}) {
        const pureCable = cableState || (updateState ? this.host.connect({
            fromModule: fromJack.dataset.module,
            fromPort: fromJack.dataset.port,
            toModule: toJack.dataset.module,
            toPort: toJack.dataset.port
        }) : {
            fromModule: fromJack.dataset.module,
            fromPort: fromJack.dataset.port,
            toModule: toJack.dataset.module,
            toPort: toJack.dataset.port
        });
        if (!pureCable) return null;

        const path = this.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('cable');
        path.style.stroke = color || CABLE_COLORS[this.colorIndex++ % CABLE_COLORS.length];
        this.cableSvg.appendChild(path);

        const visualCable = { ...pureCable, fromEl: fromJack, toEl: toJack, pathEl: path };
        this.visualCables.push(visualCable);
        this.markConnectedJacks();
        this.renderCable(visualCable);
        if (updateState) this.engine?.setCables(this.state.cables);
        return visualCable;
    }

    moveCable(cable, fromJack, toJack) {
        const moved = this.host.moveCable(cable, {
            fromModule: fromJack.dataset.module,
            fromPort: fromJack.dataset.port,
            toModule: toJack.dataset.module,
            toPort: toJack.dataset.port
        });
        if (!moved) return null;

        Object.assign(cable, moved, { fromEl: fromJack, toEl: toJack });
        cable.pathEl?.classList.remove('cable-detached');
        this.markConnectedJacks();
        this.renderCable(cable);
        this.engine?.setCables(this.state.cables);
        return cable;
    }

    removeCable(cable) {
        this.host.disconnect(cable);
        this.removeVisualCable(cable);
        this.markConnectedJacks();
        this.engine?.setCables(this.state.cables);
    }

    removeVisualCable(cable) {
        cable.pathEl?.remove();
        this.visualCables = this.visualCables.filter(item => item !== cable);
    }

    async confirmClearAllCables() {
        const answer = await this.patchLibrary.choose('Clear all cables?',
            'This will remove all cables from the rack. Are you sure?',
            [['cancel', 'Cancel'], ['clear', 'Clear cables']]);
        if (answer === 'clear') {
            this.clearAllCables();
            this.patchLibrary.updateActiveLabel();
        }
    }

    clearAllCables() {
        this.clearVisualCables();
        this.host.clearCables();
    }

    clearVisualCables() {
        this.visualCables.forEach(cable => cable.pathEl?.remove());
        this.visualCables = [];
        this.markConnectedJacks();
    }

    renderStateCables(cables = this.state.cables) {
        const connectedInputs = new Set(this.visualCables.map(cable => cable.toEl));
        cables.forEach(cable => {
            const fromJack = this.document.querySelector(`.jack.output[data-module="${cable.fromModule}"][data-port="${cable.fromPort}"]`);
            const toJack = this.document.querySelector(`.jack.input[data-module="${cable.toModule}"][data-port="${cable.toPort}"]`);
            if (fromJack && toJack && !connectedInputs.has(toJack)) {
                this.addCable(fromJack, toJack, {
                    updateState: false,
                    cableState: cable
                });
            }
        });
    }

    renderCable(cable) {
        let fromEl = cable.fromEl;
        let toEl = cable.toEl;
        if (this.dropIndicator && this.draggedModule) {
            if (cable.fromModule === this.draggedModule) {
                fromEl = this.dropIndicator.querySelector(`.jack[data-port="${cable.fromPort}"]`) || fromEl;
            }
            if (cable.toModule === this.draggedModule) {
                toEl = this.dropIndicator.querySelector(`.jack[data-port="${cable.toPort}"]`) || toEl;
            }
        }
        const from = getJackCenter(fromEl);
        const to = getJackCenter(toEl);
        cable.pathEl.setAttribute('d', createCablePath(from.x, from.y, to.x, to.y));
    }

    renderAllCables() {
        this.visualCables.forEach(cable => this.renderCable(cable));
    }

    markConnectedJacks() {
        this.document.querySelectorAll('.jack.connected').forEach(jack => jack.classList.remove('connected'));
        this.visualCables.forEach(cable => {
            cable.fromEl?.classList.add('connected');
            cable.toEl?.classList.add('connected');
        });
    }

    applyParamsToDOM(moduleId) {
        const params = this.state.getModule(moduleId)?.params || {};
        const moduleEl = this.state.getModule(moduleId)?.element;
        Object.entries(params).forEach(([param, value]) => {
            if (moduleEl) {
                syncParamToModuleUI(moduleEl, moduleId, param, value);
                return;
            }

            const knob = this.document.querySelector(`.knob[data-module="${moduleId}"][data-param="${param}"]`);
            if (knob) {
                knob.dataset.value = value;
                updateKnobRotation(knob);
            }
            const sw = this.document.querySelector(`:is(.switch, .switch-positions)[data-module="${moduleId}"][data-param="${param}"]`);
            if (sw) setSwitchValue(sw, value);
            const bank = this.document.querySelector(`.button-bank[data-module="${moduleId}"][data-param="${param}"]`);
            if (bank) {
                bank.querySelectorAll('.octave-btn').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.value, 10) === value);
                });
            }
            const toggle = this.document.querySelector(`.toggle-btn[data-module="${moduleId}"][data-param="${param}"], .action-btn[data-module="${moduleId}"][data-param="${param}"]`);
            if (toggle) toggle.classList.toggle('active', value === 1 || value === true);
        });
    }

    getUserPatches() {
        return this.localPatches.read();
    }

    saveUserPatches(patches) {
        // Preserve unavailable records and local provenance outside the strict v3 state.
        this.localPatches.write(patches);
    }

    cleanUserPatches() {
        // Older versions deleted unsupported entries here. Keep them available for export.
        return this.getUserPatches();
    }

    getPatchList() {
        return { ...TEST_PATCHES, ...this.getUserPatches() };
    }

    initPatchBank() {
        if (this.document.getElementById('patchLibrary')) {
            this.patchLibrary = new PatchLibrary({ app: this, local: this.localPatches }).init();
        }
    }

    getPatchUrlOptions() {
        return {
            moduleOrder: DEFAULT_MODULE_ORDER,
            registry: pluginRegistry
        };
    }

    async savePatch(name) {
        if (!name?.trim()) { alert('Please enter a patch name'); return false; }
        try {
            const state = this.host.serializePatch();
            const saved = this.localPatches.save({ name, state }, { key: name.trim() });
            this.patchLibrary?.setActive(saved, JSON.stringify(state));
            this.updatePatchSelect();
            return true;
        } catch (error) { alert(`Failed to save patch: ${error.message}`); return false; }
    }

    async loadPatchState(patchState, { managed = false, beforeApply = null, edit = false, signal } = {}) {
        if (this.patchLibrary && !managed) return this.patchLibrary.replaceState(patchState, null, { beforeApply, edit, signal });
        signal?.throwIfAborted();
        await this.localModuleRuntime.preparePatch(patchState);
        signal?.throwIfAborted();
        const normalized = normalizePatch(patchState, { registry: pluginRegistry });
        beforeApply?.();
        try {
            await this.host.loadPatch(normalized);
            this.rerenderRack();
            return true;
        } catch (error) {
            this.rerenderRack();
            throw error;
        }
    }

    async loadPatch(name) {
        const local = this.getUserPatches();
        const localPatch = Object.hasOwn(local, name) ? local[name] : null;
        const patch = localPatch || (Object.hasOwn(TEST_PATCHES, name) ? TEST_PATCHES[name] : null);
        if (!patch) { alert('Patch not found'); return false; }
        if (this.patchLibrary) return this.patchLibrary.open({ ...patch, source: localPatch ? 'local' : 'test', key: name, canEdit: !!localPatch });
        const loaded = await this.loadPatchState(patch.state);
        const input = this.document.getElementById('patchName'); if (input) input.value = patch.name || name;
        return loaded;
    }

    deletePatch(name) {
        const patches = this.getUserPatches();
        if (!Object.hasOwn(patches, name)) return false;
        if (!confirm(`Delete patch "${name}"?`)) return false;
        this.localPatches.remove(name);
        this.updatePatchSelect();
        return true;
    }

    updatePatchSelect() {
        // Public method retained for JSON import callers; the library owns presentation.
        if (this.patchLibrary?.view !== 'rack') this.patchLibrary?.render();
    }

    async updatePatchUrl(patch) {
        const win = this.document.defaultView || (typeof window !== 'undefined' ? window : null);
        if (!win?.location) return;

        const url = await this.getPatchUrl(patch);
        if (win.history?.replaceState) {
            win.history.replaceState(null, '', url);
        } else {
            win.location.hash = await createPatchUrlHash(patch, this.getPatchUrlOptions());
        }
    }

    async loadPatchFromUrlHash() {
        const win = this.document.defaultView || (typeof window !== 'undefined' ? window : null);
        if (!win?.location?.hash) return false;

        let patch;
        try {
            if (parsePatchLocation(win.location.hash, win.location.pathname)?.source === 'cloud') return this.patchLibrary?.loadLocation() || false;
            patch = await parsePatchUrlHash(win.location.hash, {
                ...this.getPatchUrlOptions(),
                deferPluginValidation: true
            });
        } catch (error) {
            alert(`Could not open this patch: ${error.message}`);
            return false;
        }

        if (!patch) return false;
        const loaded = await this.loadPatchState(patch.state);
        const input = this.document.getElementById('patchName');
        if (!loaded) return false;
        if (input) input.value = patch.name;
        this.patchLibrary?.setActive({ source: 'snapshot', name: patch.name, state: patch.state });
        return loaded;
    }

    copyPatchToClipboard() {
        const json = JSON.stringify(this.host.serializePatch(), null, 4);
        return this.writeClipboardText(json).catch(() => alert('Failed to copy to clipboard'));
    }

    async getPatchUrl(patch) {
        const win = this.document.defaultView || (typeof window !== 'undefined' ? window : null);
        if (!win?.location) return '';

        const nextUrl = new URL('/', win.location.href);
        nextUrl.hash = await createPatchUrlHash(patch, this.getPatchUrlOptions());
        return nextUrl.toString();
    }

    writeClipboardText(text) {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(text);
        }

        return Promise.reject(new Error('Clipboard API unavailable'));
    }

    async sharePatchUrl() {
        const name = this.getCurrentPatchName();
        const patch = createCanonicalPatch(name, this.host.serializePatch());

        let url;
        try {
            await this.updatePatchUrl(patch);
            url = await this.getPatchUrl(patch);
        } catch (error) {
            alert(`Could not create a link: ${error.message}`);
            return false;
        }

        return this.writeClipboardText(url).then(() => {
            const btn = this.document.getElementById('sharePatch');
            if (!btn) return true;
            const oldText = btn.textContent;
            btn.textContent = 'Link copied.';
            setTimeout(() => { btn.textContent = oldText; }, 1500);
            return true;
        }).catch(() => {
            alert('Could not copy the link. Try again.');
            return false;
        });
    }

    getCurrentPatchName() {
        const inputName = this.document.getElementById('patchName')?.value;
        return normalizePatchName(inputName || this.patchLibrary?.active?.name || 'Untitled');
    }

    exportCurrentPatchToFile() {
        const name = this.getCurrentPatchName();
        const patch = createCanonicalPatch(name, { state: this.host.serializePatch(), provenance: this.patchLibrary?.active?.provenance });
        const json = JSON.stringify(createPatchExport(patch), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = `${sanitizeFilename(name)}.json`;
        this.document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async importPatchFile(file) {
        try {
            return await this.importPatchJson(await file.text(), { suggestedName: file.name });
        } catch (error) {
            alert(`Failed to import patch JSON: ${error.message}`);
            return { importedCount: 0, error };
        }
    }

    async importPatchJson(json, { suggestedName = '' } = {}) {
        try {
            const imported = parseImportedPatchJson(json, {
                suggestedName,
                moduleOrder: DEFAULT_MODULE_ORDER
            });

            if (imported.type === 'single') {
                const patch = imported.patches[imported.names[0]];
                const loaded = await this.loadPatchState(patch.state);
                if (!loaded) return { importedCount: 0, cancelled: true };
                this.patchLibrary?.setActive({ ...patch, source: 'local', key: patch.name, canEdit: true });
                const input = this.document.getElementById('patchName'); if (input) input.value = patch.name;
            }

            const patches = { ...this.getUserPatches(), ...imported.patches };
            this.saveUserPatches(patches);
            this.updatePatchSelect();

            return {
                importedCount: imported.names.length,
                loadedName: imported.type === 'single' ? imported.names[0] : null,
                type: imported.type
            };
        } catch (error) {
            alert(`Failed to import patch JSON: ${error.message}`);
            return { importedCount: 0, error };
        }
    }

    async initMidi() {
        this.midiManager = createMidiManager();
        this.host.setService('midiManager', this.midiManager);
        this.midiManager.setOnRawMidiMessage((data, receivedTime) => (
            this.host.engine?.sendMidi?.(data, receivedTime)
        ));
        const success = await this.midiManager.init();
        const btn = this.document.getElementById('midiLearnBtn');
        if (!success) {
            btn.style.display = 'none';
            return;
        }
        this.midiManager.setOnMidiLearnComplete((key, knobInfo) => {
            knobInfo.element.classList.remove('midi-learning');
            knobInfo.element.classList.add('midi-mapped');
            this.state.midiMappings = this.midiManager.getMappings();
        });
        this.midiManager.setOnMidiMessage(message => this.applyMidiControl(message));
        this.midiManager.setOnConnectionChange((connected, devices) => {
            btn.title = connected
                ? `MIDI Learn - Connected: ${devices.join(', ')}`
                : 'MIDI Learn - No devices connected';
        });
    }

    toggleMidiLearnMode() {
        if (!this.midiManager) return;
        const btn = this.document.getElementById('midiLearnBtn');
        const active = btn.classList.toggle('midi-learn-active');
        this.midiManager.setLearnMode(active);
        this.document.body.classList.toggle('midi-learn-mode', active);
        if (!active) {
            this.document.querySelectorAll('.midi-learning').forEach(control => control.classList.remove('midi-learning'));
        }
    }

    openMidiTool(path) {
        this.document.defaultView?.open(path, '_blank', 'noopener,noreferrer');
    }

    applyMidiControl({ moduleId, paramId, value }) {
        const module = this.state.getModule(moduleId);
        const domain = getControlDomain(this.host.registry.get(module?.type), paramId);
        if (!domain || !Number.isFinite(value)) return;
        this.setParam(moduleId, paramId, snapControlValue(domain, value));
        this.applyParamsToDOM(moduleId);
    }

    getMidiControlRange(control) {
        const module = this.state.getModule(control.dataset.module);
        const domain = getControlDomain(this.host.registry.get(module?.type), control.dataset.param);
        return domain ? controlRange(domain) : null;
    }

    handleParamMidiLearn(control, event) {
        const range = this.getMidiControlRange(control);
        if (!range) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type !== 'click') return;
        this.document.querySelectorAll('.midi-learning').forEach(item => item.classList.remove('midi-learning'));
        control.classList.add('midi-learning');
        this.midiManager.startLearning({
            element: control,
            moduleId: control.dataset.module,
            paramId: control.dataset.param,
            ...range
        });
    }

    updateMidiMappedIndicators() {
        this.document.querySelectorAll('.midi-mapped').forEach(control => control.classList.remove('midi-mapped'));
        if (!this.midiManager) return;
        Object.values(this.state.midiMappings || {}).forEach(mapping => {
            const control = this.document.querySelector(`[data-module="${mapping.moduleId}"][data-param="${mapping.paramId}"]`);
            control?.classList.add('midi-mapped');
        });
        this.midiManager.setMappings(this.state.midiMappings || {});
    }
}

export async function initApp() {
    const app = new EurorackApp();
    await app.init();
    window.eurorackApp = app;
    return app;
}

if (typeof document !== 'undefined' && document.getElementById('rack-row-1')) {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
    });
}
