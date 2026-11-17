# Vocal — continuous articulatory voice

> Parked by the user after audition, 17 November 2026. See the [archive decision](../topics/vocal-beatbox-parked.md). Historical implementation notes follow.

Status: implemented and locally validated, 2026-11-17. User requested separate vocal and beatbox modules.

## Female vocal tract — implementation plan, 2026-11-17

The user reports that raising Pitch still sounds like the same male voice.
The adapter currently hard-wires `BodyMix::MALE` and `HumanVoice::with_defaults`.
Use CHIMERA's existing female anatomy and calibrated vowel/consonant tables.
This is a physical-model preset, not a claim that all women share one voice.

- Module/category/workspace remain `vocal` / voice / current workspace. Preserve
  all controls and voltage contracts. Add persisted binary switch `female`,
  default 0, rendered as a compact **TRACT · MALE / FEMALE** selector. No new CV
  input or internal voice mode. Pitch stays 110 × 2^(Pitch/12 + V/Oct) in both
  models, allowing comparisons at equal F0. Provide a female audition patch at
  Pitch +12 (220 Hz); this explicit patch setting is independent of the selector.
- Add body-aware native construction. Female anatomy uses upstream scale .9,
  pharynx .88, tongue radius 2.2, lip width 4.4, plus female calibrated phoneme
  targets. Retain native source/pressure/gain laws; no output resampling or
  arbitrary formant EQ. The male constructor remains exactly compatible.
- Prepare one female baseline per rate, separate from the existing male/beat
  bank. Allocate both isolated 1 MiB kernels when creating VOCAL. Never rebuild
  anatomy or allocate inside `process()`. Render only the selected kernel in
  steady state, and both during an 80 ms linear crossfade. Send control targets
  to both; retain each model's physical history through active crossfades. When
  selecting a fully dormant model with Gate closed, restore its prebuilt silent
  baseline before fading it in; otherwise its old held breath can reappear.
  Never clear a model that currently contributes audio. CPU doubles
  only briefly during switching; steady memory rises from 1 to 2 MiB per VOCAL.
  Female baseline cache is bounded to three rates (3 MiB); no female percussion
  snapshots are prepared and BEATBOX remains unchanged.
- Tests before implementation: native anatomy and calibrated target differences;
  same-F0 spectral differences and pitch tracking; all female phonemes finite;
  held-gate switching, state persistence, stable buffers, no native allocation,
  reset/block-size invariance, neutral male parity. Browser checks cover model
  selection/persistence, real audio, panel fit and shared SEQ toggle styling.
- Validation: native tests; focused VOCAL/kernel/contracts/patch tests; strict
  matrix at all rates/sizes; real AudioWorklet; regenerated previews; full test
  suite and production build. Update the saved audition patch and source docs.

Sources: pinned [anatomy / BodyMix](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/anatomy/human.rs),
[vowel planner](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/planner.rs),
[consonant inventory](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/inventory.rs),
and [HumanVoice construction](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/voice/human_voice.rs).
Jameson Hodge/contributors, reviewed locally 2026-11-17. The sources support
physical geometry, calibration and gain differences. Subjective voice identity
and intelligibility remain listening questions; no training is required.

### Female-tract validation

At the same 220 Hz pitch, held-A normalized spectral similarity between the
male and female models is **.609**, establishing a resonance change independent
of level. Female 110/220/440 Hz tracking stays within 1%. All 32 female phonemes
render finite output at 44.1/48/96 kHz without native allocation, memory growth
or stack movement. Thirteen native tests pass, including anatomy and calibrated
target differences. Held-gate crossfades, model-preserving reset and block-size
invariance pass. Strict voltage matrix: **594 scenarios** (99 × six rates/sizes).

The real browser test verifies selection, persistence, panel fit, audio and
identical SEQ/VOCAL toggle styles in both states. Female test-patch capture at
48 kHz/128 frames: normalized RMS .0797, peak .2674; coarse Chromium block
p95/p99 1/2 ms against a 2.667 ms deadline. This short single-voice profile is
not a polyphony or device-performance guarantee. The standalone female patch
also passes strict serialization and production-graph rendering, with RMS
.0789 and peak .1864 over two seconds.

