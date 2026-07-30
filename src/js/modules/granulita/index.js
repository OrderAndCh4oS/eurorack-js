import { createLinearCircularReader } from '../../utils/interpolation.js';
import { softLimitVoltage } from '../../utils/voltage.js';

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
export const GRANULITA_CHORDS = [
    [0, 0, 0, 0],       // 0: Unison
    [0, 3, 0, 3],       // 1: Minor third
    [0, 4, 0, 4],       // 2: Major third
    [0, 5, 0, 5],       // 3: Fourth
    [0, 6, 0, 6],       // 4: Tritone
    [0, 7, 0, 7],       // 5: Fifth
    [0, 3, 7, 12],      // 6: Minor triad
    [0, 4, 7, 12],      // 7: Major triad
    [0, 3, 6, 9],       // 8: Diminished seventh
    [0, 3, 6, 10],      // 9: Half-diminished seventh
    [0, 3, 7, 10],      // 10: Minor seventh
    [0, 3, 7, 11],      // 11: Minor-major seventh
    [0, 4, 7, 10],      // 12: Dominant seventh
    [0, 4, 7, 11],      // 13: Major seventh
    [0, 4, 8, 11],      // 14: Augmented major seventh
    [0, 4, 8, 12],      // 15: Augmented triad, doubled root
];

export function getGranulitaVoiceSemitones(chordIndex, rootVoice, voiceIndex, pitchSemitones = 0) {
    const chord = GRANULITA_CHORDS[Math.max(0, Math.min(15, Math.floor(chordIndex)))] ||
        GRANULITA_CHORDS[0];
    const rootIndex = Math.max(0, Math.min(3, Math.floor(rootVoice)));
    const voice = Math.max(0, Math.min(3, Math.floor(voiceIndex)));
    return pitchSemitones + chord[voice] - chord[rootIndex];
}

// Maximum number of grains
const MAX_GRAINS = 32;

// Grain buffer duration in seconds
const BUFFER_DURATION = 4;
const DEFAULT_SYNC_PERIOD_SECONDS = 0.5;
const MIN_SYNC_SCALE = 0.125;
const MAX_SYNC_SCALE = 8;

export function getGranulitaGrainTiming(
    grainLengthSamples,
    grainCount,
    syncPeriodSamples,
    sampleRate
) {
    const baseLength = Math.max(1, Math.floor(grainLengthSamples));
    const count = Math.max(0, Math.min(MAX_GRAINS, Math.floor(grainCount)));
    const defaultPeriod = Math.max(1, sampleRate * DEFAULT_SYNC_PERIOD_SECONDS);
    const hasClock = Number.isFinite(syncPeriodSamples) && syncPeriodSamples > 0;
    const syncScale = hasClock
        ? Math.max(MIN_SYNC_SCALE, Math.min(MAX_SYNC_SCALE, syncPeriodSamples / defaultPeriod))
        : 1;
    const lengthSamples = Math.max(1, Math.floor(baseLength * syncScale));

    return {
        lengthSamples,
        intervalSamples: count > 0 ? Math.max(1, Math.floor(lengthSamples / count)) : 0,
        syncScale
    };
}

