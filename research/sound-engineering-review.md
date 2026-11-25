# DSP And Sound Engineering Audit

Last audited 2026-11-25.

The rack now has 83 core modules. The July baseline below covered the first 62. Each registered module has a dated measurement record alongside its hardware references and DSP decisions in [module research](modules/).

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

### Composition and arrangement modules (2026-11-25)

All five factory demos produced stereo output at 48 kHz in Chromium. The programmed Gate Seq matrix reached 10 V on all four outputs. Fold Percussion's control-extreme renders peaked below 5 V. DJ Filter passed dry samples exactly at center and when starting in bypass. Performance Mutes started closed channels at zero and reached silence on both sides of the running demo. The rack-wide strict voltage audit covered 83 modules at three rates and two block sizes. [Gate Sequencer](modules/gate-seq.md) · [Fold Percussion](modules/fold-perc.md) · [Stereo DJ Filter](modules/dj-filter.md) · [Performance Mutes](modules/mutes.md)

The Slice Sampler browser test imported a 320 Hz WAV, recorded it to the other player, stopped audio, and imported a 640 Hz replacement into the first player. After restart the measured outputs were 640 Hz left and 320 Hz right. The host tests also exercise patch replacement and a final recording commit between display updates. [Slice Sampler](modules/slice-sampler.md) · [Chromium tests](../tests/e2e/composition-modules.spec.js) · [Runtime lifecycle tests](../tests/app/sampler-runtime.test.js)

### Octo Send and Receive (2026-11-25)

The eight-lane snake resolves each numbered path to its original source before the worklet computes feedback delays. A direct-wired oscillator and clocked kick matched the same mix routed through Octo across all 96,000 frames in a 48 kHz Chromium capture. Each endpoint passed the six-configuration strict-voltage audit. The graph tests also cover crossed lanes, parallel receivers, silent jacks overriding a normal, and feedback sharing a trunk with an independent signal. [Send research](modules/octo-send.md) · [Receive research](modules/octo-receive.md) · [Routing tests](../tests/audio/octo-graph.test.js)

### LOGIC and MULT input normals (2026-11-25)

The worklet delivered cable changes through two hooks. LOGIC and MULT listened
for a different hook, so their patched OR and IN 2 jacks always followed their
normals. Both modules now use the worklet hooks. Render tests cover initial
connections, a 0 V override, unplugging and reconnecting. The same tests
confirmed the existing behavior of all three right-side CMP2 inputs.
[Worklet routing tests](../tests/audio/worklet-processor.test.js)

A 32-second stereo Chromium render of a score using only LOGIC's AND inputs
matched the previous build sample for sample. Moving its ten OR operators to
the OR jacks produced the same render with the fix. For older patches that
relied on a cable being ignored, unplugging the affected jack selects its
normal again.

### CV and gate to external MIDI (2026-11-22)

MIDI OUT samples pitch and velocity at the gate rise and releases the original note and channel at the fall. The focused tests cover multiple edges within a block and edits during held notes. The strict matrix completed 18 scenarios across six sample-rate/block-size combinations with stable buffers and zero voltage flags. The converter produces MIDI events, so the focused edge and browser tests measure its output. [MIDI OUT design and references](modules/midi-out.md)

### Rack control verification (2026-11-18)

- The panel-to-worklet test operates 370 declared controls across 75 modules.
  The strict voltage matrix covered 4,878 scenarios across 450 module and
  configuration combinations with zero voltage violations.
- A Chromium capture at OUT measures the pitches 0, 4 and 7 semitones with
  ARP Oct at one. Selecting two adds 12, 16 and 19. All 13 chords also have
  worklet-compatible DSP fixtures for the second pass.
- Granulita Direction and Hit and the COMP sidechain filter now expose all
  three declared positions. SCOPE aligns both traces to the selected CH1
  crossing. Ensemble's scale-edit buttons update the saved notes and the
  running oscillator on the same rising transition.
- The spectrogram Time knob now changes the displayed and exported history.
  Its 300 columns span 30 seconds at each supported sample rate, and the
  two-second setting displays the most recent 20 snapshots.
- The worklet preserves a momentary press and release delivered in the same
  audio block. A CV Recorder test sends two rapid Record presses and observes
  the recorder arm and cancel in sequence.
