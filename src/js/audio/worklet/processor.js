import './core-plugin.js';
import { compileGraph } from '../graph.js';
import { getModulePort, getModulePorts } from '../../rack/module-contract.js';
import { getNestedValue, setNestedValue } from '../../utils/nested-access.js';
import { getWorkletModule, getWorkletPlugin } from './plugin-registry.js';

function createMidiService() {
    const notes = [];
    const clocks = [];
    const cc = new Map();
    const bends = new Map();
    const modWheel = new Map();
    return {
        push(data) {
            const [status, data1 = 0, data2 = 0] = data;
            const type = status & 0xf0;
            const channel = status & 0x0f;
            if (type === 0x80 || (type === 0x90 && data2 === 0)) notes.push({ type: 'noteOff', channel, note: data1, velocity: 0 });
            else if (type === 0x90) notes.push({ type: 'noteOn', channel, note: data1, velocity: data2 });
            else if (type === 0xb0) {
                cc.set(`${channel}:${data1}`, data2);
                if (data1 === 1) modWheel.set(channel, data2);
            } else if (type === 0xe0) bends.set(channel, ((data2 << 7) | data1) - 8192);
            else if (status === 0xf8) clocks.push({ type: 'clock' });
            else if (status === 0xfa) clocks.push({ type: 'start' });
            else if (status === 0xfb) clocks.push({ type: 'continue' });
            else if (status === 0xfc) clocks.push({ type: 'stop' });
        },
        consumeNoteEvents(channel = null) {
            const selected = channel === null ? [...notes] : notes.filter(event => event.channel === channel);
            for (let index = notes.length - 1; index >= 0; index -= 1) {
                if (channel === null || notes[index].channel === channel) notes.splice(index, 1);
            }
            return selected;
        },
        consumeClockEvents() {
            return clocks.splice(0);
        },
        getCCValue(channel, number) {
            return cc.get(`${channel}:${number}`) || 0;
        },
        getPitchBend(channel) {
            return bends.get(channel) || 0;
        },
        getModWheel(channel) {
            return modWheel.get(channel) || 0;
        }
    };
}

function collectUiState(instance, definition) {
    const fields = {};
    const fieldNames = definition.telemetry?.fields || [];
    fieldNames.forEach(name => {
        if (instance[name] !== undefined) fields[name] = instance[name];
    });
    const methods = {};
    const methodNames = definition.telemetry?.methods || [];
    methodNames.forEach(name => {
        if (typeof instance[name] === 'function') {
            try {
                methods[name] = instance[name]();
            } catch {
                // UI telemetry must never interrupt audio processing.
            }
        }
    });
    return { params: { ...(instance.params || {}) }, leds: { ...(instance.leds || {}) }, fields, methods };
}

function collectTransferables(value, transferables = new Set()) {
    if (value instanceof ArrayBuffer) transferables.add(value);
    else if (ArrayBuffer.isView(value)) transferables.add(value.buffer);
    else if (Array.isArray(value)) value.forEach(item => collectTransferables(item, transferables));
    else if (value && typeof value === 'object') {
        Object.values(value).forEach(item => collectTransferables(item, transferables));
    }
    return [...transferables];
}

class EurorackProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.blockSize = 128;
        this.modules = {};
        this.graph = compileGraph({ modules: {}, cables: [], blockSize: this.blockSize });
        this.lastTopology = null;
        this.disabled = new Set();
        this.midi = createMidiService();
        this.telemetryFrames = 0;
        this.lastHistorySnapshots = new Map();
        this.port.onmessage = event => this.handleMessage(event.data);
    }

    createModule(specification) {
        const registered = getWorkletModule(specification.type);
        if (!registered) throw new Error(`Worklet module type "${specification.type}" is not registered`);
        if (registered.plugin.id !== specification.pluginId) {
            throw new Error(`Worklet module "${specification.type}" belongs to plugin "${registered.plugin.id}", not "${specification.pluginId}"`);
        }
        const definition = registered.definition;
        const instance = definition.createDSP({
            sampleRate,
            bufferSize: this.blockSize,
            blockSize: this.blockSize,
            services: { midiManager: this.midi },
            audioCtx: null
        });
        instance.midiManager = this.midi;
        Object.entries(specification.params || {}).forEach(([param, value]) => setNestedValue(instance.params, param, value));
        if (specification.runtimeState && definition.restoreRuntimeState) {
            definition.restoreRuntimeState(instance, specification.runtimeState);
        }
        return {
            instance,
            type: specification.type,
            pluginId: specification.pluginId,
            def: definition,
            order: specification.order,
            rackOrder: specification.rackOrder
        };
    }

    activateTopology(topology, { replace = false } = {}) {
        Object.entries(topology.plugins || {}).forEach(([pluginId, patchVersion]) => {
            const plugin = getWorkletPlugin(pluginId);
            if (!plugin) throw new Error(`Worklet plugin "${pluginId}" is not registered`);
            if (plugin.patchVersion !== patchVersion) {
                throw new Error(`Worklet plugin "${pluginId}" patch contract is ${plugin.patchVersion}; expected ${patchVersion}`);
            }
        });
        const nextModules = {};
        const createdModules = [];
        let nextGraph;
        try {
            topology.modules.forEach(specification => {
                const existing = !replace &&
                    this.modules[specification.id]?.type === specification.type &&
                    this.modules[specification.id]?.pluginId === specification.pluginId
                    ? this.modules[specification.id]
                    : null;
                const module = existing
                    ? { ...existing, order: specification.order, rackOrder: specification.rackOrder }
                    : this.createModule(specification);
                if (!existing) createdModules.push(module);
                nextModules[specification.id] = module;
            });
            nextGraph = compileGraph({ modules: nextModules, cables: topology.cables, blockSize: this.blockSize });
        } catch (error) {
            createdModules.forEach(module => module.instance.dispose?.());
            throw error;
        }
        topology.modules.forEach(specification => {
            const module = nextModules[specification.id];
            Object.entries(specification.params || {}).forEach(([param, value]) => setNestedValue(module.instance.params, param, value));
        });
        const nextInputs = new Set(topology.cables.map(cable => `${cable.toModule}\u0000${cable.toPort}`));
        (this.lastTopology?.cables || []).forEach(cable => {
            if (nextInputs.has(`${cable.toModule}\u0000${cable.toPort}`)) return;
            const module = nextModules[cable.toModule];
            const port = module ? getModulePort(module.def, 'input', cable.toPort) : null;
            const input = module ? getNestedValue(module.instance.inputs, cable.toPort) : null;
            if (port && input instanceof Float32Array) input.fill(port.voltage.normal);
            module?.instance.onInputDisconnected?.(cable.toPort);
        });
        Object.entries(this.modules).forEach(([id, module]) => {
            if (!nextModules[id] || nextModules[id].instance !== module.instance) module.instance.dispose?.();
        });
        this.modules = nextModules;
        this.graph = nextGraph;
        this.lastTopology = topology;
        if (replace) this.lastHistorySnapshots.clear();
        for (const id of [...this.lastHistorySnapshots.keys()]) {
            if (!nextModules[id]) this.lastHistorySnapshots.delete(id);
        }
        for (const id of [...this.disabled]) if (!nextModules[id]) this.disabled.delete(id);
        this.port.postMessage({ type: 'topology-active', revision: topology.revision });
    }

    handleMessage(message) {
        try {
            if (message.type === 'topology') this.activateTopology(message.topology, { replace: message.replace });
            else if (message.type === 'param') {
                const module = this.modules[message.moduleId];
                if (module) setNestedValue(module.instance.params, message.param, message.value);
            } else if (message.type === 'midi') this.midi.push(message.data);
            else if (message.type === 'retry') this.disabled.delete(message.moduleId);
            else if (message.type === 'capture-runtime') {
                const states = {};
                Object.entries(this.modules).forEach(([id, module]) => {
                    if (module.def.captureRuntimeState) {
                        states[id] = module.def.captureRuntimeState(module.instance);
                    }
                });
                this.port.postMessage({ type: 'runtime-state', requestId: message.requestId, states });
            }
        } catch (error) {
            this.port.postMessage({ type: 'host-error', message: error.message, revision: message.topology?.revision });
        }
    }

    process(_inputs, outputs) {
        const output = outputs[0];
        const left = output?.[0];
        const right = output?.[1] || left;
        if (!left) return true;
        if (left.length !== this.blockSize && this.lastTopology) {
            this.blockSize = left.length;
            this.activateTopology(this.lastTopology, { replace: true });
        }
        left.fill(0);
        right.fill(0);

        for (const id of this.graph.processOrder) {
            const module = this.modules[id];
            this.graph.route(id);
            if (module.def.role === 'audio-output') continue;
            if (this.disabled.has(id)) {
                getModulePorts(module.def, 'output').forEach(port => getNestedValue(module.instance.outputs, port.port).fill(0));
                continue;
            }
            try {
                module.instance.process({ time: currentTime, sampleRate, blockSize: this.blockSize });
                const events = module.instance.drainEvents?.() || [];
                events.forEach(event => this.port.postMessage({
                    type: 'module-event',
                    moduleId: id,
                    event
                }, collectTransferables(event)));
            } catch (error) {
                this.disabled.add(id);
                getModulePorts(module.def, 'output').forEach(port => getNestedValue(module.instance.outputs, port.port).fill(0));
                this.port.postMessage({ type: 'module-error', moduleId: id, message: error.message });
            }
        }
        this.graph.commitFeedback();

        Object.values(this.modules).forEach(module => {
            if (module.def.role !== 'audio-output') return;
            const volume = module.instance.params.volume ?? 1;
            const sourceLeft = module.instance.inputs.L;
            const sourceRight = module.instance.inputs.R;
            let peakLeft = 0;
            let peakRight = 0;
            for (let index = 0; index < this.blockSize; index += 1) {
                left[index] += sourceLeft[index] * volume / 5;
                right[index] += sourceRight[index] * volume / 5;
                peakLeft = Math.max(peakLeft, Math.abs(sourceLeft[index]));
                peakRight = Math.max(peakRight, Math.abs(sourceRight[index]));
            }
            module.instance.leds.L = peakLeft / 5;
            module.instance.leds.R = peakRight / 5;
        });

        this.telemetryFrames += this.blockSize;
        if (this.telemetryFrames >= sampleRate / 30) {
            this.telemetryFrames = 0;
            const modules = {};
            Object.entries(this.modules).forEach(([id, module]) => {
                const state = collectUiState(module.instance, module.def);
                const historyField = module.def.telemetry?.history?.field;
                const history = historyField ? module.instance[historyField] : null;
                if (Array.isArray(history)) {
                    const latest = history[history.length - 1];
                    if (latest && this.lastHistorySnapshots.get(id) !== latest) {
                        state.history = {
                            field: historyField,
                            append: latest,
                            limit: Math.min(history.length, module.def.telemetry.history.maxEntries)
                        };
                        this.lastHistorySnapshots.set(id, latest);
                    } else if (history.length === 0 && this.lastHistorySnapshots.has(id)) {
                        state.history = { field: historyField, reset: true };
                        this.lastHistorySnapshots.delete(id);
                    }
                }
                modules[id] = state;
            });
            this.port.postMessage({
                type: 'telemetry',
                modules
            });
        }
        return true;
    }
}

registerProcessor('eurorack-processor', EurorackProcessor);
