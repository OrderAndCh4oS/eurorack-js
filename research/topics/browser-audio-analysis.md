# Browser audio analysis

Decision date: 2026-11-15. First implementation: browser-local Rust/WASM metrics exposed as `measure_audio` through WebMCP.

## Reuse existing algorithms

The user's [analyse-audio-python project](https://github.com/OrderAndCh4oS/analyse-audio-python) uses Librosa 0.10, NumPy and TensorFlow for feature experiments and genre classification. Its feature notebooks cover RMS, chroma, mel spectrograms, MFCCs, spectral centroid/bandwidth/contrast/flatness/rolloff, zero-crossing rate and tempo. Its random-forest notebook aggregates mean, standard deviation, skew, kurtosis, median, minimum and maximum. This feature vocabulary is useful; the trained genre classifiers and Python runtime are not required to diagnose a modular patch.

| Candidate | Decision and evidence |
| --- | --- |
| [RealFFT 3.5.1](https://docs.rs/realfft/3.5.1/realfft/) and [RustFFT 6.4.1](https://docs.rs/rustfft/6.4.1/rustfft/) | Selected for the FFT. Pure Rust with reusable scratch buffers; RustFFT explicitly documents WASM SIMD support. Start with scalar WASM so a SIMD requirement is not imposed on browsers. MIT / MIT-or-Apache-2.0. RustFFT requires Rust 1.88 or newer. |
| [ebur128 0.1.11](https://github.com/sdroege/ebur128) | Selected for EBU loudness and true-peak estimation. Pure Rust port of libebur128; upstream documents M/S/I, loudness range and true-peak scanning. MIT. Its [changelog](https://github.com/sdroege/ebur128/blob/main/CHANGELOG.md) records relevant non-SSE2 and 32-bit fixes in 0.1.11. Reject empty input in our wrapper. Upstream's Linux CI does not establish browser compatibility; compile and browser tests are required here. |
| [pitch-detection 0.3.0](https://docs.rs/pitch-detection/0.3.0/pitch_detection/) | Possible later monophonic pitch support. Explicitly targets WASM and supplies YIN/MPM, but the repository's latest commit found during review was from December 2022. Evaluate confidence and polyphonic failure behaviour before adopting. |
| [resonant-analysis 0.4.0](https://docs.rs/resonant-analysis/0.4.0/resonant_analysis/) | Broad spectral/MFCC/chroma/onset/tempo API, but no browser build evidence established in this review. Not needed for the initial diagnostic subset. |
| [librosa-rs 0.1.0](https://github.com/DaniilPak/librosa-rs) | Closest advertised feature equivalence. Repository created 2026-11-10; its numerical-parity claims and WASM viability need independent evaluation. Too new to choose as the default based only on its README. |
| [Rust aubio bindings](https://docs.rs/aubio/latest/aubio/) | Native C bindings add a C toolchain/linking requirement; not selected. |
| [Essentia.js](https://github.com/MTG/essentia.js) | Existing browser WASM solution with broad analysis coverage, but C++/Emscripten and AGPL-3.0 rather than the selected narrow Rust stack. |

Sources are upstream repositories/API documentation, accessed 2026-11-15. The comparison is an implementation choice, not a claim that every candidate was compiled or benchmarked. Our own Rust is limited to elementary reductions, FFT framing/aggregation and the report contract; established FFT and loudness algorithms remain library code.

## First report

- Peak, RMS, DC offset and full-scale sample counts for left/right channels.
- Stereo correlation, mid/side RMS and side-to-mid energy ratio.
- Per-channel spectral centroid, 85% rolloff, flatness and low/mid/high band-energy fractions.
- Integrated, momentary and short-term LUFS plus a library true-peak estimate.
- Sample rate, exact captured frame count, duration, rack revision, schema and implementation versions.

The Rust crate documents definitions, framing and null semantics in [wasm/audio-analysis/README.md](../../wasm/audio-analysis/README.md). These are explicit measurements, not a promise of bit-identical Librosa output. Silence and insufficient-duration results use `null` where a number is undefined. Pitch, tempo, MFCC/chroma, genre classification, subjective quality scoring, image output and audio-file handoff are outside this first pass.

## Execution and bounds

1. Caller reads the rack revision and requests 0.5–10 seconds, default 5. Audio must already be running. Only one request may run at a time.
2. A lazy module Worker initializes the content-hashed Rust/WASM program. Normal rack startup does not request it.
3. Main thread allocates bounded stereo capture arrays and transfers ownership to the existing AudioWorklet. Supported analysis sample rates are 8–192kHz; ten seconds at the upper bound is 15.36 MB of PCM. Worker/WASM scratch and copied input add to peak memory use.
4. Worklet copies final stereo samples after all OUT modules, volume scaling and the output limiter. It stops at the exact requested sample count, including a partial final block. It does no FFT, loudness analysis, JSON encoding or capture-buffer allocation in `process()`.
5. Completed owned buffers transfer to the analysis Worker. The Worker returns bounded JSON and is terminated, releasing PCM and WASM memory. PCM is never uploaded, stored or converted into a public URL.

User parameter/topology changes, context suspension, audio errors, cancellation or timeouts reject the result and clean up. Host mutation events catch edits that are later reversed; start/end revision checks provide an additional guard. Autonomous notes and modulation continue during measurement. Layout changes do not change audio, but a changed reported rack revision still invalidates the result.

Final output has already sanitized non-finite sink values and limited amplitude. Consequently this report cannot prove upstream DSP is finite or unclipped. `fullScaleSamples` reports observed output samples at magnitude >=1; it does not identify the responsible module. A short-window LUFS value is a description of that capture, not a mastering recommendation or a whole-piece measurement.

## Build and validation

Keep Rust source, a pinned dependency lockfile, explicit third-party notices and reproducible build tooling in the repository. Commit generated, content-hashed browser artifacts and verify their source/artifact checksums during ordinary builds; Vercel does not need a Rust installation. Serve WASM as `application/wasm` with immutable caching only on hashed assets.

Tests cover known sine/DC/silence/stereo fixtures, finite bounded reports, independent channel behaviour, exact capture and output preservation, cancellation/timeout/stop/revision changes, Worker failure/recovery, and a real browser AudioWorklet → Worker → WASM run. Native WebMCP invocation is separate from registration-stub tests. Do not label successful numerical tests as subjective listening or zero realtime cost; capture still performs a bounded sample copy.

### Validation record — 2026-11-15

- Rust: 16 synthetic-signal/reference tests passed; Clippy passed with warnings denied. Fixtures include silent/DC channels, opposite stereo polarity, a calibrated 1 kHz loudness reference, intersample peaks, a transient at the final sample, and independent true-peak estimates when one channel has an extreme finite amplitude.
- App: `npm test` passed 2,808 tests, with nine existing skips. `npm run build` passed with source and artifact checksum validation.
- Browser: four Chromium tests passed for tool integration and the actual AudioWorklet → Worker → WASM pipeline. Verified lazy loading, WASM MIME/cache headers, no non-GET/HEAD measurement requests, unchanged playback, edit cancellation and recovery.
- Native WebMCP: three installed-Chrome tests passed through CDP tool discovery/invocation/cancellation, including a real audio report and cancellation after capture had started.
- First artifact: 401,536 bytes WASM and 7,178 bytes generated JS. Local WASM compression estimates are 133,965 bytes gzip and 104,816 bytes Brotli; negotiated delivery depends on hosting. Generated assets are versioned and immutable-cached.
- Maximum-bound smoke test of the shipped WASM in local Node: 10 seconds of stereo at 192 kHz (1,920,000 frames per channel) analysed in 195.8 ms and returned 1,497 bytes of finite JSON. WASM linear memory reached 24.69 MiB; caller PCM adds 14.65 MiB. This checks the bound and gives a local timing observation, not a browser/mobile performance guarantee. Browser captures also take their requested real-time duration. The asymmetric true-peak regression also passed in the generated WASM in both channel arrangements.

Browser checks used a separate local test port because the usual development port was already occupied. No production deployment was performed as part of this validation.

### Musical patch exercise — 2026-11-16

[Offset](../../compositions/offset/README.md) exercised the native Chrome WebMCP measurement tool on a new 18-module patch. Three eight-second captures per revision informed bass-level and stereo-send changes. Additional four-second mono, polarity-inverted, half-gain and muted-output variants passed known algebraic relationships through the real AudioWorklet → Worker → WASM path; raw reports retain their exact patch states. The final patch was restored, saved locally and reopened with identical state and no wiring diagnostics. These checks extend practical end-to-end evidence, not independent numerical conformance or subjective listening validation.
