import { describe, expect, it } from 'vitest';
import definition from '../../src/js/modules/gate-seq/index.js';

const names = ['a', 'b', 'c', 'd'];
const edges = (count, period) => Array.from({ length: count }, (_, i) => i * period);
const rises = samples => samples.flatMap((v, i) => v === 10 && samples[i - 1] !== 10 ? [i] : []);
const all = n => Array(64).fill(n);
function sequencer(tracks = [], block = 1, sampleRate = 1000) {
    const dsp = definition.createDSP({ sampleRate, bufferSize: block });
    dsp.params.pattern = dsp.params.pattern.map((track, i) => ({ ...track, ...tracks[i] }));
    return dsp;
}
function render(dsp, frames, clocks = [], resets = [], change = () => {}) {
    const result = Object.fromEntries(names.map(name => [name, []]));
    const block = dsp.inputs.clock.length;
    const clk = new Set(clocks);
    const rst = new Set(resets);
    for (let start = 0; start < frames; start += block) {
        change(start, dsp);
        for (let i = 0; i < block; i++) {
            dsp.inputs.clock[i] = clk.has(start + i) ? 10 : 0;
            dsp.inputs.reset[i] = rst.has(start + i) ? 1 : 0;
        }
        dsp.process();
        for (const name of names) result[name].push(...dsp.outputs[name].subarray(0, frames - start));
    }
    return result;
}
function changeTrack(dsp, index, edits) {
    dsp.params.pattern = dsp.params.pattern.map((track, i) => i === index ? { ...track, ...edits } : track);
}

