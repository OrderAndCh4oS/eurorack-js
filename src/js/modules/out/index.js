/**
 * OUT - Audio Output Module with Metering
 *
 * Stereo output module that connects to WebAudio destination
 * LED meters show output levels
 */

export default {
    id: 'out',
    name: 'OUT',
    hp: 3,
    color: '#333',
    category: 'output',

    createDSP({ sampleRate = 44100, bufferSize = 512, audioCtx = null } = {}) {
        // Handle case where audioCtx is not provided (testing, SSR)
        const ctx = audioCtx || (typeof window !== 'undefined' && window.AudioContext ?
            new window.AudioContext() : null);

        const gain = ctx ? ctx.createGain() : null;
        if (gain && ctx) {
            gain.connect(ctx.destination);
        }

        const leds = { L: 0, R: 0 };

        const ownL = new Float32Array(bufferSize);
        const ownR = new Float32Array(bufferSize);

        return {
            audioCtx: ctx,
            params: { volume: 0.8 },
            inputs: { L: ownL, R: ownR },
            outputs: {},
            leds,

            clearAudioInputs() {
                ownL.fill(0);
                ownR.fill(0);
                this.inputs.L = ownL;
                this.inputs.R = ownR;
            },

            process(time) {
                if (!ctx || !gain) return;

                const currentTime = time || ctx.currentTime;
                const inputL = this.inputs.L;
                const inputR = this.inputs.R;

                const buf = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
                buf.getChannelData(0).set(inputL);
                buf.getChannelData(1).set(inputR);

                leds.L = Math.max(...inputL.map(Math.abs)) / 5;
                leds.R = Math.max(...inputR.map(Math.abs)) / 5;

                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(gain);
                gain.gain.setValueAtTime(this.params.volume, currentTime);
                src.start(currentTime);

                if (this.inputs.L !== ownL) {
                    ownL.fill(0);
                    this.inputs.L = ownL;
                }
                if (this.inputs.R !== ownR) {
                    ownR.fill(0);
                    this.inputs.R = ownR;
                }
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
            { id: 'L', label: 'L', port: 'L', type: 'buffer' },
            { id: 'R', label: 'R', port: 'R', type: 'buffer' }
        ]
    }
};
