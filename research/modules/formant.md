# Formant Filter (formant)

## Hardware Reference
- **Primary references**: Doepfer A-104 Trautonium Formant Filter, Doepfer A-127 VC Triple Resonance Filter, Doepfer A-128 Fixed Filter Bank, and Doepfer A-129 Vocoder Subsystem.
- **Concept reference**: Vocal formants are resonant spectral peaks of a vocal tract or other acoustic space. The first two formants carry much of vowel identity; higher formants add voice/body color.
- **DSP references**: W3C Audio EQ Cookbook band-pass biquad formulas, STK `FormSwep` sweepable formant resonator, MusicDSP formant filter coefficient example, and Klatt cascade/parallel formant synthesis literature.
- **Model choice**: Inspired-by utility adaptation. The app module should not clone one exact panel. It should combine the A-104/A-127/A-128 resonant filter-bank idea with a compact vowel morph control and CV inputs that fit eurorack-js.

## Source-Derived Behavior
- Doepfer A-104 is a fourfold formant filter for Trautonium-like resonances. It uses four parallel resonant filters, each switchable between low-pass, off, and band-pass, with separate manual frequency, resonance, and level controls. Doepfer specifies no voltage control, about 50 Hz to 5 kHz per filter, sensitive inputs, intentional distortion, and vocal-like Trautonium effects.
- Doepfer A-127 is a triple voltage-controlled resonant filter bank. It uses three separate band-pass filters sharing one audio input; each has filter frequency, resonance, amplitude, and an internal triangle LFO or external CV path. Doepfer describes vocoder- or speech-like effects when the three filter frequencies are driven by deliberate external CV.
- Doepfer A-128 is a fixed filter bank using 15 parallel band-pass filters with fixed center frequencies from 50 Hz through 11 kHz, each with its own amplitude control and about half-octave bandwidth. This supports the broader filter-bank approach but is less directly vowel-morphable.
- Doepfer A-129 documents the classic vocoder source/filter workflow: a speech analysis signal is split by parallel filters and envelope followers, then used to control a matching synthesis filter/VCA bank fed by a carrier. Its official sound-example notes use saw, polyphonic VCO, noise, and digital oscillator carriers, supporting the practical point that rich carriers make vocal filtering more intelligible.
- MusicDSP's formant filter example is a simple five-vowel IIR coefficient set. Its comments report that rich saw or square inputs work well, but also report distortion, self-oscillation, sample-rate dependence, and instability when using low precision or some morphs. That is useful as a warning against opaque coefficient interpolation.

## Observed Behavior From Reviews, Demos, and Sound Examples
- Formant filtering needs a harmonically rich input. Saw, pulse, oscillator stacks, noise, and bright samples reveal vowel peaks better than sine waves.
- Vowel identity comes from relative resonant peaks rather than pitch tracking. The same carrier pitch can sound like different vowels as the filter-bank peaks move.
- Slow vowel morphing behaves like changing mouth shape. Fast CV produces speech-like or talking-filter gestures; audio-rate movement becomes complex filter FM rather than natural speech.
- Narrow resonances produce strong vocal or whistling color but can ring and overload. Broader resonances are less intelligible but smoother and safer for mix levels.
- The hardware context tolerates and sometimes encourages input overdrive. The app version should include controlled drive/soft clipping rather than unstable filter self-oscillation.

## Source Quality Notes
- Official Doepfer pages are primary sources for panel behavior, filter counts, ranges, no-voltage-control notes, CV behavior, and intended speech/vocoder use.
- Doepfer A-127 and A-129 demo links are official context sources. They are stronger for intended use and patch types than for exact electrical behavior.
- Wikipedia formant pages are secondary sources for broad speech-acoustics concepts and average formant ranges. They are not authoritative enough for exact vowel tables, so this spec treats exact vowel targets as musical approximations.
- W3C Audio EQ Cookbook is a strong DSP reference for stable biquad coefficient formulas. STK `FormSwep` is a strong open-source reference for sweepable formant resonators.
- MusicDSP is a practical community implementation reference, but its comments expose stability and provenance concerns. It should inform trade-offs, not be copied directly.
- Exact vowel formants vary by language, speaker, sex, age, and singing technique. The app should expose `shift` and `resonance` controls instead of pretending one table is universal.

