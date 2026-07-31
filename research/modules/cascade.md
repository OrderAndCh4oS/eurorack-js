# Cascade — Rank-Nested Rhythm Generator

Status: done. Research, implementation, independent review, strict DSP audit,
and full-suite validation are complete.

## Purpose and Boundary

`cascade` is the rhythmic half of the Cadence pair. One master clock becomes
four related trigger lanes. Increasing Fill adds ranked events without moving
or deleting existing events at a fixed Rotate setting. Every event in a sparse
lane also appears in each denser lane.

Changes receives the same raw master clock and owns harmonic time. Cascade
articulates voices or drives drums, envelopes, switches, and resets. Neither
module requires the other or shares private state.

This is an inspired utility adaptation. It is not an emulation of Multi
Repetitor, Grids, Marbles, or a Euclidean generator.

### Distinct capability

- `euclid` independently recomputes one approximately even pattern as Hits
  changes; existing onsets may move. Cascade exposes four related outputs and
  guarantees monotone ranked fill.
- `div` derives fixed clock ratios; Cascade selects events within a fixed
  16-step phrase.
- `rnd` and `turing` deliberately introduce random or mutable decisions;
  Cascade is deterministic and exactly resettable.

### Deliberate non-goals

- No Euclidean claim, variable length, probability, random perturbation,
  accent logic, editable steps, internal clock, swing, or per-lane Fill knob.
- No hidden reset/phrase connection to Changes.
- Rotate is the one control that intentionally relocates events; it is
  phrase-latched so a running phrase never changes underneath the performer.

## Evidence Summary

### Confirmed hardware and source behavior

- Multi Repetitor uses four algorithmically related trigger channels, external
  clock/reset, hands-on pattern modifiers, and 50%-duty outputs. Its design
  notes emphasize immediate variation and avoiding feature overload.
- Mutable Instruments Grids stores per-step event levels and compares them with
  density thresholds. The official source is direct precedent for adding
  events by crossing ranked thresholds rather than rebuilding a pattern.
- Marbles' Deja Vu and scale-carving behaviors demonstrate repeatable decisions
  and progressive removal according to stored importance.
- Toussaint's Euclidean work establishes the separate goal of maximally even
  distribution. It also clarifies why a sequence of independently optimal
  Euclidean masks is not generally nested as hit count changes.

### Mathematical adaptation

The binary van der Corput/bit-reversal order provides a deterministic
low-discrepancy shelling of 16 step positions:

```text
P = [0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15]
```

The first `N` positions form the Fill-N mask. Therefore Fill-N is always a
subset of Fill-(N+1). This nested priority, not perfect evenness at every N, is
the defining trade-off.

## Panel Contract

Metadata:

| Field | Contract |
|---|---|
| ID / name | `cascade` / `CASCADE` |
| Category | `clock` |
| Width | 6HP |
| UI | Declarative |

Controls:

| Kind | Param | Label | Range/default | Behavior |
|---|---|---|---|---|
| Knob | `fill` | Fill | integer 0–16, default 8 | Sampled on every accepted clock |
| Knob | `rotate` | Rotate | integer 0–15, default 0 | Commits at phrase step 0 |
| Action | `resetAction` | Reset | trigger, default 0 | Queues restart for next accepted clock |

Inputs:

| Port | Label | Signal | Voltage/normal | Behavior |
|---|---|---|---|---|
| `clock` | Clock | trigger | 0–10V, normal 0V | Rising edge strictly above 2.5V |
| `reset` | Reset | trigger | 0–10V, normal 0V | Rising edge at or above 1V |
| `fillCV` | Fill | cv | -5V to +5V, normal 0V | Additive ±8-hit modulation |

Outputs:

| Port | Label | Signal | Voltage | Behavior |
|---|---|---|---|---|
| `lane1` | 1 | trigger | 0V or 10V | Sparse ranked lane |
| `lane2` | 2 | trigger | 0V or 10V | Contains lane 1 |
| `lane3` | 3 | trigger | 0V or 10V | Contains lanes 1–2 |
| `lane4` | 4 | trigger | 0V or 10V | Densest lane |

Every hit produces a fixed 8ms pulse:

```text
max(1, round(sampleRate * 0.008)) samples
```

Multi Repetitor's 50% duty was considered, but fixed 8ms is chosen because
this project's trigger standard is 5–10ms, the core Clock caps normal pulses at
10ms, and fixed triggers compose predictably with Pluck, ADSR, drums, and
edge-triggered utilities. This is a documented hardware deviation.

LEDs:

