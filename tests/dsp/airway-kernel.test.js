// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAirwayKernel, prepareAirway } from '../../src/js/audio/chimera-kernel.js';
import { readFile } from 'node:fs/promises';
import { validateAirwayAssets, inspectAirwayAbi } from '../../scripts/airway-assets.mjs';

function capture(kernel, count, block = 128) {
    const out = new Float32Array(count);
    for (let offset = 0; offset < count; offset += block) {
        const n = Math.min(block, count - offset);
        const samples = kernel.render(n);
        for (let i = 0; i < n; i++) out[offset + i] = samples[i];
    }
    return out;
}

function lateHumPitch(samples, expected) {
    let best = -1, bestLag = 0;
    for (let lag = Math.floor(48000 / (expected * 1.1)); lag <= Math.ceil(48000 / (expected * 0.9)); lag++) {
        let sum = 0, a2 = 0, b2 = 0;
        // The native score has a 30 ms pitch glide; inspect its settled tail.
        for (let i = 6000; i < 8500; i++) {
            sum += samples[i] * samples[i + lag];
            a2 += samples[i] * samples[i];
            b2 += samples[i + lag] * samples[i + lag];
        }
        const correlation = sum / Math.sqrt(a2 * b2);
        if (correlation > best) { best = correlation; bestLag = lag; }
    }
    return { frequency: 48000 / bestLag, correlation: best };
}

