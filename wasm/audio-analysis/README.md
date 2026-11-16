# Audio analysis kernel

Bounded, local measurements of normalized stereo PCM. This is analysis of the
browser output (full scale is ±1), not raw ±5 V Eurorack signals. It performs no
network requests, file access, audio playback, or host-thread creation. The JS
integration runs it in a Worker, outside the real-time audio thread.

## Implementation plan

1. Pin pure Rust FFT and loudness libraries, with scalar WASM output.
2. Specify deterministic synthetic-signal tests before the implementation.
3. Validate input bounds, then calculate level/stereo, spectrum and loudness.
4. Return a versioned JSON object with null for undefined measurements.
5. Validate natively and through the generated browser WASM bindings.

No pitch, tempo, onset, MFCC, perceptual quality score or librosa parity is claimed.

## Interface and bounds

`analyze(left: Float32Array, right: Float32Array, sampleRate: number): string`
returns JSON, or throws on invalid input. Native tests use the public Rust
`analyze_stereo(&[f32], &[f32], u32)` function and serializable result structures.

Both channels must have the same length and contain only finite numbers. The
sample rate must be 8,000–192,000 Hz and duration 0.5–10 seconds, inclusive.
Values beyond ±1 are accepted and counted, not clipped or normalized. The caller
must also enforce bounds before passing arrays into WASM to bound copy allocation.

## Schema version 1

```js
{
  schemaVersion: 1,
  input: { frames, sampleRate, durationSeconds },
  levels: {
    left: { peak, peakDbfs, rms, rmsDbfs, dcOffset, fullScaleSamples, fullScaleFraction },
    right: { /* same */ }
  },
  stereo: { correlation, midRms, sideRms, sideToMidEnergyRatio },
  spectral: {
    fftSize: 2048, hopSize: 1024, window: "periodic-hann",
    activeFloorDbfs: -80, bandEdgesHz: [250, 4000],
    left: {
      frameCount, activeFrameCount, centroidHz, rolloff85Hz, flatness,
      bandEnergyFractions: { low, mid, high }
    },
    right: { /* same */ }
  },
  loudness: {
    integratedLufs, momentaryLufs, shortTermLufs,
    truePeakEstimate: { left, right, leftDbtp, rightDbtp }
  }
}
```

### Level and stereo definitions

- `peak`: maximum absolute sample; `rms`: square root of mean squared samples.
- dBFS is `20 * log10(amplitude)`. Zero amplitude yields `null` dBFS.
- `dcOffset`: arithmetic sample mean. RMS and peak include DC.
- `fullScaleSamples` counts `abs(sample) >= 1`; the fraction divides by frames.
  This detects samples at/beyond full scale, not proof of upstream clipping.
- `correlation`: Pearson correlation after subtracting each channel's mean.
  It is `null` if either channel has zero variance.
- Mid is `(L + R) / 2`; side is `(L - R) / 2`. Their RMS includes DC.
  `sideToMidEnergyRatio` is mean-square side divided by mean-square mid, or
  `null` if the mid energy is zero. It is a linear energy ratio, not decibels.

### Spectrum definitions

Complete 2,048-sample frames with a 1,024-sample hop; an incomplete trailing
frame is discarded. Subtract each frame's mean, then use a periodic Hann window.
Only frames whose centered, unwindowed RMS is at least 0.0001 (−80 dBFS) enter
the aggregate. `frameCount` includes inactive frames; `activeFrameCount` does not.

One-sided FFT magnitudes and powers are accumulated across active frames.
Interior-bin powers are doubled; DC and Nyquist are not. `centroidHz` weights
bin frequencies by magnitude. `rolloff85Hz` is the first bin reaching 85% of
total one-sided power. `flatness` is the geometric/arithmetic mean ratio of the
aggregate one-sided bin powers, with a relative floor of 1e-20 of maximum bin
power for the logarithm. It describes the aggregate spectrum, not an average of
per-frame flatness. Bands are low <250 Hz, mid 250–<4,000 Hz, high ≥4,000 Hz,
up to Nyquist. Fractions sum to one when defined. Pure DC and silence have no
active frames and return null spectral values and `bandEnergyFractions: null`.

