/**
 * OUT - Audio Output Module with Metering
 *
 * Stereo output module that connects to WebAudio destination
 * LED meters show output levels
 */

export default {
    id: 'out',
    name: 'OUT',
    role: 'audio-output',
    hp: 3,
    color: 'module-color-one',
    category: 'output',

    createDSP({ sampleRate = 44100, bufferSize = 512, audioCtx = null } = {}) {
        const ctx = audioCtx;

        const gain = ctx ? ctx.createGain() : null;
        if (gain && ctx) {
            gain.connect(ctx.destination);
        }

        const leds = { L: 0, R: 0 };

        const ownL = new Float32Array(bufferSize);
        const ownR = new Float32Array(bufferSize);

        const bufferSampleRate = ctx?.sampleRate || sampleRate;

        return {
            audioCtx: ctx,
            params: { volume: 0.8 },
            inputs: { L: ownL, R: ownR },
            outputs: {},
            leds,

            process(time) {
                if (!ctx || !gain) return;

                const currentTime = time || ctx.currentTime;
                const inputL = this.inputs.L;
                const inputR = this.inputs.R;

                const buf = ctx.createBuffer(2, bufferSize, bufferSampleRate);
                buf.getChannelData(0).set(inputL);
                buf.getChannelData(1).set(inputR);

                leds.L = Math.max(...inputL.map(Math.abs)) / 5;
                leds.R = Math.max(...inputR.map(Math.abs)) / 5;

                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(gain);
                gain.gain.setValueAtTime(this.params.volume, currentTime);
                src.start(currentTime);
            },

            reset() {
                ownL.fill(0);
                ownR.fill(0);
                leds.L = 0;
                leds.R = 0;
            }
        };
    },

    ui: {
        leds: ['L', 'R'],
        knobs: [
            { id: 'volume', label: 'Vol', param: 'volume', min: 0, max: 1, default: 0.8 }
        ],
        inputs: [
            { id: 'L', label: 'L', port: 'L', signal: 'audio' },
            { id: 'R', label: 'R', port: 'R', signal: 'audio' }
        ]
    }
};