A final idle-switch regression caught .206 V of stale held-note energy when a
dormant model was selected after Gate closed. Restoring only a fully inaudible
destination's silent baseline removes this; the regression now stays below
1 µV in both directions. Active crossfades retain both histories, and a new
external gate resumes normal audio. This fix does not alter the steady male
voice or rebuild anatomy in the audio callback.

Final regression run, 2026-11-17: **3,066 tests passed**, nine skipped, 160
passing files and one skipped file. Production build and refreshed catalogue
previews pass. The shared step styling and female selector are visually checked
in the real browser; existing male/beatbox regression coverage remains green.

## Voice controls and step-light panel — 2026-11-17

User requests substantially more vocal control, with square orange sound lights
and right-aligned labels to their left. Retain the enabled-pool addressing and
external gate/phoneme control. This update supersedes the nine-knob panel below.

### Implementation Plan

- Module `vocal`, voice category, existing workspace/branch; no new module.
- Keep the physical CHIMERA model and neutral sound. Add seven controls with
  bipolar ±5 V additive CV, normal 0 V. Each 5 V spans the control's full range:

| Control | Range / default | Physical behavior |
| --- | --- | --- |
| Brightness | 0–1 / .25 | Glottal closure sharpness and closing-phase skew, independent of tension |
| Roughness | 0–1 / 0 | Native jitter/shimmer and, above .5, period doubling |
| Voicing | 0–1 / 1 | Voiced pulse amplitude and glottal opening; 0 gives whispered airflow; multiplies phoneme voicing |
| Nasal | 0–1 / 0 | Opens velum from −.15 to .9; preserves a selected nasal's existing opening |
| Twang | 0–1 / 0 | Epilaryngeal narrowing; use the effective .45–1 region, with exact neutral at zero |
| Glide | 0–1 seconds / .005 (2 ms floor) | Native exponential pitch time constant; 5 V adds 1 second |
| Morph | 0–1 / 0 | Slows articulator motion from normal to 20× slower; target speed = 1/(1+19×Morph) |

- Add Breath, Tension and Fry CV with the same ±5 V = ±1 mapping. Existing six
  ports, gate thresholds, audio rails, knobs, output and LEDs remain supported.
  Total: 16 knobs, 16 inputs, one output, 32 independent sound toggles.
- Use 5 ms control smoothing at the absolute 64-sample grid. Initialize at the
  first target and reset deterministically. Morph scales bounded native dynamics;
  it does not alter pitch or add a sequencer. Glide changes pitch without varispeed.
- Native adapter stores fixed-size controls, writes complete canonical posture
  each tick, combines voicing once, and does not allocate or restore physical state.
- Keep 28 HP: eight columns/two knob rows, four rows/eight sound cells, two jack
  rows. Each sound cell has right-aligned text, then the shared SEQ step toggle
  aligned to the right of the cell (10 px, orange, square corners in Factory).
  Reuse `toggle-btn seq-gate-btn` and its active state; do not approximate the
  border, glow or colour in VOCAL CSS. The selected outline is distinct from on/off.
  Accessible names, pressed state, keyboard focus and All/None persist. Mark
  custom-handled toggles renderer-managed to avoid app-level double toggling.
- Test before implementation: meaningful normalized spectral differences for
  Brightness/Nasal/Twang, loss of pitch periodicity for Roughness/Voicing, native
  settling times for Glide/Morph, exact CV/knob equivalence, no stale modifiers,
  neutral parity, finite extremes, deterministic reset, no allocations, browser
  layout/persistence and actual AudioWorklet audio. Numerical changes alone do
  not establish subjective usefulness; provide a sustained audition patch.
