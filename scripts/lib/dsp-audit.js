import { getNestedValue } from '../../src/js/utils/nested-access.js';
import { getModulePorts } from '../../src/js/rack/module-contract.js';

export const AUDIT_SAMPLE_RATES = Object.freeze([44100, 48000, 96000]);
export const AUDIT_BLOCK_SIZES = Object.freeze([128, 512]);

export function createSeededRandom(seed = 0x6d2b79f5) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function withSeededRandom(callback, seed = 0x6d2b79f5) {
    const original = Math.random;
    Math.random = createSeededRandom(seed);
    try {
        return callback();
    } finally {
        Math.random = original;
    }
}

export function createAuditMidiService() {
    const seededNotes = [
        { type: 'noteOn', note: 36, velocity: 112, channel: 9, sampleOffset: 0 },
        { type: 'noteOn', note: 60, velocity: 96, channel: 0, sampleOffset: 8 },
        { type: 'noteOn', note: 64, velocity: 88, channel: 0, sampleOffset: 24 },
        { type: 'noteOn', note: 67, velocity: 80, channel: 0, sampleOffset: 40 }
    ];
    const seededClocks = [
        { type: 'start', sampleOffset: 0 },
        ...Array.from({ length: 24 }, (_, index) => ({ type: 'clock', sampleOffset: index * 4 }))
    ];
    let noteEvents = [];
    let clockEvents = [];
    let firstBlock = true;
    return {
        beginBlock() {
            noteEvents = firstBlock ? seededNotes : [];
            clockEvents = firstBlock ? seededClocks : [];
            firstBlock = false;
        },
        getNoteEvents(channel) {
            return channel === undefined || channel === null
                ? noteEvents
                : noteEvents.filter(event => event.channel === undefined || event.channel === channel);
        },
        getClockEvents() {
            return clockEvents;
        },
        endBlock() {
            noteEvents = [];
            clockEvents = [];
        },
        getCCValue: () => 96,
        getPitchBend: () => 2048,
        getModWheel: () => 80
    };
}

function signalValue(signal, absoluteIndex, sampleRate, voltage) {
    const min = voltage.min;
    const max = voltage.max;
    const span = max - min;
    if (signal === 'gate') return absoluteIndex % 512 < 256 ? max : min;
    if (signal === 'trigger') {
        return absoluteIndex % 512 < Math.max(1, Math.round(sampleRate * 0.005)) ? max : min;
    }
    if (signal === 'cv') return min + span * ((absoluteIndex % 2048) / 2047);
    const amplitude = Math.min(5, Math.max(Math.abs(min), Math.abs(max)));
    return Math.sin(2 * Math.PI * 220 * absoluteIndex / sampleRate) * amplitude;
}

export function fillAuditInputs(definition, dsp, { sampleRate, blockSize, blockIndex = 0 }) {
    getModulePorts(definition, 'input').forEach(port => {
        const buffer = getNestedValue(dsp.inputs, port.port);
        for (let index = 0; index < blockSize; index += 1) {
            const absoluteIndex = blockIndex * blockSize + index;
            buffer[index] = signalValue(port.signal, absoluteIndex, sampleRate, port.voltage);
        }
    });
}

function fftPower(samples) {
    let size = 1;
    while (size * 2 <= samples.length) size *= 2;
    if (size < 8) return [];
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let index = 0; index < size; index += 1) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1));
        real[index] = samples[index] * window;
    }
    for (let index = 1, reverse = 0; index < size; index += 1) {
        let bit = size >> 1;
        for (; reverse & bit; bit >>= 1) reverse ^= bit;
        reverse ^= bit;
        if (index < reverse) {
            [real[index], real[reverse]] = [real[reverse], real[index]];
            [imag[index], imag[reverse]] = [imag[reverse], imag[index]];
        }
    }
    for (let length = 2; length <= size; length *= 2) {
        const angle = -2 * Math.PI / length;
        const stepReal = Math.cos(angle);
        const stepImag = Math.sin(angle);
        for (let start = 0; start < size; start += length) {
            let twiddleReal = 1;
            let twiddleImag = 0;
            for (let offset = 0; offset < length / 2; offset += 1) {
                const even = start + offset;
                const odd = even + length / 2;
                const oddReal = real[odd] * twiddleReal - imag[odd] * twiddleImag;
                const oddImag = real[odd] * twiddleImag + imag[odd] * twiddleReal;
                real[odd] = real[even] - oddReal;
                imag[odd] = imag[even] - oddImag;
                real[even] += oddReal;
                imag[even] += oddImag;
                const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
                twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
                twiddleReal = nextReal;
            }
        }
    }
    return Array.from({ length: size / 2 }, (_, index) => (
        real[index] * real[index] + imag[index] * imag[index]
    ));
}

