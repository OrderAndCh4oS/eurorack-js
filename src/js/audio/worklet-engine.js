export class AudioWorkletEngine {
    constructor({ audioCtx, registry, onTelemetry = null, onModuleEvent = null, onModuleError = null, onHostError = null } = {}) {
        this.audioCtx = audioCtx;
        this.registry = registry;
        this.onTelemetry = onTelemetry;
        this.onModuleEvent = onModuleEvent;
        this.onModuleError = onModuleError;
        this.onHostError = onHostError;
        this.node = null;
        this.revision = 0;
        this.running = false;
        this.nextRequestId = 1;
        this.pendingRuntimeRequests = new Map();
        this.pendingTopologies = new Map();
        this.loadedPlugins = new Set(['core']);
    }

    async init() {
        if (!this.audioCtx?.audioWorklet?.addModule || typeof AudioWorkletNode !== 'function') {
            throw new Error('AudioWorklet requires a supported browser and secure context');
        }
        await this.audioCtx.audioWorklet.addModule(new URL('./worklet/processor.js', import.meta.url));
        this.node = new AudioWorkletNode(this.audioCtx, 'eurorack-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
        this.node.port.onmessage = event => this.handleMessage(event.data);
        this.node.onprocessorerror = () => {
            const error = new Error('AudioWorklet processor stopped unexpectedly');
            this.rejectPendingTopologies(error);
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
            pending?.resolve(message.revision);
        } else if (message.type === 'host-error') {
            const error = new Error(message.message);
            if (message.revision != null) {
                const pending = this.pendingTopologies.get(message.revision);
                this.pendingTopologies.delete(message.revision);
                pending?.reject(error);
            }
            this.onHostError?.(error);
        }
        else if (message.type === 'runtime-state') {
            const resolve = this.pendingRuntimeRequests.get(message.requestId);
            this.pendingRuntimeRequests.delete(message.requestId);
            resolve?.(message.states);
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
            this.pendingTopologies.set(topology.revision, { resolve, reject });
        });
        this.node.port.postMessage({ type: 'topology', topology, replace });
        return activation;
    }

    setParam(moduleId, param, value) {
        this.node?.port.postMessage({ type: 'param', moduleId, param, value });
    }

    sendMidi(data) {
        this.node?.port.postMessage({ type: 'midi', data: [...data] });
    }

    captureRuntimeStates() {
        if (!this.node) return Promise.resolve({});
        const requestId = this.nextRequestId++;
        return new Promise(resolve => {
            this.pendingRuntimeRequests.set(requestId, resolve);
            this.node.port.postMessage({ type: 'capture-runtime', requestId });
        });
    }

    start() {
        this.running = true;
    }

    stop() {
        this.running = false;
        this.node?.disconnect();
        this.node = null;
        this.rejectPendingTopologies(new Error('AudioWorklet engine stopped before topology activation'));
        this.pendingRuntimeRequests.forEach(resolve => resolve({}));
        this.pendingRuntimeRequests.clear();
    }

    rejectPendingTopologies(error) {
        this.pendingTopologies.forEach(({ reject }) => reject(error));
        this.pendingTopologies.clear();
    }
}

export async function createAudioWorkletEngine(options) {
    return new AudioWorkletEngine(options).init();
}
