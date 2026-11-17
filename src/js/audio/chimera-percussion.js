import { createAirwayKernel, prepareAirway } from './chimera-kernel.js';
import { createBeatboxResampler, prepareBeatboxResampler } from './beatbox-resampler.js';
import { createSlew } from '../utils/slew.js';
import { softLimitVoltage } from '../utils/voltage.js';
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const control = (v, fallback, lo, hi) => clamp(finite(v, fallback), lo, hi);
const PHYSICAL = [
    ['noise', 1, 0, 2, .4], ['nasal', 0, 0, 1, .2], ['lips', 0, -1, 1, .2],
    ['tongue', 0, -1, 1, .2], ['throat', 0, 0, 1, .2], ['voicing', 1, 0, 1, .2],
    ['tension', .5, 0, 1, .2], ['fry', 0, 0, 1, .2]
].map(values => [...values, `${values[0]}CV`]);
export function preparePercussion({ sampleRate = 44100 } = {}) {
    prepareBeatboxResampler();
    return prepareAirway(sampleRate);
}
export function createPercussion({ sampleRate = 44100, bufferSize = 512 } = {}, ui, advanced = false) {
    const kernel = createAirwayKernel(sampleRate);
    const reader = createBeatboxResampler(kernel);
    const out = new Float32Array(bufferSize);
    const inputs = Object.fromEntries(ui.inputs.map(p => [p.port, new Float32Array(bufferSize)]));
    const outputs = { out };
    if (advanced) { outputs.env = new Float32Array(bufferSize); outputs.active = new Float32Array(bufferSize); }
    const params = Object.fromEntries([...ui.knobs, ...ui.switches, ...ui.actions].map(c => [c.param, c.default]));
    const levelSlew = createSlew({ sampleRate, timeMs: 5 });
    const tuneSlew = createSlew({ sampleRate, timeMs: 2 });
    const accentSlew = createSlew({ sampleRate, timeMs: 5 });
    const physical = Object.fromEntries(PHYSICAL.map(([key, value]) => [key, value]));
    const physicalStep = 1 - Math.exp(-64 / (sampleRate * .005));
    const envelopeDecay = Math.exp(-1 / (sampleRate * .02));
    const meterDecay = Math.exp(-1 / (sampleRate * .05));
    const bridgeLength = Math.max(1, Math.round(sampleRate * .001));
    const chokeStep = 1 / Math.max(1, Math.round(sampleRate * .005));
    let initialized = false, disposed = false, playing = false, phase = 0;
    let lastTrig = 0, lastHit = 0, choking = false, chokeGain = 1;
    let levelTarget = .8, tuneTarget = 1, accent = 1, remaining = 0;
    let previous = 0, bridgeFrom = 0, bridge = 0, envelope = 0, meter = 0, led = 0;
    accentSlew.reset(1); tuneSlew.reset(1);
    function address(sample) {
        const raw = Math.floor(control(params.sound, 0, 0, 9) + 2 * finite(inputs.soundCV[sample]));
        return finite(params.wrap) >= .5 ? ((raw % 10) + 10) % 10 : clamp(raw, 0, 9);
    }
    function renderSpan(start, length) {
        for (let j = start; j < start + length; j++) {
            const ratio = tuneSlew.process(tuneTarget);
            const gain = levelSlew.process(levelTarget);
            const emphasis = accentSlew.process(remaining > 0 ? accent : 1);
            if (choking) chokeGain = Math.max(0, chokeGain - chokeStep);
            let value = playing ? softLimitVoltage(5 * gain * emphasis * reader.next(ratio), 5, .8) : 0;
            if (bridge > 0) { const blend = 1 - bridge / bridgeLength; value = bridgeFrom + blend * (value - bridgeFrom); bridge--; }
            value *= chokeGain;
            out[j] = value; previous = value;
            remaining = Math.max(0, remaining - ratio);
            envelope = Math.max(Math.abs(value), envelope * envelopeDecay);
            meter = Math.max(Math.abs(value) / 5, meter * meterDecay);
            if (advanced) { outputs.env[j] = clamp(envelope, 0, 5); outputs.active[j] = !choking && remaining > 0 ? 10 : 0; }
            if (chokeGain === 0 || (remaining === 0 && envelope < 1e-6)) playing = false;
        }
    }
    const dsp = {
        params, inputs, outputs, leds: { active: 0, level: 0 },
        pitchHz: 110, tuneSemitones: 0, shapePosition: 0, pressureValue: 8,
        soundIndex: -1, selectedSoundIndex: 0, decayValue: 1, snapValue: .5,
        gestureActive: 0, displayTick: 0,
        process() {
            if (disposed) { for (const output of Object.values(outputs)) output.fill(0); return; }
            levelTarget = control(params.level, .8, 0, 1);
            if (!initialized) { levelSlew.reset(levelTarget); initialized = true; }
            const hit = finite(params.audition) >= .5 ? 1 : 0;
            let spanStart = 0;
            for (let i = 0; i < bufferSize; i++) {
                const trig = finite(inputs.trig[i]);
                const choke = advanced && finite(inputs.choke[i]) >= 1;
                const edge = (trig >= 1 && lastTrig < 1) || (hit && !lastHit);
                lastTrig = trig; lastHit = hit;
                if (phase === 0 || edge || choke !== choking) {
                    renderSpan(spanStart, i - spanStart); spanStart = i;
                    choking = choke;
                    dsp.tuneSemitones = clamp(control(params.pitch, 0, -12, 12) + 12 * finite(inputs.vOct[i]), -12, 12);
                    tuneTarget = 2 ** (dsp.tuneSemitones / 12);
                    dsp.pitchHz = 110 * tuneTarget;
                    dsp.shapePosition = clamp(control(params.shape, 0, 0, 4) + .8 * finite(inputs.shapeCV[i]), 0, 4);
                    dsp.pressureValue = clamp(control(params.pressure, 8, 0, 22) + 4 * finite(inputs.pressureCV[i]), 0, 22);
                    dsp.selectedSoundIndex = address(i);
                    if (edge && !choking) {
                        dsp.soundIndex = dsp.selectedSoundIndex;
                        dsp.decayValue = clamp(control(params.decay, 1, .25, 4) * 2 ** clamp(finite(inputs.decayCV[i]) / 2.5, -20, 20), .25, 4);
                        dsp.snapValue = clamp(control(params.snap, .5, 0, 1) + .2 * finite(inputs.snapCV[i]), 0, 1);
                        accent = 1 + clamp(finite(inputs.accent[i]), 0, 5) / 10;
                        kernel.trigger(dsp.soundIndex, 110);
                        remaining = kernel.configureBeat(dsp.decayValue * tuneTarget, dsp.snapValue) + 32;
                        reader.reset(); tuneSlew.reset(tuneTarget);
                        playing = true; chokeGain = 1; led = Math.round(sampleRate * .05);
                        bridgeFrom = previous; bridge = bridgeLength;
                    }
                    if (advanced) {
                        for (const [key, fallback, lo, hi, scale, port] of PHYSICAL) {
                            const target = clamp(control(params[key], fallback, lo, hi) + scale * finite(inputs[port][i]), lo, hi);
                            physical[key] += physicalStep * (target - physical[key]);
                        }
                    }
                    kernel.setBeat(110, dsp.shapePosition, dsp.pressureValue, control(params.breath, .15, 0, 1),
                        physical.tension, physical.fry, physical.noise, physical.nasal, physical.lips,
                        physical.tongue, physical.throat, physical.voicing);
                }
                if (led > 0) led--;
                phase = (phase + 1) & 63;
            }
            renderSpan(spanStart, bufferSize - spanStart);
            dsp.gestureActive = remaining > 0 && !choking ? 1 : 0;
            dsp.leds.active = led > 0 && !choking ? 1 : 0;
            dsp.leds.level = clamp(meter, 0, 1); dsp.displayTick = (dsp.displayTick + 1) >>> 0;
        },
        reset() {
            if (disposed) return;
            kernel.reset(); reader.reset();
            initialized = false; playing = false; phase = 0; lastTrig = 0; lastHit = 0;
            choking = false; chokeGain = 1; remaining = 0; accent = 1; previous = 0;
            bridgeFrom = 0; bridge = 0; envelope = 0; meter = 0; led = 0; tuneTarget = 1;
            levelSlew.reset(0); tuneSlew.reset(1); accentSlew.reset(1);
            for (const [key, value] of PHYSICAL) physical[key] = value;
            for (const input of Object.values(inputs)) input.fill(0);
            for (const output of Object.values(outputs)) output.fill(0);
            dsp.pitchHz = 110; dsp.tuneSemitones = 0; dsp.shapePosition = 0; dsp.pressureValue = 8;
            dsp.soundIndex = -1; dsp.selectedSoundIndex = 0; dsp.decayValue = 1; dsp.snapValue = .5;
            dsp.gestureActive = 0; dsp.displayTick = 0; dsp.leds.active = 0; dsp.leds.level = 0;
        },
        dispose() { if (disposed) return; disposed = true; kernel.dispose(); for (const output of Object.values(outputs)) output.fill(0); dsp.leds.active = 0; dsp.leds.level = 0; }
    };
    return dsp;
}
