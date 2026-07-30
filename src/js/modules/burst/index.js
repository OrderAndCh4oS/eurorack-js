/**
 * BURST - Pingable trigger burst generator
 *
 * Befaco Burst-inspired clock utility. It schedules finite trigger bursts
 * inside an internal or ping-measured time window with per-burst frozen
 * quantity, distribution, time factor, and probability settings.
 */

import { clamp } from '../../utils/math.js';

const CLOCK_THRESHOLD = 2.5;
const TRIGGER_HIGH = 10;

function normalizeTempo(tempo) {
    return clamp(Number.isFinite(tempo) ? tempo : 120, 1, 6000);
}

function tempoToSamples(tempo, sampleRate) {
    return Math.max(1, Math.round((60 / normalizeTempo(tempo)) * sampleRate));
}

function normalizeSwitch(value) {
    return value === 1 || value === true ? 1 : 0;
}

function finiteClamp(value, min, max, fallback) {
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
}

function getTimeRatio(timeFactor, timeCv) {
    const cvSteps = finiteClamp(timeCv, -5, 5, 0) / 5 * 8;
    const step = Math.round(clamp(
        (Number.isFinite(timeFactor) ? timeFactor : 1) + cvSteps,
        -8,
        8
    ));

    if (step < 0) {
        return 1 / Math.max(1, Math.abs(step));
    }

    return Math.max(1, step);
}

function curvePosition(t, distribution) {
    if (distribution === 0) return t;

    const curve = 1 + Math.abs(distribution) * 4;
    return distribution > 0
        ? Math.pow(t, curve)
        : 1 - Math.pow(1 - t, curve);
}

