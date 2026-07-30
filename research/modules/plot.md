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

## Individual Contract Audit (2026-07-30, complete)

- Valid audio remains sample-identical through the module; invalid audio and
  trigger samples recover to 0 before capture, statistics, display, and output.
- Time is bounded to the documented 1-10 second window and the capture
  downsample divisor cannot become zero. Peak/RMS/DC state stays finite.
- Focused tests cover exact statistics, trigger arming, freeze, history,
  passthrough, time endpoints, LED bounds, finite recovery, and full reset.
- The strict matrix completes five scenarios with zero voltage flags, stable
  buffers, and maximum Node diagnostic time below 0.180ms/block.
