import { describe, expect, it } from 'vitest';
import hocket from '../../compositions/hocket-study/hocket.mjs';
import { validateModuleDefinition } from '../../src/js/rack/module-contract.js';

const PATTERNS = ['ABABABAB', 'AABBAABB', 'AABAABAB', 'AAABABBB'];
const MATRIX = [44100, 48000, 96000].flatMap(sampleRate =>
    [128, 512].map(bufferSize => ({ sampleRate, bufferSize })));

function create(options = {}) {
    return hocket.createDSP({ sampleRate: 1000, bufferSize: 1, ...options });
}

function tick(dsp, clock = 0, reset = 0) {
    dsp.inputs.clock[0] = clock;
    dsp.inputs.reset[0] = reset;
    dsp.process();
    return [dsp.outputs.a[0], dsp.outputs.b[0]];
}

function event(dsp, reset = 0) {
    tick(dsp);
    const values = tick(dsp, 10, reset);
    return values[0] === 10 ? 'A' : values[1] === 10 ? 'B' : '-';
}

describe('browser-local HOCKET prototype', () => {
    it.each(MATRIX)('validates its complete contract at $sampleRate Hz / $bufferSize samples', ({ sampleRate, bufferSize }) => {
        expect(validateModuleDefinition(hocket, { sampleRate, blockSize: bufferSize })).toBe(hocket);
        expect(hocket).toMatchObject({ id: 'hocket-demo', name: 'HOCKET', hp: 6, category: 'clock', color: 'module-color-six' });
        expect(hocket.ui.knobs.map(control => control.param)).toEqual(['pattern', 'rotate']);
        expect(hocket.ui.switches.map(control => control.param)).toEqual(['swap']);
        expect(hocket.ui.inputs.map(port => port.port)).toEqual(['clock', 'reset']);
        expect(hocket.ui.outputs.map(port => port.port)).toEqual(['a', 'b']);
        const dsp = create({ sampleRate, bufferSize });
        expect(dsp.params).toEqual({ pattern: 0, rotate: 0, swap: 0 });
        expect(dsp.leds).toEqual({ a: 0, b: 0 });
        for (const buffer of [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)]) {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer.length).toBe(bufferSize);
            expect(buffer.every(sample => sample === 0)).toBe(true);
        }
        for (const port of hocket.ui.inputs) expect(port.voltage).toEqual({ min: 0, max: 10, normal: 0 });
        for (const port of hocket.ui.outputs) expect(port.voltage).toEqual({ min: 0, max: 10 });
    });

    const settings = PATTERNS.flatMap((pattern, patternIndex) =>
        Array.from({ length: 8 }, (_, rotate) => [0, 1].map(swap => ({ pattern, patternIndex, rotate, swap }))).flat());
    it.each(settings)('routes two full cycles of pattern $patternIndex, rotation $rotate, swap $swap', ({ pattern, patternIndex, rotate, swap }) => {
        const dsp = create();
        Object.assign(dsp.params, { pattern: patternIndex, rotate, swap });
        for (let step = 0; step < 16; step++) {
            let expected = pattern[(step + rotate) % 8];
            if (swap) expected = expected === 'A' ? 'B' : 'A';
            expect(event(dsp)).toBe(expected);
            expect(dsp.outputs.a[0] + dsp.outputs.b[0]).toBe(10);
        }
    });

    it.each(MATRIX)('produces exact 8ms pulses and clears every tail sample at $sampleRate / $bufferSize', ({ sampleRate, bufferSize }) => {
        const dsp = create({ sampleRate, bufferSize });
        const pulseSamples = Math.ceil(sampleRate * 0.008);
        const starts = [bufferSize - 1, bufferSize * 2 + pulseSamples + 7];
        const total = Math.ceil((starts[1] + pulseSamples + bufferSize) / bufferSize) * bufferSize;
        for (let offset = 0; offset < total; offset += bufferSize) {
            dsp.inputs.clock.fill(0);
            // Poison the buffers to prove every sample is overwritten.
            dsp.outputs.a.fill(Number.NaN);
            dsp.outputs.b.fill(Number.NaN);
            for (const start of starts) if (start >= offset && start < offset + bufferSize) dsp.inputs.clock[start - offset] = 10;
            dsp.process();
            for (let i = 0; i < bufferSize; i++) {
                const sample = offset + i;
                expect(dsp.outputs.a[i]).toBe(sample >= starts[0] && sample < starts[0] + pulseSamples ? 10 : 0);
                expect(dsp.outputs.b[i]).toBe(sample >= starts[1] && sample < starts[1] + pulseSamples ? 10 : 0);
            }
        }
    });

    it('uses a strictly greater than 2.5V clock threshold and ignores held-high clock', () => {
        const dsp = create();
        for (const low of [-10, 0, 1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(tick(dsp, low)).toEqual([0, 0]);
        expect(tick(dsp, 2.5001)).toEqual([10, 0]);
        for (let i = 0; i < 20; i++) tick(dsp, 10);
        expect(tick(dsp, 10)).toEqual([0, 0]);
        expect(event(dsp)).toBe('B');
    });

    it('uses a 1V reset threshold and resets before a simultaneous clock edge', () => {
        const dsp = create();
        expect(event(dsp)).toBe('A');
        expect(event(dsp, 0.999)).toBe('B');
        expect(event(dsp)).toBe('A');
        expect(event(dsp, 1)).toBe('A');
        tick(dsp, 0, 10);
        expect(tick(dsp, 10, 10)).toEqual([0, 10]);
        tick(dsp, 0, 0);
        expect(tick(dsp, 10, 1)).toEqual([10, 0]);
    });

    it('an isolated reset cancels the pulse and restarts at the rotated, swapped first step', () => {
        const dsp = create();
        Object.assign(dsp.params, { pattern: 3, rotate: 2, swap: 1 });
        expect(event(dsp)).toBe('B');
        expect(event(dsp)).toBe('A');
        expect(tick(dsp, 0, 1)).toEqual([0, 0]);
        expect(dsp.leds).toEqual({ a: 0, b: 0 });
        expect(event(dsp)).toBe('B');
    });

    it('samples controls at new clock edges and preserves the active pulse destination', () => {
        const dsp = create();
        expect(event(dsp)).toBe('A');
        Object.assign(dsp.params, { pattern: 3, rotate: 2, swap: 1 });
        expect(tick(dsp)).toEqual([10, 0]);
        for (let i = 0; i < 10; i++) tick(dsp);
        expect(tick(dsp)).toEqual([0, 0]);
        expect(event(dsp)).toBe('A'); // step 1 + rotation 2 = B; swapped = A.
    });

    it.each([
        [{ pattern: -20, rotate: -3, swap: -1 }, 'ABABABAB'],
        [{ pattern: 20, rotate: 20, swap: 2 }, 'ABBBABAA'],
        [{ pattern: 1.6, rotate: 1.6, swap: 0.6 }, 'ABBABABB'],
        [{ pattern: Number.NaN, rotate: Number.POSITIVE_INFINITY, swap: Number.NEGATIVE_INFINITY }, 'ABABABAB']
    ])('clamps and rounds controls with non-finite defaults: %j', (params, expected) => {
        const dsp = create();
        Object.assign(dsp.params, params);
        expect(Array.from({ length: 8 }, () => event(dsp)).join('')).toBe(expected);
    });

    it('holds each LED for 50ms without extending triggers', () => {
        const dsp = create();
        expect(tick(dsp, 10)).toEqual([10, 0]);
        for (let i = 1; i < 8; i++) expect(tick(dsp)).toEqual([10, 0]);
        expect(tick(dsp)).toEqual([0, 0]);
        expect(dsp.leds.a).toBe(1);
        for (let i = 9; i < 49; i++) tick(dsp);
        expect(dsp.leds.a).toBe(1);
        tick(dsp);
        expect(dsp.leds.a).toBe(0);
        expect(event(dsp)).toBe('B');
        expect(dsp.leds.b).toBe(1);
    });

    it('never overlaps outputs at fast clocks and lets repeated destinations extend pulses', () => {
        const dsp = create();
        dsp.params.pattern = 1;
        expect(event(dsp)).toBe('A');
        expect(tick(dsp)).toEqual([10, 0]);
        expect(tick(dsp, 10)).toEqual([10, 0]);
        expect(tick(dsp)).toEqual([10, 0]);
        expect(tick(dsp, 10)).toEqual([0, 10]);
        for (let i = 0; i < 1000; i++) {
            const values = tick(dsp, i % 2 ? 10 : 0);
            expect(values.every(value => Number.isFinite(value) && (value === 0 || value === 10))).toBe(true);
            expect(values[0] + values[1]).toBe(10);
        }
    });

    it('clears state in place while preserving params and restarts first event after reset()', () => {
        const dsp = create();
        const buffers = [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)];
        Object.assign(dsp.params, { pattern: 3, rotate: 1, swap: 1 });
        for (let i = 0; i < 5; i++) event(dsp);
        dsp.reset();
        expect(dsp.params).toEqual({ pattern: 3, rotate: 1, swap: 1 });
        expect(dsp.leds).toEqual({ a: 0, b: 0 });
        [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)].forEach((buffer, index) => {
            expect(buffer).toBe(buffers[index]);
            expect(buffer.every(value => value === 0)).toBe(true);
        });
        expect(tick(dsp, 10)).toEqual([0, 10]);
        dsp.reset();
        for (let i = 0; i < 100; i++) expect(tick(dsp)).toEqual([0, 0]);
    });
});
