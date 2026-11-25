import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import sampler from '../../src/js/modules/slice-sampler/index.js';
import { decodeWav, readWavFile, MAX_FRAMES, MAX_FILE_BYTES } from '../../src/js/modules/slice-sampler/media.js';

const make = (bufferSize = 8, sampleRate = 8000) => sampler.createDSP({ bufferSize, sampleRate });
const level = sample => sample * 5 / 32768;

function install(dsp, channel, frames, sampleRate = 8000) {
    sampler.applyRuntimeCommand(dsp, { type: 'load-sample', channel, pcm: Int16Array.from(frames), sampleRate, name: channel + '.wav' });
    Object.assign(dsp.params, { ['source' + channel]: 1, ['count' + channel]: 1, ['level' + channel]: 1 });
}

function hit(dsp, channel = 'A') {
    dsp.inputs['trig' + channel].fill(0);
    dsp.inputs['trig' + channel][0] = 1;
    dsp.process();
}

function wav(samples, { stereo = false, dataFirst = false } = {}) {
    const pcm = new Uint8Array(samples.length * 2);
    const data = new DataView(pcm.buffer);
    samples.forEach((v, i) => data.setInt16(i * 2, v, true));
    const fmt = new Uint8Array(16);
    const f = new DataView(fmt.buffer);
    f.setUint16(0, 1, true);
    f.setUint16(2, stereo ? 2 : 1, true);
    f.setUint32(4, 44100, true);
    f.setUint32(8, 44100 * (stereo ? 4 : 2), true);
    f.setUint16(12, stereo ? 4 : 2, true);
    f.setUint16(14, 16, true);
    const chunks = [['JUNK', Uint8Array.of(1)], ...(dataFirst ? [['data', pcm], ['fmt ', fmt]] : [['fmt ', fmt], ['data', pcm]])];
    const bytes = new Uint8Array(12 + chunks.reduce((n, [, b]) => n + 8 + b.length + (b.length % 2), 0));
    const view = new DataView(bytes.buffer);
    const write = (at, str) => bytes.set(Array.from(str, c => c.charCodeAt(0)), at);
    write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE');
    let at = 12;
    for (const [tag, payload] of chunks) {
        write(at, tag); view.setUint32(at + 4, payload.length, true); bytes.set(payload, at + 8);
        at += 8 + payload.length + (payload.length % 2);
    }
    return bytes.buffer;
}

describe('slice sampler media', () => {
    it('decodes signed mono and mixes stereo in legal chunk orders with padded unknown chunks', () => {
        const mono = decodeWav(wav([-32768, 32767]));
        expect(mono.sampleRate).toBe(44100);
        expect([...mono.pcm]).toEqual([-32768, 32767]);
        expect([...decodeWav(wav([-8000, 4000, 1000, 3000], { stereo: true, dataFirst: true })).pcm]).toEqual([-2000, 2000]);
    });
    it('rejects malformed sizes, incomplete sample frames, encoding, rate, alignment and empty audio', async () => {
        const valid = wav([42, 24]);
        for (const [offset, value, size] of [[4, 9999, 4], [26, 99, 4], [30, 3, 2], [32, 9, 2], [34, 0, 4], [38, 2, 4], [42, 8, 2], [44, 24, 2], [50, 3, 4]]) {
            const bad = valid.slice(0);
            new DataView(bad)[size === 2 ? 'setUint16' : 'setUint32'](offset, value, true);
            expect(() => decodeWav(bad)).toThrow();
        }
        expect(() => decodeWav(valid.slice(0, -1))).toThrow();
        expect(() => decodeWav(wav([]))).toThrow();
        expect(() => decodeWav(wav([3], { stereo: true }))).toThrow();
        let reads = 0;
        await expect(readWavFile({ size: MAX_FILE_BYTES + 1, arrayBuffer: () => { reads++; } })).rejects.toThrow();
        expect(reads).toBe(0);
    });
    it('loads signed PCM from another JavaScript realm and rejects unsigned, spoofed and non-typed views', () => {
        const dsp = make();
        const command = { type: 'load-sample', channel: 'A', sampleRate: 44100, name: 'across.wav' };
        const pcm = runInNewContext('Int16Array.of(-32768, 32767)');
        sampler.applyRuntimeCommand(dsp, { ...command, pcm });
        expect([...sampler.captureRuntimeState(dsp).A.pcm]).toEqual([-32768, 32767]);
        for (const value of [new DataView(new ArrayBuffer(4)), new Uint16Array(2), { [Symbol.toStringTag]: 'Int16Array' }]) {
            expect(() => sampler.applyRuntimeCommand(dsp, { ...command, pcm: value })).toThrow();
        }
        const spoof = new Uint16Array(2);
        Object.defineProperty(spoof, Symbol.toStringTag, { value: 'Int16Array' });
        expect(() => sampler.applyRuntimeCommand(dsp, { ...command, pcm: spoof })).toThrow();
    });
    it('validates an incoming command before replacing a live slot', () => {
        const dsp = make();
        install(dsp, 'B', [1, 2, 3]);
        const cmd = { type: 'load-sample', channel: 'B', pcm: Int16Array.of(4), sampleRate: 44100, name: 'valid.wav' };
        for (const change of [{ type: 'x' }, { channel: 'Q' }, { pcm: [] }, { pcm: new Int16Array(0) },
            { pcm: new Int16Array(MAX_FRAMES + 1) }, { sampleRate: 3 }, { sampleRate: NaN }, { name: null }]) {
            expect(() => sampler.applyRuntimeCommand(dsp, { ...cmd, ...change })).toThrow();
        }
        expect([...sampler.captureRuntimeState(dsp).B.pcm]).toEqual([1, 2, 3]);
    });
});

