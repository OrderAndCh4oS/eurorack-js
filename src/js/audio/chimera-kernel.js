import { AIRWAY_WASM_BASE64 } from '../../wasm/airway/manifest.js';

export const AIRWAY_RENDER_CAPACITY = 2048;
const MAX_CACHED_RATES = 3;
let compiledModule;
const banks = new Map();
const femaleBanks = new Map();

// AudioWorklet does not provide atob, fetch or TextEncoder consistently. This
// decoder uses only ECMAScript primitives and runs once per realm, before DSP.
function decodeBase64(text) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(128);
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;
    const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
    const bytes = new Uint8Array(text.length / 4 * 3 - padding);
    let cursor = 0;
    for (let i = 0; i < text.length; i += 4) {
        const bits = lookup[text.charCodeAt(i)] << 18 | lookup[text.charCodeAt(i + 1)] << 12 |
            lookup[text.charCodeAt(i + 2)] << 6 | lookup[text.charCodeAt(i + 3)];
        bytes[cursor++] = bits >>> 16;
        if (cursor < bytes.length) bytes[cursor++] = bits >>> 8 & 255;
        if (cursor < bytes.length) bytes[cursor++] = bits & 255;
    }
    return bytes;
}

function moduleForRealm() {
    if (!compiledModule) compiledModule = new WebAssembly.Module(decodeBase64(AIRWAY_WASM_BASE64));
    return compiledModule;
}

function checkedRate(rate) {
    if (!Number.isFinite(rate) || rate < 8000 || rate > 192000) throw new RangeError('Airway sample rate must be 8000–192000 Hz.');
    return rate;
}

function prepareBank(sampleRate, body) {
    const exports = new WebAssembly.Instance(moduleForRealm()).exports;
    const handle = body === 'female' ? exports.airway_create_female(sampleRate) : exports.airway_create(sampleRate);
    const buffer = exports.memory.buffer;
    const memory = new Uint8Array(buffer);
    const outputPointer = exports.airway_output(handle);
    const stackPointer = exports.__stack_pointer.value;
    const allocations = exports.airway_allocations();
    const pristine = body === 'male' ? memory.slice() : null;
    exports.airway_voice_baseline(handle);
    const baseline = memory.slice();
    const beats = [];
    const soundCount = body === 'male' ? 10 : 0;
    const gestureSamples = new Uint32Array(soundCount);
    for (let sound = 0; sound < soundCount; sound++) {
        memory.set(pristine);
        let remaining = exports.airway_prepare_beat(handle, sound);
        while (remaining > 0) {
            const count = Math.min(AIRWAY_RENDER_CAPACITY, remaining);
            exports.airway_render(handle, count);
            remaining -= count;
        }
        if (exports.memory.buffer !== buffer || exports.__stack_pointer.value !== stackPointer || exports.airway_allocations() !== allocations) {
            throw new Error('Airway preparation changed the fixed ABI layout or allocated while rendering.');
        }
        beats.push(memory.slice());
        gestureSamples[sound] = exports.airway_remaining_samples(handle);
    }
    return { sampleRate, handle, outputPointer, stackPointer, baseline, beats, gestureSamples,
        info: Object.freeze({ sampleRate, memoryBytes: buffer.byteLength, snapshotBytes: buffer.byteLength * (beats.length + 1), soundCount: beats.length }) };
}

function bankFor(sampleRate, body) {
    if (body !== 'male' && body !== 'female') throw new RangeError('Airway body must be male or female.');
    const cache = body === 'female' ? femaleBanks : banks;
    const rate = checkedRate(sampleRate);
    let bank = cache.get(rate);
    if (bank) {
        cache.delete(rate);
        cache.set(rate, bank);
        return bank;
    }
    bank = prepareBank(rate, body);
    cache.set(rate, bank);
    if (cache.size > MAX_CACHED_RATES) cache.delete(cache.keys().next().value);
    // Existing instances retain their bank even if it leaves the bounded cache.
    return bank;
}

