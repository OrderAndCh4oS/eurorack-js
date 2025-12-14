/**
 * GRANULITA - Granular Chord Generator
 *
 * Based on Noise Engineering Granulita Versio specifications.
 * Stereo granular resynthesizer that creates chords from input audio.
 *
 * Features:
 * - 4-voice granular engine with pitch shifting
 * - 16 selectable chord types
 * - Adjustable grain count and length
 * - Built-in shimmer reverb
 * - Freeze, sync, and trigger modes
 * - Forward, reverse, and random grain playback
 */

// 16 chord types (intervals in semitones from root)
const CHORDS = [
    [0, 0, 0, 0],       // 0: Unison
    [0, 12, 0, 12],     // 1: Octave
    [0, 7, 12, 19],     // 2: Fifth
    [0, 4, 7, 12],      // 3: Major
    [0, 3, 7, 12],      // 4: Minor
    [0, 4, 7, 11],      // 5: Maj7
    [0, 3, 7, 10],      // 6: Min7
    [0, 4, 7, 10],      // 7: Dom7
    [0, 3, 6, 9],       // 8: Dim
    [0, 4, 8, 12],      // 9: Aug
    [0, 5, 7, 12],      // 10: Sus4
    [0, 2, 7, 12],      // 11: Sus2
    [0, 4, 7, 14],      // 12: Add9
    [0, 3, 7, 14],      // 13: Min9
    [0, 7, 14, 21],     // 14: Spread (stacked fifths)
    [0, 1, 2, 3],       // 15: Cluster
];

// Maximum number of grains
const MAX_GRAINS = 32;

// Grain buffer duration in seconds
const BUFFER_DURATION = 4;

