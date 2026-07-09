import {
    loadModules,
    moduleRegistry,
    DEFAULT_MODULE_ORDER,
    CATEGORY_ORDER,
    CATEGORY_LABELS
} from '../index.js';
import { BUFFER, CABLE_COLORS, PATCH_STORAGE_KEY } from '../config/constants.js';
import { FACTORY_PATCHES } from '../config/factory-patches.js';
import { createAudioEngine } from '../audio/engine.js';
import { createCablePath, getJackCenter } from '../cables/cable-manager.js';
import { createMidiManager } from '../midi/midi-manager.js';
import { cleanupRenderedModule, renderModule, syncParamToModuleUI, updateModuleLEDs } from '../ui/renderer.js';
import { updateKnobRotation } from '../ui/toolkit/components.js';
import { RackState } from './rack-state.js';
import {
    PATCH_VERSION,
    createPatchUrlHash,
    normalizePatch,
    normalizePatchCollection,
    parsePatchUrlHash
} from './patch-format.js';
import { setNestedValue } from '../utils/nested-access.js';
import { adjustColor, getModuleColorToken, isHexColor } from '../utils/color.js';

export const PATCH_EXPORT_SCHEMA = 'eurorack-js/patch-export';
export const PATCH_EXPORT_VERSION = 1;
export const THEME_STORAGE_KEY = 'eurorack-theme';
export const THEME_MODE_STORAGE_KEY = 'eurorack-theme-mode';
export const SKIN_STORAGE_KEY = 'eurorack-skin';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPatchStateLike(value) {
    return isPlainObject(value) && (
        value.version === PATCH_VERSION &&
        Array.isArray(value.modules) &&
        isPlainObject(value.params) &&
        Array.isArray(value.cables) &&
        isPlainObject(value.midiMappings)
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
        state: normalizePatch(rawPatch?.state || rawPatch)
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
        state: normalizePatch(rawPatch?.state || rawPatch)
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
        patches[patch.name] = patch;
        names.push(patch.name);
    });

    return { type: 'collection', patches, names };
}