describe('Airway physical WASM kernel', () => {
    it.each([44100, 48000, 96000])('prepares an isolated, fixed-memory female voice at %i Hz without percussion snapshots', rate => {
        const info = prepareAirway(rate, 'female');
        expect(info).toBe(prepareAirway(rate, 'female'));
        expect(info.memoryBytes).toBe(1048576);
        expect(info.snapshotBytes).toBe(1048576);
        expect(info.soundCount).toBe(0);
        expect(() => createAirwayKernel(48000, 'unknown')).toThrow(/body/i);
        const k = createAirwayKernel(rate, 'female');
        const buffer = k.memoryBuffer, allocations = k.allocationCount, stack = k.boundaryStackPointer;
        for (let sound = 0; sound < 32; sound++) {
            k.setPhoneme(220, 0, 8, .15, .5, 0, true, sound, .8);
            expect(capture(k, 4096).every(Number.isFinite)).toBe(true);
        }
        expect(k.memoryBuffer).toBe(buffer); expect(k.allocationCount).toBe(allocations);
        expect(k.boundaryStackPointer).toBe(stack);
        expect(() => k.trigger(0)).toThrow(/percussion/i);
        k.reset(); expect(capture(k, 128).every(x => x === 0)).toBe(true);
        k.dispose();
    });
    it('ships pinned, checksummed assets with one fixed memory and only the boundary stack global', async () => {
        const manifest = await validateAirwayAssets();
        const bytes = await readFile(new URL(`../../src/wasm/airway/${manifest.wasmFile}`, import.meta.url));
        expect(inspectAirwayAbi(bytes)).toEqual({ memoryBytes: 1048576, mutableGlobals: ['__stack_pointer'] });
        const e = new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports;
        expect(() => e.memory.grow(1)).toThrow(RangeError);
    });
    it('prepares once per rate and restores deterministic independent physical states', () => {
        expect(prepareAirway(48000)).toBe(prepareAirway(48000));
        const a = createAirwayKernel(48000);
        const b = createAirwayKernel(48000);
        const stable = a.render(128);
        a.trigger(0, 110);
        const first = capture(a, 4096);
        b.trigger(7, 110);
        capture(b, 2048);
        a.trigger(0, 110);
        expect(capture(a, 4096)).toEqual(first);
        expect(a.render(1)).toBe(stable);
        expect(a.memoryBuffer).not.toBe(b.memoryBuffer);
        a.reset();
        expect(capture(a, 512).every(x => x === 0)).toBe(true);
        a.dispose(); b.dispose();
    });

    it.each([44100, 48000, 96000].flatMap(rate =>
        Array.from({ length: 10 }, (_, sound) => [rate, sound])
    ))('resumes at %i Hz sound %i promptly without allocation or growth', (rate, sound) => {
        const k = createAirwayKernel(rate);
        const memory = k.memoryBuffer;
        const globals = k.boundaryStackPointer;
        k.trigger(sound, 110);
        k.setVoice(110, 0, 8, 0.15, 0.5, 0, false);
        const allocations = k.allocationCount;
        const samples = capture(k, Math.round(rate * 0.6), 512);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        expect(peak).toBeGreaterThan(0.0001);
        expect(samples.every(Number.isFinite)).toBe(true);
        const onset = samples.findIndex(x => Math.abs(x) > peak * 0.1) / rate;
        expect(onset).toBeLessThan(0.011);
        expect(k.memoryBuffer).toBe(memory);
        expect(k.allocationCount).toBe(allocations);
        expect(k.boundaryStackPointer).toBe(globals);
        k.dispose();
    });

    it('continues the identical simulation across arbitrary render subdivisions', () => {
        const k = createAirwayKernel(48000);
        k.trigger(9, 220);
        const a = capture(k, 8192, 128);
        k.trigger(9, 220);
        expect(capture(k, 8192, 17)).toEqual(a);
        k.reset();
        k.setVoice(220, 1.5, 8, 0.15, 0.5, 0, true);
        const voice = capture(k, 8192, 256);
        k.reset();
        k.setVoice(220, 1.5, 8, 0.15, 0.5, 0, true);
        expect(capture(k, 8192, 63)).toEqual(voice);
        k.dispose();
    });

    it('retargets Hum pitch and keeps extreme voice controls finite without allocation', () => {
        const k = createAirwayKernel(48000);
        for (const hz of [55, 110, 220, 440]) {
            k.trigger(9, hz);
            const pitch = lateHumPitch(capture(k, 11000), hz);
            expect(Math.abs(pitch.frequency / hz - 1)).toBeLessThan(0.025);
            expect(pitch.correlation).toBeGreaterThan(0.97);
        }
        k.reset();
        const allocations = k.allocationCount;
        for (let i = 0; i < 24; i++) {
            k.setVoice(i % 2 ? 1100 : 40, i % 5, i % 2 ? 22 : 0, i % 2, (i >> 1) % 2, (i >> 2) % 2, true);
            expect(capture(k, 1024).every(Number.isFinite)).toBe(true);
        }
        expect(k.allocationCount).toBe(allocations);
        k.dispose();
    });

    it('reliably restores alternating states at fast retrigger rates with stable pointers', () => {
        const k = createAirwayKernel(48000);
        const buffer = k.memoryBuffer;
        const output = k.render(1);
        for (let i = 0; i < 150; i++) {
            const before = k.allocationCount;
            k.trigger(i % 10, i % 2 ? 1100 : 40);
            const allocations = k.allocationCount;
            expect(allocations).toBe(before);
            const stack = k.boundaryStackPointer;
            // Alternating sample-adjacent hits and 240 BPM sixteenths.
            const count = i % 2 ? 1 : 3000;
            const rendered = capture(k, count, 128);
            expect(rendered.every(Number.isFinite)).toBe(true);
            expect(k.allocationCount).toBe(allocations);
            expect(k.boundaryStackPointer).toBe(stack);
            expect(k.memoryBuffer).toBe(buffer);
            expect(k.render(0)).toBe(output);
        }
        k.reset();
        k.setVoice(NaN, Infinity, -Infinity, NaN, NaN, NaN, NaN);
        expect(capture(k, 512).every(Number.isFinite)).toBe(true);
        expect(() => k.render(2049)).toThrow(RangeError);
        k.dispose();
        k.dispose();
        expect(k.memoryBytes).toBe(0);
        expect(() => k.render(1)).toThrow('disposed');
    });

    it('reports each complete score window and continues held breath after exact expiry', () => {
        const k = createAirwayKernel(48000);
        const memory = k.memoryBuffer;
        const durations = new Set();
        for (let sound = 0; sound < 10; sound++) {
            const duration = k.trigger(sound, 110);
            expect(Number.isInteger(duration)).toBe(true);
            expect(duration).toBeGreaterThan(0);
            expect(duration).toBeLessThan(48000);
            durations.add(duration);
            k.setVoice(110, 0, 8, 0.15, 0.5, 0, true);
            expect(k.remainingGestureSamples).toBe(duration);
            const allocations = k.allocationCount;
            capture(k, duration - 1);
            expect(k.remainingGestureSamples).toBe(1);
            k.render(1);
            expect(k.remainingGestureSamples).toBe(0);
            const recovery = capture(k, 12000);
            const tail = recovery.slice(-4096);
            expect(Math.sqrt(tail.reduce((sum, x) => sum + x * x, 0) / tail.length)).toBeGreaterThan(0.005);
            expect(k.memoryBuffer).toBe(memory);
            expect(k.allocationCount).toBe(allocations);
        }
        expect(durations.size).toBeGreaterThan(3);
        k.reset();
        expect(k.remainingGestureSamples).toBe(0);
        k.dispose();
    });

    it('keeps gate edges and pitch changes live within a Hum without restarting its score', () => {
        const k = createAirwayKernel(48000);
        const duration = k.trigger(9, 55);
        k.setVoice(55, 0, 8, 0.15, 0.5, 0, false);
        capture(k, 1024);
        const remaining = k.remainingGestureSamples;
        const allocations = k.allocationCount;
        k.setVoice(440, 3, 16, 0.35, 0.7, 0, true);
        expect(k.remainingGestureSamples).toBe(remaining);
        const changed = capture(k, 4096);
        expect(k.remainingGestureSamples).toBe(duration - 5120);
        expect(k.allocationCount).toBe(allocations);
        k.trigger(9, 55);
        k.setVoice(55, 0, 8, 0.15, 0.5, 0, false);
        capture(k, 1024);
        expect(capture(k, 4096)).not.toEqual(changed);
        // A dropped Gate must not cancel a running one-shot.
        k.setVoice(55, 0, 8, 0.15, 0.5, 0, false);
        expect(k.remainingGestureSamples).toBe(duration - 5120);
        k.dispose();
    });

    it('preserves the same waveform when a render crosses score expiry', () => {
        const k = createAirwayKernel(48000);
        const duration = k.trigger(6, 220);
        k.setVoice(220, 2, 12, 0.2, 0.6, 0, true);
        const reference = capture(k, duration + 1024, 512);
        k.trigger(6, 220);
        k.setVoice(220, 2, 12, 0.2, 0.6, 0, true);
        expect(capture(k, duration + 1024, 17)).toEqual(reference);
        k.dispose();
    });

    it('does not disturb any held score when identical live controls repeat on the rack grid', () => {
        const k = createAirwayKernel(48000);
        for (let sound = 0; sound < 10; sound++) {
            k.trigger(sound, 110);
            k.setVoice(110, 0, 8, 0.15, 0.5, 0, false);
            const once = capture(k, 24000, 64);
            k.trigger(sound, 110);
            const allocations = k.allocationCount;
            const repeated = new Float32Array(24000);
            for (let offset = 0; offset < repeated.length; offset += 64) {
                k.setVoice(110, 0, 8, 0.15, 0.5, 0, false);
                const n = Math.min(64, repeated.length - offset);
                const block = k.render(n);
                for (let i = 0; i < n; i++) repeated[offset + i] = block[i];
            }
            expect(repeated.findIndex((sample, i) => sample !== once[i]), `sound ${sound}, first different sample`).toBe(-1);
            expect(k.allocationCount).toBe(allocations);
        }
        k.dispose();
    }, 30000);

    it('preserves score contributions while moving live controls between native control ticks', () => {
        const k = createAirwayKernel(48000);
        function movingControls(sound, redundant) {
            k.trigger(sound, 110);
            const samples = new Float32Array(12288);
            for (let offset = 0; offset < samples.length; offset += 64) {
                const step = Math.floor(offset / 512);
                if (redundant || offset % 512 === 0) {
                    k.setVoice(step % 2 ? 220 : 110, step % 5, 4 + step % 4 * 4,
                        step % 3 / 3, 0.2 + step % 3 * 0.3, step % 4 / 4, step % 3 !== 0);
                }
                const block = k.render(64);
                for (let i = 0; i < 64; i++) samples[offset + i] = block[i];
            }
            return samples;
        }
        for (const sound of [3, 5, 8, 9]) {
            const changed = movingControls(sound, false);
            const allocations = k.allocationCount;
            const repeated = movingControls(sound, true);
            expect(repeated.findIndex((sample, i) => sample !== changed[i]), `sound ${sound}, first different sample`).toBe(-1);
            expect(k.allocationCount).toBe(allocations);
            k.trigger(sound, 110);
            k.setVoice(110, 0, 8, 0.15, 0.5, 0, false);
            const fixed = capture(k, changed.length, 64);
            expect(changed.every(Number.isFinite)).toBe(true);
            expect(changed.some((sample, i) => Math.abs(sample - fixed[i]) > 0.001)).toBe(true);
        }
        k.dispose();
    }, 15000);
});