- The shared verification commands and proof boundaries are in
  [Rack laws](../laws/README.md).

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
| `verb` | Stereo normalization follows cable state instead of signal amplitude, preventing zero-crossing channel splices; the output uses a continuous ±5 V soft rail. |
| `cmp2`, `comp` | Right-side signal/CV and sidechain normals follow cable lifecycle state, so patched silence and bipolar zero crossings cannot change routing semantics. |
| `granulita` | Continuous FRZ/SYNC scheduling, distinct trigger-only mode, cable-state stereo normalization, continuous rails, corrected chord/Voice mapping, and allocation-free grain counting. |
| `dly` | Official full-range 0-5 V modulation restored, feedback damping made sample-rate invariant, and soft-rail/reset behavior covered. |
| `tape` | Time changes slew, head layouts crossfade, taps retain exact timing, and CV ranges are explicit; full timing/tone strict matrix passes. |
| `chorus`, `phaser`, `flanger` | One-cable stereo operation now uses cable-state In R normalization; connected silence is preserved, disconnect restores the normal, and reset/rails are covered. |
| `crush` | Stereo normal follows cable state, over-range output uses a continuous rail, and bit-depth/sample-hold endpoints are characterized. |
| `loop` | Practical loops receive endpoint fades, record-stop/Clear transitions are de-clicked, and reset preserves loop state while clearing I/O. |
| `resbank` | Audio/Strum normals use cable state, so connected silence cannot invoke internal excitation or unintended auto-strums. |
| `vcf` | Maximum resonance receives a one-shot deterministic seed so documented self-oscillation can start; CV and slew-reset contracts are explicit. |
| `ring` | Four-quadrant voltage scaling is locked, over-range multiplication uses a continuous rail, and sum-frequency Nyquist limits are documented. |
| `fold` | First-order antiderivative antialiasing replaces the raw sine lookup; a coherent high-drive render reduces measured reflected-harmonic power by 8.26 dB while preserving ±5 V rails. |
| `lpg` | VCA/Combo/LP changes now crossfade over 4 ms, reducing the measured mode-boundary jump from 1.997 V to 0.171 V; CV contracts and complete reset behavior are explicit. |
| `formant` | Drive/Mix changes now slew over 5 ms and reset covers every CV buffer; the measured dry-to-wet boundary falls from 2.841 V to 0.040 V. |
| `pluck` | Excitation, damping, DC blocking, and idle detection now preserve physical time across sample rates; the 96/44.1 kHz brightness ratio falls from 2.043x to 1.206x. |
| `vco` | Input normals/reset and the 1 V Sync threshold are enforced; coherent saw testing measures PolyBLEP reflected-harmonic power 13.71 dB below the equivalent naive oscillator. |
| `wavetable` | Bank and safe mip-replica crossfades reduce measured boundary jumps from 4.103 V to 0.182 V and 1.683 V to 0.0024 V; coherent reflected bins remain below -100 dB. |
| `complex-vco` | Smooth Nyquist partial fades reduce the 13th-harmonic boundary from 0.1736 V to 0.000046 V; the bandlimited triangle core cuts measured reflected power by 62.24 dB. |
| `ensemble-vco` | Root/Pitch/Scale/Spread/Balance now process per sample, UI Freeze reaches worklet DSP, and Cross-FM uses a stable previous-sample snapshot; the 44-scenario matrix remains below 0.872 ms in the Node diagnostic. |
| `pwm` | Full-scale CV now spans the documented threshold range; sub-sample crossing integration reduces measured reflected comparator-edge power by 4.93 dB while retaining exact settled +/-5 V levels. |
| `atten` | The utility adaptation now explicitly uses 0V input normals with dedicated bipolar offsets, rejects non-finite controls/samples, and restores stable buffers plus the zero-voltage LED state on reset. |
| `vca` | DSP and panel defaults now agree; 5V-normalled CV starts fully open without an unintended fade, while real CV transitions retain 3ms smoothing and reset restores every stable buffer/filter state. |
| `slew` | The 0ms endpoint is now exact bypass, positive RC timing is verified invariant at 44.1/48/96 kHz, and bipolar CV plus stable reset/finite behavior are explicit. |
| `mix` | Four 5ms level slews reduce a 5V manual-gain boundary from a full 5V step to about 0.023V at 44.1 kHz; initial renders remain direct and DC sums retain continuous +/-10V rails. |
| `matrix` | All sixteen effective routes now slew over 5ms, covering knob and polarity-mode transitions; every cell has focused coverage and four DC sums retain continuous +/-10V rails. |
| `joystick` | Reset wins trigger coincidence, range switching slews its 5V offset over 5ms, non-finite polar CV is neutralized, and gesture playback no longer allocates per-sample result objects. |
| `sh` | The hidden 0-0.5ms slew dead zone is removed, bypass now tracks filter state to prevent reverse transients, and 50ms timing is invariant at all supported sample rates. |
| `quant` | Nearest-note search now crosses negative octave boundaries correctly, note changes emit a real 8ms pulse instead of one sample, and panel/worklet defaults agree. |
| `seq` | The four documented repeat/pendulum modes now use their real repeat patterns, Reset wins Clock coincidence, and block processing no longer allocates step/gate arrays. |
| `seq-switch` | Its 1ms crossfade bounds a measured +5V/-5V source transition to 1V per sample at 10 kHz; steps, port rails, and complete stable reset are explicit. |
| `euclid` | The former four-block (~46ms) trigger is now exact 8ms, Length/Hits CV runs per sample, Reset wins Clock, and hit calculation no longer allocates a pattern each block. |
| `turing` | Scale now affects held DAC voltage immediately, DSP/panel length defaults agree, and register stepping removes per-edge object allocation plus obsolete disconnect cleanup. |
| `clk` | Pause now closes an in-progress pulse immediately, while a separate 50ms visual hold preserves LED visibility without changing the electrical clock width. |
| `div` | Multiplied clocks now use safe exact subdivisions, expire naturally after the last measured period, separate electrical/LED timing, and follow stable input/reset/voltage contracts without obsolete disconnect hooks. |
| `swing` | Non-finite timing controls can no longer strand immortal pending events; causal delayed pulses drain after disconnect, and explicit clock/CV rails plus full stable reset are enforced. |
| `burst` | Finite fallbacks prevent malformed CV/time/distribution values from creating immortal burst deadlines; all trigger/CV rails and complete stable reset are now explicit. |
| `gate-delay` | Exact monostable timing is preserved while independent 50ms LED holds make sub-block gates visible; finite input/timing recovery and stable reset are covered. |
| `lfo` | Rate/Wave CV and Reset now run sample-exactly, maximum Wave reaches the fourth shapes instead of wrapping to sine, and DSP/UI defaults plus finite/reset contracts agree. |
| `quad-lfo` | Exact quadrature and sample-level CV/Reset/Hold timing are locked; finite range/FM guards, explicit bipolar rails, and complete stable reset prevent phase poisoning. |
| `rnd` | A connected external Clock now truly suppresses the internal clock and makes Rate a gate probability; Amp is continuous and Smooth uses sample-rate-invariant 250-5ms timing. |
| `envf` | Exact threshold polarity and 1ms/10ms fast timing are locked across sample rates; finite guards prevent envelope poisoning and reset restores the 0V/10V complementary pair. |
| `func` | In cable state now owns slew mode even at 0V, Fall retriggers no longer discontinuously restart, and EOR/EOC pulses are exact 5ms rather than one sample long. |
| `adsr` | The 5.5V RC attack now crosses 5V at its selected time, EOC is an exact 5ms/10V trigger, and Gate/Retrig coincidence plus all CV/rail/reset contracts are explicit. |
| `ochd` | Corrected triangle traversal restores 160Hz, the bottom no-CV endpoint is 25 minutes rather than ~28 hours/stalled, and the missing bipolar Rate CV attenuverter is implemented. |
| `nse` | Downsample hold time is now sample-rate invariant, VCA retriggers retain envelope continuity, stale mode state is cleared, and DSP/UI defaults plus trigger/rail/reset contracts agree. |
| `db` | VU now reaches 99% in 300ms, peak falls 20dB in 1.5s, and Combined mode finally displays raw transients over VU bars while preserving finite stereo passthrough. |

