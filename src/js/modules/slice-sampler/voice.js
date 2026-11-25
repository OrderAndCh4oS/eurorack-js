import { clamp } from '../../utils/math.js';
import { appendCapture, factoryMedia, frameAt, makeOverview, sliceStarts, snapshot, startCapture } from './media.js';

const finite = value => Number.isFinite(value) ? value : 0;

export function createVoice(ch, dsp, engineRate, blockSize) {
    const params = dsp.params;
    const keys = {};
    for (const stem of ['source','tune','level','playMode','order','slice','count','method','markers',
        'assign1','assign2','assign3','audition','stop','record','playing','recording']) keys[stem] = stem + ch;
    const trig = dsp.inputs['trig'+ch], rec = dsp.inputs['rec'+ch], out = dsp.outputs['out'+ch];
    const cv1 = dsp.inputs['cv1'+ch], cv2 = dsp.inputs['cv2'+ch], cv3 = dsp.inputs['cv3'+ch];
    const factory = factoryMedia(ch);
    const initialSeed = ch === 'A' ? 103939 : 141241;
    const fadeFrames = Math.max(1, Math.round(engineRate * 0.001));
    let local = null, capture = null;
    let active, starts = [], lastCount, lastMethod, lastMarkers;
    let random = initialSeed, cursor = -1, region = -1, lastOrder = -1;
    let playing = false, loop = false, reverse = false, start = 0, end = 0, position = 0;
    let lastTrigger = false, lastAudition = false, lastStop = false, lastRecord = false, initialized = false;
    let previous = 0, from = 0, fadeLength = 0, remaining = 0, regionFade = 0;

    function transition(length) {
        from = previous;
        remaining = fadeLength = length;
    }

    function stop() {
        if (playing) transition(regionFade);
        playing = false;
        cursor = -1;
        region = -1;
    }

    function refresh() {
        const source = params[keys.source] ? local : factory;
        const count = params[keys.count], method = params[keys.method], markers = params[keys.markers];
        if (source !== active) {
            stop();
            active = source;
            random = initialSeed;
        } else if (count === lastCount && method === lastMethod && markers === lastMarkers) return;
        starts = sliceStarts(active, count, method, markers);
        lastCount = count;
        lastMethod = method;
        lastMarkers = markers;
    }

    function trigger(mode, order, dial, addressCV, reverseGate, speed) {
        if (!active || !starts.length) return;
        const count = starts.length;
        if (order !== lastOrder) cursor = -1;
        lastOrder = order;
        if (order === 3) {
            cursor = clamp(dial - 1 + Math.floor(clamp(addressCV,0,5) * count / 5),0,count-1);
        } else if (order === 2) {
            random = (Math.imul(random,1664525) + 1013904223) >>> 0;
            cursor = Math.floor(random / 4294967296 * count);
        } else if (order === 1) {
            cursor = cursor < 0 ? count - 1 : (cursor + count - 1) % count;
        } else cursor = (cursor + 1) % count;
        region = cursor;
        start = starts[region];
        end = starts[region+1] ?? active.frames;
        reverse = Boolean(mode % 2) !== reverseGate;
        loop = mode >= 2;
        position = reverse ? end - 1 : start;
        // Limit transitions to an eighth of this hit's duration. Single-frame
        // slices sound at full gain even under large transposition.
        regionFade = Math.min(fadeFrames, Math.floor((end-start) / Math.max(1,speed) / 8));
        transition(regionFade);
        playing = true;
    }

    function blend(raw) {
        if (remaining) {
            const weight = remaining-- / fadeLength;
            return raw + (from - raw) * weight;
        }
        return raw;
    }

    function readVoice(speed, gain) {
        const left = Math.floor(position);
        const first = frameAt(active,left);
        const second = frameAt(active,Math.min(left+1,end-1));
        let raw = (first + (second-first) * (position-left)) * (5 / 32768) * gain;
        if (!loop && regionFade) {
            const toEdge = reverse ? position - start : end - 1 - position;
            raw *= clamp(toEdge / (speed * regionFade));
        }
        previous = blend(raw);
        position += reverse ? -speed : speed;
        if (position < start || position >= end) {
            if (loop) {
                const length = end-start;
                position = start + (((position-start) % length) + length) % length;
                // Pitch is continuous, so the seam length must track changes
                // made after the hit was triggered.
                regionFade = Math.min(fadeFrames, Math.floor(length / Math.max(1, speed) / 8));
                transition(regionFade);
            } else playing = false;
        }
        return previous;
    }

    function commit() {
        if (capture?.frames) {
            capture.overview = makeOverview(capture);
            local = capture;
            params[keys.source] = 1;
        }
        capture = null;
        refresh();
    }

    function process() {
        refresh();
        const audition = Boolean(params[keys.audition]), stopValue = Boolean(params[keys.stop]), record = Boolean(params[keys.record]);
        if (initialized && record && !lastRecord) {
            if (capture) commit();
            else capture = startCapture(engineRate);
        }
        const stopping = stopValue && !lastStop;
        if (stopping) stop();
        const fireAction = audition && !lastAudition;
        initialized = true;
        lastAudition = audition;
        lastStop = stopValue;
        lastRecord = record;
        const assign1 = params[keys.assign1], assign2 = params[keys.assign2], assign3 = params[keys.assign3];
        const tune = params[keys.tune] / 12, dialGain = params[keys.level], dial = params[keys.slice];
        const order = params[keys.order], mode = params[keys.playMode];
        const baseSpeed = active ? active.sampleRate / engineRate : 1;
        let sounded = false;
        for (let i = 0; i < blockSize; i++) {
            if (capture && capture.frames < capture.limit) appendCapture(capture, rec[i]);
            const high = trig[i] >= 1;
            const fire = (high && !lastTrigger || i === 0 && fireAction) && !(i === 0 && stopping);
            lastTrigger = high;
            if (playing || fire) {
                const a = finite(cv1[i]), b = finite(cv2[i]), c = finite(cv3[i]);
                const pitch = (assign1 === 1 ? a : 0) + (assign2 === 1 ? b : 0) + (assign3 === 1 ? c : 0);
                const speed = baseSpeed * 2 ** clamp(tune + pitch,-4,4);
                if (fire) {
                    const address = (assign1 === 2 ? a : 0) + (assign2 === 2 ? b : 0) + (assign3 === 2 ? c : 0);
                    const invert = assign1 === 4 && a >= 1 || assign2 === 4 && b >= 1 || assign3 === 4 && c >= 1;
                    trigger(mode, order, dial, address, invert, speed);
                }
                if (playing) {
                    const level = (assign1 === 3 ? a : 0) + (assign2 === 3 ? b : 0) + (assign3 === 3 ? c : 0);
                    out[i] = readVoice(speed,clamp(dialGain + level/5));
                    sounded = true;
                    continue;
                }
            }
            previous = blend(0);
            out[i] = previous;
        }
        if (capture && capture.frames === capture.limit) commit();
        dsp.leds[keys.playing] = sounded ? 1 : 0;
        dsp.leds[keys.recording] = capture ? 1 : 0;
    }

    return {
        process,
        load(media) {
            capture = null;
            local = media;
            refresh();
        },
        snapshot() { return snapshot(capture?.frames ? capture : local); },
        info() {
            refresh();
            return {
                name: active?.name ?? '', frames: active?.frames ?? 0, sampleRate: active?.sampleRate ?? 0,
                starts, overview: active?.overview ?? [], region, playing, recording: Boolean(capture)
            };
        },
        reset() {
            stop();
            random = initialSeed;
            previous = from = remaining = fadeLength = 0;
            lastTrigger = lastAudition = lastRecord = lastStop = initialized = false;
            lastOrder = -1;
            capture = null;
            params[keys.record] = params[keys.audition] = params[keys.stop] = 0;
            dsp.leds[keys.playing] = dsp.leds[keys.recording] = 0;
            out.fill(0);
        }
    };
}
