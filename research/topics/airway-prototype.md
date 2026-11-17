> Superseded 2026-11-17 by [Vocal](../modules/vocal.md) and [Beatbox](../modules/beatbox.md).
> Retained as the original engine provenance and historical validation record.

# Airway: one patchable physical-model vocal source

Status: **implemented and validated**, 2026-11-17.

Airway is one continuously patchable source: Gate controls sustained breath,
and Trig articulates the selected one-shot sound on that same source. There
is no Mode switch, Hold latch, or trigger-to-vowel audition timer.

## Intent, sources and confidence

Use the actual CHIMERA Rust physical model, pinned to commit
`24bd2e4ee4accf7b27d57d8bf912472880dff9f7` (2026-11-16). It simulates a
branched airway with glottal excitation, moving mouth geometry, pressure,
flow and turbulence. This is a utility adaptation, not a formant-filter
approximation, neural model or PCM sample player. Airway produces voltage;
speakers remain exclusively the responsibility of the rack output module.
[S1–S6]

Pinned source and regression tests are normative. Architecture prose includes
unimplemented mechanisms; the code wins. Proctor et al. (2013) supports the
human ejective, ingressive and click mechanisms, not a realism claim about
this synthesizer. The CHIMERA app and USC MRI demonstrations are linked demo
references, but text tools could not retrieve their audiovisual content; no
listening judgment was made in research. The screenshot is interaction
inspiration, not evidence of Japanese reading or external excitation. There
is no hardware electrical specification: every voltage law below is an app
adaptation. [S3, S11–S14]

Retain upstream MIT copyright/permission notices, calibration tables used by
the human model, source pin and dependency notices. Do not distribute unused
web UI/fonts/dictionaries/creature assets. Source, lockfile, reproducible build
script and checksummed generated WASM must remain reviewable. [S1, S2]

## Full panel and voltage contract

ID `airway`, name **Airway**, category `voice`, **16 HP**, color
`module-color-six`. Eight knobs, one Hit action, seven inputs and one output
fit two rows of four sockets. No switch, toggle, audio input, sequencer,
internal drone latch, text interface or independent percussion voice exists.
Use the standard module controls; custom controls always call `onParamChange`.

| Param | Control | Range; default | Meaning |
|---|---|---|---|
| `pitch` | Pitch | -24..24 semitones; 0 | Continuous source pitch, including the Hum articulation |
| `vowel` | Vowel | 0..4 continuous; 0 | Baseline A/E/I/O/U posture morph |
| `sound` | Sound | 0..9 integer; 0 | Articulation selected on the next Trig/Hit |
| `pressure` | Pressure | 0..22 cmH2O; 8 | Baseline lung pressure, always live |
| `breath` | Breath | 0..1; 0.15 | Baseline source breathiness, always live |
| `tension` | Tension | 0..1; 0.5 | Baseline lax-to-pressed source, always live |
| `fry` | Fry | 0..1; 0 | Baseline vocal fry, always live |
| `level` | Level | 0..1; 0.8 | Shared final gain, 5 ms smoothing |
| `audition` | Hit trigger action | 0 / 1; 0 | Same selected articulation as Trig; never sustains a vowel |

No control is disabled when a gesture is active. A strong score may temporarily
dominate selected articulators, but baseline values continue updating and
resume naturally as its weights decay. Five optional A/E/I/O/U shortcuts only
set `vowel` to 0/1/2/3/4. There is no additional state or shortcut latch.

Vowel anchors are pinned male calibrated IPA `ɑ`, `e`, `i`, `o`, `u` postures.
Linearly interpolate each articulator target between adjacent anchors, then
retain upstream articulator dynamics. This is a useful path through postures,
not linear interpolation of measured formants. Body is fixed male; changing
body upstream rebuilds the network, so no Body/Size CV is exposed. [S9, S10]

