import { clamp } from '../utils/math.js';

/**
 * Shakmat Bard Quartet – Programmable Quad Quantiser
 *
 * Matches real hardware:
 *   - 320 programmable scales (4 channels × 8 harmonies × 10 memory slots)
 *   - 12-note keyboard for scale programming
 *   - 1 Harmony potentiometer (8 positions)
 *   - 4 CV inputs/outputs
 *   - Shared gate input and trigger output
 *
 * Panel Layout:
 *   - In 1-4: CV inputs per channel
 *   - Out 1-4: CV outputs per channel
 *   - GT In: Shared gate input (track & hold / arp reset)
 *   - Trig Out: Shared trigger output
 *   - Hrmn: Harmony CV input
 *   - Trsp: Transpose CV input
 *
 * @param {Object} options
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @param {number} options.sampleRate - Sample rate (default: 44100)
 * @returns {Object} Quantizer module
 */
export function createBardQuartet({ bufferSize = 512, sampleRate = 44100 } = {}) {
    const toSemi = v => v * 12;
    const toVolt = s => s / 12;
    const clampPitch = v => Math.max(-3, Math.min(7, v));

    // Note names for display
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    /**
     * Factory preset scales (used to initialize memory)
     * Bit masks: bit 11 = C, bit 0 = B (1 = note in scale)
     */
    const FACTORY_SCALES = {
        major:          0b101011010101,  // C D E F G A B
        minor:          0b101101011010,  // A B C D E F G (natural minor)
        mixolydian:     0b101011010110,
        dorian:         0b101101010110,
        phrygian:       0b110101011010,
        majorPent:      0b101010010100,  // C D E G A
        minorPent:      0b100101001010,  // A C D E G
        blues:          0b100101101010,  // C Eb F F# G Bb
        chromatic:      0b111111111111,  // All notes
        wholeTone:      0b101010101010,
        diminished:     0b101101101101,
        augmented:      0b100010001000
    };

    /**
     * Factory harmony presets
     */
    const FACTORY_HARMONIES = [
        { name: 'C Major',      root: 0,  scales: [FACTORY_SCALES.major, FACTORY_SCALES.major, FACTORY_SCALES.major, FACTORY_SCALES.major] },
        { name: 'A Minor',      root: 9,  scales: [FACTORY_SCALES.minor, FACTORY_SCALES.minor, FACTORY_SCALES.minor, FACTORY_SCALES.minor] },
        { name: 'G Mixolydian', root: 7,  scales: [FACTORY_SCALES.mixolydian, FACTORY_SCALES.mixolydian, FACTORY_SCALES.mixolydian, FACTORY_SCALES.mixolydian] },
        { name: 'D Dorian',     root: 2,  scales: [FACTORY_SCALES.dorian, FACTORY_SCALES.dorian, FACTORY_SCALES.dorian, FACTORY_SCALES.dorian] },
        { name: 'E Phrygian',   root: 4,  scales: [FACTORY_SCALES.phrygian, FACTORY_SCALES.phrygian, FACTORY_SCALES.phrygian, FACTORY_SCALES.phrygian] },
        { name: 'Pentatonic',   root: 0,  scales: [FACTORY_SCALES.majorPent, FACTORY_SCALES.minorPent, FACTORY_SCALES.majorPent, FACTORY_SCALES.minorPent] },
        { name: 'Blues',        root: 0,  scales: [FACTORY_SCALES.blues, FACTORY_SCALES.blues, FACTORY_SCALES.blues, FACTORY_SCALES.blues] },
        { name: 'Chromatic',    root: 0,  scales: [FACTORY_SCALES.chromatic, FACTORY_SCALES.chromatic, FACTORY_SCALES.chromatic, FACTORY_SCALES.chromatic] }
    ];

    // Arpeggiator modes
    const ARP_MODES = ['off', 'up', 'down', 'pendulum', 'random'];

    /**
     * Memory structure: 8 harmonies × 10 slots × 4 channels
     * Each harmony slot contains: { name, root, scales[4] }
     */
    const memory = Array.from({ length: 8 }, (_, h) =>
        Array.from({ length: 10 }, (_, s) => ({
            name: s === 0 ? FACTORY_HARMONIES[h].name : `Harmony ${h + 1} Slot ${s + 1}`,
            root: FACTORY_HARMONIES[h].root,
            scales: [...FACTORY_HARMONIES[h].scales]
        }))
    );

    // Current memory slot per harmony (0-9)
    const currentSlot = new Array(8).fill(0);

    // Buffers
    const cvIn = Array.from({ length: 4 }, () => new Float32Array(bufferSize));
    const cvOut = Array.from({ length: 4 }, () => new Float32Array(bufferSize));
    const trigOut = new Float32Array(bufferSize);

    // State
    const held = new Float32Array(4);
    const lastHeld = new Float32Array(4);
    let lastGate = 0;
    let trigPulse = 0;
    const TRIG_SAMPLES = Math.floor(sampleRate * 0.01);

    // Arpeggiator state
    const arpState = Array.from({ length: 4 }, () => ({
        position: 0,
        direction: 1,
        notes: []
    }));

    /**
     * Quantise a semitone value to the nearest note in the scale
     */
    function quantise(semi, mask, root) {
        const oct = Math.floor(semi / 12);
        const note = ((Math.round(semi) % 12) + 12) % 12;

        for (let offset = 0; offset <= 6; offset++) {
            const upNote = (note + offset) % 12;
            const upRel = (upNote - root + 12) % 12;
            if (mask & (1 << (11 - upRel))) {
                return oct * 12 + note + offset;
            }

            if (offset > 0) {
                const downNote = ((note - offset) % 12 + 12) % 12;
                const downRel = (downNote - root + 12) % 12;
                if (mask & (1 << (11 - downRel))) {
                    return oct * 12 + note - offset;
                }
            }
        }
        return semi;
    }

    /**
     * Build arpeggiator note sequence
     */
    function buildArpSequence(mask, root, baseNote, octaves) {
        const notes = [];
        const startOct = Math.floor(baseNote / 12);

        for (let oct = 0; oct < octaves; oct++) {
            for (let i = 0; i < 12; i++) {
                const rel = (i - root + 12) % 12;
                if (mask & (1 << (11 - rel))) {
                    notes.push((startOct + oct) * 12 + i);
                }
            }
        }
        return notes;
    }

    /**
     * Get next arpeggiator note
     */
    function getArpNote(state, mode) {
        if (state.notes.length === 0) return 0;

        let note;
        switch (mode) {
            case 1: // Up
                note = state.notes[state.position % state.notes.length];
                state.position = (state.position + 1) % state.notes.length;
                break;
            case 2: // Down
                note = state.notes[state.notes.length - 1 - (state.position % state.notes.length)];
                state.position = (state.position + 1) % state.notes.length;
                break;
            case 3: // Pendulum
                note = state.notes[state.position];
                state.position += state.direction;
                if (state.position >= state.notes.length - 1) {
                    state.direction = -1;
                    state.position = state.notes.length - 1;
                } else if (state.position <= 0) {
                    state.direction = 1;
                    state.position = 0;
                }
                break;
            case 4: // Random
                note = state.notes[Math.floor(Math.random() * state.notes.length)];
                break;
            default:
                note = state.notes[0];
        }
        return note;
    }

    /**
     * Get current harmony data (from memory)
     */
    function getCurrentHarmonyData(harmonyIdx) {
        const h = clamp(Math.floor(harmonyIdx), 0, 7);
        const s = currentSlot[h];
        return memory[h][s];
    }

    return {
        params: {
            harmony: 0,
            transpose: 0,
            transposeMode: 'post',
            root: 0,
            arpMode: 0,
            arpOctaves: 1,
            // UI state params (matching real panel)
            editChannel: 0,      // Currently selected channel for editing (0-3)
            editMode: false,     // Edit button state
            arpgMode: false,     // ARPG button state
            utuneMode: false     // μTune button state
        },
        inputs: {
            cv: cvIn,
            gate: 0,
            harmonyCV: 0,
            transposeCV: 0
        },
        outputs: {
            cv: cvOut,
            trigger: trigOut
        },
        leds: {
            active: 0,
            ch1: 0,
            ch2: 0,
            ch3: 0,
            ch4: 0
        },

        // ========== Harmony & Memory Methods ==========

        /**
         * Get harmony names for current slots
         */
        getHarmonyNames() {
            return memory.map((h, i) => h[currentSlot[i]].name);
        },

        /**
         * Get current harmony info
         */
        getCurrentHarmony() {
            return getCurrentHarmonyData(this.params.harmony);
        },

        /**
         * Get arpeggiator mode names
         */
        getArpModeNames() {
            return [...ARP_MODES];
        },

        /**
         * Get note names
         */
        getNoteNames() {
            return [...NOTE_NAMES];
        },

        /**
         * Get factory scale presets
         */
        getFactoryScales() {
            return { ...FACTORY_SCALES };
        },

        // ========== Scale Programming Methods ==========

        /**
         * Set scale for a channel in current harmony/slot
         * @param {number} channel - Channel 0-3
         * @param {number} scaleMask - 12-bit scale mask
         */
        setScale(channel, scaleMask) {
            const ch = clamp(Math.floor(channel), 0, 3);
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = currentSlot[h];
            memory[h][s].scales[ch] = scaleMask & 0xFFF;
        },

        /**
         * Get scale for a channel in current harmony/slot
         * @param {number} channel - Channel 0-3
         * @returns {number} 12-bit scale mask
         */
        getScale(channel) {
            const ch = clamp(Math.floor(channel), 0, 3);
            return getCurrentHarmonyData(this.params.harmony).scales[ch];
        },

        /**
         * Toggle a note in a channel's scale
         * @param {number} channel - Channel 0-3
         * @param {number} note - Note 0-11 (0=C, 11=B)
         * @returns {boolean} New state of the note (true=in scale)
         */
        toggleNote(channel, note) {
            const ch = clamp(Math.floor(channel), 0, 3);
            const n = clamp(Math.floor(note), 0, 11);
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = currentSlot[h];
            const bit = 1 << (11 - n);
            memory[h][s].scales[ch] ^= bit;
            return (memory[h][s].scales[ch] & bit) !== 0;
        },

        /**
         * Check if a note is in a channel's scale
         * @param {number} channel - Channel 0-3
         * @param {number} note - Note 0-11
         * @returns {boolean}
         */
        isNoteInScale(channel, note) {
            const ch = clamp(Math.floor(channel), 0, 3);
            const n = clamp(Math.floor(note), 0, 11);
            const scale = this.getScale(ch);
            return (scale & (1 << (11 - n))) !== 0;
        },

        /**
         * Set root note for current harmony/slot
         * @param {number} root - Root note 0-11
         */
        setRoot(root) {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = currentSlot[h];
            memory[h][s].root = clamp(Math.floor(root), 0, 11);
        },

        /**
         * Get root note for current harmony/slot
         * @returns {number} Root note 0-11
         */
        getRoot() {
            return getCurrentHarmonyData(this.params.harmony).root;
        },

        /**
         * Set name for current harmony/slot
         * @param {string} name - Harmony name
         */
        setHarmonyName(name) {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = currentSlot[h];
            memory[h][s].name = String(name).slice(0, 32);
        },

        /**
         * Copy scale from one channel to another
         * @param {number} fromChannel - Source channel 0-3
         * @param {number} toChannel - Target channel 0-3
         */
        copyScale(fromChannel, toChannel) {
            const from = clamp(Math.floor(fromChannel), 0, 3);
            const to = clamp(Math.floor(toChannel), 0, 3);
            const scale = this.getScale(from);
            this.setScale(to, scale);
        },

        /**
         * Apply a factory scale preset to a channel
         * @param {number} channel - Channel 0-3
         * @param {string} presetName - Preset name from FACTORY_SCALES
         */
        applyFactoryScale(channel, presetName) {
            if (FACTORY_SCALES[presetName] !== undefined) {
                this.setScale(channel, FACTORY_SCALES[presetName]);
            }
        },

        // ========== Memory Slot Methods ==========

        /**
         * Get current memory slot for a harmony
         * @param {number} harmony - Harmony index 0-7
         * @returns {number} Current slot 0-9
         */
        getMemorySlot(harmony) {
            const h = clamp(Math.floor(harmony), 0, 7);
            return currentSlot[h];
        },

        /**
         * Set memory slot for a harmony
         * @param {number} harmony - Harmony index 0-7
         * @param {number} slot - Slot index 0-9
         */
        setMemorySlot(harmony, slot) {
            const h = clamp(Math.floor(harmony), 0, 7);
            currentSlot[h] = clamp(Math.floor(slot), 0, 9);
        },

        /**
         * Save current harmony to a memory slot
         * @param {number} slot - Target slot 0-9
         */
        saveToMemory(slot) {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = clamp(Math.floor(slot), 0, 9);
            const current = memory[h][currentSlot[h]];
            memory[h][s] = {
                name: current.name,
                root: current.root,
                scales: [...current.scales]
            };
        },

        /**
         * Load harmony from a memory slot
         * @param {number} slot - Source slot 0-9
         */
        loadFromMemory(slot) {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            currentSlot[h] = clamp(Math.floor(slot), 0, 9);
        },

        /**
         * Copy harmony from one slot to another
         * @param {number} fromSlot - Source slot 0-9
         * @param {number} toSlot - Target slot 0-9
         */
        copyMemorySlot(fromSlot, toSlot) {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const from = clamp(Math.floor(fromSlot), 0, 9);
            const to = clamp(Math.floor(toSlot), 0, 9);
            const source = memory[h][from];
            memory[h][to] = {
                name: source.name,
                root: source.root,
                scales: [...source.scales]
            };
        },

        /**
         * Reset current harmony/slot to factory defaults
         */
        resetToFactory() {
            const h = clamp(Math.floor(this.params.harmony), 0, 7);
            const s = currentSlot[h];
            const factory = FACTORY_HARMONIES[h];
            memory[h][s] = {
                name: factory.name,
                root: factory.root,
                scales: [...factory.scales]
            };
        },

        /**
         * Reset all memory to factory defaults
         */
        resetAllToFactory() {
            for (let h = 0; h < 8; h++) {
                for (let s = 0; s < 10; s++) {
                    memory[h][s] = {
                        name: s === 0 ? FACTORY_HARMONIES[h].name : `Harmony ${h + 1} Slot ${s + 1}`,
                        root: FACTORY_HARMONIES[h].root,
                        scales: [...FACTORY_HARMONIES[h].scales]
                    };
                }
                currentSlot[h] = 0;
            }
        },

        // ========== Export/Import ==========

        /**
         * Export all memory as JSON
         * @returns {string} JSON string
         */
        exportMemory() {
            return JSON.stringify({
                memory: memory.map(h => h.map(s => ({
                    name: s.name,
                    root: s.root,
                    scales: s.scales
                }))),
                currentSlots: [...currentSlot]
            });
        },

        /**
         * Import memory from JSON
         * @param {string} json - JSON string
         * @returns {boolean} Success
         */
        importMemory(json) {
            try {
                const data = JSON.parse(json);
                if (data.memory && Array.isArray(data.memory)) {
                    for (let h = 0; h < 8 && h < data.memory.length; h++) {
                        for (let s = 0; s < 10 && s < data.memory[h].length; s++) {
                            const src = data.memory[h][s];
                            if (src) {
                                memory[h][s] = {
                                    name: String(src.name || '').slice(0, 32),
                                    root: clamp(Math.floor(src.root || 0), 0, 11),
                                    scales: Array.isArray(src.scales)
                                        ? src.scales.slice(0, 4).map(s => (s || 0) & 0xFFF)
                                        : [0xFFF, 0xFFF, 0xFFF, 0xFFF]
                                };
                            }
                        }
                    }
                }
                if (data.currentSlots && Array.isArray(data.currentSlots)) {
                    for (let h = 0; h < 8 && h < data.currentSlots.length; h++) {
                        currentSlot[h] = clamp(Math.floor(data.currentSlots[h] || 0), 0, 9);
                    }
                }
                return true;
            } catch (e) {
                console.error('Error importing memory:', e);
                return false;
            }
        },

        // ========== Audio Processing ==========

        process() {
            // Harmony selection with CV modulation
            const harmonyFromCV = Math.round(clamp(this.inputs.harmonyCV, -5, 5) / 5 * 4);
            const harmonyIdx = clamp(Math.floor(this.params.harmony) + harmonyFromCV, 0, 7);
            const harmony = getCurrentHarmonyData(harmonyIdx);

            // Use param root override or harmony root
            const root = this.params.root !== 0 ? this.params.root % 12 : harmony.root;

            // Transpose calculation
            const transposeSemi = Math.round(clamp(this.params.transpose, -3, 3)) * 12 +
                                  Math.round(clamp(this.inputs.transposeCV, -5, 5)) * 12;

            // Gate edge detection
            const gateHigh = this.inputs.gate >= 1;
            const gateRising = gateHigh && lastGate < 1;
            lastGate = this.inputs.gate;

            let anyNoteChanged = false;

            for (let ch = 0; ch < 4; ch++) {
                const mask = harmony.scales[ch];
                lastHeld[ch] = held[ch];

                let inputV = clampPitch(this.inputs.cv[ch][0]);

                // Pre-quantizer transpose
                if (this.params.transposeMode === 'pre') {
                    inputV = clampPitch(inputV + transposeSemi / 12);
                }

                let semi = quantise(toSemi(inputV), mask, root);

                // Arpeggiator
                if (this.params.arpMode > 0) {
                    const state = arpState[ch];
                    if (gateRising) {
                        state.position = 0;
                        state.direction = 1;
                        state.notes = buildArpSequence(mask, root, Math.floor(semi / 12) * 12, this.params.arpOctaves);
                    }
                    if (gateRising && state.notes.length > 0) {
                        semi = getArpNote(state, this.params.arpMode);
                    }
                }

                // Post-quantizer transpose
                if (this.params.transposeMode === 'post') {
                    semi = semi + transposeSemi;
                }

                held[ch] = clampPitch(toVolt(semi));

                if (Math.abs(held[ch] - lastHeld[ch]) > 0.001) {
                    anyNoteChanged = true;
                }

                for (let i = 0; i < bufferSize; i++) {
                    cvOut[ch][i] = held[ch];
                }
            }

            if (anyNoteChanged) {
                trigPulse = TRIG_SAMPLES;
            }

            for (let i = 0; i < bufferSize; i++) {
                trigOut[i] = trigPulse > 0 ? 5 : 0;
                if (trigPulse > 0) trigPulse--;
            }

            // Update LEDs
            this.leds.active = trigPulse > 0 ? 1 : 0;

            // Channel LEDs - show selected channel
            const editCh = clamp(Math.floor(this.params.editChannel), 0, 3);
            this.leds.ch1 = editCh === 0 ? 1 : 0;
            this.leds.ch2 = editCh === 1 ? 1 : 0;
            this.leds.ch3 = editCh === 2 ? 1 : 0;
            this.leds.ch4 = editCh === 3 ? 1 : 0;
        }
    };
}