- Validation: native cargo tests; focused DSP/kernel/contracts/patch tests;
  `npm run audit:dsp -- --module vocal --matrix --strict-voltage`; browser test;
  `npm test`; `npm run build`; refresh Vocal preview and standalone demo.

### Evidence and trade-offs

The pinned [HumanVoice source](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/voice/human_voice.rs)
defines brightness, roughness and logarithmic-frequency glide. The pinned
[anatomy implementation](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/anatomy/human.rs)
documents that epilarynx below .45 has little effect; skip this dead range.
The [articulator dynamics](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/control/articulators.rs)
provide independent speed multipliers. Reviewed locally 2026-11-17, author
Jameson Hodge/contributors. This is an app adaptation, not a hardware emulation.
Use existing controls rather than live body resizing, which rebuilds the tract.
Keep vibrato patchable through V/Oct rather than introduce an internal LFO.
The user reported weak Beatbox Pro knob effects, so assess these on held vocals
with normalized spectral and timing tests, not sample-array inequality alone.

### Measurements

At 48 kHz/128 frames, held A with Breath 0, after one second of settling:
Brightness 0→1 raises the normalized 2–8 kHz band by **10.27 dB**. Pitch-period
autocorrelation falls from **.996** clean to **.582** at Roughness 1 and **.030**
at Voicing 0 (whisper). Normalized spectral similarity is **.827** for Nasal
0→1 and **.936** for Twang 0→1. These are physical/spectral differences, not
claims of universal perceptual salience across every phoneme.

Native timing tests establish that a 110→440 Hz step settles within 1 Hz in
100 ms at default Glide; Glide .5 is still below 200 Hz then and reaches the
same final pitch. Morph 1 leaves more than five times the lip-position error
at 100 ms compared with normal speed and converges to the same U posture.
Twelve native tests pass. Neutral controls are sample-identical to the prior
voice. All ten new CV routes are compared against equivalent knob changes,
including disconnection and clamped endpoints. Fixed memory, allocation counts,
stack bounds and score-free operation remain intact.

The strict matrix passes **582 scenarios** (97 × six rates/block sizes), with
finite output, stable buffers and zero voltage violations. A standalone
`compositions/vocal-controls.json` holds Gate high and enables the five vowels
for manual audition. Change Pitch to hear Glide and Sound to hear Morph; all
source and throat controls act on the sustained tone. The Alphabet Pool demo
and Test - Vocal retain their existing rhythm and enabled phoneme pool.

### Final validation of the voice-control update

2026-11-17: **3,055 tests passed**, nine skipped, across 160 passing test files
and one skipped file. Production build passed. The real Chromium AudioWorklet
test passed with all 16 controls/inputs, the initial 18 px lights, left-side
right-aligned labels, four aligned rows, persisted selection and eight pixels
of clearance below every control/label. Refreshed catalogue thumbnails pass
their content and patch-key checks. The standalone sustained-vowel patch passes
strict serialization and production-graph rendering (normalized peak .0844,
RMS .0370). Numerical verification does not replace the user's listening test.

## Current panel and behavior

VOCAL is a 28 HP continuous physical voice with four rows of illuminated sound
buttons. A–Z and SH/CH/TH/DH/NG/ZH form an enabled pool; Sound CV scans only lit
buttons. All off fades to silence. The selected sound has a separate outline.
Sixteen knobs and sixteen inputs expose pitch, breath, pressure, articulation,
source character, nasal/throat shaping and transition timing. Stops need closure/release envelopes.

The current voice-control contract and plan are above; the phoneme bank and
addressing contract are in **Alphabet selection bank** below. Together these
supersede the original 16 HP panel with eight consonants and five vowel shortcuts.

All sound comes from the pinned CHIMERA physical model. No training, sample
playback, automatic text pronunciation, internal sequence or percussion mode.
Sound changes retain the mouth's physical history. Each instance owns isolated
native state, stable input/output buffers and bounded telemetry.

## Sources and evidence

