# DSP And Sound Engineering Audit

Whole-library baseline: 2026-07-11; later module checks are dated below.

The original whole-library baseline covered 62 core modules. This index also records later module additions and focused checks. Detailed hardware context, algorithm notes, sources, and the current measured audit record live in `research/modules/{moduleId}.md`.

## Female vocal tract (2026-11-17)

The initial VOCAL adapter hard-wired male anatomy and phoneme calibration;
raising F0 left those resonances unchanged. It now offers Male/Female tract
selection using CHIMERA's original anatomy and separate calibrated targets.
Pitch remains independently patchable with the same 110 Hz / 1 V per octave
law. The female audition patch explicitly starts at +12 semitones (220 Hz).

Two fixed-memory models are prepared before processing, so changing anatomy
never rebuilds a network or allocates in the audio callback. An 80 ms crossfade
runs both briefly; steady state renders only one model. Cost is an additional
1 MiB per VOCAL and a female baseline cache bounded to three rates. Female
percussion snapshots are not generated. Tests check same-pitch spectral
differences, 110/220/440 Hz tracking, all female phonemes, held-gate switching,
reset and fixed memory. SEQ's own theme classes now style the sound toggles,
including their exact size, colour, border and glow.

Equal-220 Hz normalized spectral similarity is .609; pitch tracking remains
within 1%. Strict matrix: 594 scenarios, finite/stable/within rails. Browser
female-patch profile p95/p99 is 1/2 ms at 48 kHz/128 frames (2.667 ms deadline),
using coarse timers and a short single-voice capture. A silent-gate model-change
test caught stale held-note energy in a dormant tract; resetting only that
inaudible destination before the fade now keeps both directions below 1 µV.

## Vocal source, tract and timing controls (2026-11-17)

VOCAL adds Brightness, Roughness, Voicing, Nasal, Twang, Glide and Morph, each
with additive bipolar CV, plus Breath/Tension/Fry CV. It has 16 knobs/inputs
at 28 HP. The alphabet bank now uses square orange lights and right-aligned
labels to their left. Continuous targets preserve native mouth and source
history; neutral new settings reproduce the prior voice exactly. Twang skips
the native low-effect region below .45; Morph only slows native articulators.
Five-millisecond control smoothing and fixed memory keep modulation bounded.

On held A, normalized high-band energy changes 10.27 dB across Brightness;
periodicity drops from .996 to .582 with full Roughness and .030 at whispered
Voicing. Nasal and Twang produce normalized spectral similarities .827/.936
against neutral. Glide/Morph tests verify distinct settling times and identical
final targets. These checks address weak-control feedback quantitatively without
asserting subjective usefulness for every sound. Strict voltage matrix: 582
passing scenarios; native adapter: 12 passing tests. Full mappings, sources and
audition instructions are in [Vocal research](modules/vocal.md).

## Vocal and Beatbox split (2026-11-17)

VOCAL and BEATBOX replace the hybrid Airway module. Each owns independent
physical CHIMERA state. VOCAL uses continuous vowel/consonant targets with
external breath and articulation envelopes. BEATBOX keeps ten prepared
percussion recipes, sample-exact triggers, captured accent and a 1 ms bridge
when replacing the preceding hit. Neither module has a Voice/Beat mode.

Strict voltage matrices pass 114 Vocal and 84 Beatbox scenarios over
44.1/48/96 kHz and 128/512 frames. Focused tests cover eight consonants, settled
pitch accuracy, all ten percussion onsets below 12 ms, independent concurrent
engines, reset, stable buffers, trigger timing and allocation-free controls.
Six native adapter tests also pass. The browser test verifies both panels,
actual audio, live module addition, patch replacement, disconnection, manual
Hit and stop/restart. At 48 kHz/128 frames the Beatbox test patch's coarse
Chromium profile reports p95/p99 of 1/1 ms against a 2.667 ms deadline. This is
a short single-voice measurement, not a polyphony guarantee.

The Mouth Music vocal patch renders continuously with no Gate falls in ten
seconds while articulation ranges from zero to .989. Each physical instance
still carries substantial CPU cost. Automated captures establish signal
integrity; subjective listening remains for user audition. Contracts and
source links: [Vocal](modules/vocal.md), [Beatbox](modules/beatbox.md).
[Prototype history](topics/airway-prototype.md) retains earlier measurements.

## Two shipping Beatbox modules (2026-11-17)

The compact BEATBOX now adds Tune for every sound, Decay and Snap. BEATBOX PRO
ships alongside it with eight physical modifiers, Choke, Env and Active. Both
have persistent Clamp/Wrap sound addressing. The Pro defaults are sample-identical
to compact. External sequencers, envelopes and modulation remain responsible
for musical gestures; neither module contains a voice mode or rhythm generator.

Tune uses a precomputed 64-tap bandlimited streaming reader over fresh physical
model output at .5..2x speed. Compared with a granular shifter, this avoids
window-length latency and repeated transients. Compared with tract rescaling,
it also transposes clicks/noise without breaking native stability constraints.
The trade-offs are shifted time, bounded pitch range and up to twice the native
rendering work. Decay compensates initial Tune where the score allows; live
Tune bends still change the remaining duration. Snap changes native release
motion. Pro modifiers rebuild a bounded canonical score without accumulating
geometry offsets or allocating in the audio callback.