- `lane1` through `lane4`: 50ms visual hold after a lane hit.
- `pending`: lit while Rotate differs from its active phrase value or restart
  is queued.

All inputs use explicit 0V normals.

## Normative Algorithm

Precompute the inverse rank table:

```text
rank[P[k]] = k
```

At every accepted clock, sanitize:

```text
D = clamp(round(fill + clamp(fillCV, -5, 5) * 8 / 5), 0, 16)
R = active phrase-latched Rotate
S = ((step - R) mod 16 + 16) mod 16
```

For lane `j = 1..4`:

```text
count[j] = floor(j * D / 4)
hit[j] = rank[S] < count[j]
```

Consequences:

- `lane1 ⊆ lane2 ⊆ lane3 ⊆ lane4` for every Fill and Rotate.
- Each lane's Fill-D mask is a subset of its Fill-(D+1) mask.
- Equal adjacent lanes are unavoidable at silence and some Fill values below
  four. Inclusion is proper for every adjacent pair at Fill 4–16.
- At Fill 8, counts are `[2,4,6,8]`.
- At Fill 16, counts are `[4,8,12,16]`.
- At Fill 8 / Rotate 0:

```text
lane1 {0,8}
lane2 {0,4,8,12}
lane3 {0,2,4,8,10,12}
lane4 {0,2,4,6,8,10,12,14}
```

Increasing Fill does not cancel a pulse that is already active. The new Fill
affects event decisions starting at the current accepted clock.

## Why This Is Not Euclidean

Independently optimal Euclidean masks are not nested. For example, with an
anchored convention:

```text
E(2,8) = {0,4}
E(3,8) = {0,3,6}
```

The onset at step 4 moves. If the opposite pair `{0,4}` must remain, adding one
new onset can only make gaps 4/2/2 or a rotation-equivalent distribution, not
the independently optimal three-hit spacing. Cascade prioritizes stable live
Fill over perfect evenness.

## Clock, Latching, and Reset

- Phrase length is fixed at 16 accepted Clock edges.
- Initial and lifecycle-reset state is `step = -1`; the first later clock plays
  step 0.
- Transport advances on every accepted master clock, including all-rest steps.
- Fill and Fill CV are sampled at each accepted edge.
- Rotate commits only while playing step 0. A mid-phrase change sets Pending,
  then applies atomically on the next natural or reset phrase start.
- External Reset and Reset action immediately cancel active trigger/LED
  counters and set `restartPending`; they do not emit a trigger by themselves.
- The next accepted Clock consumes pending restart, plays step 0, commits
  Rotate, and evaluates lane hits. Reset and Clock on the same sample therefore
  play step 0.
- A held Reset does not repeatedly restart.
- Lifecycle `reset()` clears stable input/output buffers, edge memories,
  counters, active Rotate, pending state, and LEDs.
- Per-sample priority is reset edge detection, clock edge detection, edge-memory
  update, accepted-clock event calculation, then pulse/LED output.

## DSP Plan and Trade-offs

- Preallocate stable inputs, outputs, four trigger counters, four LED counters,
  and fixed rank data in `createDSP()`.
- Process CV per sample only to sanitize the sample at a clock edge; there are
  no pattern arrays or per-block allocations.
- Use integer rank/count comparisons, so Fill changes are deterministic and
  cheap at all supported sample rates and block sizes.
- No RNG, DOM, Web Audio node, or main-thread dependency.
- Export the priority/rank helpers for exhaustive tests.
- Expected hardware difference: no traditional rhythm banks, accents,
  probability, tap tempo, or 50%-duty gates. The ranked Fill invariant is the
  app-specific instrument.

## Cadence Pair Patch Contract

Use common Clock fan-out:

```text
clk.clock -> changes.clock
clk.clock -> cascade.clock

changes.pitch -> lead.vOct
cascade.lane3 -> lead.trigger

changes.root -> bass.vOct
cascade.lane1 -> bass.trigger
```

Never clock Changes from a Cascade lane. Doing so would cause rests to stop the
harmonic phrase. The pair needs no private synchronization because both begin
at pre-step `-1`.

## Contradictions and Decisions

- **Single versus four outputs:** one stable-density output would be compact but
  too close to Euclid. Four contained lanes better match the user's cascading
  request and Multi Repetitor's immediate multi-output value.
- **“Strict” nesting:** mathematically false at Fill 0–3 because adjacent
  counts can be equal. The contract is subset-or-equal/rank-nested, with proper
  inclusion from Fill 4.
- **Immediate versus latched Rotate:** rotation necessarily moves all onsets.
  Phrase latching preserves a stable running phrase; Reset is the immediate
  path.
