const MIN_TIME_SECONDS = 0.002;
const MAX_TIME_SECONDS = 10;
const TRIGGER_THRESHOLD = 1;

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function timeToSamples(value, sampleRate) {
    const normalized = clamp(value);
    if (normalized <= 0) return 0;
    const seconds = MIN_TIME_SECONDS * ((MAX_TIME_SECONDS / MIN_TIME_SECONDS) ** normalized);
    return Math.max(1, Math.round(seconds * sampleRate));
}

function createChannel() {
    return { lastHigh: false, pending: -1, remaining: 0 };
}

export default {
    id: 'gate-delay',
    name: 'GATE DELAY',
    hp: 6,
    color: 'module-color-five',
    category: 'clock',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const trig1 = new Float32Array(bufferSize);
        const trig2 = new Float32Array(bufferSize);
        const gate1 = new Float32Array(bufferSize);
        const gate2 = new Float32Array(bufferSize);
        const channels = [createChannel(), createChannel()];

        function processChannel(input, output, state, delay, length) {
            const delaySamples = timeToSamples(delay, sampleRate);
            const lengthSamples = timeToSamples(length, sampleRate);

            for (let i = 0; i < bufferSize; i++) {
                const high = Number.isFinite(input[i]) && input[i] >= TRIGGER_THRESHOLD;
                const rising = high && !state.lastHigh;
                state.lastHigh = high;

                if (rising) {
                    state.pending = delaySamples;
                    if (delaySamples === 0) {
                        state.pending = -1;
                        state.remaining = lengthSamples;
                    }
                } else if (state.pending > 0) {
                    state.pending--;
                    if (state.pending === 0) {
                        state.pending = -1;
                        state.remaining = lengthSamples;
                    }
                }

                output[i] = state.remaining > 0 ? 10 : 0;
                if (state.remaining > 0) state.remaining--;
            }
        }

        return {
            params: { delay1: 0, length1: 0.35, delay2: 0, length2: 0.35 },
            inputs: { trig1, trig2 },
            outputs: { gate1, gate2 },
            leds: { gate1: 0, gate2: 0 },

            process() {
                processChannel(this.inputs.trig1, gate1, channels[0], this.params.delay1, this.params.length1);
                processChannel(this.inputs.trig2, gate2, channels[1], this.params.delay2, this.params.length2);
                this.leds.gate1 = gate1[bufferSize - 1] / 10;
                this.leds.gate2 = gate2[bufferSize - 1] / 10;
            },

            reset() {
                channels.forEach(state => Object.assign(state, createChannel()));
                trig1.fill(0);
                trig2.fill(0);
                gate1.fill(0);
                gate2.fill(0);
                this.leds.gate1 = 0;
                this.leds.gate2 = 0;
            }
        };
    },

    ui: {
        leds: ['gate1', 'gate2'],
        knobs: [
            { id: 'delay1', label: 'Dly 1', param: 'delay1', min: 0, max: 1, default: 0, small: true },
            { id: 'length1', label: 'Len 1', param: 'length1', min: 0, max: 1, default: 0.35, small: true },
            { id: 'delay2', label: 'Dly 2', param: 'delay2', min: 0, max: 1, default: 0, small: true },
            { id: 'length2', label: 'Len 2', param: 'length2', min: 0, max: 1, default: 0.35, small: true }
        ],
        inputs: [
            { id: 'trig1', label: 'In 1', port: 'trig1', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'trig2', label: 'In 2', port: 'trig2', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'gate1', label: 'Out 1', port: 'gate1', signal: 'gate', voltage: { min: 0, max: 10 } },
            { id: 'gate2', label: 'Out 2', port: 'gate2', signal: 'gate', voltage: { min: 0, max: 10 } }
        ]
    }
};