## Specifications

### App Panel Contract
- **Module ID**: `formant`
- **Name**: `FORMANT`
- **Category**: `filter`
- **Suggested HP**: 6
- **Suggested color token**: `module-color-ten`
- **Knobs**:
  - `vowel`: morph position through vowel targets `A -> E -> I -> O -> U`, 0..1, default 0.25.
  - `resonance`: shared formant sharpness, 0..1, default 0.55. Maps to moderate through narrow resonator bandwidth.
  - `shift`: global formant-frequency shift, 0..1, default 0.5. Maps to -12..+12 semitones around neutral.
  - `drive`: pre-filter drive, 0..1, default 0.25. Maps to clean through moderate soft saturation.
  - `mix`: dry/wet blend, 0..1, default 1.0.
- **Switches**: none for the first implementation.
- **Buttons**: none.
- **Inputs**:
  - `audio`: `buffer`, main audio input, nominal +/-5 V.
  - `vowelCV`: `cv`, bipolar modulation of vowel position.
  - `shiftCV`: `cv`, bipolar modulation of global formant shift.
  - `resCV`: `cv`, bipolar modulation of resonance.
- **Outputs**:
  - `out`: `buffer`, processed audio output.
- **LEDs**:
  - `level`: output peak level with decay.
- **Normalization**:
  - Unpatched `audio` is silence.
  - Unpatched CV inputs are 0 V and do not alter knob settings.
  - No internal carrier, envelope follower, LFO, or stored speech table in the first implementation.

### Vowel Target Table
The app should use four resonant peaks per vowel. F1/F2 are based on common vowel-center ranges in the formant sources; F3/F4 are musical synthesis assumptions inside the cited broad upper-formant ranges.

| Target | F1 Hz | F2 Hz | F3 Hz | F4 Hz | Notes |
|--------|------:|------:|------:|------:|-------|
| A | 1000 | 1400 | 2700 | 3600 | Open, bright, strong F1. |
| E | 500 | 2300 | 3000 | 3800 | Front vowel with high F2. |
| I | 320 | 3200 | 3300 | 4200 | Closed/front, low F1 and very high F2. |
| O | 500 | 1000 | 2600 | 3600 | Rounded/back, low-mid F1/F2. |
| U | 320 | 800 | 2400 | 3500 | Closed/back, low F1/F2. |

Per-band gains should start around `[1.0, 0.8, 0.45, 0.25]` so higher formants add color without dominating. These are implementation assumptions, not hardware measurements.

### Voltage Contract
- `audio` accepts nominal audio-rate +/-5 V. Values outside that range are allowed but are soft-clipped by the drive stage before filtering.
- `vowelCV` is bipolar: -5 V moves the vowel morph one full control range left, +5 V moves it one full range right. Effective vowel position is `clamp(vowel + vowelCV / 5, 0, 1)`.
- `shiftCV` is bipolar: -5 V adds -12 semitones, +5 V adds +12 semitones. Effective shift is the knob shift plus CV, clamped to a total -24..+24 semitone safety range.
- `resCV` is bipolar: -5 V reduces resonance toward broad peaks, +5 V increases resonance toward narrow peaks. Effective resonance is clamped 0..1.
- `out` is audio-rate `buffer`, nominally constrained to +/-5 V with final soft clipping. The final limiter is part of the app contract because parallel resonances can otherwise exceed audio standards.
- LED `level` maps peak absolute output voltage to `peak / 5`, clamped 0..1, with decay between blocks.
- No gate, trigger, clock, pitch-CV, or reset input behavior is present.

## DSP Implementation

### Algorithm Overview
Use a four-band parallel resonator bank:

