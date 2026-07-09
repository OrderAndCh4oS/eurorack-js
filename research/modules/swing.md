# Swing Clock Processor (swing)

## Status

Research complete and implemented. Queue status is coordinator-owned and tracks the current implementation state in `research/module-queue.md`.

## Hardware Reference

The proposed module is an app-adapted clock processor, not a clone of one hardware product. It combines the core behavior of clock-utility shuffle modules with the musical vocabulary of drum-machine shuffle and modern groove quantization.

- Based on:
  - 4ms Shuffling Clock Multiplier and SCM Breakout for voltage-controlled slip/shuffle, straight plus shuffled clock outputs, reset/resync, pulse width, and skipped/slipped beat concepts.
  - ALM Pamela's PRO Workout / Pamela's NEW Workout for Eurorack clock microtiming, humanize/flex timing, external DIN-style 24 PPQN sync, CV assignability, and practical voltage ranges.
  - Roland TR-909 for historical drum-machine shuffle/flam context and the early MIDI/DIN-sync era.
  - MIDI 1.0 timing clock and DIN Sync practice for 24 PPQN synchronization context.
- Primary manuals/pages:
  - 4ms SCM product page and official user manual v1.2.
  - 4ms SCM Breakout manual v2.0.
  - ALM Pamela's PRO Workout product page and manual v0.35 / firmware 130.
  - MIDI Association summary of MIDI 1.0 messages.
  - Roland TR-909 owner's manual archived at Internet Archive.
- Reviews/demos:
  - 4ms product page video/demo list, including SCM Breakout demo, Richard Devine RCD/SCM demos, and "4ms SCM Clock Manipulation".
  - SCM Breakout manual sample patch describing simultaneous straight x8 and slipped S8 clocks patched to VCAs/LPGs.
  - Roland TR-909 historical review context from secondary summaries is used only for historical motivation, not electrical or timing facts.
- DSP and research references:
  - 4ms open-source SCM firmware repository and release notes for practical clock-processor concerns such as high-frequency jitter, double triggers, skip tables, and resync behavior.
  - Datseris et al., "Does it Swing? Microtiming Deviations and Swing Feeling in Jazz" for swing-ratio and microtiming-perception cautions.
  - Lee et al., "PocketVAE: A Two-step Model for Groove Generation and Control" for separating note templates from velocity/microtiming detail.
  - Rasanen et al., "Timing and Dynamics of the Rosanna Shuffle" for measured shuffle behavior, tempo drift, microtiming deviation, and dynamics as separate groove components.
  - Wachter et al., "Transformer-Based Rhythm Quantization of Performance MIDI Using Beat Annotations" for modern beat-based MIDI quantization context.

## Source Quality Summary

- Highest confidence electrical facts come from manufacturer manuals and official product pages. 4ms documents SCM clock input at 3.5V to 15V rising-edge triggered, Slip/Rotate CV at roughly 0V to +5V, and SCM Breakout pulse-width outputs as 0V/+10V. ALM documents Pamela's PRO Workout outputs as 0V to 5V and CV inputs as 0V to 5V, with clock/run rising-edge input minimum 700 mV.
- Highest confidence MIDI timing facts come from MIDI.org's MIDI 1.0 message summary: Timing Clock is sent 24 times per quarter note, with Start, Continue, and Stop real-time messages.
- The Roland TR-909 owner's manual is an OCR copy of a primary manual hosted by Internet Archive. It clearly lists Shuffle and Flam as rhythm-expression features and includes sync functions/MIDI context, but exact shuffle timing values are not machine-readable from the cited manual text.
- The academic sources are useful for defining a musically plausible microtiming model and avoiding overclaiming. They do not define Eurorack voltages or a hardware panel contract.
- The 4ms product page phrase "CV Slip causes particular beats to land ahead in time" conflicts in wording with the SCM manual's operational description that slipped beats land late. The manual's detailed operation section wins for implementation: this app delays selected beats.

## Specifications

### Proposed Module

- Module ID: `swing`
- Name: `SWING`
- Category: `clock`
- Suggested width: 4 HP
- Suggested color token: `module-color-five`
- DSP model: inspired-by utility adaptation, not a faithful hardware emulation.

### Panel Contract