| Input port | Signal, range, normal | Law |
|---|---|---|
| `vOct` | CV -5..5 V, 0 V | `clamp(110 * 2^(pitch/12 + V), 40, 1100)` Hz, always continuous |
| `gate` | gate 0..10 V, 0 V | >=1 V requests sustained breath; lower releases it |
| `trig` | trigger 0..10 V, 0 V | Rising crossing of 1 V fires selected articulation; below 1 V rearms |
| `vowelCV` | CV -5..5 V, 0 V | `clamp(vowel + 0.8*V, 0, 4)`, continuous baseline posture |
| `soundCV` | CV -5..5 V, 0 V | `clamp(floor(sound + 2*V), 0, 9)`, sampled only at a hit |
| `pressureCV` | CV -5..5 V, 0 V | `clamp(pressure + 4*V, 0, 22)` cmH2O, always continuous |
| `accent` | CV 0..5 V, 0 V | At hit sample gain `1 + clamp(V,0,5)/10`; temporary shared-output emphasis |

Output `out` is mono audio, -5..5 V. All arrays are preallocated and retain
identity. Nonfinite input samples use normal zero; nonfinite params use finite
defaults; over-range finite values saturate through these laws. Exact octave
tracking applies inside the 40–1100 Hz limit. With Sound=0, 0–<0.5 V selects
B, 0.5–<1 V selects t, and so on; >=4.5 V selects m. Negative Sound CV subtracts
selection before clamping. No hysteresis is needed for edge-sampled selection.

A sustained vowel requires Gate; a constant CV source or external gate latch
can create a drone in the patch. Trig and Hit fire an articulation whether
Gate is high or low. They do not synthesize a 150 ms Gate pulse. Gate falling
releases baseline breath but does not cancel an already-triggered score.
Gate rising during a score is accepted immediately. Simultaneous Trig/Hit
produce one event; simultaneous Gate and trigger use both current values.
A held trigger fires once, not once per block. Parameters apply before an
event at the sample where they are observed.

Accent is a temporary **shared voice output** gain: keep the sampled value
through the remaining score duration (including gesture ramps/release holds),
then target unity again with 5 ms smoothing. Derive its expiry from prepared
score metadata, not a guessed common drum duration. Retrigger replaces both
the score and accent window. A held vowel is also emphasized during that
window because it is the same physical source; there is no separate drum
signal to scale. Accent never remains latched onto the subsequent sustained
vowel, and moving Accent without a trigger has no effect. Smooth accent changes
over 5 ms; retain the independent 1 ms state-restoration bridge.

LEDs: `active` reflects held breath with native release indication, OR a 50 ms
hit indication; `level` is a bounded output peak/envelope. Optional bounded
text telemetry: effective vowel, pitch, pressure, current/last selected sound
and articulation activity. No mode telemetry exists. Custom renderers declare
telemetry even when only synchronized params/LEDs are used. [S5, S8]

## Verified source/gesture interaction

The pinned `HumanVoice::control` already combines baseline controls with
scores. Articulators carrying active gestures blend against baseline posture
(weight 0.05); untouched articulators follow baseline. Positive recipe breath
combines as `max(gate_target, score_breath)`. Negative ingressive breath
intentionally overrides held Gate during that phase. When score weights reach
zero, ordinary gate_target and baseline source/posture resume through native
dynamics. This is directly source-verified, not inferred from a demo. [S5]

Consequently a closed hi-hat or hum need not end in silence if Gate stays high:
the mouth returns toward the patched vowel and breath continues. An inward
snare temporarily reverses flow even under a held gate. Pressure/Breath/Tension/
Fry influence the ongoing physical source during gestures; closure/suction
already stored in a prepared snapshot cannot be changed retroactively.

The wrapper must reapply current pitch, vowel, pressure, breath, tension, fry
and Gate immediately after snapshot restoration, then keep updating them on
the absolute 64-sample control grid. It must **not** call a reset or restore
the clean baseline when a score finishes: that would cut the held voice and
lose natural recovery. Let the score expire on the same engine. Preserve
recipe tongue-tip behavior while its score is active; return to ordinary free
vowel tongue-tip control afterward using target changes, without snapping.