- **50% gates versus 8ms triggers:** the manufacturer precedent uses 50%, while
  the app and intended destinations favor standard fixed triggers. Fixed 8ms
  won.
- **Euclidean naming:** rejected. Low-discrepancy nested shelling and
  independently even hit placement optimize different goals.
- Source material supports ranked density concepts but does not prescribe this
  exact bit-reversal lane mapping; it is an authored assumption.

## Implementation Plan

- **Module ID/category:** `cascade`, `clock`, 6HP,
  `module-color-five`.
- **Branch/worktree:** `module/changes-cascade` in
  `/Users/orderandchaos/code/eurorack-js/.worktrees/changes-cascade`; shared
  with Changes for the atomic core-graph and combined-patch change.
- **DSP model:** fixed 16-entry inverse-rank table, edge-sampled Fill, phrase-
  latched Rotate, four preallocated trigger counters, separate 50ms LED holds,
  and no pattern allocation.
- **Params:** `fill`, `rotate`, `resetAction`.
- **Inputs:** `clock`, `reset`, `fillCV`.
- **Outputs:** `lane1`, `lane2`, `lane3`, `lane4`.
- **LEDs:** `lane1`–`lane4`, `pending`.
- **Factory patch:** combined `test-changes-cascade.js`, with Clock fanned to
  both modules and lanes 1/3 articulating bass/lead voices.
- **Tests first:** `tests/dsp/cascade.test.js` must exhaust every Fill/Rotate
  mask, subset invariant, panel element, voltage/timing/reset rule, stable
  buffer, LED, and pair integration behavior.
- **Shared changes:** same manifest/static-list and synchronized worklet
  revision updates documented in the Changes plan.
- **Focused validation:** `npm test -- tests/dsp/changes.test.js
  tests/dsp/cascade.test.js tests/rack/module-contracts.test.js
  tests/research/module-queue.test.js`.
- **Patch validation:** `npm test --
  tests/config/factory-patches.test.js tests/app/patch-format.test.js`.
- **DSP audits:** `npm run audit:dsp -- --module cascade --matrix
  --strict-voltage` and the corresponding Changes command.
- **Full validation:** `npm test`.
- **Known assumptions:** fixed 16-step length, authored bit-reversal priority,
  fixed 8ms trigger articulation, and phrase-latched Rotate are intentional
  utility choices.

## Test Targets

1. Metadata, defaults, exhaustive panel coverage, signals, voltage ranges, and
   0V normals.
2. Buffer sizes/identities, full writes, finite invalid-value recovery, and
   lifecycle reset.
3. Clock values at, below, and above 2.5V; sustained-high edge behavior;
   exactly 16 steps and wrap.
4. Exact priority and inverse-rank tables.
5. For every Fill 0–16 and Rotate 0–15: exact count per lane, lane-to-lane
   subset, same-lane Fill-D to Fill-(D+1) subset, and exact rotation.
6. Proper adjacent inclusion at every Fill 4–16; equality cases below four.
7. Golden masks for Fill 0, Fill 8/Rotate 0, and Fill 16.
8. Fill CV at -5/0/+5V, scaling `8/5`, rounding boundaries, clamping, normal
   voltage, and non-finite fallback.
9. Fill changes apply on the next accepted clock and never truncate an active
   pulse.
10. Rotate edits remain pending through step 15 and commit at natural/reset
    step 0; Pending LED.
11. Reset input/action edge behavior, held Reset, same-sample Reset+Clock,
    cancellation of active pulses, and first-clock step 0.
12. Every hit is exactly 8ms and 10V at supported sample rates/block sizes;
    rest samples are exactly 0V; retrigger behavior at high clock rates.
13. Lane LEDs have separate 50ms holds and do not extend trigger voltage.
14. Integration with Changes: common clock preserves harmonic phase through
    rests; increasing Fill retains every previously articulated note position;
    shared reset exactly replays pitch and all lanes.

## DSP Audit (2026-07-30)

- **Focused coverage:** `tests/dsp/cascade.test.js` exhaustively covers every
  Fill 0–16, Rotate 0–15, and lane combination, as well as clock/reset edges,
  CV scaling, phrase latching, exact trigger and LED durations, stable buffers,
  deterministic replay, and paired behavior with Changes.
- **Measured status:** the strict 44.1/48/96kHz by 128/512-sample audit matrix
  completed six scenarios per configuration with finite, stable buffers, zero
  processing errors, zero voltage-contract flags, an exact 10.000V observed
  peak, and a maximum Node diagnostic time of 145.0 microseconds per block.
  All four outputs remain exact 0V/10V triggers.
