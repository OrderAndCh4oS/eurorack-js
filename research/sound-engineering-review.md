# DSP And Sound Engineering Audit

Last audited: 2026-07-11

This is the central index for the 62 registered core modules. Detailed hardware context, algorithm notes, sources, and the current measured audit record live in `research/modules/{moduleId}.md`.

## Scope And Method

The audit combines four evidence layers:

1. **Contract inspection**: module metadata, controls, signal/voltage declarations, DSP state, reset, and telemetry.
2. **Automated stimulus**: deterministic audio, CV, gate, trigger, MIDI note/CC/clock, and control-extreme scenarios.
3. **Runtime matrix**: 44.1, 48, and 96 kHz at block sizes 128 and 512.
4. **Research review**: existing primary/secondary sources plus refreshed canonical references for MIDI, Compare 2, Loop, MATHS/FUNC, and analyzer behavior.

The harness measures finite samples, min/max/peak, RMS, DC, zero-crossing frequency, spectral centroid, upper-band energy, voltage-contract compliance, stable buffer identity, reset behavior, and advisory execution time. Generic measurements detect regressions; they do not prove hardware fidelity or perceptual quality.

Run the baseline:

```bash
npm run audit:dsp
npm run audit:dsp -- --matrix --strict-voltage
npm run audit:dsp -- --module vcf --json
```

## Baseline Result

- All 62 modules instantiated and processed without exceptions.
- All captured samples were finite at every sample rate and block size.
- All modules retained stable input and output buffer identities.
- Deterministic MIDI and action scenarios now exercise event-driven modules instead of accepting silence as a pass.
- All 62 modules now have focused DSP coverage; MIDI timing/allocation and recorder/WAV behavior have dedicated tests.
- The strict matrix reports zero voltage-contract violations.
- The Node timing column is diagnostic only. It includes stimulus/capture overhead and is not a real-time AudioWorklet benchmark.

## Remediation Completed

### Signal And Voltage Contracts

| Modules | Resolution |
|---|---|
| `midi-cv`, `midi-4`, `midi-cc`, `midi-drum` | Pitch ranges now cover all supported note/transpose/bend controls; velocity, modulation, and CC outputs explicitly declare 0-10 V. |
| `envf`, `func`, `comp`, `rnd` | Unipolar CV outputs explicitly declare 0-10 V. |
| `quant`, `arp` | Pitch outputs declare their theoretical control/input extrema without clamping valid pitch. |
| `mix`, `matrix` | DC sums remain linear below 9.6 V and smoothly approach explicit ±10 V rails under overload. |

### Audio Rails And Stability

| Modules | Resolution |
|---|---|
| `vco` | Frequency requests are capped at 45% of sample rate before PolyBLEP and outputs use ±5 V soft rails. Extreme pitch/FM tests pass at 44.1, 48, and 96 kHz. |
| `vcf` | LP/BP/HP outputs smoothly approach ±5 V; resonant, audio-rate-modulated long runs remain finite and bounded. |
| `dly`, `phaser`, `flanger` | Output and feedback/write state use ±5 V soft rails; 500-block extreme-feedback tests remain finite and bounded. |

### MIDI, Recording, And Analysis

- MIDI note and clock events carry AudioContext timestamps and sample offsets, remain visible to every MIDI module in a block, and never use browser globals from DSP.
- Recorder storage uses one-second chunks and exact sample counts instead of one allocation per render quantum; WAV tests cover padded final chunks.
- `spectrum` and `spectrogram` share a preallocated Hann-window real FFT calibrated so a coherent-bin 5 V peak sine is 0 dBFS.
- `--strict-voltage` turns audit voltage flags into failures, and CI coverage runs every control scenario through the supported matrix.

### P2: Verify Spectral And Modulation Quality

| Area | Modules | Next experiment |
|---|---|---|
| Discontinuous oscillators | `vco`, `wavetable`, `pwm` | Frequency-swept alias-energy fixtures, hard-sync residual tests, and audio-rate FM/PWM tests. Compare PolyBLEP/wavetable behavior at 44.1 and 96 kHz. |
| Nonlinear voices/processors | `pluck`, `fold`, `ring`, `lpg`, `formant`, `kick`, `snare`, `hat` | Level sweeps, DC checks, decay invariance, and oversampling comparisons where nonlinear aliasing is measurable. |
| Filters | `vcf`, `lpg`, `formant` | Cutoff tracking, resonance stability, modulation sidebands, and sample-rate invariance. |
| Delay modulation | `dly`, `tape`, `chorus`, `phaser`, `flanger`, `loop`, `granulita` | Interpolation sidebands, zipper/click tests, feedback decay, stereo correlation, and long-run bounds. |
| Envelopes/control | `lfo`, `quad-lfo`, `ochd`, `adsr`, `func`, `slew`, `envf`, `rnd`, `sh` | Time-constant accuracy, block-boundary continuity, trigger latency, and rate invariance. |

### Analyzer DSP

The shared FFT and calibrated-bin tests are complete. `scope` and `plot` retain exact trigger, frequency, peak, RMS, and DC fixtures; all analyzers remain sample-identical passthroughs.

