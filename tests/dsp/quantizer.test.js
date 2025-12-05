import { describe, it, expect, beforeEach } from 'vitest';
import { createBardQuartet } from '../../src/js/dsp/quantizer.js';

describe('createBardQuartet', () => {
    let quant;

    beforeEach(() => {
        quant = createBardQuartet();
    });

    describe('initialization', () => {
        it('should create a quantizer with default params', () => {
            expect(quant.params.harmony).toBe(0);
            expect(quant.params.transpose).toBe(0);
            expect(quant.params.transposeMode).toBe('post');
            expect(quant.params.root).toBe(0);
            expect(quant.params.arpMode).toBe(0);
            expect(quant.params.arpOctaves).toBe(1);
        });

        it('should create 4-channel CV inputs (In 1-4)', () => {
            expect(quant.inputs.cv.length).toBe(4);
            expect(quant.inputs.cv[0]).toBeInstanceOf(Float32Array);
            expect(quant.inputs.cv[0].length).toBe(512);
        });

        it('should create shared gate input (GT In)', () => {
            expect(quant.inputs.gate).toBe(0);
        });

        it('should create CV modulation inputs (Hrmn, Trsp)', () => {
            expect(quant.inputs.harmonyCV).toBe(0);
            expect(quant.inputs.transposeCV).toBe(0);
        });

        it('should create 4-channel CV outputs (Out 1-4)', () => {
            expect(quant.outputs.cv.length).toBe(4);
            expect(quant.outputs.cv[0]).toBeInstanceOf(Float32Array);
        });

        it('should create shared trigger output (Trig Out)', () => {
            expect(quant.outputs.trigger).toBeInstanceOf(Float32Array);
            expect(quant.outputs.trigger.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(quant.leds.active).toBe(0);
        });

        it('should accept custom buffer size', () => {
            const customQuant = createBardQuartet({ bufferSize: 256 });
            expect(customQuant.inputs.cv[0].length).toBe(256);
            expect(customQuant.outputs.trigger.length).toBe(256);
        });
    });

    describe('harmony presets', () => {
        it('should have 8 pre-programmed harmonies', () => {
            const names = quant.getHarmonyNames();
            expect(names.length).toBe(8);
        });

        it('should have named harmonies', () => {
            const names = quant.getHarmonyNames();
            expect(names).toContain('C Major');
            expect(names).toContain('A Minor');
            expect(names).toContain('Pentatonic');
            expect(names).toContain('Blues');
            expect(names).toContain('Chromatic');
        });

        it('should return current harmony info', () => {
            quant.params.harmony = 0;
            const harmony = quant.getCurrentHarmony();
            expect(harmony.name).toBe('C Major');
            expect(harmony.root).toBe(0);
            expect(harmony.scales.length).toBe(4);
        });

        it('should switch harmony with param', () => {
            quant.params.harmony = 1;
            expect(quant.getCurrentHarmony().name).toBe('A Minor');

            quant.params.harmony = 5;
            expect(quant.getCurrentHarmony().name).toBe('Pentatonic');
        });

        it('should clamp harmony to valid range', () => {
            quant.params.harmony = -1;
            expect(quant.getCurrentHarmony().name).toBe('C Major');

            quant.params.harmony = 10;
            expect(quant.getCurrentHarmony().name).toBe('Chromatic');
        });
    });

    describe('arpeggiator', () => {
        it('should have 5 arp modes', () => {
            const modes = quant.getArpModeNames();
            expect(modes.length).toBe(5);
            expect(modes).toEqual(['off', 'up', 'down', 'pendulum', 'random']);
        });

        it('should default to arp off', () => {
            expect(quant.params.arpMode).toBe(0);
        });

        it('should support 1-4 octave spread', () => {
            expect(quant.params.arpOctaves).toBe(1);
            quant.params.arpOctaves = 4;
            expect(quant.params.arpOctaves).toBe(4);
        });
    });

    describe('output range', () => {
        it('should produce CV output in -3V to +7V range', () => {
            for (let ch = 0; ch < 4; ch++) {
                quant.inputs.cv[ch][0] = Math.random() * 10 - 3;
            }

            quant.process();

            for (let ch = 0; ch < 4; ch++) {
                const max = Math.max(...quant.outputs.cv[ch]);
                const min = Math.min(...quant.outputs.cv[ch]);
                expect(min).toBeGreaterThanOrEqual(-3);
                expect(max).toBeLessThanOrEqual(7);
            }
        });

        it('should produce trigger output of 0 or 5V', () => {
            quant.inputs.cv[0][0] = 1;
            quant.process();

            expect(quant.outputs.trigger.every(v => v === 0 || v === 5)).toBe(true);
        });
    });

    describe('quantization', () => {
        it('should quantize to C Major scale notes', () => {
            quant.params.harmony = 0; // C Major

            quant.inputs.cv[0][0] = 0; // C
            quant.process();
            expect(quant.outputs.cv[0][0]).toBeCloseTo(0, 1);
        });

        it('should quantize non-scale notes to nearest scale note', () => {
            quant.params.harmony = 0; // C Major (C D E F G A B)

            // Input C# (not in C Major), should snap to C or D
            quant.inputs.cv[0][0] = 1/12; // C# = 1 semitone
            quant.process();

            const output = quant.outputs.cv[0][0];
            const isC = Math.abs(output - 0) < 0.01;
            const isD = Math.abs(output - 2/12) < 0.01;
            expect(isC || isD).toBe(true);
        });

        it('should use chromatic scale when harmony=7', () => {
            quant.params.harmony = 7; // Chromatic

            quant.inputs.cv[0][0] = 1/12; // C#
            quant.process();
            expect(quant.outputs.cv[0][0]).toBeCloseTo(1/12, 2);
        });
    });

    describe('shared gate input (GT In)', () => {
        it('should detect rising edge', () => {
            quant.params.harmony = 7;
            quant.inputs.gate = 0;
            quant.inputs.cv[0][0] = 0;
            quant.process();

            quant.inputs.gate = 5; // Rising edge
            quant.inputs.cv[0][0] = 0.5;
            quant.process();

            // Gate should affect processing
            expect(quant.outputs.cv[0][0]).toBeDefined();
        });
    });

    describe('shared trigger output (Trig Out)', () => {
        it('should fire trigger on note change', () => {
            const smallQuant = createBardQuartet({ bufferSize: 64 });
            smallQuant.params.harmony = 7;

            smallQuant.inputs.cv[0][0] = 0;
            smallQuant.process();

            // Wait for initial trigger to finish
            for (let i = 0; i < 10; i++) {
                smallQuant.process();
            }

            // Change note
            smallQuant.inputs.cv[0][0] = 1.0;
            smallQuant.process();

            expect(smallQuant.outputs.trigger.some(v => v === 5)).toBe(true);
        });

        it('should be shared across all channels', () => {
            const smallQuant = createBardQuartet({ bufferSize: 64 });
            smallQuant.params.harmony = 7;

            // Initial state
            for (let ch = 0; ch < 4; ch++) {
                smallQuant.inputs.cv[ch][0] = 0;
            }
            smallQuant.process();

            // Let trigger finish
            for (let i = 0; i < 10; i++) {
                smallQuant.process();
            }

            // Change only channel 2
            smallQuant.inputs.cv[2][0] = 1.0;
            smallQuant.process();

            // Shared trigger should fire
            expect(smallQuant.outputs.trigger.some(v => v === 5)).toBe(true);
        });
    });

    describe('harmony CV (Hrmn)', () => {
        it('should modulate harmony selection with CV', () => {
            quant.params.harmony = 0; // C Major
            quant.inputs.harmonyCV = 0;
            expect(quant.getCurrentHarmony().name).toBe('C Major');
        });

        it('should clamp harmony CV result to valid range', () => {
            quant.params.harmony = 7; // Chromatic
            quant.inputs.harmonyCV = 5; // Would overflow
            quant.inputs.cv[0][0] = 0;
            quant.process();

            expect(quant.outputs.cv[0][0]).toBeDefined();
        });

        it('should handle negative harmony CV', () => {
            quant.params.harmony = 4;
            quant.inputs.harmonyCV = -5;
            quant.inputs.cv[0][0] = 0;
            quant.process();

            expect(quant.outputs.cv[0][0]).toBeDefined();
        });
    });

    describe('transpose', () => {
        it('should transpose output by octaves', () => {
            quant.params.harmony = 7; // Chromatic
            quant.params.transpose = 0;
            quant.inputs.cv[0][0] = 0;
            quant.process();
            const noTranspose = quant.outputs.cv[0][0];

            quant.params.transpose = 1; // +1 octave
            quant.process();
            const upOctave = quant.outputs.cv[0][0];

            expect(upOctave - noTranspose).toBeCloseTo(1, 1);
        });

        it('should handle negative transpose', () => {
            quant.params.harmony = 7;
            quant.params.transpose = 0;
            quant.inputs.cv[0][0] = 1;
            quant.process();
            const noTranspose = quant.outputs.cv[0][0];

            quant.params.transpose = -2;
            quant.process();
            const downOctaves = quant.outputs.cv[0][0];

            expect(noTranspose - downOctaves).toBeCloseTo(2, 1);
        });

        it('should clamp transpose to -3 to +3', () => {
            quant.params.harmony = 7;
            quant.params.transpose = 10; // Should clamp to 3
            quant.inputs.cv[0][0] = 0;
            quant.process();

            expect(quant.outputs.cv[0][0]).toBeCloseTo(3, 1);
        });

        it('should respond to transpose CV (Trsp)', () => {
            quant.params.harmony = 7;
            quant.params.transpose = 0;
            quant.inputs.transposeCV = 0;
            quant.inputs.cv[0][0] = 0;
            quant.process();
            const noCV = quant.outputs.cv[0][0];

            quant.inputs.transposeCV = 1; // +1 octave via CV
            quant.process();
            const withCV = quant.outputs.cv[0][0];

            expect(withCV - noCV).toBeCloseTo(1, 1);
        });
    });

    describe('transpose mode (pre/post)', () => {
        it('should default to post mode', () => {
            expect(quant.params.transposeMode).toBe('post');
        });

        it('should support pre mode', () => {
            quant.params.transposeMode = 'pre';
            quant.params.harmony = 0; // C Major
            quant.params.transpose = 1;
            quant.inputs.cv[0][0] = 0;
            quant.process();

            expect(quant.outputs.cv[0][0]).toBeDefined();
        });
    });

    describe('root note', () => {
        it('should default to 0 (use harmony root)', () => {
            expect(quant.params.root).toBe(0);
        });

        it('should allow root override', () => {
            quant.params.root = 5; // F
            quant.params.harmony = 0;
            quant.inputs.cv[0][0] = 0;
            quant.process();

            expect(quant.outputs.cv[0][0]).toBeDefined();
        });
    });

    describe('LED', () => {
        it('should show activity when trigger fires', () => {
            const smallQuant = createBardQuartet({ bufferSize: 64 });
            smallQuant.params.harmony = 7;

            smallQuant.inputs.cv[0][0] = 0;
            smallQuant.process();

            for (let i = 0; i < 10; i++) {
                smallQuant.process();
            }

            smallQuant.inputs.cv[0][0] = 1.0;
            smallQuant.process();

            expect(smallQuant.leds.active).toBe(1);
        });

        it('should turn off after trigger pulse ends', () => {
            const smallQuant = createBardQuartet({ bufferSize: 64 });
            smallQuant.params.harmony = 7;

            smallQuant.inputs.cv[0][0] = 0;
            smallQuant.process();

            smallQuant.inputs.cv[0][0] = 0.5;
            smallQuant.process();

            for (let i = 0; i < 10; i++) {
                smallQuant.process();
            }

            expect(smallQuant.leds.active).toBe(0);
        });

        it('should show channel LED for selected channel', () => {
            quant.params.editChannel = 0;
            quant.process();

            expect(quant.leds.ch1).toBe(1);
            expect(quant.leds.ch2).toBe(0);
            expect(quant.leds.ch3).toBe(0);
            expect(quant.leds.ch4).toBe(0);
        });

        it('should update channel LED when channel changes', () => {
            quant.params.editChannel = 2;
            quant.process();

            expect(quant.leds.ch1).toBe(0);
            expect(quant.leds.ch2).toBe(0);
            expect(quant.leds.ch3).toBe(1);
            expect(quant.leds.ch4).toBe(0);
        });
    });

    describe('UI params', () => {
        it('should have editChannel param', () => {
            expect(quant.params.editChannel).toBeDefined();
            expect(quant.params.editChannel).toBe(0);
        });

        it('should have editMode param', () => {
            expect(quant.params.editMode).toBeDefined();
            expect(quant.params.editMode).toBe(false);
        });

        it('should have arpgMode param', () => {
            expect(quant.params.arpgMode).toBeDefined();
            expect(quant.params.arpgMode).toBe(false);
        });

        it('should have utuneMode param', () => {
            expect(quant.params.utuneMode).toBeDefined();
            expect(quant.params.utuneMode).toBe(false);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            for (let ch = 0; ch < 4; ch++) {
                for (let i = 0; i < 512; i++) {
                    quant.inputs.cv[ch][i] = Math.random() * 6 - 2;
                }
            }

            quant.process();

            for (let ch = 0; ch < 4; ch++) {
                expect(quant.outputs.cv[ch].every(v => !isNaN(v))).toBe(true);
            }
            expect(quant.outputs.trigger.every(v => !isNaN(v))).toBe(true);
        });

        it('should respect custom buffer size', () => {
            const smallQuant = createBardQuartet({ bufferSize: 64 });
            smallQuant.inputs.cv[0][0] = 0;
            smallQuant.process();

            expect(smallQuant.outputs.cv[0].length).toBe(64);
            expect(smallQuant.outputs.trigger.length).toBe(64);
        });
    });

    describe('per-channel scales', () => {
        it('should use different scales per channel in Pentatonic harmony', () => {
            quant.params.harmony = 5; // Pentatonic
            const harmony = quant.getCurrentHarmony();

            expect(harmony.scales[0]).toBe(harmony.scales[2]); // Ch1 & Ch3 same
            expect(harmony.scales[1]).toBe(harmony.scales[3]); // Ch2 & Ch4 same
            expect(harmony.scales[0]).not.toBe(harmony.scales[1]); // Ch1 != Ch2
        });
    });

    describe('scale programming', () => {
        it('should set scale for a channel', () => {
            const customScale = 0b101010101010; // Whole tone
            quant.setScale(0, customScale);
            expect(quant.getScale(0)).toBe(customScale);
        });

        it('should mask scale to 12 bits', () => {
            quant.setScale(0, 0xFFFF); // 16 bits
            expect(quant.getScale(0)).toBe(0xFFF); // Should be masked to 12 bits
        });

        it('should clamp channel to 0-3', () => {
            quant.setScale(-1, 0b111111111111);
            expect(quant.getScale(0)).toBe(0b111111111111);

            quant.setScale(10, 0b101010101010);
            expect(quant.getScale(3)).toBe(0b101010101010);
        });

        it('should toggle notes in scale', () => {
            quant.params.harmony = 7; // Chromatic (all notes on)

            // Toggle off C (note 0)
            const wasOn = quant.isNoteInScale(0, 0);
            expect(wasOn).toBe(true);

            const newState = quant.toggleNote(0, 0);
            expect(newState).toBe(false);
            expect(quant.isNoteInScale(0, 0)).toBe(false);

            // Toggle back on
            const toggledBack = quant.toggleNote(0, 0);
            expect(toggledBack).toBe(true);
        });

        it('should check if note is in scale', () => {
            quant.params.harmony = 0; // C Major
            // C Major: C D E F G A B (bits: 101011010101)
            expect(quant.isNoteInScale(0, 0)).toBe(true);  // C
            expect(quant.isNoteInScale(0, 1)).toBe(false); // C# not in C Major
            expect(quant.isNoteInScale(0, 2)).toBe(true);  // D
        });

        it('should copy scale between channels', () => {
            const customScale = 0b110011001100;
            quant.setScale(0, customScale);
            quant.copyScale(0, 2);
            expect(quant.getScale(2)).toBe(customScale);
        });

        it('should apply factory scale preset', () => {
            const scales = quant.getFactoryScales();
            quant.applyFactoryScale(0, 'blues');
            expect(quant.getScale(0)).toBe(scales.blues);
        });

        it('should ignore invalid factory preset name', () => {
            const before = quant.getScale(0);
            quant.applyFactoryScale(0, 'notARealScale');
            expect(quant.getScale(0)).toBe(before);
        });

        it('should get factory scale presets', () => {
            const scales = quant.getFactoryScales();
            expect(scales.major).toBeDefined();
            expect(scales.minor).toBeDefined();
            expect(scales.blues).toBeDefined();
            expect(scales.chromatic).toBe(0b111111111111);
        });

        it('should get note names', () => {
            const names = quant.getNoteNames();
            expect(names.length).toBe(12);
            expect(names[0]).toBe('C');
            expect(names[11]).toBe('B');
        });
    });

    describe('root note programming', () => {
        it('should set root note for current harmony', () => {
            quant.setRoot(5); // F
            expect(quant.getRoot()).toBe(5);
        });

        it('should clamp root to 0-11', () => {
            quant.setRoot(-1);
            expect(quant.getRoot()).toBe(0);

            quant.setRoot(15);
            expect(quant.getRoot()).toBe(11);
        });
    });

    describe('harmony naming', () => {
        it('should set harmony name', () => {
            quant.setHarmonyName('My Custom Scale');
            expect(quant.getCurrentHarmony().name).toBe('My Custom Scale');
        });

        it('should truncate long names to 32 chars', () => {
            const longName = 'This is a very long harmony name that exceeds the limit';
            quant.setHarmonyName(longName);
            expect(quant.getCurrentHarmony().name.length).toBe(32);
        });
    });

    describe('memory slots', () => {
        it('should have 10 memory slots per harmony', () => {
            // Default slot is 0
            expect(quant.getMemorySlot(0)).toBe(0);
        });

        it('should switch memory slots', () => {
            quant.setMemorySlot(0, 5);
            expect(quant.getMemorySlot(0)).toBe(5);
        });

        it('should clamp slot to 0-9', () => {
            quant.setMemorySlot(0, -1);
            expect(quant.getMemorySlot(0)).toBe(0);

            quant.setMemorySlot(0, 15);
            expect(quant.getMemorySlot(0)).toBe(9);
        });

        it('should save to memory slot', () => {
            // Modify current slot
            quant.setScale(0, 0b101010101010);
            quant.setHarmonyName('Test Scale');

            // Save to slot 5
            quant.saveToMemory(5);

            // Switch to slot 5
            quant.loadFromMemory(5);

            expect(quant.getScale(0)).toBe(0b101010101010);
            expect(quant.getCurrentHarmony().name).toBe('Test Scale');
        });

        it('should load from memory slot', () => {
            // Set up slot 3
            quant.setMemorySlot(0, 3);
            quant.setScale(0, 0b110011001100);

            // Switch back to slot 0
            quant.loadFromMemory(0);

            // Original scale should be intact
            expect(quant.getScale(0)).not.toBe(0b110011001100);

            // Load slot 3 again
            quant.loadFromMemory(3);
            expect(quant.getScale(0)).toBe(0b110011001100);
        });

        it('should copy memory slot', () => {
            // Modify slot 0
            quant.setScale(0, 0b111000111000);
            quant.setHarmonyName('Source Slot');

            // Copy to slot 7
            quant.copyMemorySlot(0, 7);

            // Switch to slot 7 and verify
            quant.loadFromMemory(7);
            expect(quant.getScale(0)).toBe(0b111000111000);
            expect(quant.getCurrentHarmony().name).toBe('Source Slot');
        });

        it('should reset current slot to factory', () => {
            quant.params.harmony = 0; // C Major
            const factoryName = quant.getCurrentHarmony().name;

            quant.setHarmonyName('Modified');
            quant.setScale(0, 0);

            quant.resetToFactory();

            expect(quant.getCurrentHarmony().name).toBe(factoryName);
            expect(quant.getScale(0)).not.toBe(0);
        });

        it('should reset all memory to factory', () => {
            // Modify multiple harmonies
            quant.params.harmony = 0;
            quant.setScale(0, 0);
            quant.setMemorySlot(0, 5);

            quant.params.harmony = 3;
            quant.setScale(0, 0);

            quant.resetAllToFactory();

            // Check all slots reset
            quant.params.harmony = 0;
            expect(quant.getMemorySlot(0)).toBe(0);
            expect(quant.getScale(0)).not.toBe(0);

            quant.params.harmony = 3;
            expect(quant.getScale(0)).not.toBe(0);
        });

        it('should maintain separate slots per harmony', () => {
            quant.params.harmony = 0;
            quant.setMemorySlot(0, 3);

            quant.params.harmony = 1;
            quant.setMemorySlot(1, 7);

            expect(quant.getMemorySlot(0)).toBe(3);
            expect(quant.getMemorySlot(1)).toBe(7);
        });
    });

    describe('export/import', () => {
        it('should export memory as JSON', () => {
            const json = quant.exportMemory();
            const data = JSON.parse(json);

            expect(data.memory).toBeDefined();
            expect(data.memory.length).toBe(8);
            expect(data.memory[0].length).toBe(10);
            expect(data.currentSlots).toBeDefined();
            expect(data.currentSlots.length).toBe(8);
        });

        it('should import memory from JSON', () => {
            // Create custom data
            const customData = {
                memory: Array.from({ length: 8 }, (_, h) =>
                    Array.from({ length: 10 }, (_, s) => ({
                        name: `Imported H${h} S${s}`,
                        root: h,
                        scales: [0b111111111111, 0b111111111111, 0b111111111111, 0b111111111111]
                    }))
                ),
                currentSlots: [1, 2, 3, 4, 5, 6, 7, 8]
            };

            const result = quant.importMemory(JSON.stringify(customData));
            expect(result).toBe(true);

            quant.params.harmony = 0;
            quant.loadFromMemory(1);
            expect(quant.getCurrentHarmony().name).toBe('Imported H0 S1');
        });

        it('should handle invalid JSON on import', () => {
            const result = quant.importMemory('not valid json');
            expect(result).toBe(false);
        });

        it('should round-trip export/import', () => {
            // Modify some data - switch to slot 4 first, then modify
            quant.params.harmony = 2;
            quant.loadFromMemory(4);  // Switch to slot 4
            quant.setScale(0, 0b101010101010);
            quant.setHarmonyName('Round Trip Test');

            // Export (should include currentSlots state)
            const exported = quant.exportMemory();

            // Reset
            quant.resetAllToFactory();

            // Import
            quant.importMemory(exported);

            // Verify - slot 4 should be restored as current
            quant.params.harmony = 2;
            expect(quant.getMemorySlot(2)).toBe(4);
            expect(quant.getCurrentHarmony().name).toBe('Round Trip Test');
            expect(quant.getScale(0)).toBe(0b101010101010);
        });
    });

    describe('320 programmable scales', () => {
        it('should support 320 unique scales (8 harmonies × 10 slots × 4 channels)', () => {
            let count = 0;

            for (let h = 0; h < 8; h++) {
                quant.params.harmony = h;
                for (let s = 0; s < 10; s++) {
                    quant.setMemorySlot(h, s);
                    for (let ch = 0; ch < 4; ch++) {
                        // Set unique scale
                        quant.setScale(ch, count % 0xFFF);
                        count++;
                    }
                }
            }

            expect(count).toBe(320);
        });
    });
});
