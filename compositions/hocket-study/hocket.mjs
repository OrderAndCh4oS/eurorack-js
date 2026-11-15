/**
 * HOCKET — a browser-local complementary trigger router.
 *
 * Original utility inspired by Branches and DivSkip's A/B routing approach.
 * Research and explicit differences: research/local-modules/hocket.md.
 * Self-contained: import this file through Code → Modules → Import own module.
 * Local revisions are not supported in account saves or public patches.
 */

const PATTERNS = ['ABABABAB', 'AABBAABB', 'AABAABAB', 'AAABABBB'];

function integerControl(value, maximum) {
    return Math.round(Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)));
}

export default {
    id: 'hocket-demo',
    name: 'HOCKET',
    hp: 6,
    color: 'module-color-six',
    category: 'clock',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const resetInput = new Float32Array(bufferSize);
        const a = new Float32Array(bufferSize);
        const b = new Float32Array(bufferSize);
        const params = { pattern: 0, rotate: 0, swap: 0 };
        const leds = { a: 0, b: 0 };
        const pulseLength = Math.ceil(sampleRate * 0.008);
        const ledLength = Math.ceil(sampleRate * 0.05);
        let step = 0;
        let pulseRemaining = 0;
        let destination = 0;
        let ledA = 0;
        let ledB = 0;
        let lastClockHigh = false;
        let lastResetHigh = false;

        function clearState() {
            step = 0;
            pulseRemaining = 0;
            destination = 0;
            ledA = 0;
            ledB = 0;
            leds.a = 0;
            leds.b = 0;
        }

        return {
            params,
            inputs: { clock, reset: resetInput },
            outputs: { a, b },
            leds,

            process() {
                for (let i = 0; i < bufferSize; i++) {
                    const clockHigh = Number.isFinite(clock[i]) && clock[i] > 2.5;
                    const resetHigh = Number.isFinite(resetInput[i]) && resetInput[i] >= 1;

                    // Reset precedes clock, so a simultaneous pair starts on step zero.
                    if (resetHigh && !lastResetHigh) clearState();

                    if (clockHigh && !lastClockHigh) {
                        const pattern = PATTERNS[integerControl(params.pattern, 3)];
                        const rotate = integerControl(params.rotate, 7);
                        const swap = integerControl(params.swap, 1);
                        destination = (pattern[(step + rotate) % 8] === 'B' ? 1 : 0) ^ swap;
                        step = (step + 1) % 8;
                        // One active pulse ensures the electrical outputs never overlap.
                        // Faster-than-8ms clocks may truncate or merge successive pulses.
                        pulseRemaining = pulseLength;
                        if (destination === 0) ledA = ledLength;
                        else ledB = ledLength;
                    }

                    a[i] = pulseRemaining > 0 && destination === 0 ? 10 : 0;
                    b[i] = pulseRemaining > 0 && destination === 1 ? 10 : 0;
                    if (pulseRemaining > 0) pulseRemaining--;
                    if (ledA > 0) ledA--;
                    if (ledB > 0) ledB--;
                    lastClockHigh = clockHigh;
                    lastResetHigh = resetHigh;
                }
                // Hold indicators long enough to be visible at worklet telemetry rates.
                // This visual hold does not change the 8ms output pulses.
                leds.a = ledA > 0 ? 1 : 0;
                leds.b = ledB > 0 ? 1 : 0;
            },

            reset() {
                clearState();
                lastClockHigh = false;
                lastResetHigh = false;
                clock.fill(0);
                resetInput.fill(0);
                a.fill(0);
                b.fill(0);
            }
        };
    },

    ui: {
        leds: ['a', 'b'],
        knobs: [
            { id: 'pattern', label: 'Pattern', param: 'pattern', min: 0, max: 3, step: 1, default: 0 },
            { id: 'rotate', label: 'Rotate', param: 'rotate', min: 0, max: 7, step: 1, default: 0 }
        ],
        switches: [
            { id: 'swap', label: 'Swap', param: 'swap', default: 0 }
        ],
        inputs: [
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'a', label: 'A', port: 'a', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'b', label: 'B', port: 'b', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
