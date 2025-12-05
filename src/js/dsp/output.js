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

    return {
        audioCtx: ctx,
        params: { volume: 0.8 },
        inputs: { L: new Float32Array(bufferSize), R: new Float32Array(bufferSize) },
        led: leds,
        process(time = ctx.currentTime) {
            const buf = ctx.createBuffer(2, this.inputs.L.length, ctx.sampleRate);
            buf.getChannelData(0).set(this.inputs.L);
            buf.getChannelData(1).set(this.inputs.R);
            leds.L = Math.max(...this.inputs.L.map(Math.abs)) / 5;
            leds.R = Math.max(...this.inputs.R.map(Math.abs)) / 5;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(gain);
            gain.gain.setValueAtTime(this.params.volume, time);
            src.start(time);
        }
    };
}
