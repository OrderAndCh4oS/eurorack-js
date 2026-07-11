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
