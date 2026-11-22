const CORE_WORKLET_GRAPH_REVISION = '20261122-1-5cb380a1';
const MAX_CAPTURE_SECONDS = 10;
const MAX_CAPTURE_SAMPLE_RATE = 192000;
const CAPTURE_TIMEOUT_GRACE_MS = 2000;
const captureError = (code, message) => Object.assign(new Error(message), {code});

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
        this.activeRevision = 0;
        this.running = false;
        this.nextRequestId = 1;
        this.pendingRuntimeRequests = new Map();
        this.pendingProfilingRequests = new Map();
        this.pendingTopologies = new Map();
        this.pendingOutputCapture = null;
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
            this.running = false;
            this.activeRevision = 0;
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
            if (pending) this.activeRevision = message.revision;
            pending?.resolve(message.revision);
        } else if (message.type === 'host-error') {
            const error = new Error(message.message);
            this.cancelOutputCapture(error);
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
        } else if (message.type === 'output-capture' || message.type === 'output-capture-error') {
            const pending = this.pendingOutputCapture;
            if (!pending || pending.requestId !== message.requestId) return;
            if (message.type === 'output-capture-error') {
                this.cancelOutputCapture(captureError(message.code || 'capture-failed', message.message || 'Audio capture failed.'));
                return;
            }
            if (message.revision !== pending.revision || this.activeRevision !== pending.revision || this.revision !== pending.revision) {
                this.cancelOutputCapture(captureError('rack-changed', 'The rack changed during audio capture.'));
                return;
            }
            if (message.frames !== pending.frames || message.sampleRate !== pending.sampleRate ||
                !(message.left instanceof Float32Array) || !(message.right instanceof Float32Array) ||
                message.left.length !== pending.frames || message.right.length !== pending.frames ||
                !Number.isFinite(message.startTimeSeconds) || message.startTimeSeconds < 0) {
                this.cancelOutputCapture(captureError('capture-failed', 'The audio capture reply was incomplete.'));
                return;
            }
            this.pendingOutputCapture = null;
            pending.cleanup();
            pending.resolve({left: message.left, right: message.right, sampleRate: message.sampleRate,
                frames: message.frames, revision: message.revision, startTimeSeconds: message.startTimeSeconds});
        }
    }

    async setPatchState(state, { registry = this.registry, replace = false } = {}) {
        if (!this.node) throw new Error('AudioWorklet engine is not initialized');
        this.cancelOutputCapture(captureError('rack-changed', 'The rack changed during audio capture.'));
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

    /** Capture the actual final stereo output; analysis runs elsewhere, never in the audio callback. */
    async captureOutput({durationSeconds = 5, signal} = {}) {
        if (signal?.aborted) throw new DOMException('Audio capture cancelled.', 'AbortError');
        if (!this.node || !this.running || this.audioCtx?.state !== 'running') {
            throw captureError('audio-not-running', 'Start audio before measuring the rack.');
        }
        const sampleRate = this.audioCtx?.sampleRate;
        const frames = Math.round(sampleRate * durationSeconds);
        if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
            durationSeconds > MAX_CAPTURE_SECONDS || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
            sampleRate > MAX_CAPTURE_SAMPLE_RATE || !Number.isSafeInteger(frames) || frames < 1 ||
            frames > Math.floor(sampleRate * MAX_CAPTURE_SECONDS)) {
            throw captureError('invalid-input', 'Capture between one sample and 10 seconds at a sample rate up to 192 kHz.');
        }
        if (this.pendingOutputCapture) throw captureError('busy', 'An audio capture is already running.');
        if (!this.activeRevision || this.activeRevision !== this.revision || this.pendingTopologies.size) {
            throw captureError('rack-changed', 'Wait for the current rack to finish loading before measuring.');
        }
        const requestId = this.nextRequestId++;
        const revision = this.activeRevision;
        // Allocate outside the realtime thread, then transfer ownership to the processor.
        const left = new Float32Array(frames);
        const right = new Float32Array(frames);
        return new Promise((resolve, reject) => {
            const onAbort = () => this.cancelOutputCapture(new DOMException('Audio capture cancelled.', 'AbortError'));
            const onStateChange = () => {
                if (this.audioCtx?.state !== 'running') {
                    this.cancelOutputCapture(captureError('audio-not-running', 'Audio stopped during capture.'));
                }
            };
            const timer = setTimeout(() => this.cancelOutputCapture(captureError('capture-timeout', 'Audio capture timed out.')),
                Math.ceil(frames / sampleRate * 1000) + CAPTURE_TIMEOUT_GRACE_MS);
            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                this.audioCtx?.removeEventListener?.('statechange', onStateChange);
            };
            this.pendingOutputCapture = {requestId, revision, sampleRate, frames, resolve, reject, cleanup};
            signal?.addEventListener('abort', onAbort, {once: true});
            this.audioCtx.addEventListener?.('statechange', onStateChange);
            if (signal?.aborted) { onAbort(); return; }
            try {
                this.node.port.postMessage({type: 'capture-output', requestId, revision, frames, left, right}, [left.buffer, right.buffer]);
            } catch (error) {
                this.cancelOutputCapture(error);
            }
        });
    }

    cancelOutputCapture(error = captureError('capture-failed', 'Audio capture cancelled.')) {
        const pending = this.pendingOutputCapture;
        if (!pending) return;
        this.pendingOutputCapture = null;
        pending.cleanup();
        // A stopped/crashed port can reject messages; cleanup and promise rejection must still complete.
        try { this.node?.port.postMessage({type: 'cancel-output-capture', requestId: pending.requestId}); } catch {}
        pending.reject(error);
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
        this.rejectPendingRequests(captureError('audio-not-running', 'AudioWorklet engine stopped before request completion'));
        this.node?.disconnect();
        this.node = null;
        this.activeRevision = 0;
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
        this.cancelOutputCapture(error);
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