### Worklet Performance

Opt-in AudioWorklet profiling now reports bounded block and per-module p50/p95/p99 timing plus p99 deadline utilization. Chromium exercises the real reporting path. Values remain diagnostic rather than machine-dependent CI thresholds; investigate a single-module p95 above 50% or representative-patch p99 above 75%.

## Module Index

All listed modules pass the finite/stable-buffer baseline and strict voltage matrix. Remaining P2 work is sound-quality characterization, not a known contract defect.

| Area | Modules and status |
|---|---|
| MIDI | `midi-cv`, `midi-4`, `midi-cc`, `midi-clk`, `midi-drum` baseline |
| Clock | `clk`, `div`, `swing`, `burst` baseline |
| Modulation | `lfo`, `quad-lfo`, `adsr`, `slew`, `ochd`, `rnd`, `func`, `envf` baseline |
| Sources/voices | `nse`, `vco`, `wavetable`, `pluck`, `kick`, `snare`, `hat` baseline |
| Sequencing/pitch | `sh`, `quant`, `arp`, `seq`, `seq-switch`, `euclid`, `turing` baseline |
| Filters/nonlinear | `vcf`, `lpg`, `formant`, `fold`, `ring` baseline |
| Utilities | `logic`, `mult`, `matrix`, `mix`, `joystick`, `vca`, `atten`, `db`, `pwm`, `cmp2`, `comp` baseline |
| Effects | `dly`, `phaser`, `flanger`, `tape`, `verb`, `chorus`, `crush`, `loop`, `granulita` baseline |
| Analysis/recording | `scope`, `spectrum`, `plot`, `spectrogram`, `rec` baseline |
| Output | `out` baseline |

## Contentious Decisions

### Voltage Declarations Versus Clamping

Do not solve every mismatch with a clamp. Pitch CV must preserve pitch range, and unipolar modulation should declare 0-10 V. Summing and resonant audio are different: they need an explicit product decision about headroom and overload character. The preferred default is soft, documented rail behavior for audio and explicit wider declarations only where downstream modules are designed to accept them.

### Fidelity Versus Utility Adaptation

Some modules emulate named hardware; others are utilities inspired by a class of devices. Research files must label the model as faithful emulation, inspired approximation, or utility adaptation. Tests should enforce the stated target, not undocumented assumptions about the source hardware.

### Shared DSP Extraction

The optional library now covers phase wrapping, PolyBLEP, linear/circular interpolation, slew, voltage limiting, and calibrated FFT analysis. Equivalent phase and circular-reader implementations were migrated behind focused utility and module tests. Modules continue to own state, saturation, timing, waveform, and reset policy; extract further primitives only after equivalence tests exist.

The existing utility layer was reviewed at the same boundary. Math helpers now reject inverted or invalid exponential ranges, slew construction and runtime updates share one validated time contract, FFT calibration and buffer arguments validate explicitly, nested paths are anchored and block prototype keys, typed-buffer copies require equal lengths, and color adjustment rejects malformed input. The looper retains its local interpolator because its active circular length changes at runtime; clock phase wrapping remains local because wrapping also defines pulse-edge state.

### Performance Gates

Do not turn the Node microbenchmark into a CI failure threshold. Browser scheduling, JIT warm-up, telemetry transfer, and graph size determine real-time safety. Use deterministic Node timing to spot regressions, then confirm them in an AudioWorklet benchmark.

## Acceptance Gates For Follow-Up Work

1. Update the relevant `research/modules/{id}.md` with the chosen behavior and source evidence.
2. Add or tighten focused tests before changing DSP.
3. Run `npm run audit:dsp -- --module {id} --matrix` and the focused tests.
4. For contract changes, run module-contract and factory-patch validation.
5. For audio changes, include objective before/after measurements and a listening protocol.
6. Run the full test suite before merge.

## Primary References Refreshed

- [MIDI 1.0 Core Specifications](https://midi.org/midi-1-0-core-specifications) - MIDI Association, accessed 2026-07-11.
- [Compare 2 product page and manual link](https://joranalogue.com/products/compare-2) - Joranalogue Audio Design, accessed 2026-07-11.
- [Loop](https://www.twohp.com/modules/loop) - 2hp, accessed 2026-07-11.
- [MATHS manual](https://www.makenoisemusic.com/wp-content/uploads/2024/03/MATHSmanual2013.pdf) - Make Noise, accessed 2026-07-11.
- [Web Audio API: AnalyserNode](https://www.w3.org/TR/webaudio-1.0/#the-analysernode-interface) - W3C Recommendation, accessed 2026-07-11.
- [Antialiasing Oscillators in Subtractive Synthesis](https://ieeexplore.ieee.org/document/4117934) - Välimäki and Huovilainen, IEEE Signal Processing Magazine, 2007.
- [The Art of VA Filter Design](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf) - Vadim Zavalishin.
- [Effect Design, Part 1 and 2](https://ccrma.stanford.edu/~dattorro/) - Jon Dattorro.
