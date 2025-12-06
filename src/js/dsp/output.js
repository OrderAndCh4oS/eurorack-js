/**
 * 2HP Output Module – Audio Output with Metering
 *
 * Stereo output module that connects to WebAudio destination
 * LED meters show output levels
 *
 * Params:
 *   volume: 0-1 (master volume)
 *
 * Inputs:
 *   L: Audio buffer for left channel
 *   R: Audio buffer for right channel
 *
 * LEDs:
 *   L: Left channel level (0-1)
 *   R: Right channel level (0-1)
 *
 * @param {AudioContext} ctx - Web Audio context
 * @param {Object} options
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} Output module
 */
export function create2hpOut(ctx = new (window.AudioContext)(), { bufferSize = 512 } = {}) {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const leds = { L: 0, R: 0 };

    // Own buffers that we control - routing will overwrite if patched
    const ownL = new Float32Array(bufferSize);
    const ownR = new Float32Array(bufferSize);

    return {
        audioCtx: ctx,
        params: { volume: 0.8 },
        inputs: { L: ownL, R: ownR },
        leds: leds,
        clearAudioInputs() {
            ownL.fill(0);
            ownR.fill(0);
            this.inputs.L = ownL;
            this.inputs.R = ownR;
        },
        process(time = ctx.currentTime) {
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
            gain.gain.setValueAtTime(this.params.volume, time);
            src.start(time);

            // Reset to zeroed own buffers if input was replaced by routing
            if (this.inputs.L !== ownL) {
                ownL.fill(0);
                this.inputs.L = ownL;
            }
            if (this.inputs.R !== ownR) {
                ownR.fill(0);
                this.inputs.R = ownR;
            }
        }
    };
}
