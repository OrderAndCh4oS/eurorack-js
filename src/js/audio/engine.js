/**
 * Audio Engine - block DSP scheduling over an atomically compiled patch graph.
 */

import { BUFFER, SAMPLE_RATE } from '../config/constants.js';
import { MODULE_ORDER } from '../rack/module-manifest.js';
import { getModulePorts } from '../rack/module-contract.js';
import { getNestedValue } from '../utils/nested-access.js';
import { compileGraph } from './graph.js';

function compareByTypeOrder(modules, a, b) {
    const indexes = new Map(MODULE_ORDER.map((type, index) => [type, index]));
    const aIndex = indexes.get(modules[a]?.type || a) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = indexes.get(modules[b]?.type || b) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
}

/**
 * Compute deterministic processing order without instantiating a graph.
 * Graph compilation uses the same type-based priority and additionally gives
 * every feedback edge an explicit block delay.
 */
export function computeProcessOrder(modules, cables) {
    const moduleIds = Object.keys(modules);
    const adjacency = new Map(moduleIds.map(id => [id, new Set()]));
    const inDegree = new Map(moduleIds.map(id => [id, 0]));

    cables.forEach(cable => {
        if (cable.fromModule === cable.toModule) return;
        if (!adjacency.has(cable.fromModule) || !adjacency.has(cable.toModule)) return;
        if (adjacency.get(cable.fromModule).has(cable.toModule)) return;
        adjacency.get(cable.fromModule).add(cable.toModule);
        inDegree.set(cable.toModule, inDegree.get(cable.toModule) + 1);
    });

    const queue = moduleIds
        .filter(id => inDegree.get(id) === 0)
        .sort((a, b) => compareByTypeOrder(modules, a, b));
    const result = [];
    while (queue.length) {
        const current = queue.shift();
        result.push(current);
        for (const next of adjacency.get(current)) {
            inDegree.set(next, inDegree.get(next) - 1);
            if (inDegree.get(next) === 0) queue.push(next);
        }
        queue.sort((a, b) => compareByTypeOrder(modules, a, b));
    }

    const visited = new Set(result);
    result.push(...moduleIds.filter(id => !visited.has(id)).sort((a, b) => compareByTypeOrder(modules, a, b)));
    return result;
}

function createCompatibilityDefinition(module) {
    const inputs = Object.keys(module.instance?.inputs || {}).map(port => ({
        id: port,
        port,
        signal: 'any',
        voltage: {
            min: -10,
            max: 10,
            normal: module.instance.inputs[port] instanceof Float32Array
                ? module.instance.inputs[port][0]
                : 0
        }
    }));
    const outputs = Object.keys(module.instance?.outputs || {}).map(port => ({
        id: port,
        port,
        signal: 'any',
        voltage: { min: -10, max: 10 }
    }));
    return { id: module.type || 'test', ui: { inputs, outputs } };
}

function prepareModules(moduleMap) {
    const orderByType = new Map(MODULE_ORDER.map((type, index) => [type, index]));
    return Object.fromEntries(Object.entries(moduleMap).map(([id, module], rackOrder) => [id, {
        ...module,
        def: module.def || createCompatibilityDefinition(module),
        order: orderByType.get(module.type) ?? Number.MAX_SAFE_INTEGER,
        rackOrder
    }]));
}

function restoreInputNormal(module, portName) {
    const port = getModulePorts(module.def, 'input').find(candidate => candidate.port === portName);
    const buffer = getNestedValue(module.instance?.inputs, portName);
    if (buffer instanceof Float32Array && port) buffer.fill(port.voltage.normal);
    module.instance?.onInputDisconnected?.(portName);
}

function getDisconnectedInputs(previousCables, nextCables) {
    const next = new Set(nextCables.map(cable => `${cable.toModule}\u0000${cable.toPort}`));
    return previousCables.filter(cable => !next.has(`${cable.toModule}\u0000${cable.toPort}`));
}

