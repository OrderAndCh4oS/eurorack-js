# Pitch Tracker (`pitch-track`)

## Status and Model

- **Research status:** implemented and validated against the coordinator-
  approved specification on 31 July 2026.
- **Module ID:** `pitch-track`.
- **Name:** `PITCH TRACK`.
- **Category:** `utility`.
- **Panel width:** 6 HP.
- **Color:** `module-color-twelve`.
- **Model:** an inspired-by, monophonic software frequency-to-voltage utility,
  not a component-level emulation of one hardware tracker.
- **Primary job:** estimate the fundamental frequency of a monophonic audio
  input, express that estimate as continuous 1 V/octave CV, and assert a gate
  only while the estimate is qualified by both signal level and YIN
  periodicity.

The first version deliberately chooses a small, deterministic contract. It has
one audio input, a held pitch output, a validity gate, level and smoothing
controls, and Fast/Low range selection. It has no quantizer, envelope output,
trigger extractor, audio-through path, gain stage, polyphonic note separator,
MIDI conversion, learned model, or custom display.

## Queue Fit and Distinctness

The queue asks for “monophonic audio-to-1 V/oct tracking with a confidence or
gate output.” No existing module owns that conversion:

- [`envf`](../../src/js/modules/envf/index.js) follows **amplitude**. Its
  envelope and inverse-envelope outputs say how loud the input is, not which
  fundamental frequency produced it. `pitch-track` uses a private level
  envelope only to qualify tracking and does not expose an envelope CV.
- [`quant`](../../src/js/modules/quant/index.js) corrects an **existing pitch
  CV** to selected scale degrees. It does not inspect audio. `pitch-track`
  deliberately emits continuous, unquantized 1 V/oct CV so bends, slides, and
  vibrato survive; patching its Pitch output into Quant is the explicit pitch
  correction workflow.
- [`scope`](../../src/js/modules/scope/index.js) has a Tune display that
  averages positive-going zero crossings. That browser-facing measurement is
  not a routable output and has no fundamental-frequency confidence or lock
  contract. `pitch-track` uses YIN rather than importing the display shortcut,
  which is especially vulnerable to harmonics and multiple crossings.
- [`midi-cv`](../../src/js/modules/midi-cv/index.js) establishes the local
  absolute pitch convention, but its source is MIDI note data rather than
  audio.

This separation is normative. Future implementation must not add ENVF-style
envelope output or Quant-style scale snapping under the same module ID.

## Research Questions and Answers

1. **What is the pitch reference?** `0 V = C4 = 261.6255653005986 Hz`, matching
   this app's MIDI-CV convention. Pitch is
   `log2(frequency / 261.6255653005986)` volts.
2. **Should unlocked pitch fall to zero?** No. The Pitch output holds the last
   accepted target, initially 0 V, while Gate reports whether that value is
   current. This follows the musically useful held-output precedent in the
   Analogue Systems RS-35 and prevents downstream oscillators plunging when an
   input note decays.
3. **Should the output be chromatically quantized?** No. Slides and vibrato are
   part of pitch tracking. The existing Quant module is the explicit optional
   correction stage.
4. **Why YIN rather than zero crossings?** YIN's normalized difference
   function supplies a bounded periodicity decision and rejects many
   harmonic/octave ambiguities that defeat raw zero crossings. It also has a
   clear, reproducible threshold and interpolation procedure.
5. **Why not probabilistic YIN or a neural model?** pYIN improves candidate
   trajectories through probabilities and an HMM, but adds state, latency,
   and tuning policy. A model-based detector adds assets and opaque CPU cost.
   Neither is needed for this bounded, deterministic first version.
6. **How low should it track?** Fast covers E2–C7 with a 512-sample analysis
   frame; Low extends to E1 with a 1024-sample frame. This makes the lower-note
   latency cost visible instead of pretending one setting can be equally fast
   and robust everywhere.
7. **What makes Gate high?** The input-level hysteresis must be open and the
   latest completed YIN job must produce an in-range first threshold minimum.
   One above-threshold invalid analysis result is tolerated; two consecutive
   invalid results clear lock. Falling below the level-close threshold clears
   it immediately.
8. **How is audio-thread work bounded?** Analysis is decimated to approximately
   16 kHz after two fixed low-pass sections. Direct YIN lag rows are distributed
   across the 128-sample analysis hop. The largest supported job is 397 lags
   by 627 comparisons, and no analysis tick evaluates more than four lag rows.
9. **What is promised for chords?** Nothing beyond finite, rail-safe output.
   The contract is monophonic. A chord may fail, select a component, or select
   a common subharmonic, as the Tailgater documentation warns.
10. **What does the level control do?** It sets an explicit input-amplitude
    qualification threshold from 0.01 V to 1 V. It is not an audio gain or
    preamp and does not alter the samples sent to YIN.

## Source Register

Live web sources were checked on 31 July 2026. First-party manuals support
panel behavior and electrical precedent; papers support algorithms; demos and
reviews support observed playing behavior. Values invented for this app are
identified as local decisions rather than attributed to hardware.

### Pitch-estimation papers and implementations