Hum contains a high-weight F0 gesture; `source.f0` alone does not control it.
Retarget every active F0 gesture whenever requested pitch changes, using the
reserved <=16-gesture scratch buffer and replacing the bounded score without
allocating. This preserves the recipe while making V/Oct continuously useful.
The native score pitch time constant is 30 ms; baseline glide is 5 ms. Source
roughness, drift and vibrato depth are fixed zero, brightness 0.25. Fry
intentionally changes periodicity, so clean pitch assertions use Fry zero.
[S4–S6]

Control targets update every absolute 64 output samples; articulation has
physiological dynamics. Trigger detection, sound/accent capture and gate edges
are sample-exact; do not claim audio-rate mouth response. Internal simulation
exceeds 60 kHz (2x at 44.1/48 kHz, 1x at 96 kHz). Native gate attack/release time
constants are 25/70 ms, with score-specific breath release. Default idle is
silent; Pressure zero prevents sustained lung excitation but moving geometry
and a prepared compressed-air state can still produce short transients. [S5]

## Beat catalogue and measured timing

Order is fixed and matches the pinned upstream table. Recipe length is 0.18 s;
individual gestures have their own tails, and Hum is a one-shot, not a gate.

| Index | ID / name | Mechanism | Native pad lead-in | Prepared onset at 48 kHz* |
|---:|---|---|---:|---:|
| 0 | B / Kick | glottalic ejective | 137.0 ms | 4.98 ms |
| 1 | t / Hi-hat | pulmonic | 106.0 ms | 1.38 ms |
| 2 | tss / Open hat | pulmonic | 106.0 ms | 1.38 ms |
| 3 | Pf / Snare | pulmonic | 130.0 ms | 0.00 ms |
| 4 | K / Rimshot | glottalic ejective | 117.5 ms | 0.00 ms |
| 5 | ^K / Inward snare | ingressive | 100.0 ms | 0.00 ms |
| 6 | ! / Tongue click | velaric click | 174.0 ms | 1.31 ms |
| 7 | P! / Lip pop | velaric click | 173.0 ms | 2.29 ms |
| 8 | kch / Crash | pulmonic | 101.0 ms | 0.00 ms |
| 9 | m / Hum | voiced nasal | 105.6 ms | 5.27 ms |

*Native research probe, 2026-11-17: unmodified pinned engine, fixed male body,
source defaults, `artic.snap(beat_ready)`, `tip_free=false`, `beat_hit` at clock
zero, pre-render `round((lead_in - .003)*sampleRate)` samples, clone HumanVoice
during setup, then render 0.6 s. Onset means first absolute sample above 10% of
that render's peak; it is not a perceptual listening judgment. Across
44.1/48/96 kHz the first crossing was 0–6.04 ms. Some fricatives already have
energy at the snapshot boundary; their peak occurs later. Ordinary native
pad rendering also produces preparation noise, so its first nonzero sample
must not be misreported as the main drum onset. [S4, S9]

The reference setup uses upstream's Hum note E2 (MIDI 40). The module keeps
Hum's F0 gesture target synchronized with continuous Pitch/V/Oct, including
after a hit; native pitch settling remains. Other recipes produce mostly
unpitched percussion. Snapshots prepare at canonical pressure 8 and accent 1.
Immediately after restoration, current source/posture/gate targets are reapplied
and continue updating. They cannot retroactively change the prepared closure
or stored pressure: a hit can still emit its already-prepared impulse at
Pressure zero. Accent is expressly post-synthesis gain, not a claim of stronger
precomputed ejective pressure. The onset measurements below remain prototype
reference measurements; retest under the unified live-control contract.

