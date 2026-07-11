# Stereo Recorder (`rec`)

## Reference And Scope

Inline stereo recorder that passes audio unchanged, accumulates bounded blocks in the worklet, and transfers completed recordings to the main thread for WAV encoding and download.

## Contract

- Stereo sample-identical passthrough.
- Recording is bounded to five minutes at the active sample rate.
- The worklet emits transferable recording-complete events; browser-only WAV/download work remains on the main thread.

## DSP Audit (2026-07-11)

- **Measured**: default and recording-action scenarios remain finite, within ±5 V, and buffer-stable over the full matrix.
- **Resolved**: focused tests cover passthrough, exact capture length, injectable auto-stop, event draining, reset, and padded-final-chunk WAV encoding.
- **Storage**: recording uses one-second stereo chunks instead of one allocation per render quantum; completion events include exact `sampleCount`.

## Sources

- [Web Audio API](https://www.w3.org/TR/webaudio-1.0/) - W3C Recommendation, accessed 2026-07-11; browser audio processing and worklet context.
- [WAVE PCM soundfile format](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html) - McGill MMSP summary of Microsoft/IBM RIFF WAVE; encoding field reference.
