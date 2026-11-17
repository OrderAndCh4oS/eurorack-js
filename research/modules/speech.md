# Speech

> Parked by the user after audition, 17 November 2026. See the [archive decision](../topics/vocal-beatbox-parked.md). Historical implementation notes follow.

Status: implemented and validated locally, 2026-11-17. See the [comparative research and primary sources](../topics/speech-design.md).

SPEECH is a CHIMERA physical-model phrase voice. It prepares English text with
the upstream dictionary, G2P, duration and coarticulation planner. It is a utility
adaptation, not an emulation of a hardware speech chip. No training or recorded
speech is used. Vocabulary quality and unusual names remain limited by that
dictionary and rule-based frontend.

## Implementation Plan

- ID `speech`, category `voice`, color `module-color-six`, 28 HP custom panel.
  Use the existing wide-panel size so text and nine jacks remain readable.
- Branch/workspace: existing user workspace; preserve concurrent uncommitted work.
- Separate Worker WASM planner depends on the pinned vendored CHIMERA source.
  Bundle the pinned CMU pronunciation dictionary and retain its license.
- Store a versioned, finite, bounded gesture plan for both anatomies in one
  atomic `phrase` state value, including the applied text. Store editor `text`
  separately. This makes saved patches immediately playable without Worker
  preparation. These are control gestures, never audio or WASM snapshots.
- An active-gesture cursor computes exact upstream raised-cosine weights on a
  fixed 64-sample grid. Native ABI accepts the blended targets, weights and
  speeds through a preallocated buffer. The original voice's articulator,
  airflow and glottal dynamics remain intact. Rate advances the gesture clock
  independently of the physical simulation. No complete sentence enters the
  native 64-gesture score; at most 22 per-channel gestures represent each tick.
- Finite plans are limited to 240 characters, 20 seconds at 1x, 2048 gestures per
  anatomy and 64 simultaneously active gestures. Reject overflow, never truncate.
  Admission validates sorted bounds, channel values, body count and schema.
- Knobs: Pitch -24..24 semitones default 0; Rate .5..2 default 1; Contour 0..2
  default 1; Breath 0..1 default .15; Level 0..1 default .8.
- Switches: Female 0/1 default 0; Restart 0/1 default 0 (Finish).
- Actions: Speak and Stop. Text/Apply prepare asynchronously; stale results
  cannot replace the latest requested text. Errors retain the last ready phrase.
- Inputs: Trig, Stop, V/Oct, Rate CV, Contour CV, Breath CV. Outputs: Out, Busy,
  End. LEDs: Busy and audio Level. Telemetry: bounded progress, effective controls,
  active text and phoneme position. Renderer uses the stable UI mirror.
- Test patch: clocked full phrase, a slow external modulation and a direct output;
  separate saved audition patch makes text and Pitch/Rate easy to explore.
- Focused tests: planner, native ABI, scheduling/rate/pitch, trigger and text
  semantics, validation, UI Worker cancellation, real worklet and round-trip patch.
- Validation: `npm test -- tests/dsp/speech.test.js tests/dsp/speech-plan.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`;
  native Cargo tests; patch catalogs/format tests; `npm run audit:dsp -- --module speech --matrix --strict-voltage`;
  browser AudioWorklet/controls, full `npm test`, `npm run build`.

## Panel and voltage contract

Text is one English passage. Apply prepares it; Speak fires the prepared passage.
Edits never affect a currently playing version. Male/Female is latched at the
accepted start; pitch stays independent. An example female patch uses Pitch +12.
Pitch, Rate, Contour, Breath and Level remain live. There is no internal clock,
repeat, effect or alphabet selection bank.

| Input | Range and normal | Law |
|---|---|---|
| `trig` | 0..10 V, normal 0 | Rising crossing >=1 V starts; low rearms. |
| `stop` | 0..10 V, normal 0 | Rising crossing >=1 V stops; wins simultaneous Trig. |
| `vOct` | -5..5 V, normal 0 | 1 V/octave, added to Pitch. |
| `rateCV` | -5..5 V, normal 0 | `clamp(rate * 2^(V/5), .5, 2)`. |
| `contourCV` | -5..5 V, normal 0 | `clamp(contour + V/5, 0, 2)`. |
| `breathCV` | -5..5 V, normal 0 | `clamp(breath + V/5, 0, 1)`. |

