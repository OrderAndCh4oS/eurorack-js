// Limits apply to decoded mono frames and complete input files independently.
export const MAX_FRAMES = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = 33 * 1024 * 1024;
const CHUNK_FRAMES = 4096;
const OVERVIEW_BINS = 96;
// Built-in accessors check internal slots across windows, workers and VM realms.
const typedArrayName = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Int16Array.prototype), Symbol.toStringTag).get;
const arrayBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;

function bufferLength(buffer) {
    try { return arrayBufferLength.call(buffer); }
    catch { return -1; }
}

export function decodeWav(buffer) {
    const length = bufferLength(buffer);
    if (length < 12 || length > MAX_FILE_BYTES) {
        throw new Error('Choose a RIFF WAV file up to 33 MiB.');
    }
    const view = new DataView(buffer);
    const tag = at => String.fromCharCode(view.getUint8(at), view.getUint8(at+1), view.getUint8(at+2), view.getUint8(at+3));
    const u16 = at => view.getUint16(at, true);
    const u32 = at => view.getUint32(at, true);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || u32(4) !== buffer.byteLength - 8) {
        throw new Error('Invalid RIFF/WAVE header or file length.');
    }

    let fmt, dataOffset, dataSize;
    for (let at = 12; at < buffer.byteLength;) {
        if (at + 8 > buffer.byteLength) throw new Error('Truncated WAV chunk header.');
        const kind = tag(at);
        const length = u32(at + 4);
        const start = at + 8;
        at = start + length + (length % 2);
        if (at > buffer.byteLength) throw new Error('Truncated WAV chunk.');
        if (kind === 'fmt ') {
            if (fmt || length < 16) throw new Error('Invalid WAV format chunk.');
            const channels = u16(start + 2);
            const sampleRate = u32(start + 4);
            if (u16(start) !== 1 || u16(start + 14) !== 16 || ![1,2].includes(channels)) {
                throw new Error('Choose a mono or stereo 16-bit PCM WAV.');
            }
            if (sampleRate < 8000 || sampleRate > 96000) throw new Error('Choose a sample rate from 8 to 96 kHz.');
            if (u16(start + 12) !== channels * 2 || u32(start + 8) !== channels * 2 * sampleRate) {
                throw new Error('Inconsistent WAV frame alignment or byte rate.');
            }
            fmt = { channels, sampleRate };
        } else if (kind === 'data') {
            if (dataOffset !== undefined) throw new Error('Multiple WAV data chunks.');
            dataOffset = start;
            dataSize = length;
        }
    }
    if (!fmt || !dataSize) throw new Error('Missing WAV format or audio data.');
    const frames = dataSize / (2 * fmt.channels);
    if (!Number.isInteger(frames) || frames > MAX_FRAMES) throw new Error('Incomplete frames or sample exceeds 16 MiB.');
    const pcm = new Int16Array(frames);
    for (let i = 0, at = dataOffset; i < frames; i++, at += 2 * fmt.channels) {
        const left = view.getInt16(at, true);
        pcm[i] = fmt.channels === 1 ? left : (left + view.getInt16(at + 2, true)) / 2;
    }
    return { pcm, sampleRate: fmt.sampleRate };
}

export async function readWavFile(file) {
    if (!file || file.size > MAX_FILE_BYTES) throw new Error('Choose a WAV file up to 33 MiB.');
    return decodeWav(await file.arrayBuffer());
}

export function validateSlot(slot, imported = false) {
    const maxRate = imported ? 96000 : 384000;
    if (!ArrayBuffer.isView(slot?.pcm) || typedArrayName.call(slot.pcm) !== 'Int16Array' || !slot.pcm.length || slot.pcm.length > MAX_FRAMES ||
        !Number.isInteger(slot.sampleRate) || slot.sampleRate < 8000 || slot.sampleRate > maxRate ||
        typeof slot.name !== 'string' || !slot.name.trim() || slot.name.length > 255 ||
        /[\\/\x00-\x1f]/.test(slot.name)) throw new Error('Invalid sampler audio, rate or filename.');
}

export function frameAt(media, index) {
    return media.pcm ? media.pcm[index] : media.chunks[index >>> 12][index & (CHUNK_FRAMES - 1)];
}

// Decimate very large bins to a fixed number of probes so a hot replacement
// or capture commit has the same bounded cost, regardless of file duration.
export function makeOverview(media) {
    const bins = Math.min(OVERVIEW_BINS, media.frames);
    const overview = new Float32Array(bins * 2);
    for (let bin = 0; bin < bins; bin++) {
        const start = Math.floor(bin * media.frames / bins);
        const end = Math.floor((bin + 1) * media.frames / bins);
        let low = 32767, high = -32768;
        const probes = Math.min(32, end - start);
        for (let i = 0; i < probes; i++) {
            const at = start + Math.floor(i * (end - 1 - start) / Math.max(1, probes - 1));
            const value = frameAt(media, at);
            low = Math.min(low, value);
            high = Math.max(high, value);
        }
        overview[2*bin] = low / 32768;
        overview[2*bin+1] = high / 32768;
    }
    return overview;
}