### MIDI, Recording, And Analysis

- MIDI note and clock events carry AudioContext timestamps and sample offsets, remain visible to every MIDI module in a block, and never use browser globals from DSP.
- Recorder storage uses one-second chunks and exact sample counts instead of one allocation per render quantum; WAV tests cover padded final chunks.
- `spectrum` and `spectrogram` share a preallocated Hann-window real FFT calibrated so a coherent-bin 5 V peak sine is 0 dBFS.
- `--strict-voltage` turns audit voltage flags into failures, and CI coverage runs every control scenario through the supported matrix.

### P2: Verify Spectral And Modulation Quality

| Area | Modules | Next experiment |
|---|---|---|
| Discontinuous oscillators | complete | `vco`, `wavetable`, `complex-vco`, and `pwm` now have coherent alias/transition comparisons; `ensemble-vco` deep digital shaping is characterized as intentional broadband behavior. |
| Nonlinear voices/processors | `ring`, `kick`, `snare`, `hat` | Contract audits are complete, including percussion rail/finite/reset hardening and deterministic noise. Continue level sweeps, DC checks, and oversampling comparisons where nonlinear aliasing is measurable. (`fold`, `lpg`, `formant`, and `pluck` already have individual quality comparisons.) |
| Filters | `vcf`, `lpg`, `formant` | Cutoff tracking, resonance stability, modulation sidebands, and sample-rate invariance. |
| Delay modulation | `dly`, `tape`, `chorus`, `phaser`, `flanger`, `loop`, `granulita` | Interpolation sidebands, zipper/click tests, feedback decay, stereo correlation, and long-run bounds. |
| Envelopes/control | `lfo`, `quad-lfo`, `ochd`, `adsr`, `func`, `slew`, `envf`, `rnd`, `sh` | Time-constant accuracy, block-boundary continuity, trigger latency, and rate invariance. |