1. Normalize input from volts to -1..+1 by dividing by 5.
2. Apply `drive` gain and `tanh` soft clipping.
3. Compute effective vowel, shift, and resonance from knobs plus CV.
4. Interpolate between adjacent vowel targets. Interpolate formant frequencies in log-frequency space and gains linearly.
5. Apply global shift as `freq *= 2 ** (semitones / 12)`, then clamp each formant to about 80 Hz..8000 Hz and below Nyquist margin.
6. Process the driven signal through four constant-peak band-pass biquads, one per formant.
7. Sum the four bands with per-band gains, apply wet gain compensation, blend dry/wet, scale back to volts, and soft-limit to +/-5 V.

### Filter Topology
- Prefer W3C/RBJ constant-0-dB-peak band-pass biquad formulas for each formant, implemented in transposed direct form II or another locally established stable form.
- Smooth effective frequency and resonance values with `createSlew()` to prevent zipper noise during knob/CV changes. A 3-10 ms smoothing range is enough for manual motion; do not smooth the audio input.
- Recompute coefficients per sample or when smoothed control values change materially. Four biquads are small enough for per-sample CV in the app.
- Avoid coefficient interpolation between opaque vowel filters. MusicDSP comments document instability and sample-rate sensitivity in that style of implementation.

### Parameter Mapping
- `vowel`: 0..1 maps to continuous position over five targets. Position `p = vowel * 4`; index `floor(p)`, fraction `fract(p)`.
- `resonance`: map 0..1 to Q about 2..18. Suggested curve: `Q = 2 * (18 / 2) ** resonance` before CV clamp, or a similarly exponential mapping.
- `shift`: 0..1 maps to -12..+12 semitones. CV can extend total shift to -24..+24 semitones.
- `drive`: map 0..1 to input gain about 0.75..3.0 before `tanh`. Higher drive should add vowel density without unbounded gain.
- `mix`: 0 is dry input, 1 is formant output.

### Expected Deviations From Hardware
- A-104 has four manual filters and no CV; this app version adds one macro vowel control and CV because the queued module is intended to be morphable.
- A-127 has three filters and built-in LFOs; this app uses four vowel peaks and expects other rack modules to provide LFO/envelope/sequencer modulation.
- A-128 and A-129 use many fixed bands; this app uses four moving formant bands to keep the panel small and musical.
- Hardware can overload analog filter inputs. The app uses explicit drive and final soft limiting for predictable voltage behavior.
- The module is a formant filter, not a vocoder: it does not analyze speech or transfer envelopes from an external voice input.

### Code Notes
- Use the standard audio silence pattern for the `audio` input: keep an owned zero buffer and restore it when routed buffers are removed.
- Reset should clear all biquad states, output, smoothing state, and LED state, without changing params.
- Keep the first implementation declarative unless the generic renderer cannot present five knobs and four jacks cleanly.
- Document the chosen vowel table in a code comment only if it helps future maintainers understand the intentionally approximate source.

## Assumptions and Contradictions
- **Morphable vs. clone**: The best hardware primary source for formant filtering, A-104, has no voltage control. The queue asks for morphable formants, so this spec intentionally follows A-127-style CV control and a vowel macro rather than cloning A-104.
- **Number of filters**: Hardware references range from 3 filters (A-127) to 4 filters (A-104) to 15 filters (A-128/A-129). Four filters are selected because F1-F4 give recognizable vowel color with manageable CPU and panel size.
- **Exact vowel values**: Sources agree on the role of F1/F2 but exact frequencies vary. The table is a musical starting point and should be testable for relative behavior, not treated as a speech-science standard.
- **Stability**: MusicDSP-style high-order coefficient filters can become unstable or level-sensitive during morphing. Parallel biquads are preferred for predictable stability.
- **Output clipping**: Analog modules may produce levels above nominal Eurorack audio. eurorack-js should keep the user-facing output within +/-5 V by default.
- **Reviews**: This pass found stronger official demo/sound-example material than independent written reviews for the exact A-104 formant-filter behavior. The lack of independent review data is not blocking because the implementation is an inspired-by app module and primary specs are sufficient for the panel/DSP contract.

