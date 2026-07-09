import { describe, it, expect } from 'vitest';
import lpgModule from '../../src/js/modules/lpg/index.js';

const createLPG = (options = {}) => lpgModule.createDSP(options);

function peak(buffer) {
    return buffer.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function rms(buffer) {
    const sumSquares = buffer.reduce((sum, value) => sum + value * value, 0);
    return Math.sqrt(sumSquares / buffer.length);
}

function fillAlternating(buffer, amount = 5) {
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i % 2 === 0 ? amount : -amount;
    }
}

function fillSine(buffer, { sampleRate = 44100, frequency = 440, amount = 5 } = {}) {
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amount;
    }
}

describe('LPG module', () => {
    describe('initialization', () => {
        it('creates the documented params, ports, output, and LED', () => {
            const lpg = createLPG();

            expect(lpg.params).toEqual({
                level: 0,
                damp: 0.35,
                tone: 0.65,
                resonance: 0,
                mode: 1
            });
            expect(lpg.inputs.audio).toBeInstanceOf(Float32Array);
            expect(lpg.inputs.cv).toBeInstanceOf(Float32Array);
            expect(lpg.inputs.strike).toBeInstanceOf(Float32Array);
            expect(lpg.inputs.dampCV).toBeInstanceOf(Float32Array);
            expect(lpg.outputs.out).toBeInstanceOf(Float32Array);
            expect(lpg.outputs.out.length).toBe(512);
            expect(lpg.leds.open).toBe(0);
        });

        it('accepts custom buffer options', () => {
            const lpg = createLPG({ sampleRate: 48000, bufferSize: 128 });

            expect(lpg.outputs.out.length).toBe(128);
            expect(lpg.inputs.audio.length).toBe(128);
        });

        it('defines the expected declarative UI contract', () => {
            expect(lpgModule.ui.knobs.map(knob => knob.param)).toEqual([
                'level',
                'damp',
                'tone',
                'resonance'
            ]);
            expect(lpgModule.ui.buttons[0]).toMatchObject({
                param: 'mode',
                values: [0, 1, 2],
                default: 1
            });
            expect(lpgModule.ui.inputs.map(input => input.port)).toEqual([
                'audio',
                'cv',
                'strike',
                'dampCV'
            ]);
            expect(lpgModule.ui.outputs.map(output => output.port)).toEqual(['out']);
        });
    });

    describe('output ranges and integrity', () => {
        it('stays silent and finite with no audio input, even when struck', () => {
            const lpg = createLPG();

            lpg.inputs.strike.fill(10);
            lpg.process();

            expect(lpg.outputs.out.every(value => value === 0)).toBe(true);
            expect(lpg.outputs.out.every(Number.isFinite)).toBe(true);
        });

        it('soft-limits hot input and extreme controls to the rack audio range', () => {
            const lpg = createLPG({ bufferSize: 256 });

            lpg.params.level = 1;
            lpg.params.damp = 0;
            lpg.params.tone = 1;
            lpg.params.resonance = 1;
            lpg.params.mode = 2;
            fillAlternating(lpg.inputs.audio, 12);
            lpg.inputs.cv.fill(10);
            lpg.inputs.dampCV.fill(10);

            for (let i = 0; i < 20; i++) {
                lpg.process();
            }

            expect(lpg.outputs.out.every(Number.isFinite)).toBe(true);
            expect(Math.max(...lpg.outputs.out)).toBeLessThanOrEqual(5);
            expect(Math.min(...lpg.outputs.out)).toBeGreaterThanOrEqual(-5);
        });
    });

    describe('level and main CV control', () => {
        it('closes VCA mode with no level, CV, or strike', () => {
            const lpg = createLPG();

            lpg.params.mode = 0;
            lpg.params.level = 0;
            lpg.inputs.audio.fill(3);

            for (let i = 0; i < 4; i++) {
                lpg.process();
            }

            expect(peak(lpg.outputs.out)).toBeLessThan(0.01);
            expect(lpg.leds.open).toBeLessThan(0.01);
        });

        it('passes a steady signal when the manual level is fully open', () => {
            const lpg = createLPG();

            lpg.params.mode = 0;
            lpg.params.level = 1;
            lpg.inputs.audio.fill(3);

            for (let i = 0; i < 6; i++) {
                lpg.process();
            }

            expect(lpg.outputs.out[511]).toBeGreaterThan(2.7);
            expect(lpg.outputs.out[511]).toBeLessThanOrEqual(3);
            expect(lpg.leds.open).toBeGreaterThan(0.95);
        });

        it('maps 5V CV to full open and clamps hotter CV safely', () => {
            const closed = createLPG();
            const open = createLPG();
            const hot = createLPG();

            [closed, open, hot].forEach(lpg => {
                lpg.params.mode = 0;
                lpg.params.level = 0;
                lpg.inputs.audio.fill(3);
            });
            open.inputs.cv.fill(5);
            hot.inputs.cv.fill(10);

            for (let i = 0; i < 6; i++) {
                closed.process();
                open.process();
                hot.process();
            }

            expect(peak(closed.outputs.out)).toBeLessThan(0.01);
            expect(peak(open.outputs.out)).toBeGreaterThan(2.7);
            expect(peak(hot.outputs.out)).toBeCloseTo(peak(open.outputs.out), 1);
        });
    });

    describe('strike and damping', () => {
        it('responds to strike rising edges and does not retrigger while held high', () => {
            const lpg = createLPG({ sampleRate: 1000, bufferSize: 100 });

            lpg.params.mode = 0;
            lpg.params.level = 0;
            lpg.params.damp = 1;
            lpg.inputs.audio.fill(3);
            lpg.inputs.strike.fill(10);

            lpg.process();
            const firstPeak = peak(lpg.outputs.out);

            for (let i = 0; i < 15; i++) {
                lpg.process();
            }
            const heldHighTail = peak(lpg.outputs.out);

            lpg.inputs.strike.fill(0);
            lpg.process();
            lpg.inputs.strike.fill(10);
            lpg.process();
            const retriggerPeak = peak(lpg.outputs.out);

            expect(firstPeak).toBeGreaterThan(0.5);
            expect(heldHighTail).toBeLessThan(firstPeak * 0.2);
            expect(retriggerPeak).toBeGreaterThan(heldHighTail * 3);
        });

        it('uses damp to shorten the struck tail', () => {
            const tailPeak = (damp) => {
                const lpg = createLPG({ sampleRate: 1000, bufferSize: 100 });
                lpg.params.mode = 0;
                lpg.params.level = 0;
                lpg.params.damp = damp;
                lpg.inputs.audio.fill(3);
                lpg.inputs.strike[0] = 10;
                lpg.process();
                lpg.inputs.strike.fill(0);

                for (let i = 0; i < 5; i++) {
                    lpg.process();
                }

                return peak(lpg.outputs.out);
            };

            expect(tailPeak(0)).toBeGreaterThan(tailPeak(1) * 2);
        });

        it('adds damp CV to the knob damping amount', () => {
            const tailPeak = (dampCV) => {
                const lpg = createLPG({ sampleRate: 1000, bufferSize: 100 });
                lpg.params.mode = 0;
                lpg.params.level = 0;
                lpg.params.damp = 0;
                lpg.inputs.audio.fill(3);
                lpg.inputs.dampCV.fill(dampCV);
                lpg.inputs.strike[0] = 10;
                lpg.process();
                lpg.inputs.strike.fill(0);

                for (let i = 0; i < 5; i++) {
                    lpg.process();
                }

                return peak(lpg.outputs.out);
            };

            expect(tailPeak(0)).toBeGreaterThan(tailPeak(5) * 2);
        });
    });

    describe('tone, resonance, and modes', () => {
        it('makes low tone darker than high tone in combo mode', () => {
            const comboRms = (tone) => {
                const lpg = createLPG();
                lpg.params.mode = 1;
                lpg.params.level = 1;
                lpg.params.tone = tone;
                fillAlternating(lpg.inputs.audio);

                for (let i = 0; i < 10; i++) {
                    lpg.process();
                }

                return rms(lpg.outputs.out);
            };

            expect(comboRms(1)).toBeGreaterThan(comboRms(0.1) * 2);
        });

        it('changes low-pass response with resonance without becoming unstable', () => {
            const outputRms = (resonance) => {
                const lpg = createLPG({ bufferSize: 1024 });
                lpg.params.mode = 2;
                lpg.params.level = 1;
                lpg.params.tone = 0.3;
                lpg.params.resonance = resonance;
                fillSine(lpg.inputs.audio, { frequency: 4000, amount: 1.5 });

                for (let i = 0; i < 10; i++) {
                    lpg.process();
                }

                expect(lpg.outputs.out.every(Number.isFinite)).toBe(true);
                return rms(lpg.outputs.out);
            };

            const noRes = outputRms(0);
            const highRes = outputRms(1);

            expect(Math.abs(highRes - noRes)).toBeGreaterThan(0.02);
        });

        it('keeps VCA mode brighter than combo mode for high-frequency input', () => {
            const outputRms = (mode) => {
                const lpg = createLPG();
                lpg.params.mode = mode;
                lpg.params.level = 1;
                lpg.params.tone = 0.15;
                fillAlternating(lpg.inputs.audio);

                for (let i = 0; i < 10; i++) {
                    lpg.process();
                }

                return rms(lpg.outputs.out);
            };

            expect(outputRms(0)).toBeGreaterThan(outputRms(1) * 2);
        });

        it('uses LP mode as a near-unity low-pass path when open', () => {
            const lpg = createLPG();

            lpg.params.mode = 2;
            lpg.params.level = 1;
            lpg.params.tone = 1;
            lpg.inputs.audio.fill(2);

            for (let i = 0; i < 10; i++) {
                lpg.process();
            }

            expect(lpg.outputs.out[511]).toBeGreaterThan(1.8);
            expect(lpg.outputs.out[511]).toBeLessThanOrEqual(2.1);
        });
    });

    describe('LED, reset, and input clearing', () => {
        it('opens the LED with manual control and decays after closing', () => {
            const lpg = createLPG({ sampleRate: 1000, bufferSize: 100 });

            lpg.params.mode = 0;
            lpg.params.level = 1;
            lpg.process();
            const openLed = lpg.leds.open;

            lpg.params.level = 0;
            lpg.params.damp = 1;
            for (let i = 0; i < 15; i++) {
                lpg.process();
            }

            expect(openLed).toBeGreaterThan(0.95);
            expect(lpg.leds.open).toBeLessThan(openLed * 0.2);
        });

        it('clears envelopes, filter state, LEDs, and output on reset', () => {
            const lpg = createLPG();

            lpg.params.mode = 1;
            lpg.params.level = 1;
            lpg.inputs.audio.fill(3);
            lpg.inputs.strike.fill(10);
            lpg.process();

            expect(peak(lpg.outputs.out)).toBeGreaterThan(0);
            expect(lpg.leds.open).toBeGreaterThan(0);

            lpg.reset();

            expect(lpg.outputs.out.every(value => value === 0)).toBe(true);
            expect(lpg.leds.open).toBe(0);
        });

        it('resets replaced audio input buffers so disconnection silences the next process call', () => {
            const lpg = createLPG({ bufferSize: 64 });
            const externalAudio = new Float32Array(64).fill(3);

            lpg.params.mode = 1;
            lpg.params.level = 1;
            lpg.inputs.audio = externalAudio;
            lpg.process();

            expect(peak(lpg.outputs.out)).toBeGreaterThan(0);
            expect(lpg.inputs.audio).not.toBe(externalAudio);
            expect(lpg.inputs.audio.every(value => value === 0)).toBe(true);

            lpg.process();

            expect(lpg.outputs.out.every(value => value === 0)).toBe(true);
        });

        it('restores replaced CV and trigger buffers after processing and cable clearing', () => {
            const lpg = createLPG({ bufferSize: 64 });
            const externalAudio = new Float32Array(64).fill(3);
            const externalCV = new Float32Array(64).fill(5);
            const externalStrike = new Float32Array(64).fill(10);
            const externalDampCV = new Float32Array(64).fill(5);

            lpg.inputs.audio = externalAudio;
            lpg.inputs.cv = externalCV;
            lpg.inputs.strike = externalStrike;
            lpg.inputs.dampCV = externalDampCV;
            lpg.process();

            expect(lpg.inputs.audio).not.toBe(externalAudio);
            expect(lpg.inputs.cv).not.toBe(externalCV);
            expect(lpg.inputs.strike).not.toBe(externalStrike);
            expect(lpg.inputs.dampCV).not.toBe(externalDampCV);
            expect(lpg.inputs.cv.every(value => value === 0)).toBe(true);
            expect(lpg.inputs.strike.every(value => value === 0)).toBe(true);
            expect(lpg.inputs.dampCV.every(value => value === 0)).toBe(true);

            lpg.inputs.cv = externalCV;
            lpg.inputs.strike = externalStrike;
            lpg.inputs.dampCV = externalDampCV;
            lpg.clearAudioInputs();

            expect(lpg.inputs.cv).not.toBe(externalCV);
            expect(lpg.inputs.strike).not.toBe(externalStrike);
            expect(lpg.inputs.dampCV).not.toBe(externalDampCV);
            expect(lpg.inputs.cv.every(value => value === 0)).toBe(true);
            expect(lpg.inputs.strike.every(value => value === 0)).toBe(true);
            expect(lpg.inputs.dampCV.every(value => value === 0)).toBe(true);
        });
    });
});