describe('slice sampler transport and CV', () => {
    it('keeps buffers stable, performs inclusive rising detection at the exact offset and latches held edges across quanta', () => {
        const dsp = make();
        const input = dsp.inputs.trigA;
        for (const ch of ['A', 'B']) install(dsp, ch, [8192]);
        dsp.process();
        expect([...dsp.outputs.outA]).toEqual(Array(8).fill(0));
        input.set([0, 0.999, 0, 1, 1, 0, 0, 10]);
        dsp.inputs.trigB[3] = 1;
        dsp.process();
        expect([...dsp.outputs.outA]).toEqual([0, 0, 0, 1.25, 0, 0, 0, 1.25]);
        expect([...dsp.outputs.outB]).toEqual([0, 0, 0, 1.25, 0, 0, 0, 0]);
        input.fill(10); dsp.process();
        expect(dsp.outputs.outA.every(v => v === 0)).toBe(true);
        expect(dsp.inputs.trigA).toBe(input);
    });
    it.each(['A','B'])('plays in either direction, latches the region and keeps short boundaries clean on %s', ch => {
        const dsp = make();
        install(dsp, ch, [1000, 2000, 6000, 7000]);
        Object.assign(dsp.params, { ['count'+ch]: 2, ['order'+ch]: 3, ['slice'+ch]: 2 });
        for (const [mode, samples] of [[0,[6000,7000,0,0]], [1,[7000,6000,0,0]], [2,[6000,7000,6000,7000]], [3,[7000,6000,7000,6000]]]) {
            dsp.reset(); dsp.params['playMode'+ch] = mode;
            hit(dsp, ch);
            expect([...dsp.outputs['out'+ch].slice(0,4)]).toEqual(samples.map(level));
        }
        dsp.params['slice'+ch] = 1;
        dsp.inputs['trig'+ch].fill(0);
        dsp.process();
        expect(dsp.outputs['out'+ch][4]).toBe(level(7000));
        dsp.params['stop'+ch] = 1;
        dsp.process();
        expect(dsp.leds['playing'+ch]).toBe(0);
    });
    it.each(['A','B'])('routes all three independent CV assignments on %s', ch => {
        const dsp = make();
        const raw = [1000,2000,3000,4000,5000,6000,7000,8000];
        install(dsp,ch,raw);
        for (const cv of [1,2,3]) {
            for (const [dest, volts, sample] of [[0,5,2000],[1,1,3000],[1,-1,1500],[2,2.5,6000],[3,-5,0],[4,1,7000],[4,0.999,2000]]) {
                dsp.reset();
                Object.assign(dsp.params,{ ['assign1'+ch]:0,['assign2'+ch]:0,['assign3'+ch]:0,
                    ['assign'+cv+ch]: dest,['count'+ch]:dest === 2 ? 4 : 1, ['order'+ch]:3 });
                dsp.inputs['cv'+cv+ch].fill(volts);
                hit(dsp,ch);
                expect(dsp.outputs['out'+ch][1]).toBeCloseTo(level(sample), 6);
            }
        }
    });
    it('sums repeated assignments, clamps pitch overshoot and retains recorded rate at common engine rates', () => {
        for (const rate of [44100,48000,96000]) {
            const dsp = make(4,rate);
            install(dsp,'A',[0,1000,2000,3000,4000,5000,6000,7000],48000);
            hit(dsp);
            expect(dsp.outputs.outA[1]).toBeCloseTo(level(1000 * 48000/rate),5);
        }
        const dsp = make();
        install(dsp,'A',[0,1000,2000,3000,4000,5000,6000,7000]);
        dsp.params.assign2A = 1;
        dsp.inputs.cv1A.fill(1); dsp.inputs.cv2A.fill(1);
        hit(dsp);
        expect(dsp.outputs.outA[1]).toBe(level(4000));
        dsp.params.playModeA = 2; dsp.params.countA = 8; dsp.params.sliceA = 2; dsp.params.orderA = 3;
        dsp.inputs.cv2A.fill(5); hit(dsp);
        expect(dsp.outputs.outA[7]).toBe(level(1000));
    });
    it('applies tune and level continuously without retriggering and sums duplicate level assignments', () => {
        const dsp = make(4);
        install(dsp, 'A', Array.from({ length: 32 }, (_, i) => i * 800));
        dsp.params.playModeA = 2;
        dsp.params.tuneA = 24;
        hit(dsp);
        expect(dsp.outputs.outA[1]).toBe(level(3200));
        dsp.params.tuneA = -24;
        dsp.params.levelA = 0.25;
        dsp.params.assign1A = dsp.params.assign2A = 3;
        dsp.inputs.cv1A.fill(1);
        dsp.inputs.cv2A.fill(1.5);
        dsp.inputs.trigA.fill(0);
        dsp.process();
        expect(dsp.outputs.outA[0]).toBe(level(16*800)*0.75);
        expect(dsp.outputs.outA[1]).toBe(level(16.25*800)*0.75);
        dsp.inputs.cv1A.fill(Infinity);
        dsp.inputs.cv2A.fill(NaN);
        dsp.params.levelA = 0;
        dsp.process();
        expect(dsp.outputs.outA.every(v => v === 0)).toBe(true);
    });
    it('bins addresses, traverses both ways, resets the seeded random order, and coalesces audition and a jack edge', () => {
        const dsp = make(); install(dsp,'A',[1000,2000,3000,4000]);
        dsp.params.countA = 4;
        const region = () => { hit(dsp); return dsp.getSamplerInfo().A.region; };
        dsp.params.auditionA = 1;
        expect([region(),region(),region(),region(),region()]).toEqual([0,1,2,3,0]);
        dsp.reset(); dsp.params.orderA = 1;
        expect([region(),region(),region(),region()]).toEqual([3,2,1,0]);
        dsp.params.orderA = 2;
        dsp.reset(); const series = Array.from({length:16},region);
        dsp.reset(); expect(Array.from({length:16},region)).toEqual(series);
        expect(new Set(series).size).toBeGreaterThan(1);
        dsp.params.orderA = 3;
        for (const [v,index] of [[0,0],[1.25,1],[2.5,2],[3.75,3],[5,3]]) {
            dsp.inputs.cv2A.fill(v); expect(region()).toBe(index);
        }
    });
    it('de-clicks long hits, hard retriggers, source swaps and stops within one millisecond', () => {
        const dsp = make(16);
        install(dsp, 'A', Array(64).fill(32767).concat(Array(64).fill(-32768)));
        Object.assign(dsp.params, { countA: 2, playModeA: 2 });
        hit(dsp);
        const previous = dsp.outputs.outA[15];
        expect(previous).toBeCloseTo(5, 3);
        hit(dsp);
        expect(dsp.outputs.outA[0]).toBe(previous);
        expect(dsp.outputs.outA[8]).toBe(-5);
        dsp.inputs.trigA.fill(0);
        install(dsp, 'A', [0]);
        dsp.process();
        expect(dsp.outputs.outA[0]).toBe(-5);
        expect(dsp.outputs.outA[8]).toBe(0);

        install(dsp, 'A', Array(128).fill(16384));
        hit(dsp);
        dsp.inputs.trigA.fill(0);
        dsp.params.stopA = 1;
        dsp.process();
        expect(dsp.outputs.outA[0]).toBe(2.5);
        expect(dsp.outputs.outA[7]).toBeGreaterThan(0);
        expect(dsp.outputs.outA[8]).toBe(0);
    });
    it('computes strictly increasing manual, grid and zero boundaries and bounds the overview', () => {
        const dsp = make();
        install(dsp,'A',[1,1,1,-1,-1,1,1,1,1]); dsp.params.countA = 2;
        const starts = () => { dsp.process(); return Array.from(dsp.getSamplerInfo().A.starts); };
        expect(starts()).toEqual([0,4]);
        dsp.params.methodA = 1; expect(starts()).toEqual([0,3]); // equally close, choose earlier
        install(dsp,'A',Array(9).fill(200));
        dsp.params.countA = 2; expect(starts()).toEqual([0,4]);
        dsp.params.methodA = 2; dsp.params.markersA = [0,1,0.8,0.2,0.2,0.21,-3,45];
        expect(starts()).toEqual([0,1,7]);
        dsp.params.methodA = 0; dsp.params.countA = 32;
        expect(starts()).toEqual(Array.from({length:9},(_,i) => i));
        expect(dsp.getSamplerInfo().A.overview.length).toBeLessThanOrEqual(192);
    });
});