## Test Targets
- Initialization creates params `vowel`, `resonance`, `shift`, `drive`, and `mix`; inputs `audio`, `vowelCV`, `shiftCV`, and `resCV`; output `out`; and LED `level`.
- Default processing with unpatched audio produces silence, finite values, and a low LED.
- A rich input at nominal +/-5 V produces finite output constrained to +/-5 V.
- `mix = 0` returns the dry input path within tolerance; `mix = 1` returns the formant-filtered path; intermediate mix blends both.
- `drive` increases harmonic/saturation density but never produces NaN or output outside +/-5 V.
- `vowel` extremes select A and U target regions; midpoint settings change the spectral balance. A focused test can compare RMS response for sine or multi-sine probes near selected F1/F2 targets.
- `vowelCV` shifts vowel position and clamps at both ends for -5 V and +5 V.
- `shift` and `shiftCV` move formant peaks up/down; a probe sine should pass more strongly when it matches the shifted target frequency than an off-target frequency.
- `resonance` and `resCV` increase selectivity/ringing without instability. Test broad vs. narrow settings with sine or impulse probes.
- LED `level` rises with output and decays after silence.
- `reset()` clears filter state, output buffer, smoothing state, and LED state.
- Runtime update (July 2026): the audio input buffer remains stable and the compiled graph restores its declared 0V normal on disconnection. The earlier cleanup-method plan is superseded.
- Buffer integrity: the full output buffer is written every process call and contains no NaN or Infinity.
- Metadata and UI port names match the research contract.
- No switch, button, gate, trigger, clock, pitch-CV, or reset-input tests are required because the module has none.

## Implementation Plan
- Module ID: `formant`
- Category: `filter`
- Branch/worktree: research-only pass in current isolated workspace `/Users/orderandchaos/code/eurorack-js`; implementation should use a module branch/worktree such as `module/formant` at `../eurorack-js-formant` if coding begins.
- DSP model: four parallel morphable band-pass resonators using log-frequency vowel interpolation, shared resonance/Q, global formant shift, pre-filter drive, dry/wet mix, and final soft limiting.
- Params: `vowel`, `resonance`, `shift`, `drive`, `mix`.
- Inputs: `audio`, `vowelCV`, `shiftCV`, `resCV`.
- Outputs: `out`.
- LEDs: `level`.
- Factory patch: add `src/js/config/patches/test-formant.js` when implementing. Suggested patch: VCO saw or pulse into `formant.audio`, LFO into `formant.vowelCV`, `formant.out` to `out`, optionally with `scope` or `spectrum` for visual confirmation.
- Focused tests: `npm test -- tests/dsp/formant.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Factory patch tests if added: `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Full validation command: `npm test`
- Shared framework changes: none expected.
- Known assumptions: approximate vowel table, no speech analysis/vocoder behavior, no internal LFO, no manual per-formant editing, final output constrained to +/-5 V.

## Potential Improvements
- Add a custom vowel-pad UI later, with one axis for A/E/I/O/U morphing and another for formant shift or brightness.
- Add a second output for wet-only or formant-energy CV if patch feedback needs it.
- Add a "manual" mode with per-formant frequency/level editing if the generic vowel macro proves too restrictive.
- Add optional noise/carrier excitation only as a separate voice module; keep this module a filter.
- Add a more carefully sourced speaker table set if speech-science accuracy becomes a product goal.

