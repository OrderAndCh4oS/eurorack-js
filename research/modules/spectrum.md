# Spectrum Analyzer (`spectrum`)

## Reference And Scope

Real-time FFT analyzer with audio passthrough. The display is diagnostic telemetry; it must never alter the signal path.

## Contract

- Mono audio input and sample-identical passthrough output.
- Windowed FFT magnitude display with bounded telemetry.
- User controls change display range and smoothing, not audio.

## DSP Audit (2026-07-11)

- **Measured**: passthrough remains finite, within ±5 V, and buffer-stable over the full matrix. The generic harness observed no processing errors.
- **Coverage**: focused tests exist for passthrough and analyzer state.
- **Resolved**: `spectrum` shares the preallocated Hann-window real FFT with `spectrogram`; a coherent-bin 5 V peak sine is 0 dBFS and silence floors at -100 dBFS.
- **Performance**: opt-in AudioWorklet profiling reports block and per-module percentiles without adding timing work when disabled.

## Sources

- [Web Audio API, AnalyserNode](https://www.w3.org/TR/webaudio-1.0/#the-analysernode-interface) - W3C Recommendation, accessed 2026-07-11; reference pipeline for windowing, FFT, smoothing, and dB conversion.

## Individual Contract Audit (2026-07-30, complete)

- Peak history now initializes at the calibrated -100dBFS floor and releases in
  dB per second. The previous per-block interpolation changed hold time with
  render-quantum size; 128- and 512-sample one-second renders now agree.
- Invalid input samples recover to 0V before passthrough and FFT accumulation;
  invalid Decay values recover to the panel default. FFT and peak telemetry
  therefore remain finite without requiring a manual reset.
- Coherent-tone calibration, frequency helpers, Floor/Scale display controls,
  peak behavior, exact valid passthrough, LED bounds, and reset are covered.
- The strict matrix completes seven scenarios with zero voltage flags, stable
  buffers, and maximum Node diagnostic time below 0.581ms/block.