describe('slice sampler recording and runtime ownership', () => {
    it('records both inputs separately and restores exact committed takes while preserving the prefix of an unfinished take', () => {
        const dsp = make(4); dsp.process();
        dsp.params.recordA = dsp.params.recordB = 1;
        dsp.inputs.recA.set([5,-5,9,NaN]); dsp.inputs.recB.fill(-2.5); dsp.process();
        expect(dsp.leds.recordingA).toBe(1);
        dsp.params.recordA = dsp.params.recordB = 0; dsp.process();
        dsp.params.recordA = 1; dsp.process();
        expect(dsp.leds.recordingA).toBe(0);
        expect(dsp.leds.recordingB).toBe(1);
        const state = sampler.captureRuntimeState(dsp);
        expect([...state.A.pcm]).toEqual([32767,-32768,32767,0,32767,-32768,32767,0]);
        expect([...state.B.pcm]).toEqual(Array(12).fill(-16384));
        expect(state.A.sampleRate).toBe(8000);
        const restored = make(4,48000); sampler.restoreRuntimeState(restored,state); restored.params.sourceA = 1;
        expect(restored.getSamplerInfo().A.frames).toBe(8);
        expect(restored.getSamplerInfo().B.recording).toBe(false);
        restored.reset();
        expect([...sampler.captureRuntimeState(restored).A.pcm]).toEqual([...state.A.pcm]);
        expect(JSON.stringify(restored.params)).not.toContain('pcm');
    });
    it('retains the live voice and in-progress take on B while replacing A', () => {
        const dsp = make(16);
        install(dsp, 'B', Array(512).fill(16384));
        dsp.params.playModeB = 2;
        hit(dsp, 'B');
        dsp.inputs.trigB.fill(0);
        dsp.inputs.recB.fill(-5);
        dsp.params.recordB = 1;
        dsp.process();
        install(dsp, 'A', [0, 123]);
        dsp.params.recordB = 0;
        dsp.process();
        expect(dsp.outputs.outB.every(v => v === 2.5)).toBe(true);
        expect(dsp.getSamplerInfo().B.recording).toBe(true);
        dsp.params.recordB = 1;
        dsp.process();
        expect(sampler.captureRuntimeState(dsp).B.pcm).toEqual(new Int16Array(32).fill(-32768));
        expect(dsp.params.sourceB).toBe(1);
    });
    it('does not arm a restored high action; caps each recording at exactly thirty seconds and remains idle', () => {
        const dsp = make(8192);
        dsp.params.recordA = 1; dsp.process();
        expect(dsp.leds.recordingA).toBe(0);
        dsp.params.recordA = 0; dsp.process(); dsp.params.recordA = 1;
        for (let i=0;i<34;i++) dsp.process();
        expect(dsp.leds.recordingA).toBe(0);
        expect(sampler.captureRuntimeState(dsp).A.pcm.length).toBe(8000 * 30);
    });
    it('reports missing local media, silent output, distinct factory kits and deterministic reset', () => {
        const dsp = make(128); dsp.params.sourceA = 1;
        hit(dsp); expect(dsp.outputs.outA.every(v => v === 0)).toBe(true);
        expect(dsp.getSamplerInfo().A.frames).toBe(0);
        dsp.params.sourceA = 0; dsp.reset(); hit(dsp); const first = dsp.outputs.outA.slice();
        expect(first.some(v => v !== 0)).toBe(true);
        hit(dsp,'B'); expect(dsp.outputs.outB).not.toEqual(first);
        dsp.reset(); hit(dsp); expect(dsp.outputs.outA).toEqual(first);
    });
});
