/**
 * TURING - Random Looping Sequencer
 *
 * Based on Music Thing Modular Turing Machine Mk II
 * https://www.musicthing.co.uk/Turing-Machine/
 *
 * A 16-bit shift register sequencer that generates random voltages
 * which can be locked into repeating loops. The big knob controls
 * the probability of bits flipping as they cycle through the register.
 *
 * Features:
 * - 16-bit shift register with 8-bit DAC output
 * - Lock knob: CCW=2x lock, noon=random, CW=locked
 * - Length switch: 2, 3, 4, 5, 6, 8, 12, 16 steps
 * - CV output (0-5V) from register state
 * - Pulse output (gate when CV > threshold)
 * - 8 LEDs showing current bit states
 */

export default {
    id: 'turing',
    name: 'TURING',
    hp: 8,
    color: '#2a4a2a',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // 16-bit shift register
        let register = new Array(16).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);

        // Length options
        const lengths = [2, 3, 4, 5, 6, 8, 12, 16];

        // State
        let lastClock = 0;
        let currentCV = 0;
        let currentPulse = 0;

        // Pulse threshold - based on bit pattern, not scaled CV
        // This ensures pulse output works regardless of scale setting
        const pulseThresholdBits = 4; // Out of 8 bits - pulse when >= 4 bits high

        // Own input buffers
        const ownClock = new Float32Array(bufferSize);
        const ownLockCV = new Float32Array(bufferSize);

        // Calculate CV from register (always uses first 8 bits)
        // Returns unscaled value (0-5V) for pulse comparison, and scaled for output
        function calculateCV(scale) {
            let value = 0;
            for (let i = 0; i < 8; i++) {
                value += register[i] * (1 << i);
            }
            // Normalize 0-255 to 0-5V
            const unscaledCV = (value / 255) * 5;
            return { unscaled: unscaledCV, scaled: unscaledCV * scale };
        }

        // Update LED states from register (first 8 bits)
        function updateLEDs(leds) {
            for (let i = 0; i < 8; i++) {
                leds[`bit${i}`] = register[i];
            }
        }

        return {
            params: {
                lock: 0.5,    // 0=always flip (2x lock), 0.5=random, 1=never flip (locked)
                scale: 0.8,   // Output voltage range
                length: 3     // Switch position 0-7 → lengths[i]
            },

            inputs: {
                clock: ownClock,
                lockCV: ownLockCV
            },

            outputs: {
                cv: new Float32Array(bufferSize),
                pulse: new Float32Array(bufferSize)
            },

            leds: {
                bit0: 0, bit1: 0, bit2: 0, bit3: 0,
                bit4: 0, bit5: 0, bit6: 0, bit7: 0
            },

            process() {
                const { clock, lockCV } = this.inputs;
                const { lock, scale, length } = this.params;
                const { cv, pulse } = this.outputs;

                const seqLength = lengths[Math.floor(length)] || 8;

                for (let i = 0; i < bufferSize; i++) {
                    // Detect rising edge on clock
                    const clockHigh = clock[i] >= 1;
                    const risingEdge = clockHigh && lastClock < 1;
                    lastClock = clock[i];

                    if (risingEdge) {
                        // Calculate effective lock amount (knob + CV)
                        // CV is ±5V, normalize to ±0.5 contribution
                        const cvMod = (lockCV[i] || 0) / 10;
                        const effectiveLock = Math.max(0, Math.min(1, lock + cvMod));

                        // Convert lock (0-1) to threshold for comparison
                        // At lock=1: threshold=1, noise never exceeds → never flip
                        // At lock=0.5: threshold=0, 50% chance → random
                        // At lock=0: threshold=-1, noise always exceeds → always flip (2x lock)
                        const threshold = (effectiveLock - 0.5) * 2;

                        // Get the bit that's about to fall off (based on length setting)
                        // Length determines which bit wraps, not the register size
                        const wrapBit = register[seqLength - 1];

                        // Random noise for probability
                        const noise = Math.random() * 2 - 1; // -1 to +1

                        // Determine if bit should flip
                        const shouldFlip = noise > threshold;
                        const newBit = shouldFlip ? (1 - wrapBit) : wrapBit;

                        // Shift entire 16-bit register
                        for (let j = 15; j > 0; j--) {
                            register[j] = register[j - 1];
                        }
                        register[0] = newBit;

                        // Calculate CV (unscaled for pulse, scaled for output)
                        const cvResult = calculateCV(scale);
                        currentCV = cvResult.scaled;

                        // Pulse output: high when unscaled CV > 1.5V (per original spec)
                        currentPulse = cvResult.unscaled > 1.5 ? 10 : 0;

                        // Update LEDs
                        updateLEDs(this.leds);
                    }

                    // Output current values (sample and hold)
                    cv[i] = currentCV;
                    pulse[i] = currentPulse;
                }

                // Reset own inputs if replaced by routing
                if (this.inputs.clock !== ownClock) {
                    ownClock.fill(0);
                    this.inputs.clock = ownClock;
                }
                if (this.inputs.lockCV !== ownLockCV) {
                    ownLockCV.fill(0);
                    this.inputs.lockCV = ownLockCV;
                }
            },

            reset() {
                // Reinitialize with random register
                register = new Array(16).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);
                lastClock = 0;
                currentCV = 0;
                currentPulse = 0;

                this.outputs.cv.fill(0);
                this.outputs.pulse.fill(0);

                for (let i = 0; i < 8; i++) {
                    this.leds[`bit${i}`] = 0;
                }
            }
        };
    },

    ui: {
        leds: ['bit0', 'bit1', 'bit2', 'bit3', 'bit4', 'bit5', 'bit6', 'bit7'],
        knobs: [
            { id: 'lock', label: 'Lock', param: 'lock', min: 0, max: 1, default: 0.5 },
            { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: 1, default: 0.8 },
            { id: 'length', label: 'Len', param: 'length', min: 0, max: 7, step: 1, default: 5 }
        ],
        switches: [],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', type: 'trigger' },
            { id: 'lockCV', label: 'CV', port: 'lockCV', type: 'cv' }
        ],
        outputs: [
            { id: 'cv', label: 'CV', port: 'cv', type: 'cv' },
            { id: 'pulse', label: 'Pulse', port: 'pulse', type: 'gate' }
        ]
    }
};