export function createPatchExport(patch, {
    exportedAt = new Date().toISOString()
} = {}) {
    const canonicalPatch = createCanonicalPatch(patch?.name || 'Untitled Patch', patch, {
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
        this.state = new RackState();
        this.audioCtx = null;
        this.engine = null;
        this.midiManager = null;
        this.visualCables = [];
        this.colorIndex = 0;
        this.dragState = null;
        this.draggedModule = null;
        this.draggedModuleEl = null;
        this.dropIndicator = null;
        this.lastCtrlClickJack = null;
        this.ctrlClickCycleIndex = 0;
        this.theme = 'industrial';
        this.themeMode = 'light';
    }

    async init() {
        await loadModules();
        this.cacheElements();
        this.applySavedSkin();
        this.populateSidebar();
        this.bindEvents();
        await this.initMidi();
        this.cleanUserPatches();
        this.initPatchBank();
        await this.loadPatchFromUrlHash();
        this.markEmptyRows();
    }

    cacheElements() {
        this.cableSvg = this.document.getElementById('cable-svg');
        this.rackContainer = this.document.getElementById('rack-container');
        this.startButton = this.document.getElementById('startButton');
        this.themeSelect = this.document.getElementById('themeSelect');
        this.themeModeToggle = this.document.getElementById('themeModeToggle');
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

        moduleRegistry.getAllDefinitions().forEach(def => {
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
        this.document.addEventListener('mousedown', event => this.handleMouseDown(event), true);
        this.document.addEventListener('click', event => this.handleClick(event));
        this.document.addEventListener('mousemove', event => this.handleMouseMove(event));
        this.document.addEventListener('mouseup', event => this.handleMouseUp(event));
        this.document.addEventListener('contextmenu', event => {
            if (event.target.closest('.jack')) event.preventDefault();
        });
        this.document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.midiManager?.isLearnMode) {
                this.toggleMidiLearnMode();
            }
        });

        window.addEventListener('resize', () => this.renderAllCables());
        this.rackContainer?.addEventListener('scroll', () => this.renderAllCables(), { passive: true });

        this.startButton.addEventListener('click', () => this.toggleAudio());
        this.document.getElementById('clearCables').addEventListener('click', () => this.clearAllCables());
        this.document.getElementById('copyPatch').addEventListener('click', () => this.copyPatchToClipboard());
        this.document.getElementById('sharePatch')?.addEventListener('click', () => this.sharePatchUrl());
        this.document.getElementById('exportPatch')?.addEventListener('click', () => this.exportCurrentPatchToFile());
        this.document.getElementById('importPatch')?.addEventListener('click', () => {
            this.document.getElementById('patchFileInput')?.click();
        });
        this.document.getElementById('patchFileInput')?.addEventListener('change', event => {
            const file = event.target.files?.[0];
            if (file) this.importPatchFile(file);
            event.target.value = '';
        });
        this.document.getElementById('midiLearnBtn').addEventListener('click', () => this.toggleMidiLearnMode());
        this.document.getElementById('midiControllerBtn').addEventListener('click', () => this.openMidiTool('midi-controller.html'));
        this.document.getElementById('midiDrumControllerBtn').addEventListener('click', () => this.openMidiTool('midi-drum-controller.html'));
        this.themeSelect?.addEventListener('change', event => this.setTheme(event.target.value));
        this.themeModeToggle?.addEventListener('click', () => this.toggleThemeMode());
        this.document.getElementById('addRackRow')?.addEventListener('click', () => this.addRackRow());
        this.document.getElementById('removeRackRow')?.addEventListener('click', () => this.removeRackRow());
    }

    applySavedSkin() {
        let savedTheme = 'industrial';
        let savedMode = 'light';
        try {
            savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || '';
            savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY) || 'light';
            if (!savedTheme) {
                const legacySkin = localStorage.getItem(SKIN_STORAGE_KEY);
                savedTheme = legacySkin === 'factory' ? 'industrial' : legacySkin === 'classic' ? 'classic' : 'industrial';
            }
        } catch {
            savedTheme = 'industrial';
            savedMode = 'light';
        }
        this.setTheme(savedTheme, { persist: false, render: false });
        this.setThemeMode(savedMode, { persist: false });
    }

    setTheme(theme, { persist = true, render = true } = {}) {
        this.theme = theme === 'classic' ? 'classic' : 'industrial';
        this.document.body.classList.toggle('theme-industrial', this.theme === 'industrial');
        this.document.body.classList.toggle('theme-classic', this.theme === 'classic');
        this.document.body.classList.toggle('skin-factory', this.theme === 'industrial');
        if (this.themeSelect) {
            this.themeSelect.value = this.theme;
        }
        if (persist) {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, this.theme);
                localStorage.setItem(SKIN_STORAGE_KEY, this.theme === 'industrial' ? 'factory' : 'classic');
            } catch {
                // Ignore storage failures; the theme still applies for this session.
            }
        }
        if (render) this.renderAllCables();
    }

    setThemeMode(mode, { persist = true } = {}) {
        this.themeMode = mode === 'dark' ? 'dark' : 'light';
        this.document.body.classList.toggle('theme-dark', this.themeMode === 'dark');
        this.document.body.classList.toggle('theme-light', this.themeMode === 'light');
        if (this.themeModeToggle) {
            this.themeModeToggle.classList.toggle('active', this.themeMode === 'dark');
            this.themeModeToggle.textContent = this.themeMode === 'dark' ? 'Dark: On' : 'Dark: Off';
            this.themeModeToggle.setAttribute('aria-pressed', this.themeMode === 'dark' ? 'true' : 'false');
        }
        if (persist) {
            try {
                localStorage.setItem(THEME_MODE_STORAGE_KEY, this.themeMode);
            } catch {
                // Ignore storage failures; the theme mode still applies for this session.
            }
        }
        this.renderAllCables();
    }

    toggleThemeMode() {
        this.setThemeMode(this.themeMode === 'dark' ? 'light' : 'dark');
    }

    toggleSkin() {
        this.setTheme(this.theme === 'industrial' ? 'classic' : 'industrial');
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
            moduleState = this.state.addModule(type, moduleRegistry, options);
        } catch (error) {
            console.warn(error.message);
            return null;
        }

        this.renderModule(moduleState.id);
        this.markEmptyRows();
        this.syncEngineModules();
        return moduleState.id;
    }

    renderModule(id) {
        const moduleState = this.state.getModule(id);
        const definition = moduleRegistry.get(moduleState.type);
        const dsp = this.getDSP(id);
        const element = renderModule(definition, id, {
            dsp,
            getModule: () => this.state.getModule(id),
            onParamChange: (moduleId, param, value) => this.setParam(moduleId, param, value)
        });

        element.dataset.instanceId = id;
        element.dataset.row = moduleState.row;

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
        const beforeId = rowIds[position + 1];
        const beforeEl = beforeId ? this.document.getElementById(`module-${beforeId}`) : null;
        rowEl.insertBefore(element, beforeEl);
        this.applyParamsToDOM(id);
    }

    rerenderRack() {
        this.clearVisualCables();
        this.syncRowElements();
        Object.values(this.rows).forEach(row => {
            row.querySelectorAll('.module:not(.drop-indicator)').forEach(el => {
                cleanupRenderedModule(el);
                el.remove();
            });
        });

        this.state.getRowNumbers().forEach(row => {
            this.state.getRow(row).forEach(id => this.renderModule(id));
        });

        this.markEmptyRows();
        this.renderStateCables();
        this.updateMidiMappedIndicators();
        this.syncEngineModules();
    }

    removeModule(id) {
        const mod = this.state.getModule(id);
        if (!mod) return;

        cleanupRenderedModule(mod.element);
        mod.element?.remove();
        this.state.removeModule(id);
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
        this.state.setParam(moduleId, param, value);
        const dsp = this.getDSP(moduleId);
        if (dsp?.params) {
            setNestedValue(dsp.params, param, value);
        }
    }

    getDSP(moduleId) {
        return this.state.getModule(moduleId)?.instance || null;
    }

    createDSP(moduleState) {
        const definition = moduleRegistry.get(moduleState.type);
        const dsp = definition.createDSP({
            sampleRate: this.audioCtx?.sampleRate || 44100,
            bufferSize: BUFFER,
            audioCtx: this.audioCtx
        });

        if (dsp && this.midiManager) {
            dsp.midiManager = this.midiManager;
        }

        Object.entries(moduleState.params).forEach(([param, value]) => {
            setNestedValue(dsp.params, param, value);
        });

        if (moduleState.runtimeState && definition.restoreRuntimeState) {
            definition.restoreRuntimeState(dsp, moduleState.runtimeState);
        }

        moduleState.instance = dsp;
        return dsp;
    }

    syncEngineModules() {
        if (!this.engine) return;
        this.engine.setModules(this.getEngineModules());
        this.engine.setCables(this.state.cables);
    }

    getEngineModules() {
        const modules = {};
        this.state.modules.forEach((moduleState, id) => {
            if (!moduleState.instance && this.audioCtx) {
                this.createDSP(moduleState);
            }
            modules[id] = {
                instance: moduleState.instance,
                type: moduleState.type,
                def: moduleRegistry.get(moduleState.type)
            };
        });
        return modules;
    }

    toggleAudio() {
        if (this.engine) {
            this.engine.stop();
            this.engine = null;
            this.audioCtx?.close();
            this.audioCtx = null;
            this.state.modules.forEach(moduleState => {
                const definition = moduleRegistry.get(moduleState.type);
                if (moduleState.instance && definition?.captureRuntimeState) {
                    moduleState.runtimeState = definition.captureRuntimeState(moduleState.instance);
                }
                moduleState.instance = null;
            });
            this.startButton.textContent = 'Start';
            this.startButton.classList.remove('active');
            return;
        }

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.state.modules.forEach(moduleState => this.createDSP(moduleState));
        this.engine = createAudioEngine({
            modules: this.getEngineModules(),
            cables: this.state.cables,
            audioCtx: this.audioCtx,
            sampleRate: this.audioCtx.sampleRate,
            onLedUpdate: ledStates => this.updateLEDs(ledStates)
        });
        this.engine.start();
        this.startButton.textContent = 'Stop';
        this.startButton.classList.add('active');
    }

    updateLEDs(ledStates) {
        Object.entries(ledStates).forEach(([moduleId, leds]) => updateModuleLEDs(moduleId, leds));
    }

    handleMouseDown(event) {
        const midiControl = event.target.closest('[data-module][data-param]');
        if (midiControl && !midiControl.classList.contains('jack') && this.handleParamMidiLearn(midiControl, event)) return;

        const jack = event.target.closest('.jack');
        if (jack) {
            event.preventDefault();
            if (event.button === 2) {
                const cable = this.visualCables.find(c => c.fromEl === jack || c.toEl === jack);
                if (cable) this.removeCable(cable);
            } else {
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
        if (this.draggedModule) this.handleModuleDragMove(event);
    }

    handleMouseUp(event) {
        if (this.dragState) {
            this.endCableDrag(event.target.closest('.jack'), event);
        }
        if (this.draggedModule) {
            this.handleModuleDragEnd();
        }
    }

    handleModuleMouseDown(event) {
        if (event.button !== 0) return;
        if (event.target.closest('.jack, .knob, .switch, .remove-btn, .octave-btn, .toggle-btn, .action-btn')) return;

        const moduleEl = event.target.closest('.module');
        if (!moduleEl) return;
        event.preventDefault();
        event.stopPropagation();

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
        if (this.dropIndicator?.parentNode) {
            const row = this.getRowNumberFromElement(this.dropIndicator.parentNode);
            const beforeEl = this.dropIndicator.nextElementSibling;
            const beforeId = beforeEl?.dataset?.instanceId;
            const rowIds = this.state.getRow(row).filter(id => id !== this.draggedModule);
            const index = beforeId ? rowIds.indexOf(beforeId) : rowIds.length;

            try {
                this.state.moveModule(this.draggedModule, moduleRegistry, { row, index });
                this.dropIndicator.parentNode.insertBefore(this.draggedModuleEl, this.dropIndicator);
                this.draggedModuleEl.dataset.row = row;
            } catch (error) {
                console.warn(error.message);
            }
        }

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
        if (event.shiftKey || existing.length === 0) {
            this.dragState = { startJack: jackEl, startDir: jackEl.dataset.dir };
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
            this.removeCable(cable);
            this.dragState = { startJack: anchor, startDir: anchor.dataset.dir };
            this.createCablePreview(color);
        }
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
        const start = getJackCenter(this.dragState.startJack);
        this.previewPath.setAttribute('d', createCablePath(start.x, start.y, event.clientX, event.clientY));
    }

    endCableDrag(targetJack, event) {
        const color = this.previewPath?.style.stroke;
        this.previewPath?.remove();
        this.previewPath = null;

        if (targetJack && targetJack !== this.dragState.startJack && targetJack.dataset.dir !== this.dragState.startDir) {
            const fromJack = this.dragState.startDir === 'output' ? this.dragState.startJack : targetJack;
            const toJack = this.dragState.startDir === 'input' ? this.dragState.startJack : targetJack;
            this.addCable(fromJack, toJack, { color, replaceInput: !event.shiftKey });
        }

        this.dragState = null;
    }

    addCable(fromJack, toJack, { color = null, replaceInput = true, updateState = true, cableState = null } = {}) {
        if (replaceInput) {
            this.visualCables
                .filter(cable => cable.toModule === toJack.dataset.module && cable.toPort === toJack.dataset.port)
                .forEach(cable => this.removeCable(cable));
        }

        const pureCable = cableState || (updateState ? this.state.connect({
            fromModule: fromJack.dataset.module,
            fromPort: fromJack.dataset.port,
            toModule: toJack.dataset.module,
            toPort: toJack.dataset.port
        }, { replaceInput: false }) : {
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

    removeCable(cable) {
        cable.pathEl?.remove();
        this.state.removeCable(cable);
        this.visualCables = this.visualCables.filter(item => item !== cable);
        this.markConnectedJacks();
        this.engine?.setCables(this.state.cables);
    }

    clearAllCables() {
        this.clearVisualCables();
        this.state.clearCables();
        this.engine?.setCables([]);
    }

    clearVisualCables() {
        this.visualCables.forEach(cable => cable.pathEl?.remove());
        this.visualCables = [];
        this.markConnectedJacks();
    }

    renderStateCables() {
        this.state.cables.forEach(cable => {
            const fromJack = this.document.querySelector(`.jack.output[data-module="${cable.fromModule}"][data-port="${cable.fromPort}"]`);
            const toJack = this.document.querySelector(`.jack.input[data-module="${cable.toModule}"][data-port="${cable.toPort}"]`);
            if (fromJack && toJack) {
                this.addCable(fromJack, toJack, {
                    replaceInput: false,
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
            const sw = this.document.querySelector(`.switch[data-module="${moduleId}"][data-param="${param}"]`);
            if (sw) sw.classList.toggle('on', !!value);
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
        try {
            return JSON.parse(localStorage.getItem(PATCH_STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    saveUserPatches(patches) {
        const canonicalPatches = normalizePatchCollection(patches);
        localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(canonicalPatches));
    }

    cleanUserPatches() {
        const current = this.getUserPatches();
        const cleaned = {};
        let changed = false;

        Object.entries(current).forEach(([name, patch]) => {
            try {
                cleaned[name] = normalizePatchCollection({ [name]: patch })[name];
            } catch {
                changed = true;
            }
        });

        if (changed) {
            localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(cleaned));
        }
    }

    getPatchList() {
        return { ...FACTORY_PATCHES, ...this.getUserPatches() };
    }

    initPatchBank() {
        this.updatePatchSelect();

        this.document.getElementById('savePatch').addEventListener('click', async () => {
            const input = this.document.getElementById('patchName');
            if (await this.savePatch(input.value)) {
                this.document.getElementById('patchSelect').value = input.value.trim();
                input.value = '';
            }
        });
        this.document.getElementById('loadPatch').addEventListener('click', async () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) await this.loadPatch(select.value);
        });
        this.document.getElementById('deletePatch').addEventListener('click', () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) this.deletePatch(select.value);
        });
        this.document.getElementById('patchName').addEventListener('keypress', event => {
            if (event.key === 'Enter') this.document.getElementById('savePatch').click();
        });
        this.document.getElementById('patchSelect').addEventListener('dblclick', async () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) await this.loadPatch(select.value);
        });
    }

    getPatchUrlOptions() {
        return {
            moduleOrder: DEFAULT_MODULE_ORDER,
            moduleRegistry
        };
    }

    async savePatch(name) {
        if (!name?.trim()) {
            alert('Please enter a patch name');
            return false;
        }
        const patches = this.getUserPatches();
        const patchName = name.trim();
        const patch = createCanonicalPatch(patchName, this.state.serializePatch());
        patches[patchName] = patch;
        this.saveUserPatches(patches);
        this.updatePatchSelect();
        try {
            await this.updatePatchUrl(patch);
        } catch (error) {
            alert(`Failed to update share URL: ${error.message}`);
            return false;
        }
        return true;
    }

    loadPatchState(patchState) {
        const previous = this.state.serializePatch();
        const normalized = normalizePatch(patchState);
        try {
            this.state.loadPatch(normalized, moduleRegistry);
            if (this.audioCtx) {
                this.state.modules.forEach(moduleState => this.createDSP(moduleState));
            }
            this.rerenderRack();
            return true;
        } catch (error) {
            this.state.loadPatch(previous, moduleRegistry);
            if (this.audioCtx) {
                this.state.modules.forEach(moduleState => this.createDSP(moduleState));
            }
            this.rerenderRack();
            throw error;
        }
    }

    async loadPatch(name) {
        const patch = this.getPatchList()[name];
        if (!patch) {
            alert('Patch not found');
            return false;
        }
        const normalized = normalizePatch(patch);
        const loaded = this.loadPatchState(normalized);
        if (loaded) {
            try {
                await this.updatePatchUrl({
                    name: patch.name || name,
                    factory: false,
                    state: normalized
                });
            } catch (error) {
                alert(`Failed to update share URL: ${error.message}`);
                return false;
            }
        }
        return loaded;
    }

    deletePatch(name) {
        if (FACTORY_PATCHES[name]) {
            alert('Cannot delete factory patches');
            return false;
        }
        const patches = this.getUserPatches();
        if (!patches[name]) return false;
        if (!confirm(`Delete patch "${name}"?`)) return false;
        delete patches[name];
        this.saveUserPatches(patches);
        this.updatePatchSelect();
        return true;
    }

    updatePatchSelect() {
        const select = this.document.getElementById('patchSelect');
        while (select.children.length > 1) select.removeChild(select.lastChild);

        const addGroup = (label, names) => {
            if (!names.length) return;
            const group = this.document.createElement('optgroup');
            group.label = label;
            names.forEach(name => {
                const option = this.document.createElement('option');
                option.value = name;
                option.textContent = name;
                group.appendChild(option);
            });
            select.appendChild(group);
        };

        addGroup('Factory Patches', Object.keys(FACTORY_PATCHES).sort());
        addGroup('My Patches', Object.keys(this.getUserPatches()).sort());
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
            patch = await parsePatchUrlHash(win.location.hash, this.getPatchUrlOptions());
        } catch (error) {
            alert(`Failed to load shared patch URL: ${error.message}`);
            return false;
        }

        if (!patch) return false;
        const loaded = this.loadPatchState(patch.state);
        const input = this.document.getElementById('patchName');
        const select = this.document.getElementById('patchSelect');
        if (input) input.value = patch.name;
        if (select) select.value = '';
        return loaded;
    }

    copyPatchToClipboard() {
        const json = JSON.stringify(this.state.serializePatch(), null, 4);
        navigator.clipboard.writeText(json).then(() => {
            const btn = this.document.getElementById('copyPatch');
            const oldText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = oldText; }, 1500);
        }).catch(() => alert('Failed to copy to clipboard'));
    }

    async getPatchUrl(patch) {
        const win = this.document.defaultView || (typeof window !== 'undefined' ? window : null);
        if (!win?.location) return '';

        const nextUrl = new URL(win.location.href);
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
        const patch = createCanonicalPatch(name, this.state.serializePatch());

        let url;
        try {
            await this.updatePatchUrl(patch);
            url = await this.getPatchUrl(patch);
        } catch (error) {
            alert(`Failed to create share URL: ${error.message}`);
            return false;
        }

        return this.writeClipboardText(url).then(() => {
            const btn = this.document.getElementById('sharePatch');
            if (!btn) return true;
            const oldText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = oldText; }, 1500);
            return true;
        }).catch(() => {
            alert('Failed to copy share URL');
            return false;
        });
    }

    getCurrentPatchName() {
        const inputName = this.document.getElementById('patchName')?.value;
        const selectedName = this.document.getElementById('patchSelect')?.value;
        return normalizePatchName(inputName || selectedName || 'Untitled Patch');
    }

    exportCurrentPatchToFile() {
        const name = this.getCurrentPatchName();
        const patch = createCanonicalPatch(name, this.state.serializePatch());
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
                this.loadPatchState(patch.state);
                await this.updatePatchUrl(patch);
            }

            const patches = { ...this.getUserPatches(), ...imported.patches };
            this.saveUserPatches(patches);
            this.updatePatchSelect();

            const select = this.document.getElementById('patchSelect');
            if (select) select.value = '';

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
        window.midiManager = this.midiManager;
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
        this.midiManager.setOnMidiMessage(({ moduleId, paramId, value }) => {
            this.setParam(moduleId, paramId, value);
            this.applyParamsToDOM(moduleId);
        });
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

    getMidiControlRange(control) {
        if (control.classList.contains('knob')) {
            return {
                min: parseFloat(control.dataset.min),
                max: parseFloat(control.dataset.max)
            };
        }

        if (control.classList.contains('button-bank')) {
            const values = [...control.querySelectorAll('[data-value]')]
                .map(btn => Number(btn.dataset.value))
                .filter(Number.isFinite);
            if (values.length) {
                return {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        }

        return { min: 0, max: 1 };
    }

    handleParamMidiLearn(control, event) {
        if (!this.midiManager?.isLearnMode) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.document.querySelectorAll('.midi-learning').forEach(item => item.classList.remove('midi-learning'));
        control.classList.add('midi-learning');
        const { min, max } = this.getMidiControlRange(control);
        this.midiManager.startLearning({
            element: control,
            moduleId: control.dataset.module,
            paramId: control.dataset.param,
            min,
            max
        });
        return true;
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