export function measureSignal(samples, sampleRate) {
    if (!samples.length) {
        return {
            samples: 0, finite: true, min: 0, max: 0, peak: 0, rms: 0, dc: 0,
            estimatedFrequency: 0, spectralCentroid: 0, highBandRatio: 0
        };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSquares = 0;
    let crossings = 0;
    let finite = true;
    for (let index = 0; index < samples.length; index += 1) {
        const value = samples[index];
        if (!Number.isFinite(value)) finite = false;
        const safe = Number.isFinite(value) ? value : 0;
        min = Math.min(min, safe);
        max = Math.max(max, safe);
        sum += safe;
        sumSquares += safe * safe;
        if (index > 0 && samples[index - 1] <= 0 && value > 0) crossings += 1;
    }
    const power = fftPower(samples);
    const binHz = power.length ? sampleRate / (power.length * 2) : 0;
    let spectralPower = 0;
    let weightedFrequency = 0;
    let highPower = 0;
    power.forEach((value, index) => {
        spectralPower += value;
        weightedFrequency += value * index * binHz;
        if (index >= power.length * 0.75) highPower += value;
    });
    return {
        samples: samples.length,
        finite,
        min,
        max,
        peak: Math.max(Math.abs(min), Math.abs(max)),
        rms: Math.sqrt(sumSquares / samples.length),
        dc: sum / samples.length,
        estimatedFrequency: crossings * sampleRate / samples.length,
        spectralCentroid: spectralPower ? weightedFrequency / spectralPower : 0,
        highBandRatio: spectralPower ? highPower / spectralPower : 0
    };
}

function controlScenarios(definition) {
    const ui = definition.ui || {};
    const controls = [
        ...(ui.knobs || []).flatMap(control => [
            { name: control.param + ':min', params: { [control.param]: control.min } },
            { name: control.param + ':max', params: { [control.param]: control.max } }
        ]),
        ...(ui.switches || []).flatMap(control => [
            { name: control.param + ':off', params: { [control.param]: 0 } },
            { name: control.param + ':on', params: { [control.param]: 1 } }
        ]),
        ...(ui.buttons || []).flatMap(control => {
            const values = control.values?.length ? control.values : [0, 1];
            return [values[0], values[values.length - 1]].map(value => ({
                name: control.param + ':' + value,
                params: { [control.param]: value }
            }));
        }),
        ...(ui.actions || []).map(control => ({
            name: control.param + ':action',
            params: { [control.param]: 1 }
        }))
    ];
    return [{ name: 'default', params: {} }, ...controls];
}

function createDsp(definition, sampleRate, blockSize) {
    const midiManager = createAuditMidiService();
    const dsp = definition.createDSP({
        sampleRate,
        bufferSize: blockSize,
        blockSize,
        services: { midiManager },
        audioCtx: null
    });
    return { dsp, midiManager };
}

export function auditScenario(definition, {
    sampleRate = 48000,
    blockSize = 128,
    blocks = 8,
    params = {},
    name = 'default',
    seed = 0x6d2b79f5
} = {}) {
    return withSeededRandom(() => {
        const { dsp, midiManager } = createDsp(definition, sampleRate, blockSize);
        Object.assign(dsp.params, params);
        const inputRefs = Object.fromEntries(getModulePorts(definition, 'input').map(port => [
            port.port, getNestedValue(dsp.inputs, port.port)
        ]));
        const outputRefs = Object.fromEntries(getModulePorts(definition, 'output').map(port => [
            port.port, getNestedValue(dsp.outputs, port.port)
        ]));
        const outputPorts = Object.fromEntries(getModulePorts(definition, 'output').map(port => [
            port.port, port
        ]));
        const captures = Object.fromEntries(Object.keys(outputRefs).map(port => [port, []]));
        const started = performance.now();
        let error = null;
        try {
            for (let blockIndex = 0; blockIndex < blocks; blockIndex += 1) {
                fillAuditInputs(definition, dsp, { sampleRate, blockSize, blockIndex });
                midiManager.beginBlock(blockIndex * blockSize / sampleRate, sampleRate, blockSize);
                dsp.process({ time: blockIndex * blockSize / sampleRate, sampleRate, blockSize });
                midiManager.endBlock();
                Object.keys(captures).forEach(port => {
                    captures[port].push(...getNestedValue(dsp.outputs, port));
                });
            }
        } catch (caught) {
            error = caught.message;
        }
        const elapsedMs = performance.now() - started;
        const stableInputs = Object.entries(inputRefs).every(([port, buffer]) => (
            getNestedValue(dsp.inputs, port) === buffer
        ));
        const stableOutputs = Object.entries(outputRefs).every(([port, buffer]) => (
            getNestedValue(dsp.outputs, port) === buffer
        ));
        let reset = null;
        if (typeof dsp.reset === 'function') {
            try {
                dsp.reset();
                const peaks = Object.keys(outputRefs).map(port => {
                    let peak = 0;
                    getNestedValue(dsp.outputs, port).forEach(value => {
                        peak = Math.max(peak, Math.abs(value));
                    });
                    return peak;
                });
                reset = {
                    finite: Object.keys(outputRefs).every(port => (
                        getNestedValue(dsp.outputs, port).every(Number.isFinite)
                    )),
                    peak: Math.max(0, ...peaks)
                };
            } catch (caught) {
                reset = { finite: false, peak: null, error: caught.message };
            }
        }
        dsp.dispose?.();
        return {
            name,
            params,
            error,
            stableInputs,
            stableOutputs,
            elapsedMs,
            microsecondsPerBlock: blocks ? elapsedMs * 1000 / blocks : 0,
            reset,
            outputs: Object.fromEntries(Object.entries(captures).map(([port, values]) => {
                const measurement = measureSignal(values, sampleRate);
                const contract = outputPorts[port];
                const voltage = contract.voltage;
                return [port, {
                    ...measurement,
                    signal: contract.signal,
                    voltage,
                    voltageCompliant: measurement.min >= voltage.min - 1e-4 &&
                        measurement.max <= voltage.max + 1e-4
                }];
            }))
        };
    }, seed);
}

export function auditDefinition(definition, options = {}) {
    return {
        id: definition.id,
        name: definition.name,
        category: definition.category,
        sampleRate: options.sampleRate || 48000,
        blockSize: options.blockSize || 128,
        scenarios: controlScenarios(definition).map(scenario => auditScenario(definition, {
            ...options,
            ...scenario
        }))
    };
}

export function summarizeAudit(result) {
    const outputs = result.scenarios.flatMap(scenario => Object.values(scenario.outputs));
    return {
        id: result.id,
        category: result.category,
        scenarios: result.scenarios.length,
        errors: result.scenarios.filter(scenario => scenario.error).map(scenario => scenario.error),
        finite: outputs.every(output => output.finite),
        voltageCompliant: outputs.every(output => output.voltageCompliant),
        stableBuffers: result.scenarios.every(scenario => scenario.stableInputs && scenario.stableOutputs),
        voltageViolations: result.scenarios.flatMap(scenario => Object.entries(scenario.outputs)
            .filter(([, output]) => !output.voltageCompliant)
            .map(([port, output]) => ({
                scenario: scenario.name,
                port,
                signal: output.signal,
                measured: { min: output.min, max: output.max },
                expected: output.voltage
            }))),
        peak: outputs.reduce((peak, output) => Math.max(peak, output.peak), 0),
        maxMicrosecondsPerBlock: result.scenarios.reduce((peak, scenario) => (
            Math.max(peak, scenario.microsecondsPerBlock)
        ), 0)
    };
}
