import { describe, expect, it } from 'vitest';
import definition from '../../src/js/modules/fold-perc/index.js';

const rate = 48000;
const dry = { harmonic: 0, morph: 0, fold: 0, attack: 0.5, decay: 1 };
const timbre = ['attack', 'decay', 'morph', 'harmonic', 'spread', 'fold'];
const defaults = {
    pitch: 0.25, attack: 0.5, decay: 0.45, morph: 0, harmonic: 0.35,
    spread: 0, fold: 0.15, mode: 0, range: 0, hit: 0
};

function render(params = {}, ports = {}, length = 8192, block = 128, sampleRate = rate) {
    const dsp = definition.createDSP({ sampleRate, bufferSize: block });
    Object.assign(dsp.params, params);
    const audio = new Float32Array(length);
    const signals = { trigger: sample => sample === 0 ? 5 : 0, ...ports };
    for (let start = 0; start < length; start += block) {
        for (const [port, signal] of Object.entries(signals)) {
            const buffer = dsp.inputs[port];
            if (typeof signal === 'number') buffer.fill(signal);
            else for (let i = 0; i < block; i++) buffer[i] = signal(start + i);
        }
        dsp.process();
        audio.set(dsp.outputs.out.subarray(0, Math.min(block, length - start)), start);
    }
    return audio;
}

function rms(audio, start = 0, end = audio.length) {
    let power = 0;
    for (let i = start; i < end; i++) power += audio[i] ** 2;
    return Math.sqrt(power / (end - start));
}

// Hann-windowed magnitude at a selected frequency. All spectral fixtures run at 48 kHz.
function magnitude(audio, hz, start = 1200, end = audio.length) {
    let re = 0;
    let im = 0;
    const length = end - start;
    for (let i = 0; i < length; i++) {
        const weighted = audio[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / length));
        const phase = 2 * Math.PI * hz * i / rate;
        re += weighted * Math.cos(phase);
        im += weighted * Math.sin(phase);
    }
    return 4 * Math.hypot(re, im) / length;
}

function frequency(audio, start, end) {
    const crossings = [];
    for (let i = start + 1; i < end; i++) {
        if (audio[i - 1] < 0 && audio[i] >= 0) {
            crossings.push(i - audio[i] / (audio[i] - audio[i - 1]));
        }
    }
    expect(crossings.length).toBeGreaterThan(1);
    return rate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]);
}

function difference(a, b) {
    let peak = 0;
    for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i] - b[i]));
    return peak;
}