export default {
    id: 'burst',
    name: 'BURST',
    hp: 8,
    color: 'module-color-five',
    category: 'clock',

    createDSP({ sampleRate = 44100, bufferSize = 512, random = Math.random } = {}) {
        const trig = new Float32Array(bufferSize);
        const ping = new Float32Array(bufferSize);
        const quantityCv = new Float32Array(bufferSize);
        const distributionCv = new Float32Array(bufferSize);
        const timeCv = new Float32Array(bufferSize);
        const probabilityCv = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);
        const tempoOut = new Float32Array(bufferSize);
        const eocOut = new Float32Array(bufferSize);

        const triggerPulseSamples = Math.max(1, Math.round(sampleRate * 0.01));
        const minPulseSamples = Math.max(1, Math.round(sampleRate * 0.001));
        const minPingSamples = Math.max(1, Math.round(sampleRate * 0.001));
        const rng = typeof random === 'function' ? random : Math.random;

        let lastTrigHigh = false;
        let lastPingHigh = false;
        let lastPingSample = null;
        let hasPingWindow = false;
        let pingWindowSamples = tempoToSamples(120, sampleRate);
        let lastInternalTempoSamples = pingWindowSamples;
        let nextTempoSample = pingWindowSamples;
        let tempoPulseSamples = 0;
        let eocPulseSamples = 0;
        let forcedOutUntilSample = 0;
        let sampleClock = 0;
        let activeBurst = null;

        function getBaseWindowSamples(params) {
            return hasPingWindow ? pingWindowSamples : tempoToSamples(params.tempo, sampleRate);
        }

        function syncInternalTempo(params) {
            if (hasPingWindow) return;

            const currentTempoSamples = tempoToSamples(params.tempo, sampleRate);
            if (currentTempoSamples !== lastInternalTempoSamples) {
                lastInternalTempoSamples = currentTempoSamples;
                nextTempoSample = sampleClock + currentTempoSamples;
            }
        }

        function getEffectiveSettings(params, inputs, index) {
            const quantityCvSample = finiteClamp(inputs.quantityCv[index], -5, 5, 0);
            const quantityCvAmount = finiteClamp(params.quantityCvAmount, 0, 1, 1);
            const quantityOffset = quantityCvSample * quantityCvAmount * 16 / 5;
            const quantity = Math.round(clamp(
                (Number.isFinite(params.quantity) ? params.quantity : 4) + quantityOffset,
                1,
                32
            ));

            const distribution = clamp(
                finiteClamp(params.distribution, -1, 1, 0) +
                    finiteClamp(inputs.distributionCv[index], -5, 5, 0) / 5,
                -1,
                1
            );

            const timeRatio = getTimeRatio(params.timeFactor, inputs.timeCv[index]);
            const probability = clamp(
                finiteClamp(params.probability, 0, 1, 1) +
                    finiteClamp(inputs.probabilityCv[index], -5, 5, 0) / 5,
                0,
                1
            );

            const baseWindowSamples = getBaseWindowSamples(params);
            const windowSamples = Math.max(1, Math.round(baseWindowSamples * timeRatio));

            return {
                quantity,
                distribution,
                probability,
                windowSamples,
                includeFirstPulse: normalizeSwitch(params.includeFirstPulse) === 1
            };
        }

        function shouldPass(probability) {
            if (probability >= 1) return true;
            if (probability <= 0) return false;
            return rng() < probability;
        }

        function buildPulseStarts(settings) {
            const starts = [];
            const { quantity, distribution, windowSamples, includeFirstPulse } = settings;

            if (includeFirstPulse) {
                if (quantity === 1) {
                    starts.push(0);
                } else {
                    for (let pulse = 0; pulse < quantity; pulse++) {
                        const t = pulse / (quantity - 1);
                        starts.push(Math.round(curvePosition(t, distribution) * windowSamples));
                    }
                }
            } else {
                for (let pulse = 0; pulse < quantity; pulse++) {
                    const t = (pulse + 1) / quantity;
                    starts.push(Math.round(curvePosition(t, distribution) * windowSamples));
                }
            }

            starts.sort((a, b) => a - b);
            return starts.map(start => clamp(start, 0, windowSamples));
        }

        function buildPulses(settings, startSample) {
            const starts = buildPulseStarts(settings);

            return starts.map((relativeStart, index) => {
                const nextStart = starts[index + 1];
                let width = triggerPulseSamples;

                if (nextStart !== undefined) {
                    const gap = nextStart - relativeStart;
                    if (gap > 0) {
                        const maxDistinctWidth = Math.max(1, gap - 1);
                        width = gap <= minPulseSamples
                            ? maxDistinctWidth
                            : Math.min(triggerPulseSamples, maxDistinctWidth);
                    }
                }

                return {
                    start: startSample + relativeStart,
                    width: Math.max(1, Math.round(width))
                };
            });
        }

        function startBurst(params, inputs, index, startSample) {
            const settings = getEffectiveSettings(params, inputs, index);
            const passesProbability = shouldPass(settings.probability);
            const pulses = passesProbability ? buildPulses(settings, startSample) : [];
            let completionSample = startSample + settings.windowSamples;

            pulses.forEach(pulse => {
                completionSample = Math.max(completionSample, pulse.start + pulse.width);
            });

            activeBurst = {
                startSample,
                windowSamples: settings.windowSamples,
                cycleSample: startSample + settings.windowSamples,
                completionSample,
                pulses
            };
        }

        function fireEocPulse() {
            eocPulseSamples = Math.max(eocPulseSamples, triggerPulseSamples);
        }

        function completeBurst(params, inputs, index, { forceCycle = false } = {}) {
            fireEocPulse();
            const shouldCycle = normalizeSwitch(params.cycle) === 1;
            activeBurst = null;

            if (shouldCycle || forceCycle) {
                startBurst(params, inputs, index, sampleClock);
            }
        }

        function outputIsHighForCurrentSample() {
            if (!activeBurst) return false;

            for (let i = 0; i < activeBurst.pulses.length; i++) {
                const pulse = activeBurst.pulses[i];
                if (sampleClock >= pulse.start && sampleClock < pulse.start + pulse.width) {
                    return true;
                }
            }
            return false;
        }

        function activePulseEndForCurrentSample() {
            if (!activeBurst) return sampleClock;

            let end = sampleClock;
            for (let i = 0; i < activeBurst.pulses.length; i++) {
                const pulse = activeBurst.pulses[i];
                const pulseEnd = pulse.start + pulse.width;
                if (sampleClock >= pulse.start && sampleClock < pulseEnd) {
                    end = Math.max(end, pulseEnd);
                }
            }
            return end;
        }

        function resetOutputsAndLeds(instance) {
            out.fill(0);
            tempoOut.fill(0);
            eocOut.fill(0);
            instance.leds.active = 0;
            instance.leds.out = 0;
            instance.leds.tempo = 0;
            instance.leds.eoc = 0;
        }

        return {
            params: {
                tempo: 120,
                quantity: 4,
                quantityCvAmount: 1,
                distribution: 0,
                timeFactor: 1,
                probability: 1,
                cycle: 0,
                includeFirstPulse: 1,
                retrigger: 1
            },

            inputs: {
                trig,
                ping,
                quantityCv,
                distributionCv,
                timeCv,
                probabilityCv
            },

            outputs: {
                out,
                tempo: tempoOut,
                eoc: eocOut
            },

            leds: {
                active: 0,
                out: 0,
                tempo: 0,
                eoc: 0
            },

            process() {
                syncInternalTempo(this.params);

                let outActivity = false;
                let tempoActivity = false;
                let eocActivity = false;

                for (let i = 0; i < bufferSize; i++) {
                    let forceOutHigh = false;
                    const pingHigh = Number.isFinite(ping[i]) &&
                        ping[i] > CLOCK_THRESHOLD;
                    const pingEdge = pingHigh && !lastPingHigh;
                    const trigHigh = Number.isFinite(trig[i]) &&
                        trig[i] > CLOCK_THRESHOLD;
                    const trigEdge = trigHigh && !lastTrigHigh;

                    if (pingEdge) {
                        if (lastPingSample !== null) {
                            const measuredWindow = sampleClock - lastPingSample;
                            if (measuredWindow >= minPingSamples) {
                                pingWindowSamples = measuredWindow;
                                hasPingWindow = true;
                                nextTempoSample = sampleClock + pingWindowSamples;
                            }
                        }
                        lastPingSample = sampleClock;
                    }

                    if (activeBurst) {
                        const cycleDue = normalizeSwitch(this.params.cycle) === 1 &&
                            sampleClock >= activeBurst.cycleSample;
                        const completionDue = sampleClock >= activeBurst.completionSample;

                        if (cycleDue || completionDue) {
                            if (cycleDue) {
                                forcedOutUntilSample = Math.max(
                                    forcedOutUntilSample,
                                    activePulseEndForCurrentSample()
                                );
                            }
                            completeBurst(this.params, this.inputs, i, { forceCycle: cycleDue });
                        }
                    }

                    forceOutHigh = sampleClock < forcedOutUntilSample;

                    if (trigEdge) {
                        const canStart = !activeBurst || normalizeSwitch(this.params.retrigger) === 1;
                        if (canStart) {
                            startBurst(this.params, this.inputs, i, sampleClock);
                        }
                    }

                    if (sampleClock >= nextTempoSample) {
                        tempoPulseSamples = Math.max(tempoPulseSamples, triggerPulseSamples);
                        const tempoInterval = getBaseWindowSamples(this.params);
                        do {
                            nextTempoSample += tempoInterval;
                        } while (sampleClock >= nextTempoSample);
                    }

                    out[i] = (forceOutHigh || outputIsHighForCurrentSample()) ? TRIGGER_HIGH : 0;
                    tempoOut[i] = tempoPulseSamples > 0 ? TRIGGER_HIGH : 0;
                    eocOut[i] = eocPulseSamples > 0 ? TRIGGER_HIGH : 0;

                    if (out[i] > 0) outActivity = true;
                    if (tempoOut[i] > 0) tempoActivity = true;
                    if (eocOut[i] > 0) eocActivity = true;

                    if (tempoPulseSamples > 0) tempoPulseSamples--;
                    if (eocPulseSamples > 0) eocPulseSamples--;

                    lastPingHigh = pingHigh;
                    lastTrigHigh = trigHigh;
                    sampleClock++;
                }

                this.leds.active = activeBurst ? 1 : 0;
                this.leds.out = outActivity ? 1 : 0;
                this.leds.tempo = tempoActivity ? 1 : 0;
                this.leds.eoc = eocActivity ? 1 : 0;
            },

            reset() {
                lastTrigHigh = false;
                lastPingHigh = false;
                lastPingSample = null;
                hasPingWindow = false;
                pingWindowSamples = tempoToSamples(this.params.tempo, sampleRate);
                lastInternalTempoSamples = pingWindowSamples;
                nextTempoSample = pingWindowSamples;
                tempoPulseSamples = 0;
                eocPulseSamples = 0;
                forcedOutUntilSample = 0;
                sampleClock = 0;
                activeBurst = null;
                trig.fill(0);
                ping.fill(0);
                quantityCv.fill(0);
                distributionCv.fill(0);
                timeCv.fill(0);
                probabilityCv.fill(0);
                resetOutputsAndLeds(this);
            }
        };
    },

    ui: {
        leds: ['active', 'out', 'tempo', 'eoc'],
        knobs: [
            { id: 'tempo', label: 'Tempo', param: 'tempo', min: 20, max: 300, default: 120, step: 1 },
            { id: 'quantity', label: 'Qty', param: 'quantity', min: 1, max: 32, default: 4, step: 1 },
            { id: 'quantityCvAmount', label: 'Q CV', param: 'quantityCvAmount', min: 0, max: 1, default: 1 },
            { id: 'distribution', label: 'Dist', param: 'distribution', min: -1, max: 1, default: 0 },
            { id: 'timeFactor', label: 'Time', param: 'timeFactor', min: -8, max: 8, default: 1, step: 1 },
            { id: 'probability', label: 'Prob', param: 'probability', min: 0, max: 1, default: 1 }
        ],
        switches: [
            { id: 'cycle', label: 'Cycle', param: 'cycle', default: 0 },
            { id: 'includeFirstPulse', label: 'First', param: 'includeFirstPulse', default: 1 },
            { id: 'retrigger', label: 'Retrig', param: 'retrigger', default: 1 }
        ],
        inputs: [
            { id: 'trig', label: 'Trig', port: 'trig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'ping', label: 'Ping', port: 'ping', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'quantityCv', label: 'Qty', port: 'quantityCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'distributionCv', label: 'Dist', port: 'distributionCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'timeCv', label: 'Time', port: 'timeCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'probabilityCv', label: 'Prob', port: 'probabilityCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'tempo', label: 'Tempo', port: 'tempo', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'eoc', label: 'EOC', port: 'eoc', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