/** Called during worklet registration, before creating the live processor. */
export function prepareAirway(sampleRate = 48000, body = 'male') {
    return bankFor(sampleRate, body).info;
}

/** One isolated linear memory; no compilation, preparation or allocation on hits. */
export function createAirwayKernel(sampleRate = 48000, body = 'male') {
    let bank = bankFor(sampleRate, body);
    let exports = new WebAssembly.Instance(moduleForRealm()).exports;
    let memory = new Uint8Array(exports.memory.buffer);
    memory.set(bank.baseline);
    let output = new Float32Array(exports.memory.buffer, bank.outputPointer, AIRWAY_RENDER_CAPACITY);
    const handle = bank.handle;
    let speechFrame = new Float64Array(exports.memory.buffer, exports.airway_speech_frame(handle), 66);
    const assertLive = () => { if (!exports) throw new Error('Airway kernel has been disposed.'); };
    return {
        setSpeech(frame, f0, breath) {
            assertLive();
            speechFrame.set(frame);
            exports.airway_set_speech(handle, f0, breath);
        },
        setVoice(f0, vowel, pressure, breath, tension, fry, gate) {
            assertLive();
            exports.airway_set_voice(handle, f0, vowel, pressure, breath, tension, fry, Number(gate));
        },
        setPhoneme(f0, vowel, pressure, breath, tension, fry, gate, sound, amount) {
            assertLive();
            exports.airway_set_phoneme(handle, f0, vowel, pressure, breath, tension, fry, Number(gate), sound, amount);
        },
        setVocalControls(brightness, roughness, voicing, nasal, twang, glide, morph) {
            assertLive();
            exports.airway_set_vocal_controls(handle, brightness, roughness, voicing, nasal, twang, glide, morph);
        },
        setVocal(f0, vowel, pressure, breath, tension, fry, gate, consonant, amount) {
            assertLive();
            exports.airway_set_vocal(handle, f0, vowel, pressure, breath, tension, fry, Number(gate), consonant, amount);
        },
        configureBeat(decay = 1, snap = 0.5) {
            assertLive();
            exports.airway_configure_beat(handle, decay, snap);
            return exports.airway_remaining_samples(handle);
        },
        setBeat(f0, shape, pressure, breath, tension, fry, noise, nasal, lips, tongue, throat, voicing) {
            assertLive();
            exports.airway_set_beat(handle, f0, shape, pressure, breath, tension, fry, noise, nasal, lips, tongue, throat, voicing);
        },
        trigger(sound, f0 = 110) {
            assertLive();
            if (!bank.beats.length) throw new Error('Female vocal kernel has no percussion snapshots.');
            const selected = Number.isFinite(sound) ? Math.max(0, Math.min(9, Math.floor(sound))) : 0;
            memory.set(bank.beats[selected]);
            if (selected === 9) exports.airway_retarget_hum(handle, f0);
            return bank.gestureSamples[selected];
        },
        reset() {
            assertLive();
            memory.set(bank.baseline);
            output.fill(0);
        },
        render(count) {
            assertLive();
            if (!Number.isInteger(count) || count < 0 || count > AIRWAY_RENDER_CAPACITY) throw new RangeError(`Airway render count must be 0–${AIRWAY_RENDER_CAPACITY}.`);
            exports.airway_render(handle, count);
            return output;
        },
        // Read-only diagnostics used to verify the snapshot ABI, never patch data.
        get memoryBuffer() { return exports?.memory.buffer; },
        get memoryBytes() { return exports?.memory.buffer.byteLength || 0; },
        get snapshotBytes() { return bank?.info.snapshotBytes || 0; },
        get allocationCount() { return exports?.airway_allocations() ?? 0; },
        get boundaryStackPointer() { return exports?.__stack_pointer.value; },
        get remainingGestureSamples() { return exports?.airway_remaining_samples(handle) ?? 0; },
        dispose() {
            if (!exports) return;
            exports.airway_destroy(handle);
            output = null;
            speechFrame = null;
            memory = null;
            exports = null;
            bank = null;
        }
    };
}