- Knobs:
  - `swing`: 0.0 to 1.0, default 0.0. Maps to a delayed-offbeat swing ratio from straight 50% to maximum 75%. At maximum, the selected offbeat is delayed by 50% of the measured input-clock period.
  - `human`: 0.0 to 1.0, default 0.0. Adds bounded pseudo-random microtiming variation after the deterministic template. Maximum range is the lesser of 10% of the measured period or 30 ms.
  - `width`: 0.0 to 1.0, default 0.1. Sets processed and straight output pulse width from 5 ms minimum toward 50% of the measured period. Output pulses are clipped so they do not overlap the next scheduled pulse where possible.
  - `template`: stepped 0 to 3, default 0. Selects timing template:
    - 0 `classic`: every second input edge is delayed.
    - 1 `triplet`: every second input edge is delayed more aggressively toward triplet/dotted-eighth feel, still clamped by the maximum swing delay.
    - 2 `laidback`: an 8-step repeating timing table that delays the second and fourth sixteenth-style positions more than the others.
    - 3 `pushpull`: an 8-step repeating table with mild early/late feel emulated causally through global base delay when `human` is nonzero; without humanization it remains late-only.
- Inputs:
  - `clock`: trigger/clock input. Rising edge advances the timing pattern and schedules a processed output pulse.
  - `reset`: trigger input. Rising edge resets the pattern counter and clears pending delayed pulses.
  - `swingCV`: CV input. 0V to 5V adds 0.0 to 1.0 to the `swing` knob before clamping.
  - `humanCV`: CV input. 0V to 5V adds 0.0 to 1.0 to the `human` knob before clamping.
- Outputs:
  - `swung`: processed swung/humanized trigger or gate output.
  - `straight`: immediate reclocked output using the same pulse width but no swing or humanization, for comparison and parallel clocking.
- LEDs:
  - `in`: short activity indicator on input clock edge.
  - `out`: follows the processed output pulse.
- Normalization:
  - Unpatched `clock` reads 0V and produces silence/no triggers.
  - Unpatched `reset`, `swingCV`, and `humanCV` read 0V.
  - No bus clock normalization in this first implementation.

### Voltage Contract

- Clock input threshold: high when `clock > 2.5V`, matching this app's clock standard and existing `div` behavior.
- Reset input threshold: high when `reset > 2.5V`; reset is rising-edge triggered.
- CV inputs: `swingCV` and `humanCV` are clamped to 0V to 5V. Negative voltages are treated as 0V; voltages above 5V saturate at full modulation.
- Outputs:
  - `swung`: 0V low, 10V high. Port type `trigger`.
  - `straight`: 0V low, 10V high. Port type `trigger`.
- Pulse length:
  - Minimum 5 ms, consistent with this app's trigger standard.
  - Width can extend toward gate-like pulses at slow tempos, but output remains a clock/trigger signal and never exceeds 10V.
- Timing limits:
  - No processed pulse is scheduled before the input edge that caused it unless a future lookahead mode is explicitly added.
  - Delays are clamped to leave at least 1 ms of low time before the next predicted edge when the period estimate is stable.
- Reset behavior:
  - Reset rising edge clears pending delayed pulses, resets the template step to 0, clears output pulse counters, and turns LEDs off.
- Disconnect behavior:
  - When the clock input cable is removed, the engine notifies the module and clears pending delayed/straight pulses immediately. The pattern step is preserved, but no scheduled clock output remains after disconnect.

## DSP Implementation

### Algorithm Overview

- Process per sample using rising-edge detection on `clock` and `reset`.
- Track `samplesSinceLastClock` and update `lastPeriodSamples` on each clock edge. Ignore period updates shorter than 2 ms to reject accidental double triggers.
- On each input clock edge:
  - Emit an immediate `straight` pulse.
  - Compute effective `swing` and `human` from knob plus CV.
  - Look up a template weight for the current pattern step.
  - Compute `baseSwingDelay = swing * 0.5 * lastPeriodSamples`.
  - Compute `templateDelay = baseSwingDelay * templateWeight`.
  - Compute `humanRange = human * min(lastPeriodSamples * 0.10, sampleRate * 0.030)`.
  - If `humanRange > 0`, add a causal base delay of `humanRange` to all processed pulses and add deterministic pseudo-random jitter in `[-humanRange, +humanRange]`.
  - Clamp total scheduled delay to `[0, lastPeriodSamples - pulseWidthSamples - 1ms]`.
  - Add a pending processed pulse event with that delay.
  - Advance the pattern counter.