export default {
    id: 'granulita',
    name: 'GRANULITA',
    hp: 10,
    color: 'module-color-three',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Audio buffer (circular, stereo)
        const audioBufferSize = Math.floor(sampleRate * BUFFER_DURATION);
        const audioBufferL = new Float32Array(audioBufferSize);
        const audioBufferR = new Float32Array(audioBufferSize);
        const readAudioL = createLinearCircularReader(audioBufferL);
        const readAudioR = createLinearCircularReader(audioBufferR);
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
        let syncPeriodSamples = 0;
        let samplesSinceSyncEdge = 0;
        let hasSyncEdge = false;
        let hitHighSamples = 0;
        let lastHitMode = 1;

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
        const readShimmerL = createLinearCircularReader(shimmerBufferL);
        const readShimmerR = createLinearCircularReader(shimmerBufferR);
        let shimmerWriteIdx = 0;
        let shimmerReadIdx = 0;

        // Own input buffers (for reset pattern)
        const ownInL = new Float32Array(bufferSize);
        const ownInR = new Float32Array(bufferSize);
        const ownHit = new Float32Array(bufferSize);
        const ownBlendCV = new Float32Array(bufferSize);
        const ownPitchCV = new Float32Array(bufferSize);
        const ownChordCV = new Float32Array(bufferSize);
        const ownVoiceCV = new Float32Array(bufferSize);
        const ownVerbCV = new Float32Array(bufferSize);
        const ownCountCV = new Float32Array(bufferSize);
        const ownLengthCV = new Float32Array(bufferSize);
        let rightInputConnected = false;

        // Gate state for edge detection
        let lastGate = 0;

        // Hanning window for grain envelope
        function hanningEnvelope(phase) {
            return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
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
            const totalSemitones = pitchSemitones +
                chordIntervals[voiceIdx] - chordIntervals[rootVoice];
            grain.pitchRatio = Math.pow(2, totalSemitones / 12);

            // Set read position (slightly randomized around write head)
            const maxOffset = Math.min(audioBufferSize * 0.8, grainLengthSamples * 2);
            const offset = Math.random() * maxOffset;
            grain.position = (writeHead - offset + audioBufferSize) % audioBufferSize;
        }

        function chooseDirection(direction) {
            if (direction === 0) return -1;
            if (direction === 2) return 1;
            return Math.random() > 0.5 ? 1 : -1;
        }

        function spawnTriggeredBurst(
            grainCount,
            grainLengthSamples,
            pitchSemitones,
            direction,
            chordIntervals,
            rootVoice
        ) {
            for (let g = 0; g < Math.min(grainCount, 8); g++) {
                spawnGrain(
                    grainLengthSamples,
                    pitchSemitones,
                    chooseDirection(direction),
                    chordIntervals,
                    rootVoice
                );
            }
        }

        function clearInputBuffers() {
            ownInL.fill(0);
            ownInR.fill(0);
            ownHit.fill(0);
            ownBlendCV.fill(0);
            ownPitchCV.fill(0);
            ownChordCV.fill(0);
            ownVoiceCV.fill(0);
            ownVerbCV.fill(0);
            ownCountCV.fill(0);
            ownLengthCV.fill(0);
        }

        function clearTextureState() {
            audioBufferL.fill(0);
            audioBufferR.fill(0);
            writeHead = 0;
            frozen = false;

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

            shimmerBufferL.fill(0);
            shimmerBufferR.fill(0);
            shimmerWriteIdx = 0;
            shimmerReadIdx = 0;

            outL.fill(0);
            outR.fill(0);
            samplesSinceLastGrain = 0;
            grainInterval = 0;
            syncPeriodSamples = 0;
            samplesSinceSyncEdge = 0;
            hasSyncEdge = false;
            hitHighSamples = 0;
            lastGate = 0;
            lastHitMode = 1;
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
                hit: ownHit,
                blendCV: ownBlendCV,
                pitchCV: ownPitchCV,
                chordCV: ownChordCV,
                voiceCV: ownVoiceCV,
                verbCV: ownVerbCV,
                countCV: ownCountCV,
                lengthCV: ownLengthCV
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
                    const chordIntervals = GRANULITA_CHORDS[chordIndex];

                    // Handle gate input (threshold >2V)
                    const gateHigh = hit[i] > 2;
                    const gateRising = gateHigh && lastGate <= 2;
                    lastGate = hit[i];

                    if (hitMode !== lastHitMode) {
                        frozen = false;
                        samplesSinceLastGrain = 0;
                        lastHitMode = hitMode;
                    }

                    let scheduledLengthSamples = grainLengthSamples;

                    // FRZ and SYNC are continuous granular modes. TRIG is the
                    // only mode in which Hit directly fires a grain burst.
                    if (hitMode === 0) {
                        // FRZ holds the captured buffer while the granular
                        // scheduler keeps producing a texture from it.
                        frozen = gateHigh;
                    } else if (hitMode === 1) {
                        frozen = false;
                        samplesSinceSyncEdge = Math.min(
                            samplesSinceSyncEdge + 1,
                            sampleRate * 60
                        );

                        if (gateRising) {
                            if (hasSyncEdge && samplesSinceSyncEdge > 1) {
                                syncPeriodSamples = samplesSinceSyncEdge;
                            }
                            hasSyncEdge = true;
                            samplesSinceSyncEdge = 0;
                        }

                        if (gateHigh) {
                            hitHighSamples++;
                            if (hitHighSamples >= sampleRate * 2) {
                                syncPeriodSamples = 0;
                                hasSyncEdge = false;
                                samplesSinceSyncEdge = 0;
                            }
                        } else {
                            hitHighSamples = 0;
                        }

                        const timing = getGranulitaGrainTiming(
                            grainLengthSamples,
                            grainCount,
                            syncPeriodSamples,
                            sampleRate
                        );
                        scheduledLengthSamples = timing.lengthSamples;
                    } else if (hitMode === 2) {
                        frozen = false;
                        if (gateRising && grainCount > 0) {
                            spawnTriggeredBurst(
                                grainCount,
                                grainLengthSamples,
                                pitchSemitones,
                                direction,
                                chordIntervals,
                                rootVoice
                            );
                        }
                    }

                    if (hitMode !== 2) {
                        const timing = getGranulitaGrainTiming(
                            scheduledLengthSamples,
                            grainCount,
                            null,
                            sampleRate
                        );
                        grainInterval = timing.intervalSamples;

                        if (grainInterval > 0) {
                            samplesSinceLastGrain++;
                            if (samplesSinceLastGrain >= grainInterval) {
                                samplesSinceLastGrain -= grainInterval;
                                spawnGrain(
                                    scheduledLengthSamples,
                                    pitchSemitones,
                                    chooseDirection(direction),
                                    chordIntervals,
                                    rootVoice
                                );
                            }
                        } else {
                            samplesSinceLastGrain = 0;
                        }
                    } else {
                        samplesSinceLastGrain = 0;
                        grainInterval = 0;
                    }

                    const inputL = inL[i];
                    const inputR = rightInputConnected ? inR[i] : inputL;

                    // Write to audio buffer (unless frozen)
                    if (!frozen) {
                        audioBufferL[writeHead] = inputL;
                        audioBufferR[writeHead] = inputR;
                        writeHead = (writeHead + 1) % audioBufferSize;
                    }

                    // Process grains
                    let grainOutL = 0;
                    let grainOutR = 0;
                    let activeGrains = 0;

                    for (const grain of grains) {
                        if (!grain.active) continue;

                        // Calculate envelope
                        const phase = grain.elapsed / grain.length;
                        const envelope = hanningEnvelope(phase);

                        // Read from buffer
                        const sampleL = readAudioL(grain.position);
                        const sampleR = readAudioR(grain.position);

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
                        } else {
                            activeGrains++;
                        }
                    }

                    // Normalize grain output
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
                        const shimmerSampleL = readShimmerL(shimmerReadFloat);
                        const shimmerSampleR = readShimmerR(shimmerReadFloat);

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
                    outL[i] = softLimitVoltage(
                        inputL * (1 - modBlend) + wetL * modBlend,
                        5
                    );
                    outR[i] = softLimitVoltage(
                        inputR * (1 - modBlend) + wetR * modBlend,
                        5
                    );

                    peakLevel = Math.max(peakLevel, Math.abs(outL[i]), Math.abs(outR[i]));
                }

                // Update LED
                this.leds.active = Math.min(1, peakLevel / 5);

            },

            onInputConnected(port) {
                if (port === 'inR') rightInputConnected = true;
            },

            onInputDisconnected(port) {
                if (port === 'inR') rightInputConnected = false;
            },

            reset() {
                clearInputBuffers();
                clearTextureState();

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
            { id: 'inL', label: 'In L', port: 'inL', signal: 'audio' },
            { id: 'inR', label: 'In R', port: 'inR', signal: 'audio' },
            { id: 'hit', label: 'Hit', port: 'hit', signal: 'gate' },
            { id: 'blendCV', label: 'Blend', port: 'blendCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'pitchCV', label: 'Pitch', port: 'pitchCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'chordCV', label: 'Chord', port: 'chordCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'voiceCV', label: 'Voice', port: 'voiceCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'verbCV', label: 'Verb', port: 'verbCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'countCV', label: 'Count', port: 'countCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'lengthCV', label: 'Length', port: 'lengthCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'outL', label: 'Out L', port: 'outL', signal: 'audio' },
            { id: 'outR', label: 'Out R', port: 'outR', signal: 'audio' }
        ]
    }
};
