import { afterEach, describe, expect, it } from 'vitest';
import vocal from '../../src/js/modules/vocal/index.js';
import { VOCAL_SOUNDS, vocalSoundSelection } from '../../src/js/modules/vocal/sounds.js';
import { createAirwayKernel } from '../../src/js/audio/chimera-kernel.js';
import { validateModuleDefinition } from '../../src/js/rack/module-contract.js';
import { createRealFft } from '../../src/js/utils/fft.js';

const live = [];
function make(params = {}, sampleRate = 48000, bufferSize = 128) {
    const dsp = vocal.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, params);
    live.push(dsp);
    return dsp;
}
afterEach(() => live.splice(0).forEach(dsp => dsp.dispose()));
function render(dsp, count, schedule) {
    const size = dsp.outputs.out.length;
    const out = new Float32Array(Math.ceil(count / size) * size);
    for (let n = 0; n < out.length; n += size) {
        if (schedule) for (let i = 0; i < size; i++) schedule(n + i, i, dsp);
        dsp.process();
        out.set(dsp.outputs.out, n);
    }
    return out;
}
const energy = samples => samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
const peak = samples => samples.reduce((sum, value) => Math.max(sum, Math.abs(value)), 0);
const indexOf = label => VOCAL_SOUNDS.findIndex(sound => sound.label === label);
const voiceControls = ['breath', 'tension', 'fry', 'brightness', 'roughness', 'voicing', 'nasal', 'twang', 'glide', 'morph'];
function spectrum(samples) {
    const bins = new Float32Array(4096);
    createRealFft({ size: 8192 }).analyzeCircular(samples.slice(-8192), 0, bins);
    return Float64Array.from(bins, db => 10 ** (db / 10));
}
function bandFraction(bins, low, high) {
    let total = 0, band = 0;
    for (let i = 1; i < bins.length; i++) {
        total += bins[i];
        const hz = i * 48000 / 8192;
        if (hz >= low && hz < high) band += bins[i];
    }
    return band / total;
}
function periodicity(samples) {
    let best = 0;
    for (let lag = 420; lag < 453; lag++) {
        let cross = 0, a = 0, b = 0;
        for (let i = lag; i < samples.length; i++) {
            cross += samples[i] * samples[i - lag];
            a += samples[i] ** 2; b += samples[i - lag] ** 2;
        }
        best = Math.max(best, cross / Math.sqrt(a * b));
    }
    return best;
}
function held(params = {}) {
    const dsp = make({ ...vocalSoundSelection(['A']), breath: 0, ...params });
    dsp.inputs.gate.fill(10);
    render(dsp, 48000);
    return render(dsp, 16384);
}