### Analyzer DSP

The shared FFT and calibrated-bin tests are complete. `scope` and `plot` retain
exact trigger, frequency, peak, RMS, and DC fixtures; all analyzers remain
sample-identical passthroughs for valid signals and contain invalid graph values
before telemetry. Spectrum peak release is now expressed in dB/second and is
render-quantum invariant.

### Worklet Performance

Opt-in AudioWorklet profiling now reports bounded block and per-module p50/p95/p99 timing plus p99 deadline utilization. Chromium exercises the real reporting path. Values remain diagnostic rather than machine-dependent CI thresholds; investigate a single-module p95 above 50% or representative-patch p99 above 75%.

## Module Index

All listed modules pass the finite/stable-buffer baseline and strict voltage matrix. Remaining P2 work is sound-quality characterization, not a known contract defect.

| Area | Modules and status |
|---|---|
| MIDI | `midi-cv`, `midi-4`, `midi-cc`, `midi-clk`, `midi-drum` baseline |
| Clock | `clk`, `div`, `swing`, `burst` baseline |
| Modulation | `lfo`, `quad-lfo`, `adsr`, `slew`, `ochd`, `rnd`, `func`, `envf` baseline |
| Sources/voices | `nse`, `vco`, `wavetable`, `pluck`, `kick`, `snare`, `hat`, `fold-perc`, `slice-sampler` baseline |
| Sequencing/pitch | `sh`, `quant`, `arp`, `seq`, `seq-switch`, `euclid`, `turing`, `gate-seq` baseline |
| Filters/nonlinear | `vcf`, `lpg`, `formant`, `fold`, `ring`, `dj-filter` baseline |
| Utilities | `logic`, `mult`, `octo-send`, `octo-receive`, `matrix`, `mix`, `joystick`, `vca`, `atten`, `db`, `pwm`, `cmp2`, `comp`, `mutes` baseline |
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
- [Antiderivative Antialiasing for Memoryless Nonlinearities](https://www.pure.ed.ac.uk/ws/portalfiles/portal/34115216/bilbao_pdf.pdf) - Bilbao, Werner, Smith, and Abel, IEEE Signal Processing Letters, 2017.
- [The Art of VA Filter Design](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf) - Vadim Zavalishin.
- [Effect Design, Part 1 and 2](https://ccrma.stanford.edu/~dattorro/) - Jon Dattorro.
