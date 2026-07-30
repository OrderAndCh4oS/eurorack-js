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

## Individual Contract Audit (2026-07-30, complete)

- Valid stereo audio remains sample-identical. Invalid samples recover to 0V in
  both passthrough and stored chunks, preventing a malformed graph value from
  producing an invalid WAV payload.
- Recording still uses one-second chunks, stops at the exact configured sample
  bound, emits one transferable event, and preserves the padded final chunk
  with its exact sample count. Invalid duration configuration recovers to five
  minutes.
- Reset discards chunks/events, clears stable buffers and the LED, and now also
  restores the Record action to off.
- The strict matrix completes two scenarios with zero voltage flags, stable
  buffers, and maximum Node diagnostic time below 0.160ms/block.