describe('Vocal alphabet sound pool', () => {
    it('declares 32 independent sound toggles, 16 voice controls/inputs and silent idle', () => {
        validateModuleDefinition(vocal, { sampleRate: 48000, blockSize: 128 });
        const dsp = make();
        expect(vocal.hp).toBe(28);
        expect(vocal.ui.knobs).toHaveLength(16);
        expect(vocal.ui.buttons).toHaveLength(32);
        expect(dsp.params.female).toBe(0);
        expect(vocal.ui.switches.map(control => control.param)).toContain('female');
        expect(VOCAL_SOUNDS.map(sound => sound.label)).toEqual([...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SH', 'CH', 'TH', 'DH', 'NG', 'ZH']);
        for (const control of [...vocal.ui.knobs, ...vocal.ui.buttons]) expect(dsp.params[control.param]).toBe(control.default);
        expect(Object.keys(dsp.inputs)).toEqual(['vOct', 'gate', 'vowelCV', 'soundCV', 'articulationCV', 'pressureCV', ...voiceControls.map(param => `${param}CV`)]);
        expect(dsp.params).not.toHaveProperty('consonant');
        expect(render(dsp, 1024).every(value => value === 0)).toBe(true);
    });

    it.each([[0, 'A'], [1.67, 'M'], [3.34, 'SH'], [5, 'SH'], [-5, 'A'], [100, 'SH']])('selects only enabled sounds at %s V', (cv, label) => {
        const dsp = make(vocalSoundSelection(['A', 'M', 'SH']));
        dsp.inputs.soundCV.fill(cv);
        render(dsp, 128);
        expect(dsp.soundIndex).toBe(indexOf(label));
        expect(dsp.enabledCount).toBe(3);
    });

    it('adds the Sound knob to CV, and updates the pool without needing a gate edge', () => {
        const dsp = make({ ...vocalSoundSelection(['A', 'M', 'SH']), sound: 1 / 3 });
        dsp.inputs.gate.fill(10);
        render(dsp, 4096);
        expect(dsp.soundIndex).toBe(indexOf('M'));
        dsp.inputs.soundCV.fill(1.7);
        render(dsp, 128);
        expect(dsp.soundIndex).toBe(indexOf('SH'));
        dsp.params.enableSH = 0;
        render(dsp, 128);
        expect(dsp.soundIndex).toBe(indexOf('M'));
        expect(dsp.enabledCount).toBe(2);
    });

    it('silences an empty pool and resumes the selected sound without resetting the held voice', () => {
        const dsp = make(vocalSoundSelection(['A']));
        dsp.inputs.gate.fill(10);
        expect(energy(render(dsp, 8192))).toBeGreaterThan(.001);
        Object.assign(dsp.params, vocalSoundSelection([]));
        const ending = render(dsp, 8192);
        expect(peak(ending.slice(-1024))).toBeLessThan(1e-6);
        expect(dsp.soundIndex).toBe(-1);
        expect(dsp.enabledCount).toBe(0);
        dsp.params.enableU = 1;
        expect(energy(render(dsp, 8192))).toBeGreaterThan(.001);
        expect(dsp.soundIndex).toBe(indexOf('U'));
    });

    it('requires Gate >= 1 V and releases the source when Gate falls', () => {
        const dsp = make();
        dsp.inputs.gate.fill(.999);
        expect(peak(render(dsp, 4096))).toBe(0);
        dsp.inputs.gate.fill(1);
        expect(energy(render(dsp, 16384).slice(-4096))).toBeGreaterThan(.001);
        expect(dsp.leds.active).toBe(1);
        dsp.inputs.gate.fill(0);
        expect(energy(render(dsp, 48000).slice(-4096))).toBeLessThan(.000001);
    });

    it('applies pitch, release-vowel, articulation and pressure CV laws', () => {
        const dsp = make({ ...vocalSoundSelection(['M']), pitch: 12, vowel: 1, articulation: .2, pressure: 8 });
        dsp.inputs.vOct.fill(1); dsp.inputs.vowelCV.fill(2.5);
        dsp.inputs.articulationCV.fill(2.5); dsp.inputs.pressureCV.fill(2.5);
        render(dsp, 4096);
        expect(dsp.pitchHz).toBe(440); expect(dsp.vowelPosition).toBe(3);
        expect(dsp.articulationValue).toBeCloseTo(.7, 5); expect(dsp.pressureValue).toBe(18);
        for (const input of Object.values(dsp.inputs)) input.fill(100);
        render(dsp, 4096);
        expect(dsp.pitchHz).toBe(1100); expect(dsp.vowelPosition).toBe(4);
        expect(dsp.articulationValue).toBeCloseTo(1, 5); expect(dsp.pressureValue).toBe(22);
    });

    it.each(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').concat(['SH', 'CH', 'TH', 'DH', 'NG', 'ZH']))('renders %s through an external closure/release gesture', label => {
        const dsp = make({ ...vocalSoundSelection([label]), articulation: 0 });
        dsp.inputs.gate.fill(10);
        render(dsp, 4096);
        dsp.params.articulation = 1;
        const closed = render(dsp, 4096);
        dsp.params.articulation = .6;
        const release = render(dsp, 4096);
        dsp.params.articulation = 0;
        const vowel = render(dsp, 8192);
        expect(dsp.soundIndex).toBe(indexOf(label));
        for (const audio of [closed, release, vowel]) {
            expect(audio.every(Number.isFinite)).toBe(true);
            expect(peak(audio)).toBeLessThanOrEqual(5);
        }
        expect(energy(vowel.slice(-4096))).toBeGreaterThan(.0001);
    });

    it.each(['F', 'S', 'SH', 'TH', 'H'])('produces sustained unvoiced turbulence for %s', label => {
        const dsp = make({ ...vocalSoundSelection([label]), articulation: 1, breath: .2 });
        dsp.inputs.gate.fill(10);
        expect(energy(render(dsp, 16384).slice(-4096))).toBeGreaterThan(1e-8);
    });

    it.each(vocal.ui.knobs.map(control => [control.param, control.min, control.max]))('responds to %s across its range', (param, min, max) => {
        const pool = param === 'vowel' || param === 'articulation' ? vocalSoundSelection(['M']) : param === 'morph' ? vocalSoundSelection(['U']) : {};
        const other = param === 'vowel' ? { articulation: 0 } : param === 'glide' ? { pitch: 12 } : {};
        const a = make({ ...pool, ...other, [param]: min });
        const b = make({ ...pool, ...other, [param]: max });
        a.inputs.gate.fill(10); b.inputs.gate.fill(10);
        expect(render(a, 16384)).not.toEqual(render(b, 16384));
    });

    it('makes brightness change the normalized upper harmonics by at least 3 dB', () => {
        const soft = bandFraction(spectrum(held({ brightness: 0 })), 2000, 8000);
        const bright = bandFraction(spectrum(held({ brightness: 1 })), 2000, 8000);
        expect(bright / soft).toBeGreaterThan(2);
    });

    it('makes roughness and whispered voicing reduce pitch periodicity', () => {
        const clean = periodicity(held({ roughness: 0, voicing: 1 }));
        expect(clean).toBeGreaterThan(.9);
        expect(periodicity(held({ roughness: 1 }))).toBeLessThan(clean - .15);
        const whisper = held({ voicing: 0 });
        expect(energy(whisper)).toBeGreaterThan(1e-9);
        expect(periodicity(whisper)).toBeLessThan(.3);
    });

    it.each(['nasal', 'twang'])('%s changes the normalized spectral shape substantially', param => {
        const a = spectrum(held({ [param]: 0 })), b = spectrum(held({ [param]: 1 }));
        let dot = 0, aa = 0, bb = 0;
        for (let i = 1; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
        expect(dot / Math.sqrt(aa * bb)).toBeLessThan(.95);
    });

    it.each(voiceControls)('%s CV is equivalent to its knob and disconnects without stale control', param => {
        const context = param === 'glide' ? { pitch: 12 } : param === 'morph' ? vocalSoundSelection(['U']) : {};
        const knob = make({ ...context, [param]: .5 }), cv = make({ ...context, [param]: 0 });
        knob.inputs.gate.fill(10); cv.inputs.gate.fill(10);
        cv.inputs[`${param}CV`].fill(2.5);
        // Glide's 2 ms lower bound is its native floor, not an offset to CV.
        expect(render(cv, 16384)).toEqual(render(knob, 16384));
        knob.params[param] = 0; cv.inputs[`${param}CV`].fill(0);
        expect(render(cv, 8192)).toEqual(render(knob, 8192));
        cv.inputs[`${param}CV`].fill(-10);
        expect(render(cv, 1024)).toEqual(render(knob, 1024));
        knob.params[param] = 1; cv.inputs[`${param}CV`].fill(10);
        expect(render(cv, 4096)).toEqual(render(knob, 4096));
    });

    it('preserves the original native voice exactly with all new controls at neutral', () => {
        const a = createAirwayKernel(48000), b = createAirwayKernel(48000);
        b.setVocalControls(.25, 0, 1, 0, 0, .005, 0);
        for (let n = 0; n < 100; n++) {
            for (const k of [a, b]) k.setPhoneme(110, 0, 8, .15, .5, 0, true, n % 32, .7);
            expect(a.render(128).slice()).toEqual(b.render(128));
        }
        a.dispose(); b.dispose();
    });

    it('changes the vocal resonances at the same pitch with the female tract', () => {
        const male = spectrum(held({ female: 0, pitch: 12 }));
        const female = spectrum(held({ female: 1, pitch: 12 }));
        let dot = 0, aa = 0, bb = 0;
        for (let i = 1; i < male.length; i++) { dot += male[i] * female[i]; aa += male[i] ** 2; bb += female[i] ** 2; }
        expect(dot / Math.sqrt(aa * bb)).toBeLessThan(.9);
    });

    it.each([44100, 48000, 96000])('crossfades tract changes on a held gate and resets the selected model at %i Hz', rate => {
        const dsp = make({ female: 0, pitch: 12 }, rate);
        const buffers = { ...dsp.inputs }, out = dsp.outputs.out;
        dsp.inputs.gate.fill(10); render(dsp, rate / 4);
        const before = out.at(-1);
        dsp.params.female = 1;
        const switched = render(dsp, rate / 4);
        expect(switched.every(Number.isFinite)).toBe(true);
        expect(peak(switched)).toBeLessThanOrEqual(5);
        expect(Math.abs(switched[0] - before)).toBeLessThan(.5);
        expect(energy(switched.slice(-4096))).toBeGreaterThan(.0001);
        expect(dsp.tractMix).toBe(1); expect(dsp.pitchHz).toBe(220);
        dsp.params.female = 0; render(dsp, rate / 4); expect(dsp.tractMix).toBe(0);
        dsp.params.female = 1; dsp.reset(); dsp.inputs.gate.fill(10);
        const first = render(dsp, 8192);
        dsp.reset(); dsp.inputs.gate.fill(10); expect(render(dsp, 8192)).toEqual(first);
        expect(dsp.outputs.out).toBe(out);
        for (const [key, buffer] of Object.entries(buffers)) expect(dsp.inputs[key]).toBe(buffer);
    });

    it.each([110, 220, 440])('tracks %i Hz with the female model without shifting playback rate', frequency => {
        const dsp = make({ female: 1, pitch: 12 * Math.log2(frequency / 110), breath: 0 });
        dsp.inputs.gate.fill(10); render(dsp, 24064);
        const audio = render(dsp, 16384), expectedLag = 48000 / frequency;
        let best = -1, bestLag = 0;
        for (let lag = Math.floor(expectedLag * .95); lag <= expectedLag * 1.05; lag++) {
            let a = 0, b = 0, cross = 0;
            for (let i = lag; i < audio.length; i++) { a += audio[i] ** 2; b += audio[i - lag] ** 2; cross += audio[i] * audio[i - lag]; }
            const correlation = cross / Math.sqrt(a * b);
            if (correlation > best) { best = correlation; bestLag = lag; }
        }
        expect(best).toBeGreaterThan(.9);
        expect(Math.abs(48000 / bestLag / frequency - 1)).toBeLessThan(.01);
    });

    it('does not revive a dormant held note when changing tracts with Gate closed', () => {
        const dsp = make();
        dsp.inputs.gate.fill(10); render(dsp, 24576);
        dsp.params.female = 1; render(dsp, 24576);
        dsp.inputs.gate.fill(0); render(dsp, 48000);
        expect(peak(render(dsp, 2048))).toBeLessThan(1e-6);
        dsp.params.female = 0;
        expect(peak(render(dsp, 24576))).toBeLessThan(1e-6);
        dsp.inputs.gate.fill(10);
        expect(energy(render(dsp, 24576))).toBeGreaterThan(.001);
        dsp.inputs.gate.fill(0); render(dsp, 48000);
        dsp.params.female = 1;
        expect(peak(render(dsp, 24576))).toBeLessThan(1e-6);
    });

    it('updates every native sound without allocation, scheduling or physical-state restores', () => {
        const kernel = createAirwayKernel(48000);
        const memory = kernel.memoryBuffer, allocations = kernel.allocationCount, stack = kernel.boundaryStackPointer;
        for (let i = 0; i < 96; i++) {
            kernel.setVocalControls(i % 2, i % 3 / 2, i % 2, i % 2, i % 2, .1, i % 2);
            kernel.setPhoneme(220, i % 5, 8, .1, .5, 0, true, i % 32, (i % 7) / 6);
            expect(kernel.render(128).every(Number.isFinite)).toBe(true);
            expect(kernel.remainingGestureSamples).toBe(0);
        }
        expect(kernel.memoryBuffer).toBe(memory); expect(kernel.allocationCount).toBe(allocations);
        expect(kernel.boundaryStackPointer).toBe(stack);
        kernel.dispose();
    });

    it.each([44100, 48000, 96000])('resets deterministically with a persisted pool at %i Hz', rate => {
        const dsp = make({ ...vocalSoundSelection(['A', 'M', 'SH']), pressure: 22, level: 1, brightness: 1, roughness: 1, nasal: 1, twang: 1, morph: .2, glide: .02 }, rate);
        const inputs = { ...dsp.inputs }, out = dsp.outputs.out;
        const schedule = (n, i, d) => {
            d.inputs.gate[i] = n > 15 ? 10 : 0;
            d.inputs.soundCV[i] = (n % 1200) / 240;
            d.inputs.articulationCV[i] = n % 200 < 80 ? 5 : 0;
        };
        const first = render(dsp, 8192, schedule);
        expect(first.every(Number.isFinite)).toBe(true); expect(peak(first)).toBeLessThanOrEqual(5);
        dsp.reset(); expect(render(dsp, 8192, schedule)).toEqual(first);
        expect(dsp.outputs.out).toBe(out);
        for (const [key, value] of Object.entries(inputs)) expect(dsp.inputs[key]).toBe(value);
        for (const key of Object.keys(dsp.params)) dsp.params[key] = NaN;
        for (const input of Object.values(dsp.inputs)) input.fill(Infinity);
        expect(render(dsp, 512).every(Number.isFinite)).toBe(true);
    });

    it('tracks settled 55, 110, 220 and 440 Hz within 1%', () => {
        for (const frequency of [55, 110, 220, 440]) {
            const dsp = make({ ...vocalSoundSelection(['A']), pitch: 12 * Math.log2(frequency / 110), breath: 0, fry: 0 });
            dsp.inputs.gate.fill(10); render(dsp, 24576);
            const out = render(dsp, 12288), expectedLag = 48000 / frequency;
            let best = Infinity, bestLag = 0;
            for (let lag = Math.floor(expectedLag * .95); lag <= expectedLag * 1.05; lag++) {
                let difference = 0;
                for (let i = 0; i < 8192; i++) difference += (out[i] - out[i + lag]) ** 2;
                if (difference < best) { best = difference; bestLag = lag; }
            }
            expect(Math.abs(48000 / bestLag / frequency - 1)).toBeLessThan(.01);
        }
    });

    it('is block-size invariant under sample-timed gates, sound CV and articulation', () => {
        const a = make({ female: 1 }, 48000, 128), b = make({ female: 1 }, 48000, 512);
        const schedule = (n, i, d) => {
            d.inputs.gate[i] = n >= 31 && n < 7000 ? 10 : 0;
            d.inputs.articulationCV[i] = n > 1000 && n < 3000 ? 5 : 0;
            d.inputs.soundCV[i] = n / 1600;
        };
        expect(render(a, 8192, schedule)).toEqual(render(b, 8192, schedule));
    });
});