- **Invariant result:** lane nesting and same-lane Fill nesting hold for the
  complete contract matrix. Fill changes are edge-sampled without truncating
  active pulses, while Rotate remains phrase-latched.
- **31 July re-audit:** fractional Fill values delivered by MIDI or imported
  patches now follow the normative single-round equation after CV is added;
  tests cover both positive and negative boundary crossings. Pending also
  reports a pre-clock Rotate edit and clears when the first step-0 clock
  commits it.
- **Next action:** retain exhaustive mask and common-clock integration tests
  whenever priority order, lane-count mapping, or reset timing changes.

## Sources

Access date for web sources: 2026-07-30.

### Primary and manufacturer sources

- Noise Engineering, **Multi Repetitor Manual** (2026),
  https://manuals.noiseengineering.us/mr/ — four trigger/accent lanes, pattern
  modifiers, external clock/reset, voltages, and 50% duty.
- Noise Engineering, **Developing Multi Repetitor** (2026),
  https://noiseengineering.us/blogs/loquelic-literitas-the-blog/developing-multi-repetitor/
  — design history, immediate performance goal, multi-output value, and
  rejected complexity.
- Noise Engineering, **Numeric Repetitor Manual** (2015-era),
  https://escapefromnoise.com/produktfiler/NR_manual.pdf — prime/factor
  relationship and algorithmic multi-output precedent.
- Noise Engineering, **Generative sequencing with Multi Repetitor and Gamut
  Repetitor** (2026),
  https://noiseengineering.us/blogs/loquelic-literitas-the-blog/generative-sequencing-with-multi-repetitor-and-gamut-repetitor/
  — direct manufacturer example of rhythm and melody modules sharing a clock.
- Mutable Instruments, **Grids documentation** (2012–2022 archive),
  https://pichenettes.github.io/mutable-instruments-documentation/modules/grids/
  — three-channel event density and algorithmic rhythm workflow.
- Mutable Instruments, **Grids pattern generator source**,
  https://github.com/pichenettes/eurorack/blob/master/grids/pattern_generator.cc
  — per-step level versus inverse-density threshold and step-zero perturbation.
- Mutable Instruments, **Marbles Manual** (2018),
  https://pichenettes.github.io/mutable-instruments-documentation/modules/marbles/manual/
  — looped decisions, repeatable variation, and ranked scale carving.
- Mutable Instruments, **Marbles firmware notes**,
  https://pichenettes.github.io/mutable-instruments-documentation/modules/marbles/firmware/
  — reset mode and historical loop-stability fixes.

### Papers and mathematical references

- Godfried Toussaint, **The Euclidean Algorithm Generates Traditional Musical
  Rhythms** (Bridges 2005),
  https://archive.bridgesmathart.org/2005/bridges2005-47.html — even-onset
  distribution and traditional-rhythm context.
- Erik D. Demaine et al., **The Distance Geometry of Music** (2007),
  https://arxiv.org/abs/0705.4085 — rhythm distance and shelling context.
- Ralph Kritzinger, **A note on the van der Corput sequence** (2020),
  https://link.springer.com/article/10.1007/s10231-020-00990-7 — binary digit
  reversal and low-discrepancy sequence properties.

### Independent and practical secondary sources

- Sound On Sound, **Noise Engineering launch Multi Repetitor module** (2026),
  https://www.soundonsound.com/news/noise-engineering-launch-multi-repetitor-module
  — independent feature summary and live-performance framing.
- Create Digital Music, **As much triggering as you can handle: Noise
  Engineering Multi Repetitor** (2026),
  https://cdm.link/multi-repetitor/ — independent comparison of algorithmic
  power and direct drum-machine-like interaction.
- ModularGrid, **Noise Engineering Multi Repetitor**,
  https://modulargrid.net/e/noise-engineering-multi-repetitor — practical 10HP
  panel/spec cross-check and four-output categorization.
- Mutable Instruments, **Grids User Manual** mirror,
  https://www.synthmanuals.com/manuals/mutable_instruments/grids/user_manual/grids_user_manual.pdf
  — practical panel and density cross-check against the archived documentation.

## Remaining Assumptions

- The bit-reversal priority and `floor(j*Fill/4)` lane mapping are authored for
  this application. Sources support ranked density and multi-output performance,
  not this exact table.
- Fixed phrase length 16 is chosen to align with Changes and common modular
  rhythm practice; it is not copied from Multi Repetitor.
- Listening validation may change default Fill or output-lane choice in the
  combined patch, but invariant tables and tests must change with it.