export default {
    id: 'granulita',
    name: 'GRANULITA',
    hp: 10,
    color: '#4a6b8a',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Audio buffer (circular, stereo)
        const audioBufferSize = Math.floor(sampleRate * BUFFER_DURATION);
        const audioBufferL = new Float32Array(audioBufferSize);
        const audioBufferR = new Float32Array(audioBufferSize);
        let writeHead = 0;
        let frozen = false;

        // Grain pool
        const grains = [];
        for (let i = 0; i < MAX_GRAINS; i++) {
            grains.push({
                active: false,
                position: 0,        // Read position in buffer
                length: 0,          // Total grain length in samples
                elapsed: 0,         // Samples played
                pitchRatio: 1.0,    // Playback rate
                direction: 1,       // 1 = forward, -1 = reverse
                pan: 0.5,           // Stereo position
                voice: 0            // Which chord voice (0-3)
            });
        }

        // Grain scheduling
        let samplesSinceLastGrain = 0;
        let grainInterval = 0;

        // Simple reverb (allpass chain + comb filters)
        const reverbDelays = [1557, 1617, 1491, 1422, 1277, 1356];
        const reverbCombs = reverbDelays.map(d => ({
            buffer: new Float32Array(Math.floor(d * sampleRate / 44100) + 1),
            index: 0,
            filterStore: 0
        }));
        const reverbCombsR = reverbDelays.map(d => ({
            buffer: new Float32Array(Math.floor((d + 23) * sampleRate / 44100) + 1),
            index: 0,
            filterStore: 0
        }));

        // Allpass for reverb diffusion
        const allpassDelays = [556, 441, 341, 225];
        const allpassL = allpassDelays.map(d => ({
            buffer: new Float32Array(Math.floor(d * sampleRate / 44100) + 1),
            index: 0
        }));
        const allpassR = allpassDelays.map(d => ({
            buffer: new Float32Array(Math.floor((d + 23) * sampleRate / 44100) + 1),
            index: 0
        }));

        // Shimmer pitch shifter buffer
        const shimmerBufferSize = Math.floor(sampleRate * 0.1);
        const shimmerBufferL = new Float32Array(shimmerBufferSize);
        const shimmerBufferR = new Float32Array(shimmerBufferSize);
        let shimmerWriteIdx = 0;
        let shimmerReadIdx = 0;

        // Own input buffers (for reset pattern)
        const ownInL = new Float32Array(bufferSize);
        const ownInR = new Float32Array(bufferSize);

        // Gate state for edge detection
        let lastGate = 0;

        // Hanning window for grain envelope
        function hanningEnvelope(phase) {
            return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
        }

        // Read from circular buffer with interpolation
        function readBuffer(buffer, position, bufSize) {
            const idx0 = Math.floor(position) % bufSize;
            const idx1 = (idx0 + 1) % bufSize;
            const frac = position - Math.floor(position);
            // Handle negative positions
            const safeIdx0 = idx0 < 0 ? idx0 + bufSize : idx0;
            const safeIdx1 = idx1 < 0 ? idx1 + bufSize : idx1;
            return buffer[safeIdx0] * (1 - frac) + buffer[safeIdx1] * frac;
        }

        // Spawn a new grain
        function spawnGrain(grainLengthSamples, pitchSemitones, direction, chordIntervals, rootVoice) {
            // Find inactive grain
            const grain = grains.find(g => !g.active);
            if (!grain) return;

            grain.active = true;
            grain.length = grainLengthSamples;
            grain.elapsed = 0;
            grain.direction = direction;
            grain.pan = 0.3 + Math.random() * 0.4; // Slight stereo spread

            // Select a voice from the chord
            const voiceIdx = Math.floor(Math.random() * 4);
            grain.voice = voiceIdx;

            // Calculate pitch ratio based on chord interval and pitch offset
            const interval = chordIntervals[voiceIdx];
            // Root voice follows input pitch exactly
            const totalSemitones = voiceIdx === rootVoice ? pitchSemitones : pitchSemitones + interval;
            grain.pitchRatio = Math.pow(2, totalSemitones / 12);

            // Set read position (slightly randomized around write head)
            const maxOffset = Math.min(audioBufferSize * 0.8, grainLengthSamples * 2);
            const offset = Math.random() * maxOffset;
            grain.position = (writeHead - offset + audioBufferSize) % audioBufferSize;
        }

        return {
            params: {
                blend: 0.5,      // 0-1 dry/wet
                pitch: 0.5,      // 0-1 (-1 to +1 octave)
                chord: 0,        // 0-1 (selects from 16 chords)
                voice: 0,        // 0-1 (which voice tracks root, 0-3)
                verb: 0.3,       // 0-1 (reverb amount/shimmer)
                count: 0.5,      // 0-1 (grain density, 0-32)
                length: 0.3,     // 0-1 (grain length, 16ms-4s)
                direction: 1,    // 0=REV, 1=BTH, 2=FWD
                hitMode: 1       // 0=FRZ, 1=SYNC, 2=TRIG
            },

            inputs: {
                inL: ownInL,
                inR: ownInR,
                hit: new Float32Array(bufferSize),
                blendCV: new Float32Array(bufferSize),
                pitchCV: new Float32Array(bufferSize),
                chordCV: new Float32Array(bufferSize),
                voiceCV: new Float32Array(bufferSize),
                verbCV: new Float32Array(bufferSize),
                countCV: new Float32Array(bufferSize),
                lengthCV: new Float32Array(bufferSize)
            },

            outputs: {
                outL,
                outR
            },

            leds: {
                active: 0
            },

            process() {
                const { blend, pitch, chord, voice, verb, count, length, direction, hitMode } = this.params;
                const inL = this.inputs.inL;
                const inR = this.inputs.inR;
                const hit = this.inputs.hit;
                const blendCV = this.inputs.blendCV;
                const pitchCV = this.inputs.pitchCV;
                const chordCV = this.inputs.chordCV;
                const voiceCV = this.inputs.voiceCV;
                const verbCV = this.inputs.verbCV;
                const countCV = this.inputs.countCV;
                const lengthCV = this.inputs.lengthCV;

                let peakLevel = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Get modulated parameters (CV is 0-5V, normalized to 0-1)
                    const modBlend = Math.max(0, Math.min(1, blend + blendCV[i] / 5));
                    const modPitch = Math.max(0, Math.min(1, pitch + pitchCV[i] / 5));
                    const modChord = Math.max(0, Math.min(1, chord + chordCV[i] / 5));
                    const modVoice = Math.max(0, Math.min(1, voice + voiceCV[i] / 5));
                    const modVerb = Math.max(0, Math.min(1, verb + verbCV[i] / 5));
                    const modCount = Math.max(0, Math.min(1, count + countCV[i] / 5));
                    const modLength = Math.max(0, Math.min(1, length + lengthCV[i] / 5));

                    // Convert parameters
                    const pitchSemitones = (modPitch - 0.5) * 24; // -12 to +12
                    const chordIndex = Math.min(15, Math.floor(modChord * 16));
                    const rootVoice = Math.min(3, Math.floor(modVoice * 4));
                    const grainCount = Math.floor(modCount * MAX_GRAINS);
                    // Exponential length scaling: 16ms to 4000ms
                    const grainLengthMs = 16 * Math.pow(250, modLength);
                    const grainLengthSamples = Math.floor(grainLengthMs * sampleRate / 1000);

                    // Get chord intervals
                    const chordIntervals = CHORDS[chordIndex];

                    // Handle gate input (threshold >2V)
                    const gateHigh = hit[i] > 2;
                    const gateRising = gateHigh && lastGate <= 2;
                    lastGate = hit[i];

                    // Handle hit modes
                    if (hitMode === 0) {
                        // FRZ: Freeze on gate high, spawn grains on trigger
                        frozen = gateHigh;
                        if (gateRising && grainCount > 0) {
                            // Spawn multiple grains based on count
                            for (let g = 0; g < Math.min(grainCount, 8); g++) {
                                const dir = direction === 0 ? -1 : direction === 2 ? 1 : (Math.random() > 0.5 ? 1 : -1);
                                spawnGrain(grainLengthSamples, pitchSemitones, dir, chordIntervals, rootVoice);
                            }
                        }
                    } else if (hitMode === 1) {
                        // SYNC: Spawn grains on trigger (synced to external clock)
                        if (gateRising && grainCount > 0) {
                            // Spawn multiple grains based on count
                            for (let g = 0; g < Math.min(grainCount, 8); g++) {
                                const dir = direction === 0 ? -1 : direction === 2 ? 1 : (Math.random() > 0.5 ? 1 : -1);
                                spawnGrain(grainLengthSamples, pitchSemitones, dir, chordIntervals, rootVoice);
                            }
                        }
                    } else if (hitMode === 2) {
                        // TRIG: Spawn grains only on trigger
                        if (gateRising && grainCount > 0) {
                            // Spawn multiple grains based on count
                            for (let g = 0; g < Math.min(grainCount, 8); g++) {
                                const dir = direction === 0 ? -1 : direction === 2 ? 1 : (Math.random() > 0.5 ? 1 : -1);
                                spawnGrain(grainLengthSamples, pitchSemitones, dir, chordIntervals, rootVoice);
                            }
                        }
                    }

                    // Get input (mono normalization: if R is silent, use L)
                    let inputL = inL[i];
                    let inputR = inR[i];
                    if (Math.abs(inputR) < 0.0001) {
                        inputR = inputL;
                    }

                    // Write to audio buffer (unless frozen)
                    if (!frozen) {
                        audioBufferL[writeHead] = inputL;
                        audioBufferR[writeHead] = inputR;
                        writeHead = (writeHead + 1) % audioBufferSize;
                    }

                    // Process grains
                    let grainOutL = 0;
                    let grainOutR = 0;

                    for (const grain of grains) {
                        if (!grain.active) continue;

                        // Calculate envelope
                        const phase = grain.elapsed / grain.length;
                        const envelope = hanningEnvelope(phase);

                        // Read from buffer
                        const sampleL = readBuffer(audioBufferL, grain.position, audioBufferSize);
                        const sampleR = readBuffer(audioBufferR, grain.position, audioBufferSize);

                        // Apply envelope and panning
                        const gainL = envelope * (1 - grain.pan) * 2;
                        const gainR = envelope * grain.pan * 2;

                        grainOutL += sampleL * gainL;
                        grainOutR += sampleR * gainR;

                        // Advance grain position
                        grain.position += grain.pitchRatio * grain.direction;
                        if (grain.position < 0) grain.position += audioBufferSize;
                        if (grain.position >= audioBufferSize) grain.position -= audioBufferSize;

                        grain.elapsed++;

                        // Deactivate finished grains
                        if (grain.elapsed >= grain.length) {
                            grain.active = false;
                        }
                    }

                    // Normalize grain output
                    const activeGrains = grains.filter(g => g.active).length;
                    if (activeGrains > 0) {
                        const normFactor = 1 / Math.sqrt(Math.max(1, activeGrains / 4));
                        grainOutL *= normFactor;
                        grainOutR *= normFactor;
                    }

                    // Reverb section
                    const reverbDecay = Math.min(modVerb * 2, 1) * 0.28 + 0.7;
                    const shimmerAmount = Math.max(0, (modVerb - 0.5) * 2);
                    const infinite = modVerb > 0.75;

                    // Process through comb filters
                    let reverbL = 0;
                    let reverbR = 0;
                    const reverbInput = (grainOutL + grainOutR) * 0.5 * 0.015;

                    const feedback = infinite ? 0.99 : reverbDecay;
                    const damp1 = 0.2;
                    const damp2 = 0.8;

                    for (let c = 0; c < reverbCombs.length; c++) {
                        // Left comb
                        const combL = reverbCombs[c];
                        const combOutL = combL.buffer[combL.index];
                        combL.filterStore = combOutL * damp2 + combL.filterStore * damp1;
                        combL.buffer[combL.index] = reverbInput + combL.filterStore * feedback;
                        combL.index = (combL.index + 1) % combL.buffer.length;
                        reverbL += combOutL;

                        // Right comb
                        const combR = reverbCombsR[c];
                        const combOutR = combR.buffer[combR.index];
                        combR.filterStore = combOutR * damp2 + combR.filterStore * damp1;
                        combR.buffer[combR.index] = reverbInput + combR.filterStore * feedback;
                        combR.index = (combR.index + 1) % combR.buffer.length;
                        reverbR += combOutR;
                    }

                    // Allpass diffusion
                    for (let a = 0; a < allpassL.length; a++) {
                        const apL = allpassL[a];
                        const bufOutL = apL.buffer[apL.index];
                        apL.buffer[apL.index] = reverbL + bufOutL * 0.5;
                        reverbL = bufOutL - reverbL;
                        apL.index = (apL.index + 1) % apL.buffer.length;

                        const apR = allpassR[a];
                        const bufOutR = apR.buffer[apR.index];
                        apR.buffer[apR.index] = reverbR + bufOutR * 0.5;
                        reverbR = bufOutR - reverbR;
                        apR.index = (apR.index + 1) % apR.buffer.length;
                    }

                    // Shimmer (pitch-shifted reverb feedback)
                    if (shimmerAmount > 0) {
                        shimmerBufferL[shimmerWriteIdx] = reverbL;
                        shimmerBufferR[shimmerWriteIdx] = reverbR;

                        // Read at octave up (2x speed)
                        const shimmerReadFloat = shimmerReadIdx;
                        const shimmerSampleL = readBuffer(shimmerBufferL, shimmerReadFloat, shimmerBufferSize);
                        const shimmerSampleR = readBuffer(shimmerBufferR, shimmerReadFloat, shimmerBufferSize);

                        reverbL = reverbL * (1 - shimmerAmount * 0.5) + shimmerSampleL * shimmerAmount * 0.5;
                        reverbR = reverbR * (1 - shimmerAmount * 0.5) + shimmerSampleR * shimmerAmount * 0.5;

                        shimmerWriteIdx = (shimmerWriteIdx + 1) % shimmerBufferSize;
                        shimmerReadIdx = (shimmerReadIdx + 2) % shimmerBufferSize; // 2x for octave up
                    }

                    reverbL *= 1.5;
                    reverbR *= 1.5;

                    // Wet signal: grains + reverb
                    const wetL = grainOutL + reverbL * modVerb;
                    const wetR = grainOutR + reverbR * modVerb;

                    // Mix dry and wet
                    outL[i] = inputL * (1 - modBlend) + wetL * modBlend;
                    outR[i] = inputR * (1 - modBlend) + wetR * modBlend;

                    // Soft clip
                    if (Math.abs(outL[i]) > 5) {
                        outL[i] = Math.tanh(outL[i] / 5) * 5;
                    }
                    if (Math.abs(outR[i]) > 5) {
                        outR[i] = Math.tanh(outR[i] / 5) * 5;
                    }

                    peakLevel = Math.max(peakLevel, Math.abs(outL[i]), Math.abs(outR[i]));
                }

                // Update LED
                this.leds.active = Math.min(1, peakLevel / 5);

                // Reset inputs if they were replaced by routing
                if (this.inputs.inL !== ownInL) {
                    ownInL.fill(0);
                    this.inputs.inL = ownInL;
                }
                if (this.inputs.inR !== ownInR) {
                    ownInR.fill(0);
                    this.inputs.inR = ownInR;
                }
            },

            reset() {
                // Clear audio buffer
                audioBufferL.fill(0);
                audioBufferR.fill(0);
                writeHead = 0;
                frozen = false;

                // Reset all grains
                for (const grain of grains) {
                    grain.active = false;
                    grain.position = 0;
                    grain.length = 0;
                    grain.elapsed = 0;
                    grain.pitchRatio = 1.0;
                    grain.direction = 1;
                    grain.pan = 0.5;
                    grain.voice = 0;
                }

                // Clear reverb
                for (const comb of reverbCombs) {
                    comb.buffer.fill(0);
                    comb.index = 0;
                    comb.filterStore = 0;
                }
                for (const comb of reverbCombsR) {
                    comb.buffer.fill(0);
                    comb.index = 0;
                    comb.filterStore = 0;
                }
                for (const ap of allpassL) {
                    ap.buffer.fill(0);
                    ap.index = 0;
                }
                for (const ap of allpassR) {
                    ap.buffer.fill(0);
                    ap.index = 0;
                }

                // Clear shimmer
                shimmerBufferL.fill(0);
                shimmerBufferR.fill(0);
                shimmerWriteIdx = 0;
                shimmerReadIdx = 0;

                // Clear outputs
                outL.fill(0);
                outR.fill(0);

                // Reset state
                samplesSinceLastGrain = 0;
                lastGate = 0;
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'blend', label: 'Blend', param: 'blend', min: 0, max: 1, default: 0.5 },
            { id: 'pitch', label: 'Pitch', param: 'pitch', min: 0, max: 1, default: 0.5 },
            { id: 'chord', label: 'Chord', param: 'chord', min: 0, max: 1, default: 0 },
            { id: 'voice', label: 'Voice', param: 'voice', min: 0, max: 1, default: 0 },
            { id: 'verb', label: 'Verb', param: 'verb', min: 0, max: 1, default: 0.3 },
            { id: 'count', label: 'Count', param: 'count', min: 0, max: 1, default: 0.5 },
            { id: 'length', label: 'Length', param: 'length', min: 0, max: 1, default: 0.3 }
        ],
        switches: [
            { id: 'direction', label: 'Dir', param: 'direction', positions: ['REV', 'BTH', 'FWD'], default: 1 },
            { id: 'hitMode', label: 'Hit', param: 'hitMode', positions: ['FRZ', 'SYNC', 'TRIG'], default: 1 }
        ],
        inputs: [
            { id: 'inL', label: 'In L', port: 'inL', type: 'audio' },
            { id: 'inR', label: 'In R', port: 'inR', type: 'audio' },
            { id: 'hit', label: 'Hit', port: 'hit', type: 'gate' },
            { id: 'blendCV', label: 'Blend', port: 'blendCV', type: 'cv' },
            { id: 'pitchCV', label: 'Pitch', port: 'pitchCV', type: 'cv' },
            { id: 'chordCV', label: 'Chord', port: 'chordCV', type: 'cv' },
            { id: 'voiceCV', label: 'Voice', port: 'voiceCV', type: 'cv' },
            { id: 'verbCV', label: 'Verb', port: 'verbCV', type: 'cv' },
            { id: 'countCV', label: 'Count', port: 'countCV', type: 'cv' },
            { id: 'lengthCV', label: 'Length', port: 'lengthCV', type: 'cv' }
        ],
        outputs: [
            { id: 'outL', label: 'Out L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'Out R', port: 'outR', type: 'audio' }
        ]
    }
};