export function fromPcm({ pcm, name, sampleRate }) {
    // A slice of a larger backing buffer must not retain the whole allocation.
    const owned = pcm.byteLength === bufferLength(pcm.buffer) ? pcm : pcm.slice();
    const media = { pcm: owned, frames: owned.length, name, sampleRate };
    media.overview = makeOverview(media);
    return media;
}

export function startCapture(sampleRate) {
    return { name: 'Capture', sampleRate, chunks: [], frames: 0, limit: Math.min(MAX_FRAMES, Math.floor(sampleRate * 30)) };
}

export function appendCapture(media, volts) {
    const offset = media.frames & (CHUNK_FRAMES - 1);
    if (!offset) media.chunks.push(new Int16Array(Math.min(CHUNK_FRAMES, media.limit - media.frames)));
    const sample = Number.isFinite(volts) ? Math.round(volts * 32768 / 5) : 0;
    media.chunks[media.frames >>> 12][offset] = Math.max(-32768, Math.min(32767, sample));
    media.frames++;
}

export function snapshot(media) {
    if (!media?.frames) return null;
    let pcm;
    if (media.pcm) pcm = media.pcm.slice();
    else {
        pcm = new Int16Array(media.frames);
        let offset = 0;
        for (const chunk of media.chunks) {
            const count = Math.min(chunk.length, pcm.length - offset);
            pcm.set(chunk.subarray(0, count), offset);
            offset += count;
        }
    }
    return { pcm, sampleRate: media.sampleRate, name: media.name };
}

const factory = {};
export function factoryMedia(channel) {
    if (factory[channel]) return factory[channel];
    const sampleRate = 24000;
    const slot = sampleRate / 5;
    const pcm = new Int16Array(slot * 4);
    const drumPitches = [48, 155, 660, 107];
    const bellPitches = [373, 247, 558, 294];
    let seed = 1674217, phase = 0, lastNoise = 0;
    for (let i = 0; i < pcm.length; i++) {
        const segment = Math.floor(i / slot);
        const t = (i % slot) / sampleRate;
        if (i % slot === 0) phase = 0;
        seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        const hat = (noise - lastNoise) * 0.5;
        lastNoise = noise;
        let voice;
        if (channel === 'A') {
            const frequency = drumPitches[segment] * (1 + 3.5 * Math.exp(-45*t));
            phase += 2 * Math.PI * frequency / sampleRate;
            const body = Math.sin(phase);
            if (segment === 1) voice = (0.3 * body + 0.7 * noise) * Math.exp(-23*t);
            else if (segment === 2) voice = hat * Math.exp(-63*t);
            else voice = body * Math.exp(-(segment === 0 ? 16 : 21)*t);
        } else {
            const frequency = bellPitches[segment];
            phase += 2 * Math.PI * frequency / sampleRate;
            voice = (0.65 * Math.sin(phase + Math.sin(phase*2.71) * Math.exp(-32*t)) +
                0.35 * Math.sin(phase*1.48)) * Math.exp(-19*t);
        }
        const taper = Math.min(1, t * 1500, (slot - i % slot) / 30);
        pcm[i] = Math.round(voice * taper * 26500);
    }
    factory[channel] = fromPcm({ pcm, sampleRate, name: channel === 'A' ? 'Drum break' : 'Bell break' });
    return factory[channel];
}

export function sliceStarts(media, count, method, markers) {
    if (!media?.frames) return [];
    const frames = media.frames;
    const starts = [0];
    if (method === 2) {
        // State can arrive through a saved patch. Accept only the first 31
        // interior cuts and never sort, traverse or clone an unbounded array.
        if (!Array.isArray(markers)) return starts;
        const cuts = markers.slice(0,31).filter(v => Number.isFinite(v) && v > 0 && v < 1)
            // Roundoff from exporting an exact frame as frame / frames
            // must not move an automatic cut when it becomes manual.
            .map(v => Math.min(frames - 1, Math.floor(v * frames + Number.EPSILON * frames)))
            .sort((a, b) => a - b);
        for (const cut of cuts) if (cut > starts[starts.length-1]) starts.push(cut);
        return starts;
    }
    const regions = Math.max(1, Math.min(frames, 32, Math.round(count)));
    for (let k = 1; k < regions; k++) {
        const nominal = Math.floor(k * frames / regions);
        let start = nominal;
        if (method === 1) {
            const low = Math.max(starts[k-1] + 1, nominal - 64);
            const high = Math.min(Math.floor((k+1)*frames/regions)-1, nominal + 64);
            let distance = Infinity;
            for (let at = low; at <= high; at++) {
                const a = frameAt(media,at-1), b = frameAt(media,at);
                if ((a < 0 && b >= 0 || a > 0 && b <= 0 || a === 0 && b !== 0) && Math.abs(at-nominal) < distance) {
                    start = at;
                    distance = Math.abs(at-nominal);
                }
            }
        }
        starts.push(start);
    }
    return starts;
}
