import { BUFFER, SAMPLE_RATE } from '../config/constants.js';
import { createAudioWorkletEngine } from '../audio/worklet-engine.js';
import { setNestedValue } from '../utils/nested-access.js';
import { assertModuleParam } from '../rack/module-contract.js';
import { loadCorePlugin, pluginRegistry } from '../rack/registry.js';
import { normalizePatch } from './patch-format.js';
import { RackState } from './rack-state.js';

export class RackHost {
    constructor({
        registry = pluginRegistry,
        state = new RackState(),
        blockSize = BUFFER,
        sampleRate = SAMPLE_RATE,
        onLedUpdate = null,
        onModuleError = null,
        requestTimeoutMs = 5000,
        audioEngineFactory = createAudioWorkletEngine
    } = {}) {
        this.registry = registry;
        this.state = state;
        this.blockSize = blockSize;
        this.sampleRate = sampleRate;
        this.audioCtx = null;
        this.engine = null;
        this.listeners = new Set();
        this.onLedUpdate = onLedUpdate;
        this.onModuleError = onModuleError;
        this.requestTimeoutMs = requestTimeoutMs;
        this.audioEngineFactory = audioEngineFactory;
        this.services = {};
        this.unsubscribeRegistry = registry.subscribe?.(event => this.emit({ type: 'registry', event })) || null;
        this.unsubscribeUsage = registry.addUsageResolver?.(() => (
            [...this.state.modules.values()].map(moduleState => moduleState.type)
        )) || null;
    }