The fixed FFT gives different time/frequency resolution at different sample
rates. Results are descriptive measurements, not a claim of identical defaults
or numerical equivalence with Python/librosa.

### Loudness definitions

The pure Rust `ebur128` crate measures stereo EBU R128 loudness. Integrated LUFS
uses its gating; momentary uses the final 400 ms; short-term uses the final 3 s.
Short-term is `null` below 3 s. Silent or gated-out/non-finite loudness is `null`.
The library rounds its 100 ms blocks to whole samples, so these windows are
approximate by a few samples at sample rates not divisible by 10.
True-peak values are explicitly named estimates: interpolation can estimate
intersample peaks but cannot prove the peak of every possible reconstructed
continuous signal. Amplitudes are linear; dBTP is null at zero amplitude.
The library oversamples 4× below 96 kHz, 2× below 192 kHz and uses the sample peak
at 192 kHz. A separate peak meter receives 48 zero frames after the capture to
flush its FIR tail; this padding never enters loudness or input duration. For
samples beyond ±1, only peak-estimation input is scaled down independently per
channel and its result is scaled back up to avoid overflow in the library's f32
interpolator. Each estimate is at least the channel's original sample peak.

## Dependencies and licensing

Versions were checked against upstream documentation on 2026-11-15. `Cargo.lock`
pins transitive dependencies. The release uses no FFT SIMD or native C bindings.

| Dependency | Version | License | Source / purpose |
| --- | --- | --- | --- |
| RealFFT | 3.5.1 | MIT | [Source](https://github.com/HEnquist/realfft), [API](https://docs.rs/realfft/3.5.1/realfft/) — real FFT adapter |
| RustFFT | 6.4.1 | MIT OR Apache-2.0 | [Source](https://github.com/ejmahler/RustFFT), [API](https://docs.rs/rustfft/6.4.1/rustfft/) — scalar FFT |
| ebur128 | 0.1.11 | MIT | [Source](https://github.com/sdroege/ebur128), [changelog](https://github.com/sdroege/ebur128/blob/main/CHANGELOG.md) — EBU loudness and true-peak estimation |
| wasm-bindgen | 0.2.130 | MIT OR Apache-2.0 | [Source](https://github.com/wasm-bindgen/wasm-bindgen), [API](https://docs.rs/wasm-bindgen/0.2.130/wasm_bindgen/) — JS bindings |
| serde | 1.0.229 | MIT OR Apache-2.0 | [Source](https://github.com/serde-rs/serde), [API](https://docs.rs/serde/1.0.229/serde/) — serialization |
| serde_json | 1.0.154 | MIT OR Apache-2.0 | [Source](https://github.com/serde-rs/json), [API](https://docs.rs/serde_json/1.0.154/serde_json/) — JSON output |

These libraries are reused, not copied or relicensed. Preserve their license
notices with redistributed builds. `ebur128` 0.1.11 fixes non-SSE2 state flushing
and 32-bit peak index overflow. Its subsequent unreleased empty-input fix is
irrelevant here because the public boundary rejects empty input.

## Validation

```sh
cargo test --locked --manifest-path wasm/audio-analysis/Cargo.toml
cargo clippy --locked --manifest-path wasm/audio-analysis/Cargo.toml --all-targets -- -D warnings
```

The application build pipeline owns the WASM target, matching wasm-bindgen CLI,
generated bindings and hashed public assets. Do not edit generated bindings.

To rebuild the committed browser artifacts:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
npm run build:audio-analysis
```

The build uses a locked scalar release build and records the Rust toolchain
version in the generated manifest. The first build uses rustc 1.99.1. Vercel
validates source/artifact checksums and serves the committed WASM; it does not
need Rust or run an audio-analysis server.