describe('Fold Percussion', () => {
    it('declares the seven controls, two selectors, Hit and ten zero-normalled inputs', () => {
        const dsp = definition.createDSP({ bufferSize: 67 });
        expect(definition).toMatchObject({ id: 'fold-perc', name: 'FOLD PERC', hp: 16, category: 'voice' });
        expect(dsp.params).toEqual(defaults);
        expect(definition.ui.knobs.map(k => k.param).sort()).toEqual(['pitch', ...timbre].sort());
        for (const knob of definition.ui.knobs) {
            expect(knob).toMatchObject({ min: 0, max: 1, default: defaults[knob.param] });
        }
        expect(definition.ui.switches.map(s => s.positions)).toEqual([['Skin', 'Liquid', 'Metal'], ['Bass', 'Alto', 'Treble']]);
        expect(definition.ui.actions).toMatchObject([{ param: 'hit', default: 0, mode: 'trigger' }]);
        expect(definition.ui.leds).toEqual(['active']);
        const range = { trigger: 10, pitchCV: 8, modeCV: 5, rangeCV: 5 };
        for (const name of timbre) range[name + 'CV'] = 5;
        expect(Object.keys(dsp.inputs).sort()).toEqual(Object.keys(range).sort());
        expect(definition.ui.inputs).toHaveLength(10);
        for (const { port, voltage, signal } of definition.ui.inputs) {
            expect(voltage).toEqual({ min: 0, max: range[port], normal: 0 });
            expect(signal).toBe(port === 'trigger' ? 'trigger' : 'cv');
            expect(dsp.inputs[port]).toEqual(new Float32Array(67));
        }
        expect(definition.ui.outputs).toMatchObject([{ port: 'out', signal: 'audio', voltage: { min: -5, max: 5 } }]);
        dsp.outputs.out.fill(NaN);
        dsp.process();
        expect(dsp.outputs.out).toEqual(new Float32Array(67));
        expect(dsp.leds.active).toBe(0);
    });

    it('fires at 3 V inside a block and rings out identically for 1 sample, 5 ms and held gates', () => {
        const edge = 47;
        const pulse = end => i => i < edge ? 2.99 : i < end ? 3 : 0;
        const params = { ...dry, decay: 0 };
        const short = render(params, { trigger: pulse(edge + 1) }, 16000);
        expect(short.slice(0, edge).every(x => x === 0)).toBe(true);
        expect(rms(short, edge, edge + 5)).toBeGreaterThan(0);
        expect(rms(short, 15000)).toBeLessThan(1e-5);
        for (const duration of [240, Infinity]) {
            expect(difference(short, render(params, { trigger: pulse(edge + duration) }, short.length))).toBe(0);
        }
        const retrigger = render(params, { trigger: i => i === 12000 ? 0 : 10 }, 16000);
        expect(rms(retrigger, 12100, 12500)).toBeGreaterThan(0.5);
    });

    it('detects Hit independently of a held jack and merges coincident edges', () => {
        const dsp = definition.createDSP({ sampleRate: rate, bufferSize: 128 });
        Object.assign(dsp.params, dry, { decay: 0, hit: 1 });
        dsp.inputs.trigger.fill(5);
        dsp.process();
        expect(dsp.outputs.out).toEqual(render({ ...dry, decay: 0 }, {}, 128));
        for (let times = 0; times < 2; times++) {
            dsp.params.hit = 0;
            for (let i = 0; i < 80; i++) dsp.process();
            expect(rms(dsp.outputs.out)).toBeLessThan(1e-5);
            dsp.params.hit = 1;
            dsp.process();
            expect(rms(dsp.outputs.out)).toBeGreaterThan(0.5);
        }
        // A held panel button also leaves the jack usable.
        for (let i = 0; i < 80; i++) dsp.process();
        dsp.inputs.trigger[4] = 0;
        dsp.process();
        expect(rms(dsp.outputs.out)).toBeGreaterThan(0.5);
    });

    it.each([[0, 0, 0, 27.5], [1, 0, 0, 440], [0.25, 0, 0, 55], [0.25, 0, 1, 110],
        [0.25, 1, 0, 220], [0.25, 2, 0, 880]])('tracks panel pitch %s, register %s and %s V', (pitch, range, cv, expected) => {
        const audio = render({ ...dry, pitch, range }, { pitchCV: cv }, 16000);
        expect(Math.abs(frequency(audio, 1200, audio.length) / expected - 1)).toBeLessThan(0.02);
    });

    it.each([[0, [1, 2, 3, 4, 5, 6]], [1, [1, 3, 5, 7, 11, 13]]])('locates all six partials at Spread %s', (spread, ratios) => {
        const params = { ...dry, pitch: 0.5, spread };
        const full = render({ ...params, harmonic: 1 }, {}, 9600);
        const isolated = render(params, {}, 9600);
        for (const ratio of ratios.slice(1)) {
            expect(magnitude(full, ratio * 110)).toBeGreaterThan(0.025 * magnitude(full, 110));
            expect(magnitude(isolated, ratio * 110)).toBeLessThan(0.056 * magnitude(isolated, 110));
        }
        expect(frequency(isolated, 1000, 9000)).toBeCloseTo(110, 1);
        if (spread === 0) {
            const two = render({ ...params, harmonic: 0.2 }, {}, 9600);
            expect(magnitude(two, 220)).toBeGreaterThan(0.08 * magnitude(two, 110));
            expect(magnitude(two, 330)).toBeLessThan(0.02 * magnitude(two, 110));
        }
    });

    it('sweeps down to the Skin pitch in Liquid and adds difference sidebands in Metal', () => {
        const liquid = render({ ...dry, pitch: 0.6, mode: 1 }, {}, 18000);
        const skin = render({ ...dry, pitch: 0.6 }, {}, 18000);
        const steady = frequency(skin, 12000, 18000);
        expect(frequency(liquid, 0, 1500)).toBeGreaterThan(1.5 * steady);
        expect(Math.abs(frequency(liquid, 12000, 18000) / steady - 1)).toBeLessThan(0.05);
        const params = { ...dry, pitch: 0.5, harmonic: 1, spread: 0.5 };
        const additive = magnitude(render(params, {}, 12000), 165);
        const metal = magnitude(render({ ...params, mode: 2 }, {}, 12000), 165);
        expect(metal).toBeGreaterThan(Math.max(0.02, additive * 6));
    });

    it('shapes a noise transient, a clean pop and a soft attack', () => {
        const noisy = render({ ...dry, attack: 0 });
        const pop = render(dry);
        const soft = render({ ...dry, attack: 1 });
        expect(rms(soft, 0, 480)).toBeLessThan(0.4 * rms(pop, 0, 480));
        expect(rms(soft, 3600, 4800)).toBeGreaterThan(rms(soft, 0, 480) * 2);
        const highBand = audio => audio.slice(1, 480).reduce((sum, x, i) => sum + (x - audio[i]) ** 2, 0);
        expect(highBand(noisy)).toBeGreaterThan(10 * highBand(pop));
    });

    it.each([0, 1])('holds the programmed decay after Fold %s', fold => {
        const short = render({ ...dry, fold, decay: 0 }, {}, 10000);
        const long = render({ ...dry, fold }, {}, 26000);
        expect(rms(short, 9000)).toBeLessThan(0.01 * rms(short, 0, 960));
        expect(rms(long, 24000)).toBeGreaterThan(0.01 * rms(long, 0, 960));
    });

    it('morphs continuously between sine, triangle, saw and square spectra', () => {
        const wave = morph => render({ ...dry, pitch: 0.75, morph });
        const spectra = [0, 1/3, 2/3, 1].map(morph => {
            const audio = wave(morph);
            return [440, 660].map(hz => magnitude(audio, hz) / magnitude(audio, 220));
        });
        expect(spectra[0][1]).toBeLessThan(0.01);
        expect(spectra[1][0]).toBeLessThan(0.02);
        expect(spectra[1][1]).toBeGreaterThan(0.06);
        expect(spectra[2][0]).toBeGreaterThan(0.2);
        expect(spectra[3][0]).toBeLessThan(0.02);
        expect(spectra[3][1]).toBeGreaterThan(0.22);
        for (const boundary of [1/3, 2/3]) {
            expect(difference(wave(boundary - 0.00001), wave(boundary + 0.00001))).toBeLessThan(0.003);
        }
    });

    it('adds folded harmonics and a continuous top-quarter buzz', () => {
        const wave = fold => render({ ...dry, pitch: 0.75, fold });
        const clean = wave(0);
        const folded = wave(0.5);
        expect(magnitude(folded, 660)).toBeGreaterThan(magnitude(clean, 660) + 0.1);
        expect(difference(folded, wave(0.75))).toBeGreaterThan(0.1);
        expect(difference(wave(0.75), wave(1))).toBeGreaterThan(0.1);
        expect(difference(wave(0.75 - 1e-5), wave(0.75 + 1e-5))).toBeLessThan(0.01);
    });

    it('suppresses the fifth harmonic of a 5600 Hz square reflected to 20 kHz', () => {
        const audio = render({ ...dry, pitch: 0, morph: 1 }, { pitchCV: Math.log2(5600 / 27.5) }, 14400);
        const reflected = magnitude(audio, 20000) / magnitude(audio, 5600);
        expect(reflected).toBeLessThan(0.1); // A naive square gives ~0.2.
    });

    it('reduces reflected energy from a driven high sine compared with direct folding', () => {
        const params = { ...dry, pitch: 0 };
        const cv = { pitchCV: Math.log2(5600 / 27.5) };
        const length = 14400;
        const clean = render(params, cv, length);
        const folded = render({ ...params, fold: 0.5 }, cv, length);
        // The same sine, envelope split and fivefold drive, sampled directly.
        const reference = clean.map((sample, i) => {
            const halfBody = Math.pow(0.001, i / (2 * 2.4 * rate));
            const driven = sample / halfBody;
            const period = driven + 1 - 4 * Math.floor((driven + 1) / 4);
            return 5 * halfBody * (1 - Math.abs(period - 2));
        });
        for (const hz of [20000, 10400]) {
            expect(magnitude(folded, hz)).toBeLessThan(0.6 * magnitude(reference, hz));
        }
    });

    it.each(timbre)('adds/clamps %s CV at audio rate, including mid-block changes', name => {
        const params = { pitch: 0.55, harmonic: 0.8, decay: 0.8, spread: 0.4, [name]: 0.2 };
        const cv = name + 'CV';
        const knob = render({ ...params, [name]: 0.7 });
        expect(difference(render(params, { [cv]: 2.5 }), knob)).toBeLessThan(1e-5);
        const unmodulated = render(params);
        expect(difference(unmodulated, render(params, { [cv]: -4 }))).toBe(0);
        expect(difference(render(params, { [cv]: 5 }), render(params, { [cv]: 12 }))).toBe(0);
        const edge = 285;
        const modulated = render(params, { [cv]: i => i < edge ? 0 : 2.5 });
        expect(difference(unmodulated.subarray(0, edge), modulated.subarray(0, edge))).toBe(0);
        expect(difference(unmodulated.subarray(edge), modulated.subarray(edge))).toBeGreaterThan(0.01);
    });

    it.each(['mode', 'range'])('maps the three voltage bands as saturating offsets for %s', name => {
        const params = { ...dry, harmonic: 0.8, spread: 0.35 };
        for (const [base, cv, selected] of [[0, 0, 0], [0, 1.66, 0], [0, 5/3, 1], [0, 1.67, 1], [0, 2.5, 1],
            [0, 3.33, 1], [0, 10/3, 2], [0, 3.34, 2], [0, 5, 2], [1, 2.5, 2], [1, 5, 2]]) {
            expect(difference(render({ ...params, [name]: base }, { [name + 'CV']: cv }),
                render({ ...params, [name]: selected }))).toBe(0);
        }
    });

    it('reproduces the first noisy hit after reset, clears buffers in place and times its LED', () => {
        const dsp = definition.createDSP({ sampleRate: rate, bufferSize: 240 });
        dsp.params.attack = 0;
        const ports = { ...dsp.inputs, ...dsp.outputs };
        dsp.params.hit = 1;
        dsp.process();
        const first = dsp.outputs.out.slice();
        for (let i = 1; i < 9; i++) dsp.process();
        expect(dsp.leds.active).toBe(1);
        for (let i = 0; i < 2; i++) dsp.process();
        expect(dsp.leds.active).toBe(0);
        for (const input of Object.values(dsp.inputs)) input.fill(5);
        dsp.reset();
        expect(dsp.leds.active).toBe(0);
        expect(dsp.params.hit).toBe(0);
        for (const [port, buf] of Object.entries(ports)) {
            expect(buf).toBe(dsp.inputs[port] ?? dsp.outputs[port]);
            expect(buf.every(value => value === 0)).toBe(true);
        }
        dsp.params.hit = 1;
        dsp.process();
        expect(dsp.outputs.out).toEqual(first);
    });

    it('synthesizes the same event stream at different block boundaries and respects the rails', () => {
        const params = { attack: 0, harmonic: 1, morph: 0.85, spread: 1, fold: 1, mode: 2, range: 2 };
        const cv = i => 2.5 + 2.5 * Math.sin(i / 280);
        const ports = { trigger: i => i % 927 < 12 ? 10 : 0, pitchCV: cv, harmonicCV: cv, foldCV: cv };
        for (const sampleRate of [44100, 48000, 96000]) {
            const a = render(params, ports, 4096, 128, sampleRate);
            const b = render(params, ports, 4096, 512, sampleRate);
            expect(a.every(v => Number.isFinite(v) && Math.abs(v) <= 5)).toBe(true);
            expect(difference(a, b)).toBe(0);
        }
    });
});
