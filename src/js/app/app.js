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
import { renderModule, updateModuleLEDs } from '../ui/renderer.js';
import { updateKnobRotation } from '../ui/toolkit/components.js';
import { RackState } from './rack-state.js';
import { migratePatchCollection, normalizePatch } from './patch-format.js';
import { setNestedValue } from '../utils/nested-access.js';

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
    }

    async init() {
        await loadModules();
        this.cacheElements();
        this.populateSidebar();
        this.bindEvents();
        await this.initMidi();
        this.migrateUserPatches();
        this.initPatchBank();
        this.markEmptyRows();
    }

    cacheElements() {
        this.rows = {
            1: this.document.getElementById('rack-row-1'),
            2: this.document.getElementById('rack-row-2')
        };
        this.cableSvg = this.document.getElementById('cable-svg');
        this.startButton = this.document.getElementById('startButton');
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
                item.className = 'sidebar-module';
                item.dataset.moduleType = def.id;
                item.innerHTML = `
                    <div class="sidebar-module-color" style="background: ${def.color}"></div>
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

        this.startButton.addEventListener('click', () => this.toggleAudio());
        this.document.getElementById('clearCables').addEventListener('click', () => this.clearAllCables());
        this.document.getElementById('copyPatch').addEventListener('click', () => this.copyPatchToClipboard());
        this.document.getElementById('midiLearnBtn').addEventListener('click', () => this.toggleMidiLearnMode());
        this.document.getElementById('midiControllerBtn').addEventListener('click', () => this.openMidiTool('midi-controller.html'));
        this.document.getElementById('midiDrumControllerBtn').addEventListener('click', () => this.openMidiTool('midi-drum-controller.html'));
    }

    markEmptyRows() {
        [1, 2].forEach(row => {
            this.rows[row].classList.toggle('empty', this.state.getRow(row).length === 0);
        });
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
        const rowEl = this.rows[moduleState.row];
        const rowIds = this.state.getRow(moduleState.row);
        const position = rowIds.indexOf(id);
        const beforeId = rowIds[position + 1];
        const beforeEl = beforeId ? this.document.getElementById(`module-${beforeId}`) : null;
        rowEl.insertBefore(element, beforeEl);
        this.applyParamsToDOM(id);
    }

    rerenderRack() {
        this.clearVisualCables();
        Object.values(this.rows).forEach(row => {
            row.querySelectorAll('.module:not(.drop-indicator)').forEach(el => el.remove());
        });

        [1, 2].forEach(row => {
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
        const knob = event.target.closest('.knob');
        if (knob && this.handleKnobMidiLearn(knob, event)) return;

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
        if (event.target.closest('.jack, .knob, .switch, .remove-btn, .octave-btn, .toggle-btn')) return;

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
        const targetRow = [this.rows[1], this.rows[2]].find(row => {
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
            const row = this.dropIndicator.parentNode.id === 'rack-row-1' ? 1 : 2;
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
        Object.entries(params).forEach(([param, value]) => {
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
            const toggle = this.document.querySelector(`.toggle-btn[data-module="${moduleId}"][data-param="${param}"]`);
            if (toggle) toggle.classList.toggle('active', value === 1 || value === true);
            const recordButton = this.document.querySelector(`.loop-record-button[data-module="${moduleId}"][data-param="${param}"]`);
            if (recordButton) recordButton.classList.toggle('recording', value === 1 || value === true);
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
        localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(patches));
    }

    migrateUserPatches() {
        const { patches, changed } = migratePatchCollection(this.getUserPatches(), {
            moduleOrder: DEFAULT_MODULE_ORDER
        });
        if (changed) this.saveUserPatches(patches);
    }

    getPatchList() {
        return { ...FACTORY_PATCHES, ...this.getUserPatches() };
    }

    initPatchBank() {
        this.updatePatchSelect();

        this.document.getElementById('savePatch').addEventListener('click', () => {
            const input = this.document.getElementById('patchName');
            if (this.savePatch(input.value)) {
                this.document.getElementById('patchSelect').value = input.value.trim();
                input.value = '';
            }
        });
        this.document.getElementById('loadPatch').addEventListener('click', () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) this.loadPatch(select.value);
        });
        this.document.getElementById('deletePatch').addEventListener('click', () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) this.deletePatch(select.value);
        });
        this.document.getElementById('patchName').addEventListener('keypress', event => {
            if (event.key === 'Enter') this.document.getElementById('savePatch').click();
        });
        this.document.getElementById('patchSelect').addEventListener('dblclick', () => {
            const select = this.document.getElementById('patchSelect');
            if (select.value) this.loadPatch(select.value);
        });
    }

    savePatch(name) {
        if (!name?.trim()) {
            alert('Please enter a patch name');
            return false;
        }
        const patches = this.getUserPatches();
        const patchName = name.trim();
        patches[patchName] = {
            name: patchName,
            factory: false,
            created: new Date().toISOString(),
            state: this.state.serializePatch()
        };
        this.saveUserPatches(patches);
        this.updatePatchSelect();
        return true;
    }

    loadPatch(name) {
        const patch = this.getPatchList()[name];
        if (!patch) {
            alert('Patch not found');
            return false;
        }
        const normalized = normalizePatch(patch, { moduleOrder: DEFAULT_MODULE_ORDER });
        this.state.loadPatch(normalized, moduleRegistry);
        if (this.audioCtx) {
            this.state.modules.forEach(moduleState => this.createDSP(moduleState));
        }
        this.rerenderRack();
        return true;
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

    copyPatchToClipboard() {
        const json = JSON.stringify(this.state.serializePatch(), null, 4);
        navigator.clipboard.writeText(json).then(() => {
            const btn = this.document.getElementById('copyPatch');
            const oldText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = oldText; }, 1500);
        }).catch(() => alert('Failed to copy to clipboard'));
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
            this.document.querySelectorAll('.knob.midi-learning').forEach(knob => knob.classList.remove('midi-learning'));
        }
    }

    openMidiTool(path) {
        this.document.defaultView?.open(path, '_blank', 'noopener,noreferrer');
    }

    handleKnobMidiLearn(knob, event) {
        if (!this.midiManager?.isLearnMode) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.document.querySelectorAll('.knob.midi-learning').forEach(item => item.classList.remove('midi-learning'));
        knob.classList.add('midi-learning');
        this.midiManager.startLearning({
            element: knob,
            moduleId: knob.dataset.module,
            paramId: knob.dataset.param,
            min: parseFloat(knob.dataset.min),
            max: parseFloat(knob.dataset.max)
        });
        return true;
    }

    updateMidiMappedIndicators() {
        this.document.querySelectorAll('.knob.midi-mapped').forEach(knob => knob.classList.remove('midi-mapped'));
        if (!this.midiManager) return;
        Object.values(this.state.midiMappings || {}).forEach(mapping => {
            const knob = this.document.querySelector(`.knob[data-module="${mapping.moduleId}"][data-param="${mapping.paramId}"]`);
            knob?.classList.add('midi-mapped');
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