- Pending events are kept in a small queue with sample countdowns so delayed pulses can cross audio-buffer boundaries.
- When a pending event reaches zero, start the processed output pulse. If a pulse is already high, merge the event by extending the high counter instead of emitting a sub-1ms low gap.
- Use a deterministic PRNG seeded at initialization and reset so tests can assert humanized timing bounds. A future UI seed control is out of scope.
- LEDs:
  - `in` is 1 while the immediate straight pulse is active, otherwise 0.
  - `out` is 1 while the processed output is high, otherwise 0.

### Template Tables

The exact table values are app-specific and intentionally documented so tests can lock behavior:

| Template | Repeating weights | Notes |
|----------|-------------------|-------|
| `classic` | `[0, 1]` | Standard alternate offbeat delay. |
| `triplet` | `[0, 1.33]` clamped to max delay | Pushes toward heavier triplet/dotted feel without exceeding the maximum delay cap. |
| `laidback` | `[0, 1, 0.15, 0.70, 0, 0.90, 0.10, 0.60]` | A musically useful 8-step late-feel template, not a proprietary MPC/TR clone. |
| `pushpull` | `[0.20, 0.85, 0, 0.65, 0.10, 1, 0, 0.55]` | Uses small first-step delays so the pattern feels less strictly alternate while staying causal. |

### Observed Behavior From Reviews/Demos

- 4ms SCM documents and demos emphasize listening to straight and slipped outputs together. The SCM manual notes that simultaneous straight and slipped clock outputs create phasing and variable-shift effects as Slip is modulated.
- The SCM Breakout getting-started patch suggests sending S8 and x8 to separate VCAs/LPGs and slowly turning Slip while increasing Shuffle; observed behavior is increasingly late alternate beats, then more complex slipped patterns, with x8 remaining steady.
- ALM Pamela's PRO Workout frames swing, human, and bouncing-ball timing as off-grid "Flex" microtiming rather than as separate audio effects. Its external sync guidance stresses 24 PPQN plus a Run signal for stable high-resolution sync.
- The TR-909 manual presents Shuffle and Flam as rhythm-expression features alongside accent and pattern editing, showing that shuffle belongs historically to drum-machine pattern feel rather than only to modular clock math.
- Academic listening and measurement studies caution that "more microtiming" is not automatically more groove. The app should default to straight timing and make humanization optional and bounded.

### Contradictions, Assumptions, and Design Decisions

- 4ms terminology can describe Slip as beats moving "forward" while the detailed manual says the audible result is late beats. This implementation treats swing as a positive delay.
- Hardware voltage conventions differ: 4ms SCM outputs can be +10V, ALM Pamela outputs are 0V to 5V, DIN Sync is 0V/+5V TTL-like, and this app's gate/trigger convention is 0V/10V. This implementation uses 0V/10V outputs to match the app.
- Many MIDI/DIN devices operate at 24 PPQN, but this app's existing clock modules often work on musical trigger edges. `swing` processes each incoming trigger edge as one grid step. Users who want 16th-note swing should feed it a 16th-note clock; users who feed 24 PPQN will be swinging individual PPQN ticks, which is usually not musically useful without downstream division.
- True "early" timing is not possible in a causal clock processor without delaying all outputs first. The `human` algorithm adds base latency only when humanization is nonzero, allowing bipolar jitter around the delayed grid while keeping the module causal.
- Proprietary drum-machine/groove-template values are not replicated. The templates are app-specific, documented, and testable.
- The module does not multiply or divide clocks. Existing `div`, `midi-clk`, and sequencer modules already cover those responsibilities.
- The first implementation should not add skip/probability, ratchets, or DIN/MIDI transport outputs. Those would duplicate `euclid`, `div`, `midi-clk`, or future queue items.

## Internal Implementation References

- `src/js/modules/div/index.js`: period tracking, clock threshold, pulse-counter output pattern.
- `src/js/modules/clk/index.js`: app clock output voltage and pause/reset style.
- `src/js/modules/midi-clk/index.js`: MIDI 24 PPQN division comments, 5 ms trigger pulse pattern, run/reset output semantics.
- `src/js/modules/euclid/index.js`: reset/clock edge processing and deterministic trigger output state.

## Test Targets

- Initialization:
  - Creates `params.swing`, `params.human`, `params.width`, and `params.template` with documented defaults.
  - Creates `inputs.clock`, `inputs.reset`, `inputs.swingCV`, `inputs.humanCV`.
  - Creates `outputs.swung`, `outputs.straight`, and `leds.in`/`leds.out`.
- Output ranges:
  - Both outputs are always finite and in the 0V to 10V range.
  - Low samples are exactly 0V; high samples are exactly 10V.