Primary source is the already-vendored CHIMERA engine, Jameson Hodge and
contributors, pinned 2026-11-16 commit
`24bd2e4ee4accf7b27d57d8bf912472880dff9f7`. Source reviewed locally 2026-11-17;
GitHub web fetches returned cache misses on recheck. Original/vendored hashes
and modifications remain checked by `wasm/airway/source-lock.json`.

- [Phoneme inventory](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/inventory.rs): calibrated consonant targets, dominant articulators, nasal/voicing flags.
- [Speech planner](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/planner.rs): overlapping vowels/consonants, breath and glottal opening gestures.
- [Human voice](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/voice/human_voice.rs): physical state, source parameters, source/tract control updates.
- [Beatbox recipes](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/beatbox.rs): ten percussion gestures and their physical mechanisms.
- [Articulators](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/control/articulators.rs): bounded target motion and tongue-tip policy.
- [MIT license](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/LICENSE): redistribution with retained notice.
- Proctor et al., JASA 133 (2013), [Paralinguistic mechanisms of production in human beatboxing](https://pmc.ncbi.nlm.nih.gov/articles/PMC3574116/): physical closure, release and airstream context.

Prior provenance, engineering comparisons, onset and CPU measurements are in
[the original Airway research](../topics/airway-prototype.md). User listening feedback on the original
Mouth Music patch was "disjointed clips". The source confirms each prepared hit
replaced the entire model state. Removing automatic hits made the vocal patch
continuous but lost consonants. These two modules separate those workflows.
No new subjective listening judgment is inferred from numerical validation.
No hardware panel/electrical spec exists: mappings below are app adaptations.

## DSP Audit (2026-11-17)

The female-tract upgrade passes the strict voltage matrix at 44.1/48/96 kHz and
128/512 frames: 99 scenarios per combination, 594 total. Every result is finite,
all buffers remain stable and no output violates its voltage declaration.

The focused Vocal suite checks all 32 sound paths, sustained unvoiced
fricatives, sparse/single/empty pools, CV endpoints, all knobs, held-gate pool
changes, sample-rate reset and block-size invariance. Native adapter tests
(13 passing) verify lateral/nasal restoration, complete vowel targets,
compound release paths, source/tract modifiers, transition timing and female
anatomy/calibration. Kernel allocation and stack counters remain unchanged
while cycling every sound. These signal checks do not establish perfect
phoneme intelligibility; subjective audition remains necessary.

## Alphabet selection bank — 2026-11-17

User scope: illuminated on/off A–Z buttons plus SH and related digraphs, forming
an enabled sound pool. User confirmed Sound CV selects only from that pool.
This replaces the eight-consonant selector and five momentary vowel shortcuts.

### Panel and voltage contract

VOCAL remains one continuous physical voice, now 28 HP to accommodate four rows
of eight sound buttons: A–Z, SH, CH, TH, DH, NG, ZH. Each is a persisted binary
parameter `enable{label}` (default 1); lit means enabled, a separate outline marks
the current sound. All/None buttons edit that bank; they do not trigger audio.
All off fades output to silence and releases airflow. Re-enabling resumes only
when external Gate is high. No internal clock, sequence or text playback.

Nine knobs: Pitch (-24..24 st), Sound (0..1), Release Vowel (0..4, existing
`vowel` parameter), Articulate (0..1, default 1), Pressure (0..22), Breath (0..1),
Tension (0..1), Fry (0..1), Level (0..1); previous defaults otherwise retained.
Replace `consonant`/`consonantCV` with `sound`/`soundCV`. Sound CV is +/-5 V,
normal 0: clamp(knob + CV/5, 0, 1), divide the enabled pool into equal bins,
0 selects first and 5 V selects last. Disabled sounds are skipped. Knob/CV
selection follows the alphabetical/digraph panel order. Other voltage contracts
remain as above. Articulation and Release Vowel apply to consonants; selected
vowels set their own continuous posture. Gate still controls breath, not steps.

### Sound mapping and DSP decisions

The locally reviewed pinned inventory already provides calibrated IPA targets
for stops, nasals, fricatives, approximants, lateral L and affricates. Reuse it.
A/E/I/O/U retain /ɑ e i o u/ (ah/eh/ee/oh/oo, not English letter names).
B=/b/, C=hard /k/, D=/d/, F=/f/, G=hard /g/, H=/h/, J=/dʒ/, K=/k/,
L=/l/, M=/m/, N=/n/, P=/p/, Q=/kw/, R=/ɹ/, S=/s/, T=/t/, V=/v/,
W=/w/, X=/ks/, Y=/j/, Z=/z/. Extras: SH=/ʃ/, CH=/tʃ/, TH=/θ/ (thin),
DH=/ð/ (this), NG=/ŋ/, ZH=/ʒ/. C/K intentionally share a hard consonant;
Q/X are compound mouth paths, not new unrelated phonemes.

The new bounded native ABI takes a 0..31 sound index. Existing kernel APIs
remain for percussion and low-level regression coverage. Precompute all
phoneme/release targets during kernel construction. No audio-thread allocation,
score scheduling, prepared-hit restore or extra physical voice.

For J/CH/Q/X, articulation traverses base vowel -> release consonant -> closure
as amount rises, and reverses as an external envelope falls. At amount .6 the
release target is full; 1 is the closure. This exposes affricate/compound motion
without an internal syllable timer. Native articulator dynamics smooth motion;
voicing interpolates consistently with the target weights. Stops require a
close/release envelope; held closure is not expected to sound like a spoken
letter. H uses the native open glottis. All postures restore neutral fields to
avoid stale nasal/lateral/tongue state.

Primary evidence: linked CHIMERA inventory/planner/HumanVoice above, reviewed
locally 2026-11-17. `PhonemeDef.release`, nasal and voicing flags define these
mappings; the CV-driven compound path is an app adaptation, not the automatic
speech planner. User audition of Pro found weak controls; waveform difference
alone is therefore insufficient evidence of useful perceptual sound identity.

### Implementation Plan

- Existing authorized checkout; module id/category `vocal` / voice. No agents.
- Update research before tests, tests before DSP/UI. Shared scope: narrow native
  phoneme ABI and JS adapter, rebuilt checked WASM. No core IDs/order change.
- Add immutable sound metadata and 32 declared button params, finite selection
  telemetry, preallocated active-index array and a 5 ms empty-bank fade.
- Four rows of eight accessible light buttons; All/None; 9 knobs in two rows;
  seven jacks in one row. Reuse supported 28 HP width.
- Focused tests: every label/mapping, all/one/none and sparse pools, CV endpoints,
  toggling while running, persistence, defaults/reset, stale-posture recovery,
  native no-allocation, compound closure/release targets, finite audible output
  during externally controlled gesture paths, rates/block-size invariance.
- Update Test - Vocal to scan a chosen pool; retain Mouth Music's M-to-vowel
  articulation by selecting only M. Update all source/JSON/URL fixtures and
  browser controls. Regenerate catalogue previews and build.
- Validation: native tests; focused vocal/kernel/contracts/patch tests; strict
  DSP matrix; browser audio/button persistence/layout; full npm test and build.

### Final validation

2026-11-17: 160 test files passed, one skipped; 3,033 tests passed, nine
skipped. Production build passed. The browser AudioWorklet test verifies 32
buttons in exactly four rows/eight columns, empty-pool silence, SH activation,
three-sound persistence through export/reload, nonzero audio, panel bounds and
normal stop/restart. The updated demo is open for user audition. The exhaustive
all-module audit now allows 30 seconds because the bank adds 64 control scenarios
at each of six configurations; every original voltage assertion remains.

Mouth Music source/JSON/snapshot files were updated to select only M, preserving
its original articulation path and measured audio. The older combined arrangement
moves its mixer/effects/output to row two to accommodate the wider VOCAL panel.
The new Test - Vocal and standalone Alphabet Pool demo scan nine enabled sounds.