1. **“YIN, a fundamental frequency estimator for speech and music,” Alain de
   Cheveigné and Hideki Kawahara, *Journal of the Acoustical Society of
   America* 111(4), April 2002, pp. 1917–1930.**
   [DOI record](https://doi.org/10.1121/1.1458024),
   [PubMed record](https://pubmed.ncbi.nlm.nih.gov/12002874/), and
   [author-hosted paper copy](https://iro.umontreal.ca/~pift6080/H09/documents/papers/yin_pitch_tracker.pdf)
   — Primary algorithm source for the difference function, cumulative-mean
   normalized difference function, absolute threshold, first acceptable
   minimum, parabolic interpolation, and an aperiodicity measure. The authors
   present YIN as a simple, low-error autocorrelation-derived estimator with
   few tuning parameters.
2. **“YIN Pitch Tracking,” Dan Ellis / Columbia University LabROSA,
   implementation notes accessed 31 July 2026.**
   [LabROSA documentation](https://www.ee.columbia.edu/~dpwe/LabROSA/doc/yin.html)
   — Practical reference for how lower minimum frequencies require more time
   and memory, and how hop size, downsampling, precision, and the absolute
   threshold trade reliability against speed. It also documents the different
   harmonic and subharmonic error directions encouraged by threshold changes.
3. **“A Comparative Performance Study of Several Pitch Detection
   Algorithms,” Lawrence R. Rabiner, Michael J. Cheng, Aaron E. Rosenberg, and
   Carol A. McGonegal, *IEEE Transactions on Acoustics, Speech, and Signal
   Processing* 24(5), October 1976, pp. 399–418.**
   [DOI](https://doi.org/10.1109/TASSP.1976.1162846) and
   [author-hosted scan](https://web.ece.ucsb.edu/Faculty/Rabiner/ece259/Reprints/107_comparative%20pitch%20detectors.pdf)
   — Historical primary comparison of pitch detectors and their error modes.
   It supports treating performance as signal- and application-dependent
   rather than claiming one universal accuracy number.
4. **“A Smarter Way to Find Pitch,” Philip McLeod and Geoff Wyvill,
   Proceedings of ICMC 2005.**
   [Persistent proceedings record and paper](http://hdl.handle.net/2027/spo.bbp2372.2005.107)
   — Primary musical-pitch reference for the normalized square difference
   function, peak clarity, parabolic refinement, and real-time monophonic
   operation. MPM is a credible alternative, but YIN's first-threshold-minimum
   rule gives this module the smaller closed contract.
5. **“pYIN: A Fundamental Frequency Estimator Using Probabilistic Threshold
   Distributions,” Matthias Mauch and Simon Dixon, ICASSP 2014.**
   [Author-hosted paper](https://www.eecs.qmul.ac.uk/~simond/pub/2014/MauchDixon-PYIN-ICASSP2014.pdf)
   and [DOI](https://doi.org/10.1109/ICASSP.2014.6853678) — Primary source for
   deriving multiple YIN candidates, assigning probabilities, and smoothing a
   pitch path with a hidden Markov model. It is reviewed but explicitly not
   adopted in version one.
6. **aubio, Paul Brossier and contributors, open-source audio analysis library,
   source repository accessed 31 July 2026.**
   [Official repository](https://github.com/aubio/aubio) and
   [aubio 0.4.6 release note](https://aubio.org/news/20171004-1345_0.4.6.html)
   — Practical implementation reference for frame-based pitch methods. The
   release note documents `yinfast`, which obtains YIN results through spectral
   convolution in O(N log N). aubio is GPL-licensed and is a study reference,
   not code to copy.
7. **Audio EQ Cookbook, Robert Bristow-Johnson, W3C Working Group Note, 8 June
   2021.**
   [W3C note](https://www.w3.org/TR/audio-eq-cookbook/) — Normative-quality
   coefficient reference for the two analysis-only low-pass biquads.
8. **Web Audio API, W3C Recommendation, 17 June 2021.**
   [Specification](https://www.w3.org/TR/webaudio-1.0/) — Primary browser-audio
   context for render-quantum execution and real-time processing constraints.
   The module remains independent of DOM and main-thread Web Audio objects.

### Primary hardware and manual sources

9. **RS-35 External Processor manual, Analogue Systems, undated product-era
   manual accessed 31 July 2026.**
   [Official manual PDF](https://www.analoguesystems.co.uk/images/AS_manuals/RS35.pdf)
   and [current official product page](https://www.analoguesystems.co.uk/index.php/as-modules/rs-35-processor)
   — Primary source for monophonic input guidance, preprocessing with a
   band-pass filter, ±10 V input tolerance, separate raw and held F/V outputs,
   -4 V to +3 V pitch span, selectable 20 Hz–1.2 kHz and 100 Hz–10 kHz ranges,
   stated range-dependent accuracy, adjustable slew, envelope following, and
   trigger extraction. It is the strongest held-pitch hardware precedent.
10. **disting mk4 User Manual, firmware 4.7, Expert Sleepers.**
    [Official manual PDF](https://www.expert-sleepers.co.uk/downloads/manuals/disting_user_manual_4.7.pdf)
    — Primary source for the B-3 Pitch/Envelope Tracker algorithm, tracking
    down to approximately 27 Hz, separate 1 V/oct pitch and envelope outputs,
    envelope slew, and an explicit hardware reference of 0 V = C3. The manual
    also documents an envelope-zero indication when tracking fails.
11. **Tailgater User Guide, Noise Lab, current guide accessed 31 July 2026.**
    [Official manual PDF](https://www.noiselab.se/manuals/assets/files/TAILGATER_GUIDE.pdf)
    — Primary source for monophonic guitar/bass tracking, approximately 10 Vpp
    Eurorack audio expectations, nearly seven octaves of CV, 0–5 V gate and
    trigger outputs, sensitivity/threshold behavior, and the practical facts
    that low notes take longer, chords are unpredictable, upper harmonics can
    cause jitter or octave errors, and compression can worsen octave-up errors.
12. **ConVertor E1 product page and Quick Guide, Sonicsmith, current revisions
    accessed 31 July 2026.**
    [Official product page](https://www.sonicsmith.com/products/convertor-e1)
    and
    [official Quick Guide](https://cdn.shopify.com/s/files/1/0894/6706/0539/files/ConVertor_E1_Quick_Guide_A4_1-0.pdf?v=1732140616)
    — Primary source for pitch, envelope, and gate extraction; adjustable gate
    thresholds; Fast, Medium, and Sticky tracking choices; and advice that
    bright/noisy/harmonically dense inputs may need slower tracking or reduced
    treble. The product page's proprietary “sub-1 ms” detection claim is noted
    but is not used as this module's benchmark.

### Independent demonstrations and reviews

13. **“Using A Guitar To Play A Modular Synthesiser,” Synthtopia, 22 November
    2008.**
    [Independent demonstration article](https://www.synthtopia.com/content/2008/11/22/using-a-guitar-to-play-a-modular-synthesiser/)
    — Demonstrates a guitar feeding a compressor and RS-110 low-pass filter
    before the RS-35. It independently supports the importance of source
    conditioning and reduced upper-harmonic content.
14. **“Behringer Perfect Pitch PP1, Audio zu MIDI, USB, CV, Eurorack,”
    Amazona.de, 20 September 2023.**
    [Independent hands-on review](https://www.amazona.de/test-behringer-perfect-pitch-pp1-audio-zu-midi-usb-cv-eurorack/)
    — Reports apparently fast response but highly source- and technique-
    dependent results: one guitar tracked where another did not, slides could
    follow, slower passages worked better, fast/staccato passages were less
    reliable, and high-register octave calibration caused trouble. It is
    useful counter-evidence to specification-sheet latency claims.
15. **“MIDI Guitar Workshop,” Sound On Sound, 1990s archive, accessed 31 July
    2026.**
    [Independent technique article](https://www.soundonsound.com/techniques/midi-guitar-workshop)
    — Explains the physical need to observe enough of a vibration, the greater
    delay of lower notes, and the importance of clean technique, especially
    for fast lower-string passages.
16. **“Guitar Synthesizers,” Gordon Reid, Sound On Sound retrospective,
    accessed 31 July 2026.**
    [Independent historical article](https://www.soundonsound.com/sound-advice/guitar-synthesizers)
    — Describes early guitar-synth tracking glitches and the use of slower
    attacks to mask response delay. It supports presenting latency and error
    as interaction constraints, not merely implementation defects.

### Historical context

17. **“Strings and Synths: A History of Roland and BOSS Guitar Synthesizers,”
    BOSS/Roland, accessed 31 July 2026.**
    [Manufacturer history](https://articles.boss.info/strings-and-synths-a-history-of-roland-and-boss-guitar-synthesizers/)
    — First-party historical context for the GR-500 in 1977, subsequent
    tracking improvements, divided-pickup systems, and the long-running effort
    to convert instrument performance into synthesis control. It does not
    imply that this general-audio module emulates a Roland product.

### Local integration sources

18. **Eurorack JS ENVF, Quant, Scope, and MIDI-CV contracts, revision inspected
    31 July 2026.**
    [`envf`](../../src/js/modules/envf/index.js),
    [`quant`](../../src/js/modules/quant/index.js),
    [`scope`](../../src/js/modules/scope/index.js), and
    [`midi-cv`](../../src/js/modules/midi-cv/index.js) — Authoritative local
    evidence for module distinctness, stable-buffer practice, scope Tune's
    zero-crossing limitation, and the app's `0 V = C4` pitch reference.
19. **Eurorack JS oscillator, VCA, slew, and FFT utilities, revision inspected
    31 July 2026.**
    [`vco`](../../src/js/modules/vco/index.js),
    [`vca`](../../src/js/modules/vca/index.js),
    [`createSlew`](../../src/js/utils/slew.js), and
    [`createRealFft`](../../src/js/utils/fft.js) — Local references for the
    factory patch, one-pole smoothing, and implementation scope. The current
    FFT utility returns windowed magnitude spectra rather than a reusable
    complex/inverse transform, so an FFT-YIN implementation would require a
    shared-framework expansion that direct incremental YIN avoids.

## Source Quality, Contradictions, and Decisions

- The YIN paper is the primary authority for the estimator. LabROSA and aubio
  are implementation references; neither overrides the paper's core method.
- RS-35, disting, Tailgater, and ConVertor are first-party sources, but their
  electrical standards and proprietary algorithms are not mutually
  interchangeable. Their panel patterns establish useful precedents rather
  than one composite hardware specification.
- Hardware pitch references conflict. disting documents `0 V = C3`; the RS-35
  uses its own range/calibration framing. This app already defines `0 V = C4`
  through MIDI-CV, so the local convention wins and is stated numerically.
- Tailgater's Gate and Trigger are 0–5 V, while this app's gate standard is
  0/10 V. `pitch-track` follows the app standard and does not claim electrical
  identity with Tailgater.
- Hardware spans are much wider than a single algorithmic sweet spot: RS-35
  documents 20 Hz–10 kHz across two ranges, disting reaches roughly 27 Hz,
  and Tailgater advertises nearly seven octaves. The app chooses E1–C7 so a
  1024-sample maximum window and a 16 kHz-ish analysis rate have explicit CPU
  and latency bounds.
- Sonicsmith's sub-1 ms claim belongs to a proprietary commercial system and
  may describe a different stage of detection. The physical and independent
  sources agree that lower-frequency certainty takes longer. This open design
  publishes its own frame-derived 32–80 ms startup bounds instead of treating
  the marketing number as comparable.
- RS-35 exposes raw and held frequency CV. The first version exposes only the
  held form plus a validity gate because an unlocked falling voltage is less
  useful in this app and would add a second pitch-output semantic.
- RS-35, disting, Tailgater, and ConVertor combine pitch with envelope and/or
  trigger extraction. The app already has ENVF, so repeating that output would
  blur ownership. A binary lock gate is retained because it directly qualifies
  the held Pitch value.
- Tailgater includes optional chromatic quantization; `pitch-track` excludes it
  because Quant already owns scale correction and continuous pitch motion is
  useful.
- Manufacturer material and independent reports agree that source purity,
  playing technique, level, harmonic balance, and register matter. Therefore
  the tests use controlled monophonic signals and do not promise universal
  instrument accuracy.
- The two cascaded low-pass sections are a local anti-aliasing and harmonic-
  reduction decision informed by the RS-35/Synthtopia preprocessing evidence.
  They are not described as an emulation of either cited filter.
- The 0.15 YIN threshold, level mapping, hysteresis ratios, one-frame invalid
  grace, exact ranges, and smoothing times are local, testable design choices.
  No hardware source is claimed for those exact values.

## Observed Musical and Interaction Behavior

- Monophonic, stable, fundamental-rich sources are the reliable case. Pure
  waveforms, a clean oscillator, a single vocal line, or a carefully played
  single-note instrument are appropriate inputs.
- Filtering upper harmonics before detection can reduce octave-up errors. The
  internal analysis filter supplies a conservative baseline, while external
  filtering remains useful for especially bright or noisy sources.
- Lower notes necessarily require longer observation. The Low switch is
  therefore a conscious latency-for-range trade rather than a hidden quality
  mode.
- A held pitch plus a lock gate is more patchable than forcing Pitch to a
  sentinel voltage. The gate can close a destination VCA while the oscillator
  remains tuned to the last reliable value.
- Continuous, unquantized CV follows glides and vibrato. Quant can be inserted
  afterward when discrete scale notes are desired.
- Chords, distortion, pick noise, breath noise, fast staccato, and a weak
  fundamental can produce rejection, octave errors, or component selection.
  Raising Level can suppress noise but does not repair ambiguity; changing
  range or externally filtering the input may help.
- Smoothing trades response for stability. Zero milliseconds preserves the
  estimator's step timing; larger values reduce visible/audible CV jitter but
  lag slides.

## Closed Functional Specification

### Metadata and declarative UI

The module is declarative and has no custom renderer, worklet telemetry,
runtime events, browser services, or patch-persisted non-control state.

| Kind | ID / param | Label | Contract |
| --- | --- | --- | --- |
| Knob | `level` | `LEVEL` | 0..1, default 0.5; logarithmic qualification threshold described below. |
| Knob | `smooth` | `SMOOTH` | 0..250 ms, default 15 ms. |
| Switch | `range` | `RANGE` | positions `FAST`, `LOW`; values 0 and 1; default 0. |
| Input | `audio` | `IN` | port `audio`, signal `audio`, -5..+5 V, normal 0 V. |
| Output | `pitch` | `PITCH` | port `pitch`, signal `cv`, -8/3..+3 V. |
| Output | `gate` | `GATE` | port `gate`, signal `gate`, exactly 0 or 10 V. |
| LED | `signal` | signal-present | Continuous 0..1 brightness from the private level envelope. |
| LED | `lock` | pitch-valid | Binary 0/1 mirror of Gate low/high. |

Control labels are compact panel labels; parameter and port IDs above are the
patch contract. The two LEDs sit near the input and outputs respectively.

### Input sanitation and signal-level qualification

1. Each input sample is converted to a finite number; non-finite values become
   0 V. The analysis sample is then clamped to the declared -5..+5 V input
   range.
2. A private absolute-value envelope follows the sanitized raw input with a
   1 ms attack and 20 ms release. For a time constant `t`, its per-sample
   coefficient is `1 - exp(-1 / (sampleRate * t))`; the attack coefficient is
   selected when absolute input exceeds the envelope, otherwise release.
3. Level maps to an opening threshold in volts:

   ```text
   levelThreshold = 0.01 * 100^clamp(level, 0, 1)
   ```

   The endpoints are 0.01 V and 1 V; the default 0.5 is 0.1 V.
4. The level state opens when the envelope is greater than or equal to the
   current threshold. It closes when the envelope is strictly below 70% of
   that threshold. This hysteresis state is recalculated as Level moves.
5. On opening, capture begins with an empty analysis history. On closing, Gate
   and Lock clear immediately, any analysis job is cancelled, and the analysis
   ring is cleared. Pitch retains its last target and output.
6. Signal LED brightness is
   `clamp(envelope / (2 * levelThreshold), 0, 1)`. It is 0.5 at the opening
   threshold and does not imply a valid pitch.
7. Level changes qualification only. There is no input gain, compression,
   limiting beyond the declared rail, or audio output.

### Analysis ranges and pitch mapping

Constants are exact double-precision values in implementation:

```text
C4_REFERENCE_HZ = 261.6255653005986
FAST_MIN_HZ     = 82.4068892282175       // E2
LOW_MIN_HZ      = 41.20344461410875      // E1
MAX_HZ          = 2093.004522404789      // C7
BOUND_MARGIN    = 0.02                    // estimator search only
```

- Fast uses a 512-sample analysis frame and accepts nominal E2 through C7.
- Low uses a 1024-sample frame and accepts nominal E1 through C7.
- Lag search extends 2% beyond the selected nominal frequency endpoints so
  interpolation and sample-rate rounding do not reject a note exactly on a
  boundary. An accepted estimate is clamped back to the nominal range before
  conversion.
- Accepted Pitch target is
  `clamp(log2(frequency / C4_REFERENCE_HZ), minimumPitch, 3)` volts, where
  minimumPitch is -5/3 V in Fast and -8/3 V in Low.
- Useful exact points are E1 = -8/3 V, E2 = -5/3 V, A2 = -1.25 V,
  C4 = 0 V, A4 = 0.75 V, C6 = 2 V, and C7 = 3 V.
- The physical output contract is -8/3..+3 V across both modes. Fast never
  creates a new target below -5/3 V, but a previously accepted Low target may
  remain held after switching to Fast until a new Fast estimate is accepted.
- Pitch is continuous. No semitone rounding, scale memory, hysteretic note
  selection, or dead band is applied.

### Analysis preprocessing and decimation

1. Analysis uses two cascaded second-order low-pass biquads. Each section has
   cutoff 3000 Hz and `Q = 1 / sqrt(2)`, with coefficients calculated once at
   `createDSP()` from the Audio EQ Cookbook formulas. State uses transposed
   direct form II. This is analysis-only; there is no audio output.
2. The sections are intentionally described as two Butterworth-Q sections,
   not as one exact fourth-order Butterworth alignment. Their job is to reduce
   upper harmonics and aliases before decimation, not model an audible filter.
3. Decimation factor is `max(1, round(sampleRate / 16000))`. The exact analysis
   rate is `sampleRate / decimationFactor`: 14.7 kHz at 44.1 kHz input and
   16 kHz at 48 or 96 kHz input.
4. Every decimation-factor-th filtered sample is written into a preallocated
   1024-element circular `Float64Array`. Filter and decimation phase persist
   between calls to `process()`.
5. While the level state is closed, filtering and the level envelope continue,
   but samples are not accumulated into a pitch frame. Opening starts a fresh
   frame, making acquisition latency relative to that threshold crossing
   deterministic.

### Direct YIN estimator

For the active frame length `N`, analysis hop `H = 128`, analysis rate `R`,
selected minimum frequency `fMin`, and maximum `fMax`:

```text
minLag = max(2, floor(R / (fMax * 1.02)))
maxLag = min(N - 2, ceil(R / (fMin * 0.98)))
comparisonLength = N - maxLag
difference[tau] = sum(j = 0 .. comparisonLength - 1)
                  (frame[j] - frame[j + tau])^2
```

When a fresh frame is available:

1. Copy the newest `N` ring samples, oldest first, into a preallocated immutable
   frame scratch buffer. The largest one-time copy is exactly 1024 values.
2. Compute difference rows for lags 1 through `maxLag`. Row work is spread over
   later decimated samples, with
   `lagsPerAnalysisSample = ceil(maxLag / H)`. There is only one active job,
   and these bounds guarantee completion before the next frame hop.
3. After all rows are complete, calculate cumulative-mean normalized
   difference values in one bounded scan:

   ```text
   cmndf[0] = 1
   running += difference[tau]
   cmndf[tau] = running > 0 ? difference[tau] * tau / running : 1
   ```

4. Search upward from `minLag` for the first `cmndf[tau] < 0.15`. Continue
   downhill while the following lag has a lower value, choosing that local
   minimum. Search stops early enough that both interpolation neighbors exist.
5. If no threshold minimum exists, the result is invalid. There is no global-
   minimum fallback, no last-candidate substitution, and no random choice.
6. Refine the selected lag with a three-point parabolic interpolation of its
   CMNDF neighbors. Clamp the fractional offset to -0.5..+0.5 samples and
   reject non-finite or non-positive refined lags.
7. Estimated frequency is `R / refinedLag`. It is valid only within the
   margin-expanded active range; it is then clamped to the nominal range and
   converted to Pitch target.
8. Empty or constant frames have zero difference sums and are invalid by the
   explicit `running > 0` rule.

The fixed 0.15 threshold is the only periodicity threshold in version one. No
confidence control or hidden source-type heuristic changes it.

### Lock, Gate, held pitch, and smoothing

- A completed valid estimate while level state is open updates the raw Pitch
  target, clears the invalid-result count, sets Lock to 1, and Gate to 10 V.
- A completed invalid estimate while level remains open increments a saturating
  invalid-result count. The first consecutive invalid result retains Lock and
  Gate; the second clears both. Pitch target remains held.
- Level closing always clears Lock and Gate immediately, regardless of invalid
  count. It also resets that count.
- Gate opens only when the first accepted estimate completes. The raw amplitude
  onset alone can never open Gate.
- Gate contains no trigger pulse and no release tail. Every sample is exactly
  0 or 10 V. Lock LED is exactly 0 or 1 on the corresponding sample.
- Smooth is the one-pole RC time constant used by the existing
  `createSlew()` utility. At 0 ms Pitch output takes the new accepted target
  immediately. Above 0 ms it approaches the target continuously; at 15 ms it
  covers approximately 63.2% of a step in 15 ms and 95% in about 45 ms.
- Smoothing affects Pitch only, never candidate acceptance or Gate timing.
  While unlocked, Pitch continues moving toward the last accepted target if a
  prior smoothing transition has not finished.
- Before any accepted estimate, both the target and Pitch output are 0 V.

### Range changes, lifecycle, and state

- A change in the integer-normalized Range value cancels any active job,
  clears the ring and fill count, clears invalid history, and sets Lock/Gate
  low. Filter and level-envelope state may continue because cutoff and level
  semantics do not change.
- A range change retains the last Pitch target and current smoothed Pitch
  output. A new estimate in the new range is required to reopen Gate.
- `reset()` clears both output buffers in place, all input buffers in place,
  filter delay state, decimation phase, ring and frame data, difference data,
  envelope and level-hysteresis state, analysis job state, invalid count,
  slew state, held target, both LEDs, and range-change bookkeeping. The reset
  output state is Pitch 0 V and Gate 0 V.
- Input and output `Float32Array` identities never change. Frame, ring, and
  difference scratch arrays are allocated once by `createDSP()` and reused.
- Parameters are finite-clamped at use. Non-finite Level becomes its default
  0.5, Smooth becomes 15 ms, and Range becomes Fast.
- Two fresh DSP instances with the same sample rate, buffer size, parameters,
  input samples, and lifecycle calls must produce sample-identical outputs and
  LEDs. `Math.random()` is forbidden.

### Latency and computational budgets

Latency is stated from the sample at which level hysteresis opens. A real
instrument can take longer because it may not immediately produce a qualifying
periodic frame.

| Input rate | Analysis rate | Mode | Window | Hop | Max lag rows/tick | Pure-tone first-result ceiling |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 44.1 kHz | 14.7 kHz | Fast | 34.83 ms | 8.71 ms | 2 | 43 ms |
| 44.1 kHz | 14.7 kHz | Low | 69.66 ms | 8.71 ms | 3 | 80 ms |
| 48 kHz | 16 kHz | Fast | 32.00 ms | 8.00 ms | 2 | 41 ms |
| 48 kHz | 16 kHz | Low | 64.00 ms | 8.00 ms | 4 | 73 ms |
| 96 kHz | 16 kHz | Fast | 32.00 ms | 8.00 ms | 2 | 41 ms |
| 96 kHz | 16 kHz | Low | 64.00 ms | 8.00 ms | 4 | 73 ms |

The ceilings include one full frame, the distributed lag-job duration, and a
small deterministic allowance for filter/start indexing. They exclude Pitch
slew because Gate timing is independent of Smooth.

At 48/96 kHz in Low mode, the worst job has `maxLag = 397`,
`comparisonLength = 627`, and 248,919 sample-pair evaluations per result.
At 125 results/second this is 31,114,875 pair evaluations/second. The scheduler
performs at most four rows, or 2,508 pair evaluations, on one decimated sample,
followed once per job by no more than 397 CMNDF/search iterations. Fast's
48/96 kHz job is 199 by 313, or 62,287 pair evaluations per result and at most
626 per decimated sample. The 44.1 kHz cases are smaller per second.

These are operation ceilings, not browser performance claims. Implementation
must preserve them, preallocate all analysis memory, perform no logging, and
create no promises, closures, arrays, objects, FFT plans, or typed arrays in
`process()`.

### Explicit non-goals and unsupported inputs

- Polyphonic pitch separation, chord naming, and “best note” selection.
- MIDI note or event output.
- Chromatic/scale quantization or note hysteresis.
- Envelope CV, onset trigger, audio-through, preamp, compressor, or user filter.
- A raw/unheld F/V output.
- Formant correction, octave correction based on instrument profiles, pitch
  shifting, or resynthesis.
- DOM, Web Audio node, file, network, service, telemetry, or worklet-event use.
- Guaranteed accuracy for chords, percussion, noise, whispered/unpitched vocal
  sounds, distorted sources, or signals outside the selected range.

## Voltage Contract

| Endpoint | Signal | Range / threshold | Disconnected behavior |
| --- | --- | --- | --- |
| `audio` input | audio | Declared -5..+5 V; finite-clamped before analysis. Level opens at 0.01..1 V envelope according to Level and closes below 70% of it. | Stable input buffer restored to 0 V normal. Capture remains closed. |
| `pitch` output | CV | -8/3..+3 V overall, `log2(f/C4)` at accepted frequencies; held when invalid. | Remains a valid output owned by the module; initially 0 V. |
| `gate` output | gate | Exactly 0 V unlocked or 10 V locked. | Remains 0 V until a qualified estimate. |

This module consumes no pitch CV, gate, trigger, or clock. It emits no audio.
The pitch formula is the app's 1 V/oct convention, not a claim about the
calibration reference of the cited hardware.

## DSP Model and Trade-offs

### Chosen model: direct, decimated, incremental YIN

The implementation is a faithful application of YIN's central method within a
software-utility panel, not a faithful emulation of a named module. Direct YIN
was selected because it provides:

- an explicit periodicity measure and first-threshold-minimum rule;
- better fundamental handling than the local zero-crossing display shortcut;
- bounded memory and deterministic results;
- frame sizes sufficient for E1 while remaining practical after decimation;
- a calculation that can be spread across render work without hidden thread,
  model, or allocation behavior.

The cost is O(number of lags × comparison length). Distributing lag rows over
the hop avoids a single large quadratic spike, while analysis decimation keeps
the documented worst case near 31.1 million simple pair evaluations/second.

### Alternatives reviewed

- **Zero crossings:** much cheaper and already useful for Scope's display, but
  prone to harmonic multiple-crossings, DC/noise crossings, and octave errors.
  Rejected for a routable pitch contract.
- **Autocorrelation:** historically established and workable. YIN's difference
  normalization and thresholded local-minimum rule better expose a comparable
  confidence decision without amplitude normalization heuristics.
- **MPM/NSDF:** credible and designed for musical pitch, with peak clarity.
  Rejected only to keep one candidate-selection contract; it remains the best
  documented alternative if YIN testing exposes persistent octave errors.
- **FFT-accelerated YIN:** aubio demonstrates the performance advantage, but
  the repo's shared FFT helper exposes magnitude only. Adding complex inverse
  transforms would be a framework change, increase validation surface, and is
  unnecessary for the bounded v1 range. Direct YIN keeps implementation local.
- **pYIN/HMM:** can stabilize trajectories and voicing decisions, but adds
  multiple candidates, transition probabilities, state, and potentially
  lookahead. Rejected for deterministic low-state v1 behavior.
- **Neural pitch models:** can be robust on trained source classes but require
  weights, inference code, provenance/licensing review, and CPU benchmarking.
  Rejected as disproportionate and less transparent.

### Expected audible and interaction differences from hardware

- No analog preamp, comparator, filter coloration, calibration drift,
  saturation, or trigger shaper is modeled.
- The fixed YIN frame causes explicit window-scale acquisition latency. A
  proprietary tracker may respond sooner, use instrument-specific heuristics,
  or produce different octave mistakes.
- The gate describes this estimator's level-and-periodicity lock, not a direct
  clone of RS-35, Tailgater, disting, or ConVertor gate semantics.
- Fixed internal filtering and one YIN threshold reduce controls and CPU but
  cannot optimize every instrument. External EQ, ENVF, VCA, and Quant remain
  composable alternatives in the rack.

## DSP Audit (2026-07-31)

- The focused suite has 31 passing tests covering the complete declarative
  contract, exact analysis plans, pure-tone accuracy at 44.1/48/96 kHz and
  128/512-sample blocks, harmonic and missing-fundamental inputs, continuous
  pitch, rejection, lifecycle behavior, smoothing, reset, determinism, and
  the static operation ceilings.
- `npm run audit:dsp -- --module pitch-track --matrix --strict-voltage` passed
  all six matrix configurations with zero errors, no non-finite samples, no
  voltage flags, and stable input/output buffers. The audit's largest observed
  scenario time was 491.6 microseconds per block.
- A sustained two-second 55 Hz Low-mode timing probe stayed comfortably within
  every render budget. Across the matrix, p99 block time was 0.0745..0.5001 ms
  against 1.333..11.610 ms available; the largest observed block was 0.6151 ms.
- Measured pure-tone acquisition latency from Level opening was 40.998/77.868
  ms at 44.1 kHz Fast/Low, 38.146/70.125 ms at 48 kHz, and 38.167/70.146 ms at
  96 kHz, below the respective 43/80 and 41/73 ms ceilings.
- The implementation preallocates its ring, immutable frame scratch,
  difference, CMNDF, and audio buffers. `process()` creates no arrays, objects,
  closures, promises, typed arrays, or logging work. The worst Low plan remains
  397 lags, four rows per analysis tick, 2,508 comparisons per tick, and
  248,919 sample pairs per completed estimate.
- The remaining validation need is listening and browser AudioWorklet profiling
  with real monophonic sources. Real-source octave ambiguity and browser CPU
  variance remain documented limitations, not changes to the v1 contract.

## Test Targets

Tests are written in `tests/dsp/pitch-track.test.js` before implementation.
Use sample-by-sample observations rather than only inspecting the last sample
of a block, because lock transitions can occur inside a process buffer.

1. **Definition and initialization** — Assert ID, name, 6 HP, category, color,
   declarative controls, exact defaults, exact port signals/voltages/normals,
   two LEDs, and absence of hidden state/telemetry/events. Confirm all buffers
   have configured length and stable identity.
2. **Silence and startup** — Silence leaves Signal 0, Lock 0, Gate 0 V, and
   Pitch 0 V for every supported sample-rate/block-size combination.
3. **Pitch mapping** — With Smooth 0, controlled sines produce C4 = 0 V,
   A4 = 0.75 V, A2 = -1.25 V, C6 = 2 V, and appropriate E1/E2/C7 rails.
   Assert formulas in volts, not merely inferred note labels.
4. **Continuous output** — A stable detuned frequency and a slow continuous
   frequency glide produce non-semitone Pitch values. Explicitly assert the
   output is not rounded to the Quant module's note grid.
5. **Accuracy matrix** — For pure sine E2, 110 Hz, C4, A4, and C6, require
   error no greater than 5 cents after acquisition at 44.1/48/96 kHz and every
   supported block size. For upper-register G6/C7, allow no greater than
   12 cents. C7 must not exceed +3 V.
6. **Harmonic inputs** — Deterministic saw-like sums across E2–C6 must select
   the fundamental within 10 cents; G6/C7 may use 15 cents. A deterministic
   missing-fundamental sum at 220 + 330 + 440 Hz must resolve near 110 Hz
   within 15 cents rather than 220 Hz.
7. **Range switch** — Fast acquires E2 and rejects E1; Low acquires both.
   Changing Range clears Gate/Lock and analysis history, retains held Pitch,
   and requires a fresh full frame before relocking.
8. **Level knob and hysteresis** — Verify exact 0.01, 0.1, and 1 V thresholds
   at knob 0, 0.5, and 1. A qualifying pitched signal below the selected open
   threshold cannot lock. Once open, level remains open at 80% and closes below
   70%; close immediately forces Gate low and retains Pitch.
9. **Signal LED** — Verify 0 on silence, approximately 0.5 at threshold after
   envelope settling, saturation at 1, continuous response, and independence
   from pitch lock.
10. **YIN rejection** — Above-level seeded white noise and a constant/DC frame
    do not acquire. A chord has no required note or lock result, but must stay
    finite and within rails.
11. **Lock grace** — After a stable lock, one completed above-level invalid
    frame retains Gate/Lock; the second consecutive invalid result clears them.
    A following valid result resets the invalid count. Level close bypasses the
    grace and clears immediately.
12. **Gate and latency** — Assert every Gate sample is exactly 0 or 10 V and
    Gate never precedes a valid pitch. From level-open on a stable 4 V sine,
    first lock must meet 43/80 ms Fast/Low ceilings at 44.1 kHz and 41/73 ms at
    48/96 kHz. Test with Smooth 0 and 250 to prove Gate timing is unchanged.
13. **Smoothing** — At 0 ms accepted pitch steps immediately. At 15 ms a
    controlled target step reaches approximately 63.2% after 15 ms and 95%
    after about 45 ms within floating-point tolerance; 250 ms is slower and
    monotonic. No overshoot or rail violation is allowed.
14. **Held output** — After lock, replace the source with silence. Gate drops,
    Pitch holds the last target (or continues its existing slew toward it),
    and no automatic return to 0 V occurs.
15. **Buffer and numerical integrity** — Every output sample is written on
    every call; inputs keep identity; NaN/Infinity input and parameters recover
    to documented defaults; Pitch stays -8/3..+3 V; LEDs stay 0..1.
16. **Reset** — Dirty every filter, ring, job, envelope, lock, invalid-count,
    decimator, and slew path; call reset; then compare outputs and subsequent
    processing with a fresh instance. Buffers retain identity.
17. **Determinism** — Two independent instances fed identical signals and
    lifecycle calls produce sample-identical output and LED buffers.
18. **CPU/resource discipline** — Run sustained Low-mode upper-level input at
    every audit matrix point. Code review confirms the 397-lag, four-row/tick
    cap and no `process()` allocations; `npm run audit:dsp` must complete with
    strict voltage enabled.
19. **Spec distinctions** — Contract tests or focused assertions confirm no
    envelope output, quantization control, scale state, trigger output, audio
    output, custom renderer, or browser dependency was introduced.

## Factory Patch Requirement

Add `Test - Pitch Tracker` during implementation. Its intended signal flow is:

```text
Clock -> Sequencer clock
Sequencer CV -> source VCO v/oct
Sequencer Gate -> source VCA CV
source VCO triangle -> source VCA audio -> Pitch Tracker IN
Pitch Tracker PITCH -> tracked VCO v/oct
Pitch Tracker GATE -> tracked VCA CV
tracked VCO triangle -> tracked VCA audio -> Output L and R
```

Both VCO coarse controls use the local normalized C4 setting
`0.48105520203391067`; the sequencer stays within Fast's range. The source VCA
creates silence between notes so the patch demonstrates acquisition, held
pitch, Gate qualification, and reacquisition. Quant and ENVF are intentionally
absent: their absence makes the module distinction audible. Reinspect every
source-defined port immediately before writing the patch; the ports observed
during research were `clock`, `cv`, `gate`, `vOct`, `triangle`, `ch1In`,
`ch1CV`, `ch1Out`, `audio`, `pitch`, `L`, and `R` as appropriate to their
modules.

## Implementation Plan

### Isolation and scope

- **Implementation branch:** `module/pitch-track`.
- **Implementation worktree:**
  `/Users/orderandchaos/code/eurorack-js/.worktrees/pitch-track-module`.
- Start from the coordinator-approved baseline after this research branch is
  integrated and the queue row is `spec-ready`.
- Create tests first. Do not implement on the research branch and do not mix
  unrelated shared-framework changes into the module branch.

### Module contract

- Create `src/js/modules/pitch-track/index.js` with ID `pitch-track`, category
  `utility`, 6 HP, `module-color-twelve`, and declarative UI only.
- Parameters: `level: 0.5`, `smooth: 15`, `range: 0`.
- Input: `audio`, -5..+5 V audio, normal 0 V.
- Outputs: held `pitch`, -8/3..+3 V CV; binary `gate`, 0/10 V gate.
- LEDs: continuous `signal`; binary `lock`.
- Implement the two low-pass sections, decimation, direct incremental YIN,
  level hysteresis, lock grace, held target, and Pitch slew exactly as closed
  above. Reuse `clamp`/local established numeric conventions and
  `createSlew()`; no new shared FFT or pitch utility is planned.

### Test-first sequence

1. Add `tests/dsp/pitch-track.test.js` with definition, initialization,
   mapping, range, level, rejection, lock, latency, smoothing, reset,
   determinism, matrix, and buffer-integrity assertions from Test Targets.
2. Run the new test and confirm it fails because the module is absent.
3. Implement the smallest module-local DSP satisfying the closed contract.
4. Register it in `src/js/rack/module-manifest.js` and add the matching static
   import/alias and array entry in `src/js/rack/core-definitions.js`, preserving
   uninterrupted order and aliases.
5. Increment the same worklet graph revision once in
   `src/js/audio/worklet-engine.js`, `src/js/audio/worklet/processor.js`, and
   `src/js/audio/worklet/core-plugin.js`.
6. Add `Test - Pitch Tracker` under `src/js/config/patches/`, register it in the
   factory-patch index, and validate exact current port names.
7. Add Pitch Tracker to the `AGENTS.md` available-modules list and the README
   module table. Update `docs/creating-modules.md` only if implementation needs
   a genuinely reusable new authoring pattern; none is currently planned.

### Validation gates

Focused DSP and contracts:

```bash
npm test -- tests/dsp/pitch-track.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
```

Factory patch validation:

```bash
npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js
```

Strict DSP matrix:

```bash
npm run audit:dsp -- --module pitch-track --matrix --strict-voltage
```

Full pre-merge validation:

```bash
npm test
```

In addition to pass/fail, inspect sustained Low-mode worklet timing in a browser
at 44.1, 48, and 96 kHz. If direct YIN cannot remain comfortably within the
render budget, stop and amend this research contract before introducing an FFT
framework change or silently reducing accuracy/range.

### Known assumptions and risks

- The source is monophonic, within -5..+5 V, and contains a recoverable
  periodic fundamental or harmonic series.
- Fast E2 and Low E1 minima, C7 maximum, 0.15 threshold, 3 kHz preprocessing,
  two-percent boundary margin, and one-invalid-result grace are utility design
  choices that must change only through a research/spec revision.
- Real-instrument latency and octave errors will be worse than clean-signal
  tests. Documentation and panel naming must not promise otherwise.
- Browser CPU variance is the main implementation risk. The distributed
  operation cap is mandatory; if it is still too expensive, the next decision
  requires evidence comparing MPM, a shared complex/inverse FFT, or a narrower
  range.
- No manufacturer code is to be copied. YIN is implemented from the published
  equations; GPL aubio is reference material only.
- The queue coordinator owns the `researching` to `spec-ready` transition and
  queue-row link. This research-only branch does not edit the queue.

## Implementation Gate

The approved contract is implemented with committed focused tests, bounded
incremental work, static core registration, an audible factory patch, and the
validation evidence recorded in the dated DSP audit. The queue remains under
coordinator ownership and is intentionally unchanged by this implementation.