    async init() {
        if (this.registry === pluginRegistry) await loadCorePlugin();
        this.state.modules.forEach(moduleState => this.createDSP(moduleState));
        return this;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(event) {
        this.listeners.forEach(listener => listener(event));
    }

    setService(name, value) {
        this.services[name] = value;
    }

    createDSP(moduleState) {
        if (moduleState.instance) return moduleState.instance;
        const definition = this.registry.get(moduleState.type);
        if (!definition) throw new Error(`Module type "${moduleState.type}" is not registered`);
        const dsp = definition.createDSP({
            sampleRate: this.audioCtx?.sampleRate || this.sampleRate,
            bufferSize: this.blockSize,
            blockSize: this.blockSize,
            audioCtx: null,
            services: this.services
        });
        Object.entries(moduleState.params).forEach(([param, value]) => setNestedValue(dsp.params, param, value));
        if (moduleState.runtimeState && definition.restoreRuntimeState) {
            definition.restoreRuntimeState(dsp, moduleState.runtimeState);
        }
        moduleState.instance = dsp;
        return dsp;
    }

    disposeDSP(moduleState, { captureRuntimeState = false } = {}) {
        if (!moduleState?.instance) return;
        const definition = this.registry.get(moduleState.type);
        if (captureRuntimeState && definition?.captureRuntimeState) {
            moduleState.runtimeState = definition.captureRuntimeState(moduleState.instance);
        }
        moduleState.instance.dispose?.();
        moduleState.instance = null;
    }

    addModule(type, options = {}) {
        const moduleState = this.state.addModule(type, this.registry, options);
        this.createDSP(moduleState);
        this.syncTopology();
        this.emit({ type: 'module-added', moduleId: moduleState.id });
        return moduleState;
    }

    removeModule(moduleId) {
        const moduleState = this.state.getModule(moduleId);
        if (!moduleState) return null;
        this.disposeDSP(moduleState);
        const removed = this.state.removeModule(moduleId);
        this.syncTopology();
        this.emit({ type: 'module-removed', moduleId });
        return removed;
    }

    connect(connection) {
        const cable = this.state.connect(connection, { registry: this.registry });
        if (!cable) return null;
        this.syncTopology();
        this.emit({ type: 'cables-changed' });
        return cable;
    }

    moveCable(cable, connection) {
        const moved = this.state.moveCable(cable, connection, { registry: this.registry });
        if (!moved) return null;
        this.syncTopology();
        this.emit({ type: 'cables-changed' });
        return moved;
    }

    disconnect(cable) {
        const removed = this.state.removeCable(cable);
        if (removed) {
            this.syncTopology();
            this.emit({ type: 'cables-changed' });
        }
        return removed;
    }

    clearCables() {
        this.state.clearCables();
        this.syncTopology();
        this.emit({ type: 'cables-changed' });
    }

    setParam(moduleId, param, value) {
        const moduleState = this.state.getModule(moduleId);
        if (!moduleState) throw new Error(`Module instance "${moduleId}" not found`);
        assertModuleParam(this.registry.get(moduleState.type), param, value);
        if (!this.state.setParam(moduleId, param, value)) return false;
        const dsp = this.state.getModule(moduleId)?.instance;
        if (dsp?.params) setNestedValue(dsp.params, param, value);
        this.engine?.setParam?.(moduleId, param, value);
        this.emit({ type: 'param-changed', moduleId, param, value });
        return true;
    }

    syncTopology({ throwOnError = false } = {}) {
        if (!this.engine) return Promise.resolve();
        const activation = this.engine.setPatchState(this.createRuntimePatchState(), { registry: this.registry });
        if (throwOnError) return activation;
        return activation.catch(error => this.emit({ type: 'audio-error', error }));
    }

    applyTelemetry(telemetry) {
        Object.entries(telemetry || {}).forEach(([moduleId, state]) => {
            const moduleState = this.state.getModule(moduleId);
            const instance = moduleState?.instance;
            if (!instance) return;
            Object.assign(moduleState.params, state.params || {});
            Object.assign(instance.params || {}, state.params || {});
            Object.assign(instance.leds || {}, state.leds || {});
            Object.entries(state.fields || {}).forEach(([name, value]) => {
                instance[name] = value;
            });
            Object.entries(state.methods || {}).forEach(([name, value]) => {
                instance[name] = () => value;
            });
            if (state.history?.reset) {
                const field = state.history.field || 'history';
                if (Array.isArray(instance[field])) instance[field].length = 0;
            }
            if (state.history?.append) {
                const field = state.history.field || 'history';
                if (!Array.isArray(instance[field])) instance[field] = [];
                instance[field].push(state.history.append);
                const limit = Math.max(1, state.history.limit || 1);
                while (instance[field].length > limit) instance[field].shift();
            }
        });
        this.onLedUpdate?.(Object.fromEntries(
            Object.entries(telemetry || {}).map(([id, state]) => [id, state.leds || {}])
        ));
    }

    async startAudio(audioCtx) {
        if (this.engine) return this.engine;
        this.audioCtx = audioCtx;
        this.sampleRate = audioCtx.sampleRate;
        try {
            this.engine = await this.audioEngineFactory({
                audioCtx,
                registry: this.registry,
                onTelemetry: telemetry => this.applyTelemetry(telemetry),
                onModuleEvent: ({ moduleId, event }) => {
                    const moduleState = this.state.getModule(moduleId);
                    const definition = moduleState ? this.registry.get(moduleState.type) : null;
                    definition?.handleWorkletEvent?.(event, { moduleId, instance: moduleState?.instance });
                    this.emit({ type: 'module-event', moduleId, event });
                },
                onModuleError: diagnostic => {
                    this.onModuleError?.(diagnostic);
                    this.emit({ type: 'module-error', diagnostic });
                },
                onHostError: error => this.emit({ type: 'audio-error', error }),
                requestTimeoutMs: this.requestTimeoutMs
            });
            await this.engine.setPatchState(this.createRuntimePatchState(), { registry: this.registry, replace: true });
        } catch (error) {
            this.engine?.stop();
            this.engine = null;
            this.audioCtx = null;
            throw error;
        }
        this.engine.start();
        this.emit({ type: 'audio-started' });
        return this.engine;
    }

    async stopAudio() {
        let runtimeStates = {};
        try {
            runtimeStates = await this.engine?.captureRuntimeStates?.() || {};
        } catch (error) {
            this.emit({ type: 'audio-error', error });
        }
        Object.entries(runtimeStates).forEach(([moduleId, state]) => {
            const moduleState = this.state.getModule(moduleId);
            if (moduleState) moduleState.runtimeState = state;
        });
        this.engine?.stop();
        this.engine = null;
        const context = this.audioCtx;
        this.audioCtx = null;
        this.emit({ type: 'audio-stopped' });
        return context;
    }

    async loadPatch(rawPatch) {
        const normalized = normalizePatch(rawPatch, { registry: this.registry });
        const previous = this.state.serializePatch(this.registry);
        const previousRuntime = new Map([...this.state.modules].map(([id, moduleState]) => [id, moduleState.runtimeState]));

        try {
            this.state.modules.forEach(moduleState => this.disposeDSP(moduleState));
            this.state.loadPatch(normalized, this.registry);
            this.state.modules.forEach(moduleState => this.createDSP(moduleState));
            await this.syncTopology({ throwOnError: true });
            this.emit({ type: 'patch-loaded' });
            return normalized;
        } catch (error) {
            this.state.modules.forEach(moduleState => this.disposeDSP(moduleState));
            this.state.loadPatch(previous, this.registry);
            this.state.modules.forEach((moduleState, id) => {
                moduleState.runtimeState = previousRuntime.get(id);
                this.createDSP(moduleState);
            });
            await this.syncTopology({ throwOnError: true });
            throw error;
        }
    }

    serializePatch() {
        return this.state.serializePatch(this.registry);
    }

    createRuntimePatchState() {
        const patch = this.serializePatch();
        patch.modules = patch.modules.map(module => {
            const runtimeState = this.state.getModule(module.id)?.runtimeState;
            return runtimeState === undefined ? module : { ...module, runtimeState };
        });
        return patch;
    }

    getModuleSnapshot(moduleId) {
        const moduleState = this.state.getModule(moduleId);
        if (!moduleState) return null;
        const dsp = moduleState.instance;
        return Object.freeze({
            id: moduleState.id,
            type: moduleState.type,
            row: moduleState.row,
            params: structuredClone(moduleState.params),
            leds: dsp?.leds ? { ...dsp.leds } : {},
            uiState: dsp?.getUiState?.() || null
        });
    }

    async destroy() {
        const context = await this.stopAudio();
        await context?.close?.();
        this.state.modules.forEach(moduleState => this.disposeDSP(moduleState));
        this.unsubscribeRegistry?.();
        this.unsubscribeUsage?.();
        this.listeners.clear();
    }
}

export function createRackHost(options) {
    return new RackHost(options);
}