The compact strict audit covers 120 scenarios with nonzero output. Pro's 216
generic scenarios are muted by simultaneous Choke/Trig, so additional audible
48/44.1/96 kHz x 128/512-frame tests verify active Out/Env/Active ranges. Focused
tests cover every control/CV, negative and overflowing Wrap, Hum octaves, all
sounds under Tune, long hat tails, Snap response, Choke, deterministic reset,
block-size invariance and neutral parity. The reader rejects an 18 kHz source
at 2x read speed below .002 RMS while preserving passband gain. Eight native
adapter tests and an allocation counter cover timing/geometry updates.

Real Chromium AudioWorklet capture at 48 kHz/128 frames (2.667 ms deadline):

| Patch / setting | Capture RMS / peak, normalized | Block p95 / p99 |
|---|---|---|
| BEATBOX example | .0100 / .0884 | 1 / 1 ms |
| Original BEATBOX PRO example (withdrawn) | .0158 / .1187 | 1 / 2 ms |
| PRO Hum, Tune +12, Decay 4 | .00738 / .0784 | 1 / 2 ms |

These are short two-second profiles with Chromium's coarse timing resolution.
They demonstrate this single-voice patch on the test machine, not a guarantee
for large racks or slower devices. The browser also verifies panel bounds,
Wrap state, manual Hit, live addition, patch replacement, Choke connection and
removal, and stop/restart. Production build and regenerated previews include
both modules. Subjective sound quality still requires user audition; no
listening judgment is inferred from captured numbers.

Specs and sources: [BEATBOX](modules/beatbox.md),
[BEATBOX PRO](modules/beatbox-pro.md). The prior split measurements above are
retained as historical evidence, not current Tune behavior.

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
- [Antiderivative Antialiasing for Memoryless Nonlinearities](https://www.pure.ed.ac.uk/ws/portalfiles/portal/34115216/bilbao_pdf.pdf) - Bilbao, Werner, Smith, and Abel, IEEE Signal Processing Letters, 2017.
- [The Art of VA Filter Design](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf) - Vadim Zavalishin.
- [Effect Design, Part 1 and 2](https://ccrma.stanford.edu/~dattorro/) - Jon Dattorro.


## Pro demo withdrawn after audition (2026-11-17)

The user reported that most knobs had little effect and requested removal of
the Pro patch. Its composition, URL, Test catalogue entry and preview have been
removed. The module remains; the arrangement survives only as an internal
browser regression fixture. Waveform-difference tests were insufficient to
establish useful audible control ranges. Pro needs isolated per-sound A/B
audition and control-range work before another musical showcase is warranted.


## Vocal alphabet pool (2026-11-17)

VOCAL now exposes A–Z and SH/CH/TH/DH/NG/ZH as 32 persistent light buttons.
Sound CV divides only the enabled pool into equal bins. Empty selection fades
to silence; changing buttons does not trigger or reset the voice. The expanded
28 HP panel has four rows of eight buttons, All/None shortcuts and a separate
current-sound outline.

The native alphabet ABI reuses the calibrated phoneme inventory. CH/J/Q/X
trace closure/release/vowel targets using external articulation, with no
internal speech timer. C is deliberately hard /k/; Q and X trace /kw/ and /ks/.
This is an articulatory instrument, not automatic English letter pronunciation.
Ten native tests and the allocation counter verify bounded continuous updates.
The strict audit passes 498 scenarios over six configurations. Focused checks
cover all sound paths and actual sustained fricative energy, not just unequal
sample arrays. Useful phonetic identity still needs listening; the Pro feedback
above remains relevant to how these results are interpreted.

Final alphabet validation: 3,033 tests pass (nine skipped), production build
passes, and the real-browser layout/persistence/audio check passes. The demo
opens with nine selected letters and external Sound CV/articulation. The older
Mouth Music voice retains its prior measured output using an M-only pool.

## Speech phrase voice (2026-11-17)

SPEECH uses the pinned CHIMERA English frontend in a disposable Worker and
streams overlapping gestures into the physical voice. Pitch and articulation
rate are independent; prepared plans persist without audio buffers. Full
precision in shared URLs preserves gesture timing and admission bounds.

Native allocation checks, actual voiced periodicity, duration/pulse assertions,
a 60-case sounding knob/sample-rate/block-size matrix, and a real Chromium
editing/playback/URL test pass. The generic strict voltage matrix also passes,
but its simultaneous Stop and Trig stimulus is silent for this module; focused
sounding checks supply the relevant audio evidence. Full suite: 3,095 passed,
nine skipped; production build and patch previews pass.

One voice at 48 kHz / 128 frames measures p99 2 ms against a 2.667 ms deadline.
Two voices measure p99 3 ms with coarse 1 ms timing, so multiple concurrent
voices remain a performance limitation. The demo uses one voice. These are
technical checks, not an intelligibility or naturalness assessment. Use the
isolated audition protocol and saved measurements in
[Speech research](modules/speech.md#dsp-audit-2026-11-17) before expanding controls.