Native bank preparation (ten sounds; post-setup 0.6 s test renders excluded)
measured 271 ms at 44.1 kHz, 283 ms at 48 kHz and 364 ms at 96 kHz on the local
host. Native full rendering used roughly 18–24% of one wall-clock core for the
probe. These are feasibility measurements, not browser CPU guarantees. The
probe source was temporary at `/private/tmp/airway-research-probe/src/main.rs`;
implementation tests must preserve the measurement recipe rather than depend
on that path.

## DSP implementation and real-time contract

Retain the planned small Rust/WASM ABI and prepared physical-state strategy.
The state contains pressure, geometry motion, glottis, score, RNG and filters;
continuing it renders the real model, with no prerecorded PCM. A new hit chokes
the preceding state and resumes its own prepared state; 1 ms output bridging
avoids a raw discontinuity. This trades previous-hit coarticulation for usable
rack timing. Native delayed pads, a JS reimplementation, a smaller formant
approximation and sample playback are rejected for this version.

Prepare all banks before a live AudioWorkletNode exists using the planned
optional `prepareDSP({sampleRate})` hook. Main validation/UI mirrors and Node
tests may initialize once per rate. Keep the sample-rate cache bounded; an
active instance retains its bank. Live topology creation, `process`, reset
and triggers must not prime banks, compile/fetch WASM or allocate buffers.

Whole-linear-memory restore is permitted only between returned ABI calls:
fixed buffer/handle offsets, all lazy data warmed, fixed memory byte length,
preallocated typed arrays and `.set`. Inspect mutable globals and prove the
stack pointer returns to the same boundary value. No other mutable global may
hold un-restored engine state. Hundreds of alternating restores/renders must
show no growth, allocator activity, pointer drift or cross-instance leakage.
Derived Rust `clone_from` does not establish allocation-free nested Vec copies.
Use local score capacity 64 (recipe maximum 16), documented as a wrapper-specific
source change; never expose general speech scheduling. Snapshot data is runtime
state and never persisted in a patch. [S4, S5, S7, S8]

Output is upstream normalized audio times `5 * level * accentEnvelope`, with
upstream DC blocker/limiter retained. Final `softLimitVoltage(value,5,0.8)` is
linear through +/-4 V and saturates smoothly toward +/-5 V. Level and accent
have 5 ms smoothing during playback. On the first process after creation/reset,
Level starts at the sanitized patch value: there is no preceding audible gain
to crossfade, and an extra fade would soften the first percussion attack. An
initial Level of zero remains silent; trigger restoration still uses its 1 ms bridge. New articulation state uses a 1 ms output bridge from the
previous output sample; the source is still monophonic.

`reset()` restores clean baseline, clears edge histories, score/accent expiry,
LED and smoothing histories, fills output zero and restores input normals
without changing array identities or user parameter values. The next block
honors the currently routed Gate. `dispose()` releases instance resources;
reset never rebuilds the shared bank.

## Validation targets

Write focused tests before changing DSP/UI. Existing exclusive-mode tests
must be replaced, not retained as accepted behavior.

1. Defaults/schema: eight knobs, Hit only, no mode/hold/shapeCV; seven declared
   stable inputs, normal zero, silent idle, output only through rack Out.
2. Gate threshold 0.999/1 V, sustained vowel, gate release, and no spontaneous
   drone. Trig/Hit always articulate, independent of Gate; no vowel timer.
3. All ten sounds with Gate low and high. Held vowel recovers naturally after
   each score; no reset or sudden gate drop at score expiry. Inward snare may
   override airflow temporarily. Gate changes during hits remain effective.
4. Every control min/default/max; source controls remain live during scores.
   Vowel anchors/interpolation match pinned target vectors; Vowel CV and Sound
   CV are independent. Sound bins and Accent capture are sampled at exact edges.
5. Continuous Hum pitch changes during its active score; source-only pitch
   update must not be silently masked. Settled pitch 55/110/220/440 Hz within 1%
   under clean source, with correct octave law and 40–1100 Hz limiting.
6. Accent 0/2.5/5 V yields 1/1.25/1.5 target gain during its score window and
   returns smoothly to 1 afterward, including a held vowel. No-trigger Accent
   CV does not change output. Retrigger replaces expiry; compare same recipe
   and held voice after expiry to ensure no stale gain latch.
