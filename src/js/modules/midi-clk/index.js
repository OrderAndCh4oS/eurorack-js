/**
 * MIDI-CLK - MIDI Clock to Trigger Converter
 *
 * Converts MIDI clock messages to trigger/gate outputs.
 * Inspired by Mutable Instruments Yarns clock outputs.
 *
 * MIDI Clock runs at 24 PPQN (pulses per quarter note).
 *
 * Outputs:
 * - Clock: Trigger output (configurable division)
 * - Reset: Trigger on MIDI Start
 * - Run: Gate high while playing (Start→Stop)
 *
 * Features:
 * - Clock division (1, 2, 4, 8, 16, 24, 32 PPQN)
 * - Reset on Start message
 * - Run gate for transport state
 */

// Clock divisions (MIDI ticks per output pulse)
// MIDI clock = 24 PPQN
const DIVISIONS = [
    { label: '1/1', ticks: 96 },    // Whole note (4 beats)
    { label: '1/2', ticks: 48 },    // Half note
    { label: '1/4', ticks: 24 },    // Quarter note
    { label: '1/8', ticks: 12 },    // 8th note
    { label: '1/16', ticks: 6 },    // 16th note
    { label: '1/32', ticks: 3 },    // 32nd note
    { label: '1/4T', ticks: 16 },   // Quarter triplet
    { label: '1/8T', ticks: 8 }     // 8th triplet
];

export default {
    id: 'midi-clk',
    name: 'M‑CLK',
    hp: 2,
    color: 'module-color-eleven',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512, services = {} } = {}) {
        const midi = services.midiManager || null;
        const clockOut = new Float32Array(bufferSize);
        const resetOut = new Float32Array(bufferSize);
        const runOut = new Float32Array(bufferSize);

        // Clock state
        let tickCount = 0;
        let isRunning = false;
        let clockPulse = false;
        let resetPulse = false;

        // Pulse timing
        let clockPulseSamples = 0;
        let resetPulseSamples = 0;
        const pulseLength = Math.floor(0.005 * sampleRate); // 5ms pulse

        return {
            params: {
                division: 2  // Index into DIVISIONS array (default: 1/4 note)
            },

            inputs: {},

            outputs: {
                clock: clockOut,
                reset: resetOut,
                run: runOut
            },

            leds: {
                clock: 0,
                run: 0
            },

            process() {
                const divIndex = Math.floor(this.params.division);
                const ticksPerPulse = DIVISIONS[divIndex]?.ticks || 24;

                if (!midi) {
                    clockOut.fill(0);
                    resetOut.fill(0);
                    runOut.fill(0);
                    return;
                }

                // Process MIDI clock events
                const events = midi.getClockEvents();
                let eventIndex = 0;

                // Fill output buffers
                for (let i = 0; i < bufferSize; i++) {
                    while (eventIndex < events.length && events[eventIndex].sampleOffset <= i) {
                        const event = events[eventIndex++];
                        if (event.type === 'clock' && isRunning) {
                            tickCount++;
                            if (tickCount >= ticksPerPulse) {
                                tickCount = 0;
                                clockPulse = true;
                                clockPulseSamples = pulseLength;
                            }
                        } else if (event.type === 'start') {
                            isRunning = true;
                            tickCount = 0;
                            resetPulse = true;
                            resetPulseSamples = pulseLength;
                            clockPulse = true;
                            clockPulseSamples = pulseLength;
                        } else if (event.type === 'continue') {
                            isRunning = true;
                        } else if (event.type === 'stop') {
                            isRunning = false;
                        }
                    }
                    // Clock pulse
                    if (clockPulseSamples > 0) {
                        clockOut[i] = 10;
                        clockPulseSamples--;
                    } else {
                        clockOut[i] = 0;
                        clockPulse = false;
                    }

                    // Reset pulse
                    if (resetPulseSamples > 0) {
                        resetOut[i] = 10;
                        resetPulseSamples--;
                    } else {
                        resetOut[i] = 0;
                        resetPulse = false;
                    }

                    // Run gate
                    runOut[i] = isRunning ? 10 : 0;
                }

                // Update LEDs
                this.leds.clock = clockPulse ? 1 : 0;
                this.leds.run = isRunning ? 1 : 0;
            },

            reset() {
                tickCount = 0;
                isRunning = false;
                clockPulse = false;
                resetPulse = false;
                clockPulseSamples = 0;
                resetPulseSamples = 0;
                clockOut.fill(0);
                resetOut.fill(0);
                runOut.fill(0);
            }
        };
    },

    ui: {
        leds: ['clock', 'run'],
        knobs: [
            { id: 'division', label: 'Div', param: 'division', min: 0, max: 7, default: 2, step: 1 }
        ],
        switches: [],
        inputs: [],
        outputs: [
            { id: 'clock', label: 'Clk', port: 'clock', signal: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', signal: 'trigger' },
            { id: 'run', label: 'Run', port: 'run', signal: 'gate' }
        ]
    }
};