describe('four-track gate sequencer', () => {
    it('starts completely blank with eight empty memories, stable buffers and bounded playheads', () => {
        const dsp = sequencer([], 16);
        expect(dsp.params.pattern).toHaveLength(4);
        for (const track of dsp.params.pattern) {
            expect(track).toEqual({ length: 16, ratio: 1, gateLength: 25, swing: 50, delay: 0, probability: 100,
                rotation: 0, mute: 0, cells: all(-1) });
        }
        expect(dsp.params.presets).toEqual(Array(8).fill(null));
        expect(dsp.positions).toEqual([-1, -1, -1, -1]);
        expect(definition.telemetry.fields).toEqual(['positions']);
        const buffers = [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)];
        for (const buffer of Object.values(dsp.outputs)) buffer.fill(NaN);
        expect(render(dsp, 32, [0, 16]).a).toEqual(Array(32).fill(0));
        dsp.reset();
        [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)].forEach((buffer, i) => {
            expect(buffer).toBe(buffers[i]);
            expect([...buffer]).toEqual(Array(16).fill(0));
        });
        expect(Object.values(dsp.leds)).toEqual(Array(6).fill(0));
        expect(dsp.positions).toEqual([-1, -1, -1, -1]);
    });

    it('compares finite voltage at exact thresholds and handles simultaneous or held inputs', () => {
        const dsp = sequencer([{ cells: [1], gateLength: 1 }], 16);
        dsp.inputs.clock.set([2.5, 2.51, 10, 0, Infinity, 3, 0, 3, 0, 3]);
        dsp.inputs.reset.set([0, 0, .99, 0, NaN, 1, 1, 1, 0, .99]);
        dsp.process();
        expect(rises([...dsp.outputs.a])).toEqual([1, 5]);
        expect(dsp.positions[0]).toBe(2);
        expect(dsp.leds).toMatchObject({ clock: 1, reset: 1, a: 1, b: 0 });
    });

    it('divides, multiplies distinct cells only after lock and stops after the final prediction', () => {
        const dsp = sequencer([
            { cells: all(1), ratio: -3 }, { cells: all(1), ratio: 3 },
            { cells: [1, -1, 1], length: 3, ratio: 4 }, { cells: all(1), ratio: -64 }
        ], 7);
        const out = render(dsp, 520, [0, 120, 240, 360]);
        expect(rises(out.a)).toEqual([0, 360]);
        expect(rises(out.b)).toEqual([0, 120, 160, 200, 240, 280, 320, 360, 400, 440]);
        expect(rises(out.c)).toEqual([0, 150, 180, 240, 270, 330, 360, 420, 450]);
        expect(rises(out.d)).toEqual([0]);
        expect(rises(render(sequencer([{ ratio: 3, cells: all(1) }]), 300, [0, 120, 152]).a))
            .toEqual([0, 120, 152, 163, 173]);
        expect(rises(render(sequencer([{ ratio: -64, cells: all(1), gateLength: 1 }]), 710, edges(70, 10)).a))
            .toEqual([0, 640]);
    });

    it('cycles independent lengths, visits step 64, and applies signed rotation to the hit and ratchet together', () => {
        const out = render(sequencer([{ length: 3, cells: [1] }, { length: 5, cells: [1] },
            { length: 64, cells: [...Array(63).fill(-1), 1] }, { length: 1, cells: [1] }]), 800, edges(70, 10));
        expect(rises(out.a)).toEqual(edges(24, 30));
        expect(rises(out.b)).toEqual(edges(14, 50));
        expect(rises(out.c)).toEqual([630]);
        expect(rises(out.d).slice(-2)).toEqual([680, 690]);
        for (const [rotation, starts] of [[1, [120, 160, 200]], [-1, [240, 280, 320]]]) {
            expect(rises(render(sequencer([{ length: 3, cells: [3], rotation }]), 360, [0, 120, 240]).a)).toEqual(starts);
        }
    });

    it('sums swing and delay, caps them inside the window, and swings across odd-length wraps', () => {
        const out = render(sequencer([
            { length: 1, cells: [1], swing: 75 }, { cells: all(1), swing: 75, delay: 25 },
            { cells: all(1), swing: 78, delay: 58 }, { cells: all(1) }
        ]), 360, [0, 120, 240]);
        expect(rises(out.a)).toEqual([0, 180, 240]);
        expect(rises(out.b)).toEqual([31, 210, 270]);
        expect(rises(out.c)).toEqual([73, 239, 310]);
        expect(out.d.slice(120, 151)).toEqual([...Array(30).fill(10), 0]);
    });

    it('ties adjacent full gates, ends ties on rests, and immediately cancels muted bursts', () => {
        const dsp = sequencer([{ cells: [1, 1, -1, 1], gateLength: 100 }, { cells: all(3) }, { cells: all(1), gateLength: 100 }]);
        const out = render(dsp, 510, [0, 120, 240, 360], [], frame => {
            if (frame === 150 || frame === 220) {
                changeTrack(dsp, 1, { mute: Number(frame === 150) });
                changeTrack(dsp, 2, { mute: Number(frame === 150) });
            }
        });
        expect(rises(out.a)).toEqual([0, 360]);
        expect(out.a[239]).toBe(10);
        expect(out.a[240]).toBe(0);
        expect(out.a.at(-1)).toBe(10);
        expect(rises(out.b).filter(n => n >= 120 && n < 360)).toEqual([120, 240, 280, 320]);
        expect(out.c.slice(150, 240)).toEqual(Array(90).fill(0));
    });

    it('keeps multiplied ties continuous across rounded subdivisions and a paused clock', () => {
        const dsp = sequencer([{ cells: all(1), gateLength: 100, ratio: 3 }]);
        const out = render(dsp, 315, [0, 100, 200]);
        expect(out.a.every(v => v === 10)).toBe(true);
        expect(dsp.positions[0]).toBe(6);
    });

    it('keeps a ÷32 section high through two complete steps and scales the first finite gate', () => {
        const dsp = sequencer([
            { ratio: -32, cells: [1, 1, -1], gateLength: 100 },
            { ratio: -32, cells: [1], gateLength: 25 }
        ], 128);
        const out = render(dsp, 6528, edges(66, 100));
        // At 1 kHz, 64 clock intervals of 100 ms span 6,400 frames.
        expect(out.a.slice(0, 6400).every(v => v === 10)).toBe(true);
        expect(out.a.slice(6400).every(v => v === 0)).toBe(true);
        // Before tempo lock, the 125 ms estimate is per incoming clock.
        expect(out.b.indexOf(0)).toBe(1000);
    });

    it('holds past an expected clock edge until a late edge visits a rest', () => {
        const out = render(sequencer([{ cells: [1, 1, -1], gateLength: 100 }], 13),
            250, [0, 100, 210]);
        expect(out.a.indexOf(0)).toBe(210);
        expect(out.a.slice(210).every(v => v === 0)).toBe(true);
    });

    it('releases a paused tie on a track mute or reset, and waits for a clock to reopen', () => {
        const dsp = sequencer([{ cells: [1], gateLength: 100 }, { cells: [1], gateLength: 100 }]);
        const out = render(dsp, 570, [0, 550], [500], frame => {
            if (frame === 300 || frame === 320) changeTrack(dsp, 0, { mute: Number(frame === 300) });
        });
        expect(out.a.indexOf(0)).toBe(300);
        expect(out.b.indexOf(0)).toBe(500);
        expect(rises(out.a)).toEqual([0, 550]);
        expect(rises(out.b)).toEqual([0, 550]);
    });

    it('plays Loopy at each track rate, reads extended cells and resumes the underlying cycle', () => {
        const cells = [1, -1, -1, -1, 1, -1, 1];
        const dsp = sequencer([{ cells, length: 3 }, { cells, length: 2, ratio: -2 }]);
        Object.assign(dsp.params, { fillFirst: 7, fillLast: 5 });
        const out = render(dsp, 990, edges(8, 120), [], frame => {
            if (frame === 100) dsp.params.fill = 1;
            if (frame === 570) dsp.params.fill = 0;
        });
        expect(rises(out.a)).toEqual([0, 120, 360, 480, 720]);
        expect(rises(out.b)).toEqual([0, 240]);
        Object.assign(dsp.params, { fillFirst: 7, fillLast: 7, fill: 1 });
        expect(rises(render(dsp, 250, [10, 130]).a)).toEqual([10, 130]);
    });

    it('cancels delayed steps on reset, preserves measured tempo, and starts once with coincident clock', () => {
        const dsp = sequencer([{ cells: all(3), delay: 50 }, { cells: all(1), ratio: 3 }]);
        const out = render(dsp, 1250, [0, 120, 1050], [155, 1050]);
        expect(rises(out.a).filter(n => n >= 120)).toEqual([1110, 1130, 1150]);
        expect(rises(out.b).filter(n => n >= 120)).toEqual([120, 1050, 1090, 1130]);
    });

    it('rearticulates a sustained gate on a simultaneous reset and clock', () => {
        const dsp = sequencer([{ cells: all(1), gateLength: 100 }]);
        const out = render(dsp, 240, [0, 120], [120]);
        expect(rises(out.a)).toEqual([0, 121]);
        expect(out.a[120]).toBe(0);
        expect(dsp.positions[0]).toBe(0);
    });

    it('rolls chance once per eligible group, independently on each track, and resets repeatably', () => {
        const tracks = [{ cells: all(3), probability: 50 }, { cells: all(3), probability: 0 }, { cells: all(3) }];
        const dsp = sequencer(tracks, 13);
        const clocks = edges(60, 120);
        const run = d => render(d, 7200, clocks);
        const first = run(dsp);
        const grouped = rises(first.a).filter(n => n >= 120);
        for (let n = 120; n < 7200; n += 120) {
            const group = grouped.filter(i => i >= n && i < n + 120);
            expect(group).toEqual(group.length ? [n, n + 40, n + 80] : []);
        }
        expect(grouped.length).toBeGreaterThan(20);
        expect(grouped.length).toBeLessThan(170);
        expect(rises(first.b)).toEqual([]);
        expect(rises(first.c).filter(n => n >= 120)).toHaveLength(59 * 3);
        dsp.reset();
        expect(run(dsp).a).toEqual(first.a);
        tracks[1] = { probability: 67, cells: all(1) };
        expect(run(sequencer(tracks, 1)).a).toEqual(first.a);
    });

    it('fills each buffer at fast and realistic clock rates, including malformed data and close ratchets', () => {
        const tracks = [{ cells: all(12), gateLength: 100 }, { cells: [null, Infinity, 999] }, null, { length: -10 }];
        for (const period of [2, 120]) {
            const run = block => render(sequencer(tracks, block, 48000), 800, edges(5, period));
            const a = run(1);
            expect(run(128)).toEqual(a);
            expect(names.every(name => a[name].every(v => v === 0 || v === 10))).toBe(true);
            expect(rises(a.a).at(-1)).toBeLessThan(5 * period);
        }
        const invalid = sequencer();
        invalid.params.pattern = 'damaged';
        expect(rises(render(invalid, 128, [0, 60]).a)).toEqual([]);
    });
});
