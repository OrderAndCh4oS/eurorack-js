import { describe, expect, it } from 'vitest';
import probSeqModule from '../../src/js/modules/prob-seq/index.js';

const DEFAULT_STEP = Object.freeze({
    enabled: 1,
    probability: 100,
    ratchets: 1,
    condition: 0
});

function steps(overrides = {}) {
    return Array.from({ length: 8 }, (_, index) => ({
        ...DEFAULT_STEP,
        ...(overrides[index] || {})
    }));
}

function createProbSeq({
    sampleRate = 1000,
    bufferSize = 64,
    params = {}
} = {}) {
    const dsp = probSeqModule.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, params);
    return dsp;
}

function processBlock(dsp, {
    clocks = [],
    resets = [],
    fill = 0,
    probabilityCv = 0
} = {}) {
    dsp.inputs.clock.fill(0);
    dsp.inputs.reset.fill(0);
    dsp.inputs.fill.fill(fill);
    dsp.inputs.probabilityCv.fill(probabilityCv);
    clocks.forEach(sample => {
        dsp.inputs.clock[sample] = 10;
    });
    resets.forEach(sample => {
        dsp.inputs.reset[sample] = 10;
    });
    dsp.process();
    return {
        gate: Array.from(dsp.outputs.gate),
        eoc: Array.from(dsp.outputs.eoc)
    };
}

function clock(dsp, options = {}) {
    return processBlock(dsp, { ...options, clocks: [options.sample ?? 0] });
}

function risingEdges(buffer) {
    const edges = [];
    let high = false;
    buffer.forEach((sample, index) => {
        const nextHigh = sample >= 1;
        if (nextHigh && !high) edges.push(index);
        high = nextHigh;
    });
    return edges;
}

function decisionSequence(seed, count = 12) {
    const dsp = createProbSeq({
        bufferSize: 8,
        params: {
            seed,
            steps: steps(Object.fromEntries(
                Array.from({ length: 8 }, (_, index) => [
                    index,
                    { probability: 50 }
                ])
            ))
        }
    });
    return Array.from({ length: count }, () => clock(dsp).gate[0] === 10);
}

