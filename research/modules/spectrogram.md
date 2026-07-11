# Spectrogram (`spectrogram`)

## Reference And Scope

Scrolling frequency-over-time analyzer with audio passthrough and bounded history telemetry.

## Contract

- 1024-sample windowed FFT with 512 displayed bins.
- Frequency snapshots are collected at a bounded interval and history is capped at 300 entries.
- Freeze affects analysis only; passthrough remains active.

## DSP Audit (2026-07-11)

- **Measured**: passthrough remains finite, within ±5 V, and buffer-stable over the full matrix.
- **Coverage**: focused tests exist for history bounds and passthrough.
- **Resolved**: coherent-tone calibration and -100 dBFS flooring are tested through the shared preallocated Hann-window FFT; history cadence, bounds, freeze, and passthrough tests remain module-specific.

## Sources

- [Web Audio API FFT windowing and smoothing](https://www.w3.org/TR/webaudio-1.0/#fft-windowing-and-smoothing-over-time) - W3C Recommendation, accessed 2026-07-11; normative browser analyzer reference.