- Clock threshold:
  - No edge at 2.5V or below.
  - Rising edge above 2.5V schedules one processed pulse and one straight pulse.
  - Held-high clock does not retrigger until it goes low and rises again.
- Swing knob:
  - `swing = 0` produces processed output aligned with `straight` except for `human`.
  - `swing = 1` in `classic` mode delays every second pulse by 50% of the measured period, subject to clamp.
  - Intermediate swing values scale delay linearly.
- Templates:
  - Each template applies the documented repeating weights.
  - Template index is stepped and clamped to 0 through 3.
- CV inputs:
  - `swingCV = 5V` adds full swing modulation and clamps at 1.0.
  - `humanCV = 5V` adds full human modulation and clamps at 1.0.
  - Negative CV and over-5V CV clamp safely.
- Humanization:
  - With `human = 0`, timing is deterministic and matches the selected template exactly.
  - With `human > 0`, delays stay within documented bounds.
  - Reset reseeds or resets the deterministic PRNG so tests are reproducible.
- Width:
  - Minimum width is at least 5 ms.
  - Maximum width is no more than 50% of the measured period and does not cause overlapping low gaps where avoidable.
- Reset:
  - Reset rising edge clears pending delayed pulses and returns the pattern counter to step 0.
  - Reset wins over a clock edge in the same sample.
- Tempo changes:
  - Period estimates update on each valid clock edge.
  - Very short accidental double triggers below 2 ms are ignored for period updates.
- LEDs:
  - `in` follows immediate input/straight pulse activity.
  - `out` follows processed pulse activity.
- Buffer integrity:
  - Delayed events crossing buffer boundaries fire at the expected sample.
  - `process()` fills every output sample and produces no NaN.

## Implementation Plan

- Module ID: `swing`
- Category: `clock`
- Branch/worktree: implemented through an isolated implementation subagent workspace and integrated by the coordinator.
- DSP model: app-adapted causal swing clock processor with measured-period scheduling, delayed offbeats, documented groove-template weights, optional deterministic humanization, and immediate straight reference output.
- Params: `swing`, `human`, `width`, `template`
- Inputs: `clock`, `reset`, `swingCV`, `humanCV`
- Outputs: `swung`, `straight`
- LEDs: `in`, `out`
- Factory patch: `src/js/config/patches/test-swing.js`, using `clk` into `swing`, with `straight` and `swung` routed to contrasting drum/hat and scope paths so the delay is visible/audible.
- Focused tests: `tests/dsp/swing.test.js` covering the test targets above.
- Full validation command: `npm test -- tests/dsp/swing.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`, then `npm test` before merge.
- Known assumptions:
  - Incoming clock edges represent the musical grid to swing; no automatic PPQN detection.
  - Processed output is causal; no true negative/early pulses without base latency.
  - Outputs use this app's 0V/10V trigger standard even when source hardware uses 0V/5V.
  - Groove templates are original app presets, not reverse-engineered MPC/TR/SCM tables.
  - No clock multiplication, division, MIDI, DIN Sync, probability, ratchet, or skip features in the first implementation.

## Potential Improvements

- Add an optional lookahead/latency mode that can produce true early and late timing around a delayed straight reference output.
- Add a seed parameter for repeatable humanization across saved patches.
- Add clock division/multiplication only if the coordinator decides this should become a broader clock-workstation module; otherwise keep using `div` and `midi-clk`.
- Add saved user groove tables only if the UI gains a compact editable pattern control.

## Sources

