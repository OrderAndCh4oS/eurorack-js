const CORE_WORKLET_GRAPH_REVISION = '20260713-1';

export class AudioWorkletEngine {
    constructor({
        audioCtx,
        registry,
        onTelemetry = null,
        onModuleEvent = null,
        onModuleError = null,
        onHostError = null,
        requestTimeoutMs = 5000
    } = {}) {
        this.audioCtx = audioCtx;
        this.registry = registry;
        this.onTelemetry = onTelemetry;
        this.onModuleEvent = onModuleEvent;
        this.onModuleError = onModuleError;
        this.onHostError = onHostError;
        this.requestTimeoutMs = requestTimeoutMs;
        this.node = null;
        this.revision = 0;
        this.running = false;
        this.nextRequestId = 1;
        this.pendingRuntimeRequests = new Map();
        this.pendingProfilingRequests = new Map();
        this.pendingTopologies = new Map();
        this.loadedPlugins = new Set(['core']);
    }

    async init() {
        if (!this.audioCtx?.audioWorklet?.addModule || typeof AudioWorkletNode !== 'function') {
            throw new Error('AudioWorklet requires a supported browser and secure context');
        }
        const processorUrl = new URL('./worklet/processor.js', import.meta.url);
        processorUrl.searchParams.set('core', CORE_WORKLET_GRAPH_REVISION);
        await this.audioCtx.audioWorklet.addModule(processorUrl);
        this.node = new AudioWorkletNode(this.audioCtx, 'eurorack-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
        this.node.port.onmessage = event => this.handleMessage(event.data);
        this.node.onprocessorerror = () => {
            const error = new Error('AudioWorklet processor stopped unexpectedly');
            this.rejectPendingRequests(error);
            this.onHostError?.(error);
        };
        this.node.connect(this.audioCtx.destination);
        return this;
    }

    async ensurePluginLoaded(pluginId) {
        if (this.loadedPlugins.has(pluginId)) return;
        const record = this.registry.getPlugin(pluginId);
        if (!record) throw new Error(`Plugin "${pluginId}" is not registered`);
        if (!record.manifest.workletUrl) throw new Error(`Plugin "${pluginId}" does not provide a workletUrl`);
        await this.audioCtx.audioWorklet.addModule(record.manifest.workletUrl);
        this.loadedPlugins.add(pluginId);
    }

    handleMessage(message) {
        if (message.type === 'telemetry') this.onTelemetry?.(message.modules);
        else if (message.type === 'module-event') this.onModuleEvent?.({ moduleId: message.moduleId, event: message.event });
        else if (message.type === 'module-error') this.onModuleError?.({ moduleId: message.moduleId, error: new Error(message.message) });
        else if (message.type === 'topology-active') {
            const pending = this.pendingTopologies.get(message.revision);
            this.pendingTopologies.delete(message.revision);
            clearTimeout(pending?.timer);
            pending?.resolve(message.revision);
        } else if (message.type === 'host-error') {
            const error = new Error(message.message);
            if (message.revision != null) {
                const pending = this.pendingTopologies.get(message.revision);
                this.pendingTopologies.delete(message.revision);
                clearTimeout(pending?.timer);
                pending?.reject(error);
            }
            this.onHostError?.(error);
        }
        else if (message.type === 'runtime-state') {
            const pending = this.pendingRuntimeRequests.get(message.requestId);
            this.pendingRuntimeRequests.delete(message.requestId);
            clearTimeout(pending?.timer);
            pending?.resolve(message.states);
        } else if (message.type === 'profiling-report') {
            const pending = this.pendingProfilingRequests.get(message.requestId);
            this.pendingProfilingRequests.delete(message.requestId);
            clearTimeout(pending?.timer);
            pending?.resolve(message.report);
        }
    }

    async setPatchState(state, { registry = this.registry, replace = false } = {}) {
        if (!this.node) throw new Error('AudioWorklet engine is not initialized');
        await Promise.all(Object.keys(state.plugins || {}).map(pluginId => this.ensurePluginLoaded(pluginId)));
        const orderByType = type => registry.getModuleOrder(type);
        let rackOrder = 0;
        const params = state.params || {};
        const topology = {
            revision: ++this.revision,
            plugins: { ...(state.plugins || {}) },
            modules: state.modules.map(module => ({
                ...module,
                pluginId: registry.getPluginForModule(module.type),
                params: params[module.id] || {},
                order: orderByType(module.type),
                rackOrder: rackOrder++
            })),
            cables: state.cables.map(cable => ({ ...cable }))
        };
        const activation = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingTopologies.delete(topology.revision);
                reject(new Error(`Timed out waiting for AudioWorklet topology revision ${topology.revision}`));
            }, this.requestTimeoutMs);
            this.pendingTopologies.set(topology.revision, { resolve, reject, timer });
        });
        this.node.port.postMessage({ type: 'topology', topology, replace });
        return activation;
    }

    setParam(moduleId, param, value) {
        this.node?.port.postMessage({ type: 'param', moduleId, param, value });
    }

    sendMidi(data, receivedTime = globalThis.performance?.now?.() ?? 0) {
        const now = globalThis.performance?.now?.() ?? receivedTime;
        const contextTime = Number.isFinite(this.audioCtx?.currentTime) ? this.audioCtx.currentTime : 0;
        const audioTime = contextTime + (receivedTime - now) / 1000;
        this.node?.port.postMessage({ type: 'midi', data: [...data], audioTime });
    }

    captureRuntimeStates() {
        if (!this.node) return Promise.resolve({});
        const requestId = this.nextRequestId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRuntimeRequests.delete(requestId);
                reject(new Error(`Timed out waiting for AudioWorklet runtime state request ${requestId}`));
            }, this.requestTimeoutMs);
            this.pendingRuntimeRequests.set(requestId, { resolve, reject, timer });
            this.node.port.postMessage({ type: 'capture-runtime', requestId });
        });
    }

    setProfiling(enabled, { reset = false } = {}) {
        this.node?.port.postMessage({ type: 'profiling', enabled, reset });
    }

    requestProfilingReport() {
        if (!this.node) return Promise.resolve({ deadlineMs: 0, blocks: {}, modules: {} });
        const requestId = this.nextRequestId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingProfilingRequests.delete(requestId);
                reject(new Error(`Timed out waiting for AudioWorklet profiling request ${requestId}`));
            }, this.requestTimeoutMs);
            this.pendingProfilingRequests.set(requestId, { resolve, reject, timer });
            this.node.port.postMessage({ type: 'profiling-report', requestId });
        });
    }

    start() {
        this.running = true;
    }

    stop() {
        this.running = false;
        this.node?.disconnect();
        this.node = null;
        this.rejectPendingRequests(new Error('AudioWorklet engine stopped before request completion'));
    }

    rejectPendingTopologies(error) {
        this.pendingTopologies.forEach(({ reject, timer }) => {
            clearTimeout(timer);
            reject(error);
        });
        this.pendingTopologies.clear();
    }

    rejectPendingRuntimeRequests(error) {
        this.pendingRuntimeRequests.forEach(({ reject, timer }) => {
            clearTimeout(timer);
            reject(error);
        });
        this.pendingRuntimeRequests.clear();
    }

    rejectPendingRequests(error) {
        this.rejectPendingTopologies(error);
        this.rejectPendingRuntimeRequests(error);
        this.pendingProfilingRequests.forEach(({ reject, timer }) => {
            clearTimeout(timer);
            reject(error);
        });
        this.pendingProfilingRequests.clear();
    }
}

export async function createAudioWorkletEngine(options) {
    return new AudioWorkletEngine(options).init();
}