Audio `out` is ±5 V with documented soft limiting. `busy` is 0/10 V, high through
phrase pauses and final release. `end` is a 10 ms 10 V natural-completion pulse.
Stop and Restart never emit End for an interrupted phrase. Finish ignores
triggers during Busy, with no queue; Restart replaces the current phrase.
Empty prepared text is silent and produces no Busy/End. A held trigger fires once.
Disconnect restores normal voltage. Nonfinite values fall back to defaults.

Contour scales the planned pitch displacement in octaves: zero gives flat
intonation, one preserves the original, two exaggerates it. Add Pitch and V/Oct,
then clamp fundamental to 40..1100 Hz. Preserve planned voiceless consonants.
Smooth controls over 5 ms and retain native pitch/articulator dynamics. End is
based on final gesture end plus a 150 ms release, with a final 10 ms output fade.
Stop uses a 5 ms release. Restart uses a bounded transition from the previous
output into the new phrase; tests must verify its discontinuity and onset.

## DSP choices and assumptions

Use sparse original gestures rather than sampled control trajectories: exact
ramps, smaller saved plans, and no time-grid approximation. A fixed active set
makes playback cost depend on overlapping gestures, not paragraph length. A
versioned plan allows validation and rejection of unsupported formats.

Preparing both body calibrations costs additional patch size but makes tract
selection deterministic and avoids a Worker dependency at playback. The planner
and dictionary load only when editing. Dynamic anatomy morphing is outside scope.
The retained overlapping gestures support intelligibility; listening is required
before claiming natural or fluent speech. Musical Rate bounds deliberately
limit extreme consonant smearing. See the topic document for reference module
differences, source quality, and remaining pronunciation limitations.

## Test targets

Initialization is silent with a ready default phrase; every buffer retains
identity. All knobs/CV change the intended dimension. Rate affects duration,
Pitch affects voiced periodicity, Contour changes inflection, Breath changes
source quality, Level changes amplitude. Both tracts remain finite and distinct.
Test accurate edge thresholds, Finish/Restart/Stop, simultaneous events, pauses,
completion pulse width, active revision ownership, silent empty text, reset and
dispose. Reject malicious/invalid/oversized plans and stale schema versions.
Assert no native allocations or memory growth while speaking. Measure same
signal across arbitrary block sizes and profile two real worklet voices.

## DSP Audit (2026-11-17)

- Native tests: 14 airway wrapper tests and two planner tests pass, including
  allocation-free control updates and a sentence exceeding the native score size.
- Focused JS tests verify voiced periodicity at 110/220/440 Hz within 2%, .5/1/2x
  duration, sample-exact completion pulses, transport priority, block-size
  invariance, state validation, Worker cancellation and distinct tract output.
- A sounding matrix exercises five knobs at both extremes across three sample
  rates and two buffer sizes (60 cases), with bounded finite audio and stable
  native memory/allocation counts. The generic strict-voltage audit also passes
  17 scenarios in each of six configurations, but its simultaneous Stop/Trig
  inputs produce silence; it is not the evidence for sounding behavior.
- Chromium passes text preparation during playback, live controls, both tracts,
  invalid-edit retention, layout bounds, and exact prepared-plan persistence
  through the browser's compressed shared URL codec. Declared `ui.state` values
  now retain full numeric precision in URLs; ordinary controls keep rounding.
- Captured output is finite and nonzero: male peak .1337 / RMS .0310; female
  peak .1041 / RMS .0236 at the output module's .45 gain. These are regression
  captures with different tract/pitch settings, not a perceptual quality rating.
- At 48 kHz / 128 frames the single-voice rack measured p50 1 ms / p99 2 ms
  against a 2.667 ms deadline. Two voices measured p50 2 ms / p99 3 ms, exceeding
  that deadline. Timing has coarse 1 ms resolution: use one SPEECH voice in the
  audition patch and investigate native cost before promising multiple voices.
  [Saved browser measurements](../../compositions/speech-validation-measurements.json).
- Full suite: 3,095 passed, nine skipped. Production build and all 78 test-patch
  previews pass. [Audition patch](../../compositions/speech-demo.json).

No listening-based intelligibility or naturalness claim is made. Audition the
default phrase, a longer punctuation-rich sentence, fricatives/plosives, and
both tracts at matched pitch before judging vocal quality. Compare Rate .5/1/2,
Contour 0/1/2 and Breath 0/1 in isolation. Dictionary exceptions and unfamiliar
names remain a limitation; pronunciation editing is future work.