- [4ms Shuffling Clock Multiplier product page](https://4mscompany.com/scm.php) - 4ms Company, current product page, accessed 2026-07-09, supports: SCM feature scope, straight and slipped/shuffled outputs, CV Slip/Rotate, SCM Breakout features, max input frequency, size, demo/video links, and manual/firmware links.
- [4ms Shuffling Clock Multiplier User Manual v1.2 PDF](https://4mspedals.com/clocker/SCM/SCM-manual-1.2.pdf) - 4ms Pedals, updated September 2015, accessed 2026-07-09, supports: clock input voltage/rising edge, Slip CV voltage, output jack behavior, period measurement from prior pulses, every-n-beats slip, no-slip at 0V, roughly 90% max slip, default 50% normalized slip, bus clock behavior, and pulse/gate patch uses.
- [4ms SCM Breakout Panel User Manual v2.0 PDF](https://4mscompany.com/clocker/SCMBO/manual/scmbomanual2.0.pdf) - 4ms Company, v2.0 manual, accessed 2026-07-09, supports: Shuffle selecting which beats are slipped, Skip lookup-table concept, Pulse Width behavior, Mute, Re-sync, sample patch using S8 and x8 side by side, and knob/CV interaction patterns.
- [4ms/SCM firmware repository](https://github.com/4ms/SCM) - 4ms Company, open-source SCM firmware, accessed 2026-07-09, supports: implementation reference for clock processing, skip tables, resync behavior, and release-note concerns including double triggers and high-frequency jitter.
- [ALM Pamela's PRO Workout product page](https://busycircuits.com/pages/alm034) - ALM/Busy Circuits, current product page, accessed 2026-07-09, supports: clocked modulation feature scope, Flex microtiming for swing/human/bouncing-ball effects, CV assignability, technical specs, 0V-5V outputs, 0V-5V CV inputs, and 700 mV minimum clock/run rising edge.
- [ALM034 Pamela's Pro Workout Operation Manual v0.35 / firmware 130 PDF](https://assets.busycircuits.com/docs/alm034-manual.pdf) - ALM/Busy Circuits, March 31, 2026, accessed 2026-07-09, supports: panel layout, Flex operations list, external clock PPQN settings, 24 PPQN recommendation, DIN Sync style clock/run behavior, CV assignment, outputs, inputs, reset, and VCV behavior.
- [ALM Pamela's NEW Workout product page](https://busycircuits.com/pages/alm017) - ALM/Busy Circuits, discontinued product page, accessed 2026-07-09, supports: predecessor feature context including phase, delay/delay division for complex swing, external sync from 48 to 1 PPQN, DIN Sync/MIDI clock expander support, and continuity into PRO Workout.
- [Summary of MIDI 1.0 Messages](https://midi.org/summary-of-midi-1-0-messages) - MIDI Association, current reference table, accessed 2026-07-09, supports: Timing Clock status, 24 clocks per quarter note, Song Position Pointer six-clock MIDI beats, and Start/Continue/Stop real-time messages.
- [Roland TR-909 Owner's Manual full text](https://archive.org/stream/synthmanual-roland-tr-909-owners-manual/rolandtr-909ownersmanual_djvu.txt) - Roland Corporation manual archived by Internet Archive, original 1980s manual, accessed 2026-07-09, supports: TR-909 Shuffle and Flam feature context, MIDI interface/sync context, and drum-machine pattern-writing workflow.
- [Roland TR-909 overview](https://en.wikipedia.org/wiki/Roland_TR-909) - Wikipedia contributors, accessed 2026-07-09, secondary context only; supports: release-era and review-history context, including period reception and the role of shuffle/flam in TR-909 sequencing.
- [Does it Swing? Microtiming Deviations and Swing Feeling in Jazz](https://arxiv.org/abs/1904.03442) - George Datseris, Annika Ziereis, Thorsten Albrecht, York Hagmayer, Viola Priesemann, Theo Geisel, 2019, accessed 2026-07-09, supports: swing-ratio grid concept, microtiming-deviation perception, and caution that natural microtiming is not automatically preferred.
- [PocketVAE: A Two-step Model for Groove Generation and Control](https://arxiv.org/abs/2107.05009) - Kyungyun Lee, Wonil Kim, Juhan Nam, 2021, accessed 2026-07-09, supports: separating note templates, velocity, and microtiming as distinct groove components and using controllable timing patterns.
- [Timing and Dynamics of the Rosanna Shuffle](https://arxiv.org/abs/2411.06892) - Esa Rasanen, Niko Gullsten, Otto Pulkkinen, Tuomas Virtanen, 2024, accessed 2026-07-09, supports: measured shuffle timing, swing factor, tempo drift, dynamics, and repeated timing/dynamic phrase patterns in a known shuffle performance.
- [Transformer-Based Rhythm Quantization of Performance MIDI Using Beat Annotations](https://arxiv.org/abs/2604.22290) - Maximilian Wachter, Sebastian Murgul, Michael Heizmann, 2026, accessed 2026-07-09, supports: contemporary beat-based MIDI quantization context and the distinction between performed timing and score-grid quantization.
- Internal reference: `src/js/modules/div/index.js` - existing app clock threshold, period tracking, and trigger pulse practices.
- Internal reference: `src/js/modules/clk/index.js` - existing app trigger output level and pulse-width practices.
- Internal reference: `src/js/modules/midi-clk/index.js` - existing MIDI clock division, 24 PPQN comments, and run/reset clock-output conventions.
- Internal reference: `src/js/modules/euclid/index.js` - existing clock/reset edge handling and trigger-output test patterns.