7. Simultaneous Gate/Trig, Hit/Trig coalescing, sustained-high trigger, rearm,
   mid-block events and every block offset; source targets reapplied immediately
   after every memory restore. Sound changes after a hit do not change the hit.
8. New held-gate and live-vowel behavior can alter canonical onset/timbre:
   repeat default all-sound <=12 ms meaningful-energy onset target and compare
   native prepared references. Test 62.5 ms same/different-sound retriggers;
   no pre-roll work in callback. High-rate pulses remain finite and bounded.
9. Complete deterministic reset; no stale pressure/RNG/score/phase/edge/accent
   state; stable memory/pointers/I/O; no WASM growth/allocation on render,
   control, score retarget or restore. Multiple-instance independence.
10. Finite buffers, +/-5 V at all extremes, continuous rail, reasonable audio
    DC; nonfinite guards;44.1/48/96 kHz and128/512 blocks; sample schedule/block
    invariance; dispose/restart/patch reload/preparation failure handling.
11. Real browser controls, seven jack labels, bounded telemetry/LEDs, cable
    removal, sustained+triggered interaction, both patches and listening.
    No listening or browser-real-time success is inferred from native tests.

Report bank size/preparation time and callback p95/p99/worst restore cost.
Investigate single-module p95 above 50% or patch p99 above 75% of deadline under
`research/sound-engineering-review.md`. Runtime limitations require fixing or
reporting; do not silently substitute delayed triggers or another engine.

## Implementation Plan

- Research: `research/airway`, `.worktrees/airway-research`, this document only.
  Coordinator reopens queue research for the contract revision, then confirms
  spec-ready before DSP/UI edits; implementation uses `module/airway` at `.worktrees/airway` and
  `module/airway-kernel` at `.worktrees/airway-kernel`; review uses
  `.worktrees/airway-review`. The coordinator integrates and validates in the
  main workspace.
- Module `airway`, category `voice`, 16 HP, `module-color-six`; one live physical
  airway and continuous controls with overlaid triggered scores as specified.
- Keep planned optional prepareDSP lifecycle, vendored human engine, bounded
  score64, generated artifact/checksums and no-allocation snapshot path. Preserve
  attribution and document local source changes and preparation lifecycle.
- Remove mode/hold/shapeCV from DSP/UI/fixtures/docs. Add vowelCV and soundCV.
  Existing patches using removed parameters reject under strict v3 validation;
  update all repository fixtures and never silently migrate them.
- Factory fixtures: **Test - Airway** patches external pitch/Gate/Vowel CV
  to sustain the source; **Test - Airway Beatbox** patches Trig/Sound CV/Accent to
  articulate it. Names describe patches, not internal modes. Include a held
  Gate plus triggered articulation check to demonstrate shared-source behavior.
- Shared lifecycle change: prepare immutable kernel resources during core
  worklet registration, before node construction. A browser integration check
  also exposed queued telemetry overwriting same-ID replacement-patch params;
  suspend telemetry during transactional patch activation/rollback, with a
  host regression test.
- Update module/ABI tests first, then kernel/module, fixtures and registration
  docs; preserve exact source port names and core graph revision rules.