export function createAudioEngine({
    modules = {},
    cables = [],
    audioCtx = null,
    sampleRate = audioCtx?.sampleRate || SAMPLE_RATE,
    blockSize = BUFFER,
    onLedUpdate = null,
    onModuleError = null
} = {}) {
    let isRunning = false;
    let nextTime = 0;
    let timeoutId = null;
    let bufferDuration = blockSize / sampleRate;
    let preparedModules = prepareModules(modules);
    let activeCables = [...cables];
    let graph = compileGraph({ modules: preparedModules, cables: activeCables, blockSize });
    const disabledModules = new Map();

    function zeroModuleOutputs(module) {
        getModulePorts(module.def, 'output').forEach(port => {
            const output = getNestedValue(module.instance?.outputs, port.port);
            if (output instanceof Float32Array) output.fill(0);
        });
    }

    function collectLedStates() {
        const ledStates = {};
        Object.entries(preparedModules).forEach(([id, module]) => {
            if (module.instance?.leds) ledStates[id] = { ...module.instance.leds };
        });
        return ledStates;
    }

    function activateTopology(nextModules, nextCables) {
        const nextPrepared = prepareModules(nextModules);
        const nextGraph = compileGraph({ modules: nextPrepared, cables: nextCables, blockSize });
        const disconnected = getDisconnectedInputs(activeCables, nextCables);

        preparedModules = nextPrepared;
        activeCables = [...nextCables];
        graph = nextGraph;
        disconnected.forEach(cable => {
            const module = preparedModules[cable.toModule];
            if (module) restoreInputNormal(module, cable.toPort);
        });

        for (const id of disabledModules.keys()) {
            if (!preparedModules[id]) disabledModules.delete(id);
        }
    }

    function processBuffer() {
        for (const id of graph.processOrder) {
            const module = preparedModules[id];
            if (!module?.instance) continue;
            graph.route(id);
            if (disabledModules.has(id)) {
                zeroModuleOutputs(module);
                continue;
            }

            try {
                if (module.def.role === 'audio-output' || module.type === 'out') {
                    module.instance.process(nextTime);
                } else {
                    module.instance.process({ time: nextTime, sampleRate, blockSize });
                }
            } catch (error) {
                disabledModules.set(id, error);
                zeroModuleOutputs(module);
                onModuleError?.({ moduleId: id, type: module.type, error });
            }
        }
        graph.commitFeedback();
        nextTime += bufferDuration;
    }

    function processAudio() {
        if (!isRunning || !audioCtx) return;

        if (nextTime < audioCtx.currentTime - bufferDuration) {
            nextTime = audioCtx.currentTime;
        }
        while (nextTime < audioCtx.currentTime + 0.1) processBuffer();
        onLedUpdate?.(collectLedStates());
        timeoutId = setTimeout(processAudio, 20);
    }

    return {
        start() {
            if (isRunning) return;
            if (!audioCtx) throw new Error('AudioContext required to start engine');
            isRunning = true;
            nextTime = audioCtx.currentTime;
            processAudio();
        },

        stop() {
            isRunning = false;
            if (timeoutId !== null) clearTimeout(timeoutId);
            timeoutId = null;
        },

        get running() {
            return isRunning;
        },

        setTopology(nextModules, nextCables) {
            activateTopology(nextModules, nextCables);
        },

        setModules(nextModules) {
            const validCables = activeCables.filter(cable => nextModules[cable.fromModule] && nextModules[cable.toModule]);
            activateTopology(nextModules, validCables);
        },

        setCables(nextCables) {
            activateTopology(Object.fromEntries(Object.entries(preparedModules).map(([id, module]) => [id, module])), nextCables);
        },

        setAudioContext(ctx) {
            audioCtx = ctx;
            sampleRate = ctx?.sampleRate || SAMPLE_RATE;
            bufferDuration = blockSize / sampleRate;
        },

        tick() {
            if (audioCtx) nextTime = audioCtx.currentTime;
            processBuffer();
            return collectLedStates();
        },

        routeSignals(moduleId) {
            graph.route(moduleId);
        },

        retryModule(moduleId) {
            return disabledModules.delete(moduleId);
        },

        getModuleError(moduleId) {
            return disabledModules.get(moduleId) || null;
        },

        get processOrder() {
            return [...graph.processOrder];
        }
    };
}

export function createMockAudioContext() {
    let time = 0;
    return {
        get currentTime() {
            return time;
        },
        advanceTime(seconds) {
            time += seconds;
        },
        sampleRate: SAMPLE_RATE,
        destination: {}
    };
}
