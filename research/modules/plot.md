# Waveform Plotter (`plot`)

## Reference And Scope

Long-window time-domain capture and statistics utility with audio passthrough. It downsamples display data while computing signal statistics from the full-rate input.

## Contract

- Audio passthrough is sample-identical.
- Capture spans 1-10 seconds at a 1 kHz display sampling rate.
- Reports positive/negative peak, RMS, and DC.
- Trigger arming starts a fresh capture on a rising edge.

## DSP Audit (2026-07-11)

- **Measured**: passthrough remains finite, within ±5 V, and buffer-stable over all sample rates and block sizes.
- **Coverage**: focused tests exist.
- **Improvement**: add exact RMS/DC fixtures, trigger-boundary tests, and a 96 kHz check for integer downsampling drift. Decide whether display downsampling needs an anti-alias filter rather than point sampling.

## Sources

- [Web Audio API, time-domain analysis](https://www.w3.org/TR/webaudio-1.0/#dom-analysernode-getfloattimedomaindata) - W3C Recommendation, accessed 2026-07-11; browser analysis precedent.