- Focused:
  `npm test -- tests/dsp/airway.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- Patches:
  `npm test -- tests/config/patch-catalogs.test.js tests/config/factory-patches.test.js tests/app/patch-format.test.js`.
- Audit: `npm run audit:dsp -- --module airway --matrix --strict-voltage`.
- Full: `npm test`, browser AudioWorklet profiling, listening and lifecycle checks.
  Update sound-engineering review with actual results before marking done.

## DSP Audit (2026-11-17)

The unified implementation uses generated source version `7f52a917bb01`, a
436,904-byte WASM binary, fixed 1 MiB instance memory and eleven 1 MiB prepared
states per sample rate. The cache retains at most three rates; active instances
retain their bank. Normal builds verify pinned sources, documented vendor edits,
output checksums, fixed memory and the sole mutable boundary stack global.

A narrow documented `HumanVoice::set_source_live` extension preserves the held
score's glottal abduction contribution and untouched vibrato, and derives effort
from current gated pressure. The ordinary upstream setter overwrote those fields
between the prepared voice's native control ticks. Independent review found
Snare energy could change 5.85x merely by repeating identical controls. The fixed
implementation produces bit-identical audio for all ten sounds with one update
versus repeated 64-sample updates, including changed-control schedules. Hum
retargeting changes the source F0 target without reapplying unrelated fields.
The source lock records this extension and retains original upstream hashes.

`npm run audit:dsp -- --module airway --matrix --strict-voltage` passes all
108 scenarios: 18 scenarios at 44.1/48/96 kHz and 128/512 frames. There are no
exceptions, nonfinite samples, voltage violations or changed I/O identities.
Generic-stimulus peaks range from 0.898 to 1.581 V; focused extreme-control tests
also enforce the +/-5 V output contract. Node audit timing includes harness work
and concurrent tests, so it is not a callback deadline measurement.

All 30 default module-level onset measurements pass the <=12 ms target:

| Sample rate | Worst onset | Method |
|---:|---:|---|
| 44.1 kHz | 8.141 ms | First crossing of 10% of the complete 0.6 s render's peak |
| 48 kHz | 8.125 ms | Same, 128-frame host blocks, initial patch Level |
| 96 kHz | 7.906 ms | Same, all ten sounds |

Focused coverage includes independent Vowel/Sound CV, live Hum pitch, every
source control, exact trigger/gate edges, 62.5 ms retriggers, held-gate recovery,
score-derived accent expiry, deterministic reset, block-size invariance and
finite parameter extremes. Allocation counters and fixed buffer/stack identities
remain unchanged through rendering, restoring and moving controls. Four native
Rust tests cover score capacity, full expiry, F0 retargeting and source overlays.

Runtime checks used Chromium's real AudioWorklet at 48 kHz/128 frames. Both test
patches produced finite, nonzero output: the vowel example measured peak 0.235,
RMS 0.0468; beatboxing peak 0.298, RMS 0.0129 (normalized final stereo channel).
The vowel example uses external Gate Delay to extend SEQ's 10 ms pulses to about
180 ms, rather than hiding a breath timer in Airway. The browser test also passes
live patch replacement, vowel shortcut clicks, Hit, hot-add/remove, held Gate
plus articulation, cable disconnection, and audio stop/start. All eight sockets
fit the panel. Raw vowel buttons stop module-drag mousedown propagation so their
click reaches `onParamChange` without rebuilding the panel first.

The browser profile covered 752 blocks: whole-patch and Airway p95/p99 were
2/2 ms against a 2.667 ms deadline (75% p99 utilization). Its returned values have
1 ms granularity, so this is coarse diagnostic evidence, not precise headroom.
A separate Node 24.15.0 high-resolution run on the local M2 Max measured 2048
128-frame blocks after 256 warmup blocks, Gate held and all sounds retriggered
every 24 blocks. No other project test or browser benchmark ran concurrently:

| Rate | Cold bank | DSP p95 / p99 | Worst observed DSP | Restore p99 / worst |
|---:|---:|---:|---:|---:|
| 44.1 kHz | 431 ms | 1.083 / 1.175 ms | 1.857 ms | 0.027 / 0.033 ms |
| 48 kHz | 470 ms | 1.119 / 1.235 ms | 3.374 ms | 0.028 / 0.048 ms |
| 96 kHz | 677 ms | 0.860 / 0.931 ms | 2.168 ms | 0.023 / 0.031 ms |

The high-resolution run confirms that the full airway is CPU-intensive,
especially against the 1.333 ms deadline at 96 kHz. Occasional Node wall-clock
outliers exceed a block deadline; this is not proof of a browser underrun.
Prefer 48 kHz for larger racks and profile multiple instances on the target
machine. Preparation occurs before audio starts; restores do not pre-render.
There is no subjective listening sign-off: captured-audio, finite/range, onset
and lifecycle checks do not establish perceptual realism or artifact-free sound.

Final validation: the focused DSP/kernel, contract, queue, patch and host suites
pass. The complete `npm test` run passes **2,885 tests**, with 9 existing skips
across 157 passing files and 1 skipped file. The strict DSP matrix passes all six
rate/block configurations; Chromium's Airway browser test passes, including
captured output and the live lifecycle cases above. `npm run build` verifies the
final generated assets, and all 77 test-patch previews were regenerated. Research,
implementation and independent review used the isolated worktrees in the plan.

## Sources

Web access/review date: 2026-11-17. Source links are pinned to the inspected
commit; local files from that exact archive supplied the implementation detail.

- **S1 — CHIMERA README**, Jameson Hodge, 2026. Scope, physical synthesis,
  interaction modes, supported languages and third-party licence exceptions.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/README.md
- **S2 — MIT licence**, Jameson Hodge, 2026. Reuse and notice conditions.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/LICENSE
- **S3 — Acoustic architecture**, CHIMERA contributors, 2026. FDTD network,
  literature references, source/tract design and explicitly unbuilt mechanisms.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/docs/architecture.md
- **S4 — Beatbox implementation**, CHIMERA contributors, 2026. Ten sounds,
  recipes, source ownership, length/accent behavior and airstream mechanisms.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/beatbox.rs
- **S5 — Human voice implementation**, CHIMERA contributors, 2026. Source
  fields, control interval, oversampling, gate smoothing, limiter and state.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/voice/human_voice.rs
- **S6 — Glottis implementation**, CHIMERA contributors, 2026. Fry pitch pull,
  irregularity, glottal pulse mechanics and source parameters.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/sources/glottis.rs
- **S7 — Rust engine design**, CHIMERA contributors, design dated 2026-11-05.
  Allocation boundaries, deterministic native/WASM expectations, browser setup
  and upstream benchmarks; benchmarks are not our rack measurements.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/docs/rust-engine.md
- **S8 — WASM ABI**, CHIMERA contributors, 2026. Output/control buffers,
  lifecycle, bounded scheduling; reference for the narrower Airway wrapper.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera-wasm/src/lib.rs
- **S9 — Engine and beat player**, CHIMERA contributors, 2026. Native pad
  lead-in, 200 ms sequencer horizon, body reset and sample/block scheduling.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/engine.rs
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/control/beat_player.rs
- **S10 — Articulator dynamics and calibrated vowels**, CHIMERA contributors,
  2026. Bounded motion, free tongue tip and per-body posture lookup.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/control/articulators.rs
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/planner.rs
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/vowelTargets.generated.json
- **S11 — Paralinguistic mechanisms of production in human beatboxing**,
  Michael Proctor, Erik Bresch, Dani Byrd, Krishna Nayak and Shrikanth Narayanan,
  JASA 133, 1043–1054, 2013; DOI 10.1121/1.4773865. Primary articulatory context.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3574116/
- **S12 — Demo references**, CHIMERA playable app, Jameson Hodge, 2026,
  https://chimera.audio/ ; USC SPAN, *Breaking Down the Beat*, companion MRI
  demonstrations, https://sail.usc.edu/span/beatboxingproject/ . Neither was
  auditioned in this pass; text tools could not retrieve playable content.
- **S13 — Upstream beat regression and allocation tests**, CHIMERA contributors,
  2026. Recipe coverage, timing, scheduling and allocation-free warmed builds.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/tests/beatbox.rs
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/tests/beat_alloc.rs
- **S14 — VoiceControls UI**, CHIMERA contributors, 2026. App pitch40–1100 Hz,
  pressure2–22 cmH2O, breath/tension/fry ranges and glide control.
  https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/src/ui/components/VoiceControls.tsx