## Sources
- [Doepfer A-104 Trautonium Formant Filter](https://www.doepfer.de/a104.htm) - Doepfer, official product page, accessed 2026-07-09, supports: four parallel resonant filters, LP/off/BP switching, per-filter frequency/resonance/level, no voltage control, 50 Hz..5 kHz range, sensitive inputs, Trautonium/vocal-like effects, 20 HP.
- [Doepfer A-104 English manual PDF](https://www.doepfer.de/a100_man/A104_man.pdf) - Doepfer, PDF metadata shows 2003-era manual material, accessed 2026-07-09, supports: primary manual source for A-104; direct text extraction was not needed because the official product page contains the relevant English spec.
- [Doepfer A-127 VC Triple Resonance Filter](https://www.doepfer.de/a127.htm) - Doepfer, official product page, accessed 2026-07-09, supports: three voltage-controlled band-pass filters, internal triangle LFO or external CV per filter, resonance/amplitude/frequency controls, 40 Hz..6 kHz range, speech-like/vocoder-like use, tutorial and sound-example links.
- [Doepfer A-128 Fixed Filter Bank](https://www.doepfer.de/a128.htm) - Doepfer, official product page, accessed 2026-07-09, supports: 15 parallel fixed band-pass filters, fixed center frequencies, half-octave bandwidth, per-band amplitude controls, filter-bank context.
- [Doepfer A-129 Vocoder Subsystem](https://www.doepfer.de/a129e.htm) - Doepfer, official English product/context page, accessed 2026-07-09, supports: vocoder source/filter explanation, parallel filter/envelope/VCA architecture, 15-band filter-bank context, saw/polyphonic/noise carrier sound-example notes, CV manipulation context.
- [Formant](https://en.wikipedia.org/wiki/Formant) - Wikipedia contributors, secondary overview, accessed 2026-07-09, supports: broad formant definition, F1/F2 role in vowel identity, average formant ranges, source-filter context; used only as secondary conceptual support.
- [Formant](https://de.wikipedia.org/wiki/Formant) - Wikipedia contributors, secondary overview in German, accessed 2026-07-09, supports: practical F1/F2 vowel-center table and broad F3/F4 range notes; used as a secondary source for approximate musical vowel targets.
- [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/) - W3C Audio Working Group Note edited by Raymond Toy, adapted from Robert Bristow-Johnson, 2021-06-08, accessed 2026-07-09, supports: digital biquad transfer function, direct-form equation, constant-peak band-pass formulas, Q/bandwidth relationships.
- [STK `FormSwep.h`](https://raw.githubusercontent.com/thestk/stk/master/include/FormSwep.h) and [`FormSwep.cpp`](https://raw.githubusercontent.com/thestk/stk/master/src/FormSwep.cpp) - Perry R. Cook and Gary P. Scavone, STK source, 1995-2023 header notes, accessed 2026-07-09, supports: sweepable formant resonator design, pole-radius stability concerns, smooth target-frequency/radius/gain changes.
- [MusicDSP Formant filter](https://www.musicdsp.org/en/latest/Filters/110-formant-filter.html) - Alex, MusicDSP community code example, created 2002-08-02, accessed 2026-07-09, supports: five-vowel formant-filter implementation precedent, rich-input recommendation, community-reported morphing/distortion/stability issues.
- [Dennis H. Klatt, "Software for a cascade/parallel formant synthesizer"](https://doi.org/10.1121/1.383940) - Journal of the Acoustical Society of America, 1980, DOI resolved to AIP page but browser access was blocked by Cloudflare on 2026-07-09, supports: historical cascade/parallel formant synthesis context only; not used for exact coefficients.
- [src/js/modules/vcf/index.js](../../src/js/modules/vcf/index.js) - eurorack-js local implementation, accessed 2026-07-09, supports: existing filter module conventions, per-sample CV treatment, `createSlew()` use, soft limiting/normalization considerations.
- [src/js/modules/mix/index.js](../../src/js/modules/mix/index.js) - eurorack-js local implementation, accessed 2026-07-09, supports: DC-coupled buffer conventions, LED peak/decay pattern, disconnected input clearing.
- [src/js/utils/slew.js](../../src/js/utils/slew.js) - eurorack-js local utility, accessed 2026-07-09, supports: app-standard RC smoothing helper for parameter/CV changes.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/formant.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
