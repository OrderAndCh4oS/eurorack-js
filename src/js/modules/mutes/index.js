import { clamp } from '../../utils/math.js';

const channels = [1, 2, 3, 4].map(n => ({
    n, input: 'in' + n, mute: 'mute' + n, out: 'out' + n,
    on: 'on' + n, hold: 'hold' + n, led: 'level' + n
}));

export default {
    id: 'mutes',
    name: 'MUTES',
    hp: 10,
    color: 'module-color-one',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const inputs = {}, outputs = {}, leds = {}, params = {};
        const lanes = channels.map(channel => {
            const input = inputs[channel.input] = new Float32Array(bufferSize);
            const mute = inputs[channel.mute] = new Float32Array(bufferSize);
            const out = outputs[channel.out] = new Float32Array(bufferSize);
            params[channel.on] = 1;
            params[channel.hold] = 0;
            leds[channel.led] = 0;
            return { ...channel, input, mute, out, gain: 1, connected: false };
        });
        // Optical switching opens quickly and decays more slowly (see Mutes research).
        const attack = -Math.expm1(-1 / (0.003 * sampleRate));
        const release = -Math.expm1(-1 / (0.012 * sampleRate));
        const meterDecay = Math.exp(-bufferSize / (sampleRate * 0.07));
        let firstBlock = true;

        function connect(port, connected) {
            const index = channels.findIndex(channel => channel.input === port);
            if (index >= 0) lanes[index].connected = connected;
        }

        return {
            inputs, outputs, params, leds,
            onInputConnected(port) { connect(port, true); },
            onInputDisconnected(port) { connect(port, false); },
            process() {
                // Cascades carry the preceding jack's input, before its switch.
                let source = lanes[0].input;
                for (const lane of lanes) {
                    if (lane.connected) source = lane.input;
                    const held = params[lane.hold] >= 0.5;
                    const open = params[lane.on] >= 0.5 || held;
                    if (firstBlock) lane.gain = open && !(lane.mute[0] >= 1) ? 1 : 0;
                    let peak = 0;
                    for (let i = 0; i < bufferSize; i++) {
                        const target = open && !(lane.mute[i] >= 1) ? 1 : 0;
                        lane.gain += (target - lane.gain) * (target ? attack : release);
                        if (Math.abs(target - lane.gain) < 1e-7) lane.gain = target;
                        const sample = Number.isFinite(source[i]) ? clamp(source[i], -10, 10) : 0;
                        lane.out[i] = lane.gain === 0 ? 0 : sample * lane.gain;
                        peak = Math.max(peak, Math.abs(lane.out[i]));
                    }
                    leds[lane.led] = Math.max(Math.min(1, peak / 5), leds[lane.led] * meterDecay);
                }
                firstBlock = false;
            },
            reset() {
                firstBlock = false;
                for (const lane of lanes) {
                    lane.input.fill(0);
                    lane.mute.fill(0);
                    lane.out.fill(0);
                    params[lane.hold] = 0;
                    lane.gain = params[lane.on] >= 0.5 ? 1 : 0;
                    leds[lane.led] = 0;
                }
            }
        };
    },

    ui: {
        leds: channels.map(c => c.led),
        switches: channels.map(c => ({
            id: c.on, param: c.on, label: String(c.n), positions: ['Off', 'On'], default: 1
        })),
        actions: channels.map(c => ({
            id: c.hold, param: c.hold, label: 'Hold ' + c.n, mode: 'momentary', default: 0
        })),
        inputs: channels.flatMap(c => [
            { id: c.input, port: c.input, label: 'In', signal: 'any' },
            { id: c.mute, port: c.mute, label: 'Mute', signal: 'gate' }
        ]),
        outputs: channels.map(c => ({ id: c.out, port: c.out, label: 'Out', signal: 'any' })),
        socketLayout: {
            columns: channels.map(c => ({ label: String(c.n), columns: 1, ports: [c.input, c.mute, c.out] }))
        }
    }
};
