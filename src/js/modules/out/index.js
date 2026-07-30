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
                const inputL = this.inputs.L;
                const inputR = this.inputs.R;
                let peakL = 0;
                let peakR = 0;
                for (let index = 0; index < bufferSize; index++) {
                    const left = Number.isFinite(inputL[index]) ? inputL[index] : 0;
                    const right = Number.isFinite(inputR[index]) ? inputR[index] : 0;
                    peakL = Math.max(peakL, Math.abs(left));
                    peakR = Math.max(peakR, Math.abs(right));
                }
                leds.L = Math.min(1, peakL / 5);
                leds.R = Math.min(1, peakR / 5);

                if (!ctx || !gain) return;

                const currentTime = Number.isFinite(time) ? time : ctx.currentTime;
                const buf = ctx.createBuffer(2, bufferSize, bufferSampleRate);
                const channelL = buf.getChannelData(0);
                const channelR = buf.getChannelData(1);
                for (let index = 0; index < bufferSize; index++) {
                    channelL[index] = (Number.isFinite(inputL[index]) ? inputL[index] : 0) / 5;
                    channelR[index] = (Number.isFinite(inputR[index]) ? inputR[index] : 0) / 5;
                }

                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(gain);
                const volume = Number.isFinite(this.params.volume)
                    ? Math.max(0, Math.min(1, this.params.volume))
                    : 0.8;
                gain.gain.setValueAtTime(volume, currentTime);
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