describe('prob-seq', () => {
    describe('initialization and public contract', () => {
        it('declares the exact module, UI, telemetry, voltage, and default contracts', () => {
            const dsp = createProbSeq({ bufferSize: 128, sampleRate: 48000 });

            expect(probSeqModule).toMatchObject({
                id: 'prob-seq',
                name: 'PROB SEQ',
                hp: 14,
                color: 'module-color-eleven',
                category: 'sequencer'
            });
            expect(probSeqModule.telemetry).toEqual({
                fields: ['activeSeed', 'activeLength', 'cycleNumber', 'lastDecisionCode'],
                methods: []
            });
            expect(probSeqModule.ui.knobs.map(({ param, min, max, default: value, step }) => (
                [param, min, max, value, step]
            ))).toEqual([
                ['seed', 0, 65535, 0, 1],
                ['length', 1, 8, 8, 1],
                ['fallbackBpm', 30, 300, 120, 1]
            ]);
            expect(probSeqModule.ui.state).toHaveLength(1);
            expect(probSeqModule.ui.state[0].param).toBe('steps');
            expect(probSeqModule.ui.state[0].default).toEqual(steps());
            expect(probSeqModule.ui.inputs.map(input => [
                input.port,
                input.signal,
                input.voltage
            ])).toEqual([
                ['clock', 'trigger', { min: 0, max: 10, normal: 0 }],
                ['reset', 'trigger', { min: 0, max: 10, normal: 0 }],
                ['fill', 'gate', { min: 0, max: 10, normal: 0 }],
                ['probabilityCv', 'cv', { min: -5, max: 5, normal: 0 }]
            ]);
            expect(probSeqModule.ui.outputs.map(output => [
                output.port,
                output.signal,
                output.voltage
            ])).toEqual([
                ['gate', 'trigger', { min: 0, max: 10 }],
                ['eoc', 'trigger', { min: 0, max: 10 }]
            ]);
            expect(probSeqModule.ui.leds).toEqual([
                'step1', 'step2', 'step3', 'step4',
                'step5', 'step6', 'step7', 'step8',
                'hit', 'miss', 'eoc', 'pending'
            ]);

            expect(dsp.params).toEqual({
                seed: 0,
                length: 8,
                fallbackBpm: 120,
                steps: steps()
            });
            expect(Object.keys(dsp.inputs)).toEqual([
                'clock', 'reset', 'fill', 'probabilityCv'
            ]);
            expect(Object.keys(dsp.outputs)).toEqual(['gate', 'eoc']);
            Object.values(dsp.inputs).forEach(input => {
                expect(input).toBeInstanceOf(Float32Array);
                expect(input).toHaveLength(128);
                expect(input.every(sample => sample === 0)).toBe(true);
            });
            Object.values(dsp.outputs).forEach(output => {
                expect(output).toBeInstanceOf(Float32Array);
                expect(output).toHaveLength(128);
            });
        });

        it('hydrates restored params before the first clock without emitting output', () => {
            const restoredSteps = steps({
                0: { probability: 37, ratchets: 3, condition: 4 }
            });
            const dsp = createProbSeq({
                params: {
                    seed: 65535,
                    length: 3,
                    fallbackBpm: 90,
                    steps: restoredSteps
                }
            });

            const rendered = processBlock(dsp);

            expect(rendered.gate.every(sample => sample === 0)).toBe(true);
            expect(rendered.eoc.every(sample => sample === 0)).toBe(true);
            expect(dsp.activeSeed).toBe(65535);
            expect(dsp.activeLength).toBe(3);
            expect(dsp.cycleNumber).toBe(1);
            expect(dsp.lastDecisionCode).toBe(0);
            expect(dsp.leds.step1).toBe(1);
            expect(dsp.leds.pending).toBe(0);
        });

        it('normalizes malformed restored params and structured steps during hydration', () => {
            const dsp = createProbSeq({
                params: {
                    seed: Number.NaN,
                    length: Number.POSITIVE_INFINITY,
                    fallbackBpm: Number.NEGATIVE_INFINITY,
                    steps: [
                        { enabled: 0, probability: 42.6, ratchets: 99, condition: 3 },
                        null
                    ]
                }
            });

            processBlock(dsp);

            expect(dsp.params).toEqual({
                seed: 0,
                length: 8,
                fallbackBpm: 120,
                steps: steps({
                    0: { enabled: 0, probability: 43, ratchets: 8, condition: 3 }
                })
            });
        });
    });

    describe('clock, transport, and output timing', () => {
        it('accepts only a crossing strictly above 2.5 V and ignores a held clock', () => {
            const dsp = createProbSeq({ bufferSize: 16 });
            dsp.inputs.clock.fill(0);
            dsp.inputs.clock[0] = 2.5;
            dsp.inputs.clock[2] = 10;
            dsp.inputs.clock[3] = 10;
            dsp.inputs.clock[4] = 10;
            dsp.process();

            expect(dsp.outputs.gate[0]).toBe(0);
            expect(dsp.outputs.gate[2]).toBe(10);
            expect(dsp.leds.step1).toBe(1);
            expect(dsp.lastDecisionCode).toBe(1);
        });

        it('evaluates step 1 first, visits all eight steps, then wraps with EOC', () => {
            const dsp = createProbSeq({ bufferSize: 8 });

            for (let index = 0; index < 8; index++) {
                const rendered = clock(dsp);
                expect(rendered.gate[0]).toBe(10);
                expect(rendered.eoc[0]).toBe(0);
                expect(dsp.leds[`step${index + 1}`]).toBe(1);
            }

            const wrap = clock(dsp);
            expect(wrap.gate[0]).toBe(10);
            expect(wrap.eoc.slice(0, 5)).toEqual([10, 10, 10, 10, 10]);
            expect(dsp.leds.step1).toBe(1);
            expect(dsp.cycleNumber).toBe(2);
        });

        it('length 1 emits EOC from the second clock onward', () => {
            const dsp = createProbSeq({ bufferSize: 8, params: { length: 1 } });

            expect(clock(dsp).eoc[0]).toBe(0);
            expect(clock(dsp).eoc[0]).toBe(10);
            expect(clock(dsp).eoc[0]).toBe(10);
            expect(dsp.leds.step1).toBe(1);
        });

        it('preserves a low sample before an unexpectedly early replacement trigger', () => {
            const dsp = createProbSeq({ bufferSize: 16, sampleRate: 1000 });
            const rendered = processBlock(dsp, { clocks: [0, 2] });

            expect(rendered.gate.slice(0, 8)).toEqual([
                10, 10, 0, 10, 0, 0, 0, 0
            ]);
            expect(risingEdges(rendered.gate).slice(0, 2)).toEqual([0, 3]);
            expect(dsp.leds.step2).toBe(1);
        });

    });

    describe('probability, deterministic draws, and sanitization', () => {
        it('applies bipolar Probability CV in percentage points and clamps extremes', () => {
            const make = probabilityCv => {
                const dsp = createProbSeq({
                    bufferSize: 8,
                    params: { steps: steps({ 0: { probability: 50 } }) }
                });
                return clock(dsp, { probabilityCv }).gate[0];
            };

            expect(make(-5)).toBe(0);
            expect(make(0)).toBe(10); // Seed 0 first roll is 22.
            expect(make(5)).toBe(10);
            expect(make(-50)).toBe(0);
            expect(make(50)).toBe(10);
            expect(make(Number.NaN)).toBe(10);
        });

        it('locks module-level decision sequences for seeds 0 and 65535', () => {
            expect(decisionSequence(0)).toEqual([
                true, false, false, false, false, true,
                true, true, false, false, true, false
            ]);
            expect(decisionSequence(65535)).toEqual([
                false, true, false, false, false, true,
                false, false, false, false, true, false
            ]);
        });

        it('consumes one roll for disabled and condition-false steps', () => {
            const disabled = createProbSeq({
                bufferSize: 8,
                params: {
                    steps: steps({
                        0: { enabled: 0, probability: 50 },
                        1: { probability: 50 },
                        2: { probability: 50 }
                    })
                }
            });
            const conditionFalse = createProbSeq({
                bufferSize: 8,
                params: {
                    steps: steps({
                        0: { condition: 3, probability: 50 },
                        1: { probability: 50 },
                        2: { probability: 50 }
                    })
                }
            });

            expect(clock(disabled).gate[0]).toBe(0);
            expect(clock(conditionFalse).gate[0]).toBe(0);
            expect(clock(disabled).gate[0]).toBe(clock(conditionFalse).gate[0]);
            expect(clock(disabled).gate[0]).toBe(clock(conditionFalse).gate[0]);
        });

        it('sanitizes fields independently and ignores records beyond step 8', () => {
            const malformed = [
                { enabled: 1, probability: Number.NaN, ratchets: 4, condition: 3 },
                null,
                ...steps().slice(2),
                { enabled: 0, probability: 0, ratchets: 8, condition: 10 }
            ];
            const dsp = createProbSeq({
                bufferSize: 600,
                sampleRate: 1000,
                params: { steps: malformed }
            });
            const rendered = clock(dsp, { fill: 10 });

            expect(risingEdges(rendered.gate)).toEqual([0, 125, 250, 375]);
            clock(dsp);
            expect(dsp.lastDecisionCode).toBe(1);
        });
    });

    describe('conditions', () => {
        function conditionResults(condition, {
            fill = 0,
            count = 4
        } = {}) {
            const dsp = createProbSeq({
                bufferSize: 8,
                params: {
                    length: 1,
                    steps: steps({ 0: { condition } })
                }
            });
            return Array.from({ length: count }, () => (
                clock(dsp, { fill }).gate[0] === 10
            ));
        }

        it('implements all 11 condition truth tables', () => {
            expect(conditionResults(0)).toEqual([true, true, true, true]);
            expect(conditionResults(1)).toEqual([false, false, false, false]);
            expect(conditionResults(2)).toEqual([true, true, true, true]);
            expect(conditionResults(3, { fill: 10 })).toEqual([true, true, true, true]);
            expect(conditionResults(3, { fill: 0 })).toEqual([false, false, false, false]);
            expect(conditionResults(4, { fill: 0 })).toEqual([true, true, true, true]);
            expect(conditionResults(4, { fill: 10 })).toEqual([false, false, false, false]);
            expect(conditionResults(5)).toEqual([true, false, true, false]);
            expect(conditionResults(6)).toEqual([false, true, false, true]);
            expect(conditionResults(7)).toEqual([true, false, false, false]);
            expect(conditionResults(8)).toEqual([false, true, false, false]);
            expect(conditionResults(9)).toEqual([false, false, true, false]);
            expect(conditionResults(10)).toEqual([false, false, false, true]);
        });

        it('keeps PRE history on the latest non-PRE final result', () => {
            const dsp = createProbSeq({
                bufferSize: 8,
                params: {
                    length: 4,
                    steps: steps({
                        0: { enabled: 0, condition: 0 },
                        1: { condition: 1 },
                        2: { condition: 2 },
                        3: { condition: 0 }
                    })
                }
            });

            expect(clock(dsp).gate[0]).toBe(0);
            expect(dsp.lastDecisionCode).toBe(2);
            expect(clock(dsp).gate[0]).toBe(0);
            expect(dsp.lastDecisionCode).toBe(3);
            expect(clock(dsp).gate[0]).toBe(10);
            expect(clock(dsp).gate[0]).toBe(10);
        });
    });

    describe('ratchets and clock-period measurement', () => {
        it('uses fallback BPM to schedule ordered ratchets without allocation', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 600,
                params: {
                    fallbackBpm: 120,
                    steps: steps({ 0: { ratchets: 4 } })
                }
            });

            expect(risingEdges(clock(dsp).gate)).toEqual([0, 125, 250, 375]);
        });

        it('uses the latest valid measured clock interval on later steps', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 500,
                params: {
                    steps: steps({
                        0: { ratchets: 1 },
                        1: { ratchets: 4 }
                    })
                }
            });
            const rendered = processBlock(dsp, { clocks: [0, 200] });

            expect(risingEdges(rendered.gate)).toEqual([0, 200, 250, 300, 350]);
        });

        it('falls back after a stopped-clock interval longer than ten seconds', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 11000,
                params: {
                    fallbackBpm: 120,
                    steps: steps({ 1: { ratchets: 4 } })
                }
            });
            const rendered = processBlock(dsp, { clocks: [0, 10500] });

            expect(risingEdges(rendered.gate).slice(-4)).toEqual([
                10500, 10625, 10750, 10875
            ]);
        });

        it('cancels unsent ratchets when a new clock enters a failed step', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 600,
                params: {
                    steps: steps({
                        0: { ratchets: 4 },
                        1: { probability: 0 }
                    })
                }
            });
            const rendered = processBlock(dsp, { clocks: [0, 200] });

            expect(risingEdges(rendered.gate)).toEqual([0, 125]);
            expect(dsp.lastDecisionCode).toBe(4);
        });

        it('does not revise already scheduled ratchets after a step edit', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 100,
                params: { steps: steps({ 0: { ratchets: 4 } }) }
            });

            expect(risingEdges(clock(dsp).gate)).toEqual([0]);
            dsp.params.steps = steps({ 0: { ratchets: 1 } });
            expect(risingEdges(processBlock(dsp).gate)).toEqual([25]);
        });

        it('collapses unrepresentable dense starts and keeps every emitted edge separated', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 24,
                params: {
                    steps: steps({
                        0: { ratchets: 1 },
                        1: { ratchets: 8 }
                    })
                }
            });
            const rendered = processBlock(dsp, { clocks: [0, 8] });
            const edges = risingEdges(rendered.gate);

            expect(edges[0]).toBe(0);
            expect(edges).toContain(8);
            for (let index = 1; index < edges.length; index++) {
                expect(edges[index] - edges[index - 1]).toBeGreaterThanOrEqual(2);
            }
        });
    });

    describe('wrap-quantized seed and length transactions', () => {
        it('commits the latest requested seed and length together on the old-length wrap', () => {
            const dsp = createProbSeq({
                bufferSize: 8,
                params: { length: 2 }
            });

            clock(dsp); // Step 1.
            dsp.params.seed = 65535;
            dsp.params.length = 1;
            processBlock(dsp);
            expect(dsp.leds.pending).toBe(1);
            expect(dsp.activeSeed).toBe(0);
            expect(dsp.activeLength).toBe(2);

            clock(dsp); // Step 2, still old structure.
            expect(dsp.activeLength).toBe(2);
            const wrapped = clock(dsp); // Old length wraps.

            expect(wrapped.eoc[0]).toBe(10);
            expect(dsp.activeSeed).toBe(65535);
            expect(dsp.activeLength).toBe(1);
            expect(dsp.cycleNumber).toBe(1);
            expect(dsp.leds.pending).toBe(0);
        });

        it('clears pending when requested values return to active', () => {
            const dsp = createProbSeq({ bufferSize: 8 });
            processBlock(dsp);

            dsp.params.seed = 4;
            dsp.params.length = 3;
            processBlock(dsp);
            expect(dsp.leds.pending).toBe(1);

            dsp.params.seed = 0;
            dsp.params.length = 8;
            processBlock(dsp);
            expect(dsp.leds.pending).toBe(0);
        });

        it('does not reseed the random stream for a length-only commit', () => {
            const common = {
                bufferSize: 8,
                params: {
                    length: 2,
                    steps: steps(Object.fromEntries(
                        Array.from({ length: 8 }, (_, index) => [
                            index,
                            { probability: 50 }
                        ])
                    ))
                }
            };
            const changed = createProbSeq(common);
            const unchanged = createProbSeq(common);

            expect(clock(changed).gate[0]).toBe(clock(unchanged).gate[0]);
            changed.params.length = 1;
            expect(clock(changed).gate[0]).toBe(clock(unchanged).gate[0]);
            expect(clock(changed).gate[0]).toBe(clock(unchanged).gate[0]);
            expect(changed.activeLength).toBe(1);
        });

        it('uses the latest transaction values and the first draw from a committed seed', () => {
            const dsp = createProbSeq({
                bufferSize: 8,
                params: {
                    length: 2,
                    steps: steps({ 0: { probability: 80 } })
                }
            });

            clock(dsp);
            dsp.params.seed = 4;
            dsp.params.length = 3;
            processBlock(dsp);
            dsp.params.seed = 65535;
            dsp.params.length = 1;
            processBlock(dsp);
            clock(dsp);
            const wrap = clock(dsp);

            expect(wrap.gate[0]).toBe(0); // Seed 65535 first roll is 90.
            expect(dsp.activeSeed).toBe(65535);
            expect(dsp.activeLength).toBe(1);
            expect(dsp.lastDecisionCode).toBe(4);
        });
    });

    describe('reset, LEDs, robustness, and stable buffers', () => {
        it('handles same-sample Reset plus Clock before the step decision', () => {
            const params = {
                seed: 65535,
                length: 3,
                steps: steps({ 0: { probability: 100 } })
            };
            const dsp = createProbSeq({ bufferSize: 16, params });
            clock(dsp);
            clock(dsp);

            const rendered = processBlock(dsp, {
                clocks: [0],
                resets: [0],
                fill: 10
            });

            expect(rendered.gate[0]).toBe(10);
            expect(rendered.eoc[0]).toBe(0);
            expect(dsp.leds.step1).toBe(1);
            expect(dsp.activeSeed).toBe(65535);
            expect(dsp.activeLength).toBe(3);
            expect(dsp.cycleNumber).toBe(1);
        });

        it('samples Fill after same-sample Reset handling and replays the seed', () => {
            const dsp = createProbSeq({
                bufferSize: 8,
                params: {
                    seed: 0,
                    steps: steps({
                        0: { probability: 50, condition: 3 },
                        1: { probability: 50 },
                        2: { probability: 50 }
                    })
                }
            });

            const first = [
                clock(dsp, { fill: 10 }).gate[0],
                clock(dsp).gate[0],
                clock(dsp).gate[0]
            ];
            const replay = [
                processBlock(dsp, { clocks: [0], resets: [0], fill: 10 }).gate[0],
                clock(dsp).gate[0],
                clock(dsp).gate[0]
            ];

            expect(first).toEqual([10, 0, 0]);
            expect(replay).toEqual(first);
        });

        it('holds Hit/Miss for 50 ms and mirrors EOC', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 10,
                params: {
                    length: 1,
                    steps: steps({ 0: { probability: 0 } })
                }
            });

            clock(dsp);
            expect(dsp.leds.hit).toBe(0);
            expect(dsp.leds.miss).toBe(1);
            for (let block = 0; block < 6; block++) processBlock(dsp);
            expect(dsp.leds.miss).toBe(0);

            dsp.params.steps = steps();
            clock(dsp);
            expect(dsp.leds.hit).toBe(1);
            expect(dsp.leds.eoc).toBe(1);
            expect(dsp.outputs.eoc[0]).toBe(10);
        });

        it('clears same-block EOC activity when a later reset truncates the pulse', () => {
            const dsp = createProbSeq({
                sampleRate: 1000,
                bufferSize: 12,
                params: { length: 1 }
            });
            const rendered = processBlock(dsp, {
                clocks: [0, 2],
                resets: [4]
            });

            expect(rendered.eoc.slice(0, 7)).toEqual([0, 0, 10, 10, 0, 0, 0]);
            expect(dsp.leds.eoc).toBe(0);
            expect(dsp.lastDecisionCode).toBe(0);
        });

        it('reset clears stable I/O and runtime state in place while preserving params', () => {
            const dsp = createProbSeq({
                bufferSize: 16,
                params: {
                    seed: 42,
                    length: 2,
                    fallbackBpm: 90,
                    steps: steps({ 0: { ratchets: 4 } })
                }
            });
            const inputRefs = { ...dsp.inputs };
            const outputRefs = { ...dsp.outputs };
            processBlock(dsp, { clocks: [0, 4], resets: [8], fill: 10, probabilityCv: 5 });
            Object.values(dsp.inputs).forEach(input => input.fill(10));

            dsp.reset();

            expect(dsp.params.seed).toBe(42);
            expect(dsp.params.length).toBe(2);
            expect(dsp.params.fallbackBpm).toBe(90);
            Object.entries(inputRefs).forEach(([name, input]) => {
                expect(dsp.inputs[name]).toBe(input);
                expect(input.every(sample => sample === 0)).toBe(true);
            });
            Object.entries(outputRefs).forEach(([name, output]) => {
                expect(dsp.outputs[name]).toBe(output);
                expect(output.every(sample => sample === 0)).toBe(true);
            });
            Object.values(dsp.leds).forEach(value => expect(value).toBe(0));

            const replay = clock(dsp);
            expect(replay.gate[0]).toBe(10);
            expect(dsp.activeSeed).toBe(42);
            expect(dsp.activeLength).toBe(2);
        });

        it('fills finite binary outputs and preserves every buffer across the audit matrix', () => {
            for (const sampleRate of [44100, 48000, 96000]) {
                for (const bufferSize of [128, 512]) {
                    const dsp = createProbSeq({
                        sampleRate,
                        bufferSize,
                        params: {
                            seed: Number.NaN,
                            length: Number.POSITIVE_INFINITY,
                            fallbackBpm: Number.NEGATIVE_INFINITY,
                            steps: [
                                {
                                    enabled: Number.NaN,
                                    probability: Number.POSITIVE_INFINITY,
                                    ratchets: Number.NEGATIVE_INFINITY,
                                    condition: Number.NaN
                                }
                            ]
                        }
                    });
                    const inputs = { ...dsp.inputs };
                    const outputs = { ...dsp.outputs };
                    dsp.inputs.clock[0] = Number.POSITIVE_INFINITY;
                    dsp.inputs.reset[1] = Number.NaN;
                    dsp.inputs.fill[0] = Number.POSITIVE_INFINITY;
                    dsp.inputs.probabilityCv[0] = Number.NaN;

                    for (let block = 0; block < 32; block++) {
                        if (block > 0) {
                            dsp.inputs.clock.fill(0);
                            dsp.inputs.clock[block % bufferSize] = block % 2 ? 10 : 2.5;
                        }
                        dsp.process();
                        for (const output of Object.values(dsp.outputs)) {
                            expect(output.every(Number.isFinite)).toBe(true);
                            expect(output.every(sample => sample === 0 || sample === 10)).toBe(true);
                        }
                    }

                    Object.entries(inputs).forEach(([name, input]) => {
                        expect(dsp.inputs[name]).toBe(input);
                    });
                    Object.entries(outputs).forEach(([name, output]) => {
                        expect(dsp.outputs[name]).toBe(output);
                    });
                    expect(dsp.activeSeed).toBeGreaterThanOrEqual(0);
                    expect(dsp.activeSeed).toBeLessThanOrEqual(65535);
                    expect(dsp.activeLength).toBeGreaterThanOrEqual(1);
                    expect(dsp.activeLength).toBeLessThanOrEqual(8);
                    expect(dsp.cycleNumber).toBeGreaterThanOrEqual(1);
                    expect(dsp.cycleNumber).toBeLessThanOrEqual(4);
                    expect(dsp.lastDecisionCode).toBeGreaterThanOrEqual(0);
                    expect(dsp.lastDecisionCode).toBeLessThanOrEqual(4);
                }
            }
        });
    });
});
