# Probability Sequencer (`prob-seq`)

## Status and Model

- **Research status:** spec-ready proposal, pending coordinator review and queue
  transition.
- **Module ID:** `prob-seq`.
- **Name:** `PROB SEQ`.
- **Category:** `sequencer`.
- **Model:** an inspired-by software utility, not a component-level emulation of
  any one hardware sequencer.
- **Primary job:** turn an external clock into one programmed trigger lane whose
  eight steps have independent enable, probability, ratchet, and condition
  settings.

The implementation target is deliberately narrow. It combines the step-local
chance and repeat workflow of Malekko Varigate, Metropolix's explicit
per-stage probability and ratchet vocabulary, Elektron's conditional-trig
logic, and Branches' voltage-controlled Bernoulli precedent. It does not copy
the panel, firmware, presets, tracks, pitch sequencing, or menu structure of
any cited product.

## Queue Fit and Distinctness

The queue asks for “per-step probability, ratchets, skips, and conditional
gates rather than fixed deterministic playback.” No existing module has that
contract:

- [`seq`](../../src/js/modules/seq/index.js) is an eight-step pitch/gate
  sequencer. Its random option chooses traversal order; it has no authored
  probability, condition, or ratchet per step.
- [`turing`](../../src/js/modules/turing/index.js) is a looping random shift
  register. Its probability changes whether bits lock or slip; it is not an
  eight-step table of independently authored decisions.
- [`burst`](../../src/js/modules/burst/index.js) makes one probability decision
  for a whole triggered burst. It has no continuously clocked step pattern.
- [`euclid`](../../src/js/modules/euclid/index.js) deterministically distributes
  a chosen number of onsets. It does not evaluate step-local chance or logical
  conditions.

`prob-seq` therefore owns the missing middle ground: a musician programs a
recognizable fixed rhythm, then controls exactly where and why it varies. It
has no pitch output, no random playback direction, no learned pattern, and no
looping-random bit register.

## Research Questions and Answers

1. **Should probability apply once to the step or independently to every
   ratchet?** Once to the step. Metropolix documents both Stage and Pulse
   probability targets; the first version chooses Stage so a successful step
   emits its complete programmed ratchet and one clock consumes one logical
   chance result.
2. **Which conditional-trig subset remains legible on a compact panel?**
   `ALWAYS`, `PRE`, `NOT_PRE`, `FILL`, `NOT_FILL`, `1:2`, `2:2`, `1:4`,
   `2:4`, `3:4`, and `4:4`. Elektron's neighbor, first, and last pattern-chain
   conditions are excluded because this module has one lane and no pattern
   chain.
3. **What does PRE mean?** It uses the final result of the most recently
   evaluated non-PRE/NOT-PRE step, including enable, that step's logical
   condition, and probability. A PRE or NOT_PRE step never overwrites this
   history. This follows Elektron's documented chain behavior instead of the
   tempting but incompatible “physical previous step” interpretation.
4. **How are patterns replayable after patch reload?** A patch-persisted
   integer seed selects an exactly specified PCG32 stream. `Math.random()` is
   forbidden.
5. **Can edits silently shift all later random decisions?** No. Every accepted
   clock consumes exactly one bounded probability result, including disabled,
   logically false, 0%, and 100% steps. The result may be discarded, but draw
   position depends only on accepted-clock count and explicit reseeding.
6. **How do ratchets follow an irregular external clock?** The first step
   after startup/reset uses a fallback BPM. Thereafter the latest valid clock
   interval is divided into 1–8 equal subdivisions. A new clock cancels any
   unsent ratchets from the prior step.
7. **When do seed and length edits become active?** At the next natural wrap,
   using the old active length to classify that wrap. Reset commits both
   immediately. This prevents mid-pattern structural jumps.
8. **What voltage does probability CV represent?** Bipolar -5..+5 V adds
   -100..+100 percentage points at 20 points/V, then clamps to 0..100.

## Source Register

All live web sources were rechecked on 31 July 2026. Electrical values not
explicitly supported by a hardware source are identified below as local app
decisions.

### Primary product and manual sources

1. **Digitakt II User Manual, OS 1.10, Elektron, 20 March 2025.**
   [Official manual PDF](https://elektron.se/wp-content/uploads/2025/03/Digitakt-2-User-Manual_ENG_OS1.10_250320.pdf)
   — Primary source for probability being reevaluated on each play, per-trig
   probability locks, PRE/NOT-PRE history, FILL/NOT-FILL, A:B cycle
   conditions, and per-step retrig rates. It also establishes that PRE chains
   ignore intervening PRE-family evaluations when maintaining history.
2. **Metropolix Manual v1.5, Intellijel, 29 April 2025.**
   [Official manual PDF](https://intellijel.com/downloads/manuals/metropolix_manual_v1.5_2025.04.29.pdf)
   — Primary source for per-stage probability from 0–100%, separate Stage and
   Pulse probability targets, per-stage skips, 1–8 ratchets, and subdividing a
   clock period into multiple gates.
3. **Metropolix product page and current downloads, Intellijel, accessed 31
   July 2026.**
   [Official product page](https://intellijel.com/shop/eurorack/metropolix/)
   — Confirms the current product context, performance focus, assignable
   inputs/outputs, recall model, physical specifications, and availability of
   manual v1.6 dated 24 September 2025. The accessible v1.5 manual above is
   used for the detailed probability/ratchet citations.
4. **Varigate 8+ User Manual v2, Malekko Heavy Industry, approximately
   2017.**
   [Archived distributor-hosted PDF](https://www.allfordj.ru/upload/iblock/6c6/rukovodstvo_polzovatelya_malekko_varigate_8.pdf)
   — Manufacturer-authored manual mirrored after Malekko's site became
   unavailable. It supports the eight gate-lane panel, step sliders, per-step
   probability, repeat, delay and pulse-width editing, external clock/reset,
   reset-to-step-one behavior, and end-of-cycle output.
5. **Branches Manual, Mutable Instruments / Emilie Gillet.**
   [Official documentation archive](https://pichenettes.github.io/mutable-instruments-documentation/modules/branches/manual/)
   — Primary source for a probability knob plus CV, one Bernoulli decision per
   received trigger, and deterministic behavior at probability extremes.
6. **Branches open-source notes and firmware, Mutable Instruments / Emilie
   Gillet.**
   [Official open-source page](https://pichenettes.github.io/mutable-instruments-documentation/modules/branches/open_source/)
   and [source tree](https://github.com/pichenettes/eurorack/tree/master/branches)
   — Comparable firmware reference for worklet-safe, event-driven Bernoulli
   decisions. `prob-seq` does not port its routing or toggle/latch modes.

### Independent demos and reviews

7. **“Malekko Varigate 8+: In-Depth Video Manual,” Daniel Dehaan, 16
   February 2017.**
   [Independent video](https://www.youtube.com/watch?v=8Uk-mCEaxJ8)
   — The chaptered demonstration independently confirms the live workflow for
   programming probability, repeats, delay, pulse width, and randomized
   variation rather than treating them as specification-list features only.
8. **“Intellijel Metropolix review,” Rob Redman, MusicRadar, 7 September
   2021.**
   [Independent review](https://www.musicradar.com/reviews/intellijel-metropolix)
   — Observes responsive controls, readable feedback, accessible operation,
   and a strong improvisation/jamming workflow. This supports direct step
   controls and visible decisions instead of a deep-menu UI.

### Algorithmic and historical sources

9. **“PCG: A Family of Simple Fast Space-Efficient Statistically Good
   Algorithms for Random Number Generation,” Melissa E. O'Neill, Harvey Mudd
   College technical report HMC-CS-2014-0905, 5 September 2014.**
   [Paper and citation record](https://www.pcg-random.org/paper.html) and
   [minimal reference implementation](https://www.pcg-random.org/using-pcg-c-basic.html)
   — Primary algorithm source for the specified 64-bit-state/32-bit-output
   generator and unbiased bounded integer generation.
10. **ECMA-262, `Math.random`, Ecma International / TC39, living
    specification accessed 31 July 2026.**
    [Normative section](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.random)
    — The algorithm is implementation-defined and exposes no portable user
    seed, so it cannot support patch-reconstructible probability streams.
11. **“Musical Composition with a High-Speed Digital Computer,” Lejaren A.
    Hiller Jr. and Leonard M. Isaacson, Journal of the Audio Engineering
    Society 6(3), July 1958, pp. 154–160.**
    [AES bibliographic record](https://secure.aes.org/forum/pubs/journal/?elib=231)
    — Historical precedent for combining random choices with explicit
    compositional rules. It supplies context, not this module's runtime
    algorithm.

### Local integration sources

12. **Eurorack JS `seq`, `turing`, `burst`, and `euclid` module contracts,
    revision inspected 31 July 2026.**
    [`seq`](../../src/js/modules/seq/index.js),
    [`turing`](../../src/js/modules/turing/index.js),
    [`burst`](../../src/js/modules/burst/index.js), and
    [`euclid`](../../src/js/modules/euclid/index.js) — Authoritative evidence
    for local distinctness, stable buffer practice, clock conventions, and the
    features that `prob-seq` must not duplicate.
13. **Eurorack JS Refrain deterministic-generator contract and
    implementation, revision inspected 31 July 2026.**
    [Research contract](refrain.md) and
    [module implementation](../../src/js/modules/refrain/index.js) — Local
    precedent for a visible 16-bit seed, PCG32 with two 32-bit halves, bounded
    generation, first-process hydration, and bounded telemetry. `prob-seq`
    defines its own simpler draw schedule below.

## Source Quality, Contradictions, and Decisions

- Elektron and Intellijel documentation are current first-party sources and
  win for condition semantics, probability range, and ratchet vocabulary.
- Text extraction from the Elektron PDF can render the NOT-PRE glyph like PRE.
  The surrounding prose clearly describes both positive and inverted forms;
  the app uses unambiguous internal names `PRE` and `NOT_PRE`.
- Metropolix offers both Stage and Pulse probability. Varigate repeat behavior
  can also produce more complex per-repeat variation. The app chooses Stage:
  one probability result admits or rejects the entire programmed ratchet. It
  is easier to predict, preserves a fixed draw schedule, and still satisfies
  the queue's ratchet requirement.
- Metropolix documents up to eight ratchets; Elektron documents musical retrig
  rates rather than a common integer-count parameter. The app uses the clear
  integer range 1–8 and equal subdivision.
- Varigate's original manufacturer site and firmware are no longer reliably
  available. Its mirrored manufacturer manual is retained as a qualified
  primary artifact and independently corroborated by Dehaan's demo. It is not
  used as the sole source for electrical facts.
- Reviewed manuals do not publish one mutually applicable input threshold for
  all clock/reset jacks. The app therefore uses its local standards: clock
  crossings at `>2.5 V`, trigger/reset high at `>=1 V`, and 0/10 V outputs.
- Branches hardware sends +5 V in latch mode, while this app's gate standard is
  0/10 V. `prob-seq` is not a Branches emulation and follows the app standard.
- Probability CV is directly precedented by Branches but not required by each
  cited sequencer. Adding one global CV is a software adaptation: it moves all
  per-step percentages by the same number of percentage points without
  changing stored steps.
- No source dictates a reproducible seed or exact draw ordering for this
  combined design. Those are explicit app requirements so factory patches,
  saved patches, tests, and offline renders can reproduce the same decisions.
- Hiller/Isaacson supplies historical context for constrained chance. It does
  not justify any claim of stylistic or compositional equivalence.

## Observed Musical and Interaction Behavior

- Probability is most useful when it modifies a recognizable programmed
  rhythm rather than replacing the rhythm with unconstrained randomness.
- Per-step repeat/ratchet makes a successful event denser without requiring a
  faster master clock. Probability then varies phrases while keeping the
  ratchet gesture intact.
- Direct per-step controls and immediate visual feedback support performance:
  skip, probability, repeat, and conditions can be changed while the sequence
  continues.
- A:B conditions make deterministic longer forms from a short pattern. For
  example, `2:4` is true on the second of each four traversals regardless of
  random chance.
- PRE/NOT_PRE make related decisions. A lower-probability source step can
  control a following fill or response while chained PRE conditions continue
  to reference the same originating result.
- FILL/NOT_FILL provide an intentionally performable override lane. The Fill
  level is sampled at the step edge, so pressing or releasing it later does
  not revise an already scheduled ratchet.
- The independent review evidence favors readable, immediate controls. The
  proposed custom UI shows all eight step summaries at once and expands one
  selected step for exact editing.

## Closed Functional Specification

### Pattern and condition model

- The pattern always allocates eight persisted step records. `length` selects
  the active prefix from 1 through 8.
- Each step record is exactly:

  ```text
  {
      enabled: 0 | 1,
      probability: integer 0..100,
      ratchets: integer 1..8,
      condition: integer 0..10
  }
  ```

- Condition codes are stable patch data:

  | Code | Label | True when entered |
  | ---: | --- | --- |
  | 0 | `ALWAYS` | Always. |
  | 1 | `PRE` | The stored prior base result is true. |
  | 2 | `NOT_PRE` | The stored prior base result is false. |
  | 3 | `FILL` | Fill input is high on this clock sample. |
  | 4 | `NOT_FILL` | Fill input is low on this clock sample. |
  | 5 | `1:2` | Cycle index within two is 1. |
  | 6 | `2:2` | Cycle index within two is 2. |
  | 7 | `1:4` | Cycle index within four is 1. |
  | 8 | `2:4` | Cycle index within four is 2. |
  | 9 | `3:4` | Cycle index within four is 3. |
  | 10 | `4:4` | Cycle index within four is 4. |

- Cycle numbers are one-based. After startup, reset, seed activation, or
  length activation, the first traversal is cycle 1. A natural wrap advances
  the cycle counter as `1 + (cycleNumber % 4)` unless that wrap activates a
  seed or length change, in which case it restarts at 1.
- `A:B` is true exactly when
  `((cycleNumber - 1) % B) === (A - 1)`.
- `priorBaseResult` starts false. After evaluating any condition other than
  PRE/NOT_PRE, replace it with that step's final result after `enabled`,
  logical condition, and probability have all been applied. PRE and NOT_PRE
  read it but do not replace it. This lets consecutive PRE-family steps form
  one chain as documented by Elektron.
- An inactive step outside `length` is never visited and consumes no draw.
- A disabled step inside `length` is still visited, consumes its fixed
  probability result, produces no gate, and stores false in prior history if
  its condition is not PRE-family.

### Exact probability decision

At every accepted clock that evaluates a step:

1. Read and sanitize that step record and the current Probability CV sample.
2. Compute:

   ```text
   effectiveProbability = clamp(
       Math.round(finite(step.probability, 100)
           + clamp(finite(probabilityCv, 0), -5, 5) * 20),
       0,
       100
   )
   ```

3. Obtain exactly one `roll = bounded(100)` result. Rejection sampling may
   consume more than one raw PCG32 word, but it yields one logical result.
4. Evaluate the logical condition from the cycle, Fill level, or stored prior
   result.
5. The step fires exactly when
   `enabled && logicalCondition && roll < effectiveProbability`.
6. Store the result in prior history only for non-PRE-family conditions.

The draw occurs even if `enabled` is false, the logical condition is false, or
effective probability is 0 or 100. This deliberate fixed schedule means
enabling a skipped step or changing a condition does not move all later chance
positions. Probability 0 still never passes; probability 100 always passes
because `roll` is in 0..99.

### Exact PCG32 contract

Use PCG XSH-RR 64/32 with unsigned arithmetic modulo `2^64`, multiplier
`6364136223846793005`, and fixed odd increment
`1442695040888963407`.

Seeding a visible integer `seed` is exactly:

1. set state to zero;
2. run one PCG32 step;
3. add unsigned `seed` to state modulo `2^64`;
4. run one PCG32 step.

Each PCG step returns an output derived from `oldState`, then sets
`state = oldState * multiplier + increment (mod 2^64)`. Its result is the
32-bit rotate-right of
`xorshifted = (((oldState >> 18) XOR oldState) >> 27)` by
`rotation = oldState >> 59`, matching the cited PCG32 definition.

`bounded(n)` must use rejection sampling:

```text
threshold = (2^32 - n) mod n
repeat draw = pcg32() until draw >= threshold
return draw mod n
```

The production implementation should use two unsigned 32-bit halves plus
`Math.imul`, following the existing Refrain implementation, rather than
allocating BigInts in the sample loop. Golden tests must lock the official
PCG seed vectors, the first probability rolls for seeds 0 and 65535, bounded
rejection, and reset replay. This exact local contract wins over alternative
PCG stream or seeding conventions.

### Clock, transport, and cycle model

- An **accepted clock** is a rising crossing from `<=2.5 V` to `>2.5 V`.
- Startup/hydration exposes step 1 as armed but emits nothing. The first
  accepted clock evaluates step 1; it does not advance to step 2 first.
- Every later accepted clock enters and evaluates the next step.
- An ordinary advance from the old active length's last step to step 1 is a
  **natural wrap**. It emits EOC, resolves pending seed/length changes, and
  starts the next cycle before evaluating step 1.
- No internal clock free-runs. `fallbackBpm` supplies only a duration estimate
  for ratchet spacing before a valid external interval is known.
- The first clock after startup/reset uses
  `round(sampleRate * 60 / fallbackBpm)` samples as its estimated step period.
  Beginning with the second edge, the latest valid interval between accepted
  clocks replaces that estimate.
- Valid measured intervals are finite and at least one sample. An interval
  longer than 10 seconds is treated as a stopped/restarted clock and uses the
  fallback period for that decision. The edge still advances the sequence.
- Edits to a step record are sampled when that step is entered. They never
  revise the current step's already scheduled ratchets.
- `fallbackBpm` and Probability CV are sampled for the current decision only.

### Ratchet scheduler

- A successful step with `R` ratchets emits its first trigger on the clock
  sample and schedules `R - 1` triggers at normalized offsets
  `round(j * periodSamples / R)` for `j = 1..R-1`.
- Offsets are strictly increasing after rounding, at least one sample, and
  strictly less than the estimated period. Coincident rounded offsets collapse
  to one trigger instead of allocating or creating zero-width pulses.
- Every trigger is normally 5 ms. Its actual width in samples is:

  ```text
  max(1, min(round(sampleRate * 0.005), floor(subdivisionSamples / 2)))
  ```

  where `subdivisionSamples = periodSamples / R`. This keeps dense ratchets
  separated and guarantees at least one high sample.
- A new accepted clock first cancels every unsent ratchet from the preceding
  step and terminates its active gate pulse, then evaluates and schedules the
  newly entered step. Ratchets therefore cannot spill across a changed or
  unexpectedly early clock edge.
- A failed, disabled, or conditionally false step emits no initial or later
  ratchet.
- Scheduling uses preallocated fixed-size arrays or scalar slots for at most
  eight starts. `process()` performs no dynamic allocation.

### Seed and length boundary transaction

- `requestedSeed` and `requestedLength` track the latest sanitized panel
  values. `activeSeed` and `activeLength` drive the current pattern.
- A panel edit equal to the active value clears that field's pending state.
- Pending values commit together at the next natural wrap, which is classified
  using the old active length.
- On that wrap, transaction order is:

  1. cancel stale ratchets and classify the old-length wrap;
  2. emit EOC;
  3. commit the latest requested seed and length;
  4. if seed changed, reseed PCG32;
  5. if seed or length changed, set cycle to 1 and clear prior history;
  6. enter step 1 under the new active values;
  7. consume its probability result and evaluate it.

- A length-only commit does not reseed PCG32. It resets condition-cycle and PRE
  history but continues the accepted-clock random stream.
- A seed commit always reseeds, even at the same clock sample that enters step
  1. The step-1 decision uses the first post-seeding probability result.
- EOC describes the completed old traversal. Startup, lifecycle hydration,
  and asynchronous reset do not emit EOC.

### Reset, collisions, and hydration

- The Reset input detects a rising edge from `<1 V` to `>=1 V`. Holding it high
  does not retrigger.
- On the reset sample, cancel all gate/EOC pulses and pending ratchets, commit
  the latest requested seed and length, reseed from the active seed, clear
  measured clock history and PRE history, set cycle to 1, and arm step 1 for
  the next accepted clock. Reset itself emits no gate or EOC.
- If Reset and Clock rise on the same sample, Reset is handled first and that
  clock immediately evaluates step 1 with the first post-seed result.
- If Reset and Fill change on the same sample as Clock, the clock decision sees
  the new Fill level after reset handling.
- `reset()` clears transport, edge histories, output buffers, LEDs, timers,
  measured intervals, telemetry transients, and PRNG continuation while
  preserving assigned params. It requests the same hydration transaction as a
  newly created DSP instance.
- First-process hydration is required because the worklet assigns persisted
  params after `createDSP()`:

  1. read and sanitize persisted seed, length, BPM, and all eight step records;
  2. install active/requested seed and length and seed PCG32;
  3. establish panel values without treating restored values as live edits;
  4. expose step 1 as armed, with all trigger outputs low;
  5. establish jack histories low and process sample 0 normally, so an already
     high routed Clock or Reset can create one edge.

The persisted seed plus persisted steps, length, the same clock/fill samples,
and the same reset history must reproduce the same fired-step decisions after
patch reload at every supported sample rate and block size. Sample-rate
rounding changes physical ratchet sample offsets, not the logical probability
sequence.

### Persistence and volatility

Patch-persisted state is limited to:

- visible numeric params `seed`, `length`, and `fallbackBpm`;
- the structured eight-record `steps` value declared through `ui.state`.

Runtime-only volatile state includes active/requested transaction scalars,
PCG32 continuation, transport index, cycle, prior condition result, measured
clock interval, pending ratchet deadlines, edge histories, pulse timers, and
telemetry. Reload reconstructs that runtime state from the persisted seed and
pattern; it does not serialize transport position.

Custom step controls must replace the structured `steps` value and call
`onParamChange('steps', nextSteps)`. Mutating the stable UI mirror directly
does not control worklet DSP.

## App Panel Contract

### Metadata and layout

| Field | Contract |
| --- | --- |
| ID | `prob-seq` |
| Name | `PROB SEQ` |
| Category | `sequencer` |
| Width | 14 HP |
| Color | `module-color-eleven` |
| Renderer | Custom, with all eight step summaries visible and one selected-step editor |

Suggested top-to-bottom layout:

1. compact `SEED`, `LENGTH`, and `BPM` controls with numeric `ACTIVE` seed;
2. eight step cells showing active position, enable/skip, percentage, ratchet
   count, and condition abbreviation;
3. a selected-step editor with Enable, Probability, Ratchets, and Condition;
4. Hit/Miss/EOC/Pending indicators;
5. Clock, Reset, Fill, and Probability CV inputs; Gate and EOC outputs.

Selecting a step is UI-local and not patch state. Toggling Enable or changing a
step editor field replaces `params.steps`. There is no hidden long-press mode.
The eight Enable controls are the module's persisted switches. Step selection
is a non-persisted UI button; there are no transport or manual-trigger buttons.

### Persisted params and controls

| Param | Panel label | UI | Domain/default | Exact behavior |
| --- | --- | --- | --- | --- |
| `seed` | SEED | stepped numeric knob | integer 0..65535, default 0 | Requested deterministic stream identity; commits at wrap or reset. |
| `length` | LENGTH | stepped knob | integer 1..8, default 8 | Requested active prefix; commits at wrap or reset. |
| `fallbackBpm` | BPM | stepped knob | integer 30..300, default 120 | Ratchet interval estimate until a valid clock interval exists. It does not generate clocks. |
| `steps` | eight step editors | `ui.state` structured value | eight default records | Replaced atomically by the custom renderer; individual edits apply when that step is next entered. |

Every default step record is
`{ enabled: 1, probability: 100, ratchets: 1, condition: 0 }`.

Sanitization is field-local and finite:

- non-finite seed -> 0; otherwise round and clamp 0..65535;
- non-finite length -> 8; otherwise round and clamp 1..8;
- non-finite BPM -> 120; otherwise round and clamp 30..300;
- missing/non-array steps -> the full default array;
- invalid record -> default only that record;
- enable -> exactly 0 or 1 (`>=0.5` means 1);
- probability -> round/clamp 0..100, default 100;
- ratchets -> round/clamp 1..8, default 1;
- condition -> round/clamp 0..10, default 0.

### Inputs

| Port | Label | Signal | Voltage/normal | Behavior |
| --- | --- | --- | --- | --- |
| `clock` | CLOCK | trigger | 0..10 V, normal 0 V | Rising crossing from `<=2.5 V` to `>2.5 V` enters one step. |
| `reset` | RESET | trigger | 0..10 V, normal 0 V | Rising crossing from `<1 V` to `>=1 V` arms step 1 and replays the seed. |
| `fill` | FILL | gate | 0..10 V, normal 0 V | `>=1 V` is high; sampled on the accepted clock for FILL-family conditions. |
| `probabilityCv` | PROB CV | cv | -5..+5 V, normal 0 V | Adds 20 percentage points/V to every current step probability, then clamps. |

Input `Float32Array` identities are stable for DSP lifetime. Disconnection is
handled by graph normalization; the module never replaces or clears input
arrays itself.

### Outputs

| Port | Label | Signal | Rails | Behavior |
| --- | --- | --- | --- | --- |
| `gate` | GATE | trigger | exactly 0/10 V | Fixed/subdivision-limited 5 ms step and ratchet pulses. |
| `eoc` | EOC | trigger | exactly 0/10 V | 5 ms pulse on each natural old-length wrap, including a wrap that commits new structure. |

The outputs are low at construction, after reset, and after every pulse timer
expires. Every sample of every output buffer is overwritten in each
`process()` call.

### LEDs and telemetry

| Field | Meaning |
| --- | --- |
| `step1`..`step8` | One-hot active/armed step. Steps outside active length render dim/off. |
| `hit` | 1 for 50 ms after a decision that emitted a gate. |
| `miss` | 1 for 50 ms after a disabled, condition-false, or probability-false decision. |
| `eoc` | Mirrors the EOC output pulse. |
| `seedPending` | 1 while requested seed differs from active seed. |

The custom renderer requires bounded telemetry:

```javascript
telemetry: {
    fields: ['activeSeed', 'activeLength', 'cycleNumber', 'lastDecisionCode'],
    methods: []
}
```

- `activeSeed`: integer 0..65535.
- `activeLength`: integer 1..8.
- `cycleNumber`: integer 1..4.
- `lastDecisionCode`: integer `0 = none/startup`, `1 = hit`, `2 = disabled`,
  `3 = condition false`, `4 = probability false`.

No history array or method call is needed. UI polling must not allocate or
transfer unbounded event data.

## Voltage and Timing Contract

- Clock threshold follows the repository clock standard: low at or below
  2.5 V, accepted when strictly above 2.5 V.
- Reset and Fill follow repository gate/trigger standards: high at 1 V or
  above.
- All unpatched inputs normalize to 0 V.
- Probability CV is bipolar -5..+5 V and clamps before scaling. Values beyond
  the declared range cannot increase the effective range.
- Gate and EOC are exact 0 V or 10 V; no intermediate ramping or saturation is
  used.
- Nominal output pulses are 5 ms, matching the app's 5–10 ms trigger standard.
- Ratchet pulse shrinkage is the documented dense-timing exception and never
  goes below one sample.
- EOC remains 5 ms even when the next clock arrives earlier; Reset truncates
  it immediately, while later Clock edges do not cancel EOC.
- All timing uses integer sample counters. No `Date`, DOM timer, Web Audio node,
  promise, or main-thread callback is allowed in `createDSP()`/`process()`.

## DSP Plan and Trade-offs

### Processing order per sample

1. Sanitize live scalar params sufficiently to update requested seed/length
   and fallback BPM without allocating.
2. Detect Reset before Clock; sample Fill and Probability CV as finite values.
3. If Reset rises, run the reset transaction.
4. If Clock rises, cancel stale Gate ratchets/pulse, determine startup,
   ordinary advance, or natural wrap, run any wrap transaction, choose the
   entered step, consume its fixed probability result, evaluate conditions,
   update history/LED telemetry, and schedule a ratchet if it fires.
5. Start any scheduled ratchet whose deadline is this sample.
6. Render Gate and EOC from their integer remaining-sample counters.
7. Update LED decay counters and overwrite every output sample.

At a clock sample, the newly evaluated initial Gate pulse wins over stale
prior-step gate state. Scheduled ratchets are stored as absolute monotonic
sample indices or countdowns that remain correct across process block
boundaries.

### Chosen model

- **Faithfulness:** inspired by the cited performance sequencers' observable
  probability, skip, ratchet, and condition behavior; not firmware-identical.
- **Determinism:** stronger than the cited hardware evidence because the app
  must reconstruct saved patches and support golden tests.
- **CPU:** constant work per audio sample plus at most eight small scheduling
  slots on clock edges; no process-time allocation.
- **Sound:** output is control voltage only. Sample-accurate edges and pulse
  separation prevent missing or merged ratchets at ordinary musical clocks.
- **Usability:** one lane and a selected-step editor keep the panel legible.
  Multi-track/pitch/pattern-chain behavior is intentionally deferred rather
  than hidden in menus.

### Rejected alternatives

- **`Math.random()`:** not seedable or cross-runtime reproducible.
- **Draw only for eligible 1–99% steps:** edits would shift all later random
  outcomes, frustrating replay and golden tests.
- **Independent probability per ratchet:** useful, and documented by
  Metropolix Pulse mode, but it makes chance density and draw ordering harder
  to understand. It can be a future explicit mode.
- **Clock-width gates:** ratchets need known subdivision pulses; fixed trigger
  width is clearer and interoperable.
- **Pitch CV lane:** duplicates `seq` and expands the UI beyond the queue item.
- **Random playback direction:** duplicates `seq`'s traversal feature rather
  than adding authored conditional probability.
- **Neighbor/first/last conditions:** require tracks or pattern chains that do
  not exist in v1.
- **Internal clock:** a fallback clock source would blur ownership with `clk`;
  BPM exists only to estimate the first ratchet period.

## Assumptions and Explicit Non-goals

- Hardware input thresholds and logic-output rails are not treated as shared
  facts across the reference devices; local voltage standards are normative.
- “Ratchets = 1” means one initial trigger, not one additional repeat.
- `PRE` refers to the most recently evaluated non-PRE-family result, not
  necessarily the physical previous step.
- Fill is a sampled level, not a trigger or latched mode.
- One probability draw is consumed on every accepted step by design.
- Step state edits are not boundary-queued as a whole pattern; each becomes
  audible when its step is next entered. Seed/length are the only structural
  wrap transactions.
- No swing, microtiming/delay, variable pulse width, probability-per-ratchet,
  pattern memory, song chain, CV/pitch lane, MIDI, internal clock, or multiple
  output lanes are in the first implementation.
- No claim is made that PCG32 models a hardware sequencer's random source. It
  is a reproducibility mechanism.

## Exact Test Targets

### 1. Initialization and hydration

- `createDSP()` creates stable params, four input buffers, two output buffers,
  LEDs, telemetry, and fixed ratchet storage at every supported block size.
- Defaults are seed 0, length 8, BPM 120, and eight enabled 100%/one-ratchet/
  ALWAYS steps.
- First process hydrates params assigned after construction, seeds PCG32 from
  the restored value, shows step 1 armed, and emits no output before Clock.
- Malformed/missing structured step records sanitize independently without
  replacing input/output array identities.

### 2. Output ranges and buffer integrity

- Gate/EOC samples are always exactly 0 or 10 V, finite, and never NaN or
  infinite at 44.1, 48, and 96 kHz with 128- and 512-sample blocks.
- Every output sample is overwritten; stale high samples do not survive into a
  later block.
- Inputs and outputs preserve object identity across process and reset.

### 3. Clock and transport

- A crossing to exactly 2.5 V is not accepted; a crossing above it is.
- Held-high Clock advances once only.
- First accepted Clock evaluates step 1; eight accepted clocks at length 8
  visit steps 1..8, and the ninth wraps/evaluates step 1 and emits EOC.
- Length 1 evaluates step 1 on every clock and emits EOC from the second clock
  onward, not on startup.
- Clock advances even after intervals over 10 seconds but uses fallback timing
  for that decision.

### 4. Probability and CV

- Stored probabilities 0 and 100 never/always pass under 0 V CV but both
  consume one bounded result.
- -5, 0, and +5 V apply -100, 0, and +100 percentage points and clamp.
- Half-point rounding follows ECMAScript `Math.round`; non-finite CV is 0 V.
- A golden seed/clock fixture produces exact documented decision bits across
  block segmentation and lifecycle reload.
- Disabling a step or making its condition false leaves the subsequent
  accepted-clock rolls at the same positions as when it was eligible.

### 5. PCG32

- Official reference seeding/output vectors pass with two-half arithmetic.
- Seeds 0 and 65535 produce locked first-roll sequences.
- `bounded(100)` rejects words below threshold and remains unbiased by raw
  modulo shortcut.
- Reset at the same seed replays the same logical decisions.
- A natural seed commit makes step 1 consume the first post-seed roll.

### 6. Conditions and switches

- Every one of 11 condition codes is exercised.
- A:B truth tables are exact for cycles 1..8.
- FILL sees `>=1 V`; NOT_FILL is its inverse and samples only on Clock.
- PRE/NOT_PRE starts from false after reset/structural commit.
- A non-PRE step stores its final hit/miss result; consecutive PRE-family steps
  do not overwrite it.
- Disabled ALWAYS stores false; PRE following it therefore misses and
  NOT_PRE passes its logical condition.
- Invalid condition values sanitize to ALWAYS.

### 7. Ratchets and BPM

- Ratchets 1 emits one pulse on the clock edge; ratchets 8 emits eight ordered
  starts within one estimated period at an ordinary tempo.
- First post-reset decision uses the exact 30/120/300 BPM fallback periods.
- Second and later decisions use the latest valid external interval.
- A new early Clock cancels unsent prior ratchets and truncates the prior Gate
  pulse before deciding the new step.
- Dense ratchets shorten to half subdivision but remain at least one sample;
  duplicate rounded offsets collapse safely.
- Failed steps schedule zero pulses.

### 8. Seed/length transactions

- Seed and length edits remain requested until the old-length natural wrap.
- Latest edit before that wrap wins; returning to active clears pending.
- Simultaneous pending seed/length commit together before new step 1.
- Length-only change preserves PCG continuation but resets cycle/PRE history.
- Seed change reseeds and resets cycle/PRE history.
- Active/requested telemetry and Pending LED reflect the transaction, not just
  the raw panel value.

### 9. Reset and collisions

- Reset threshold is `>=1 V`; held-high Reset acts once.
- Asynchronous Reset immediately clears Gate, EOC, ratchets, LED transients,
  clock measurement, cycle, and prior result, then arms step 1.
- Reset commits requested seed/length and replays the seed.
- Same-sample Reset+Clock evaluates step 1 exactly once with the first roll.
- Same-sample Fill level is used by that step.
- `reset()` preserves assigned params but repeats first-process hydration.

### 10. LEDs and telemetry

- Step LEDs are one-hot for the armed/active step and inactive-length cells are
  dim/off.
- Hit and Miss remain high for 50 ms after their respective decisions and then
  clear at every supported sample rate.
- EOC LED mirrors EOC output.
- Pending reflects requested vs active seed; active seed/length and cycle
  telemetry stay within bounds.
- Last-decision codes distinguish hit, disabled, condition miss, and
  probability miss without history allocation.

### 11. UI and persistence

- Every step edit replaces the structured array and calls `onParamChange`.
- UI selection does not enter patch state.
- Patch round-trip preserves seed, length, BPM, and all eight exact step
  records; it does not persist transport or PRNG continuation.
- Custom renderer cleanup removes listeners and timers.

### 12. Spec compliance and audit

- Focused tests verify the queue-required initialization, every param, CV,
  gate/trigger behavior, conditions, LEDs, reset, rails, and buffer integrity.
- Strict DSP audit passes every supported sample-rate/block-size matrix without
  voltage violations or allocation-driven buffer replacement.
- A listening/manual patch check confirms probability variation remains a
  recognizable base rhythm and ratchets do not spill into the next clock.

## Implementation Plan

- **Module ID/category:** `prob-seq`, `sequencer`.
- **Implementation branch/worktree:** branch `module/prob-seq` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/prob-seq`.
- **Research input:** merge or cherry-pick this approved research commit before
  writing tests or DSP. The coordinator owns the queue transition from
  `researching` to `spec-ready` and later `implementing`.
- **DSP model:** self-contained sample-accurate eight-step trigger sequencer;
  PCG32 deterministic Stage probability; 11-condition subset; fixed-size
  1–8-ratchet scheduler; wrap-quantized seed/length; worklet-safe hydration.
- **Metadata:** 14 HP, `module-color-eleven`, custom renderer, bounded scalar
  telemetry only.
- **Persisted params/state:** `seed`, `length`, `fallbackBpm`, and structured
  `steps` through `ui.state`.
- **Inputs:** `clock`, `reset`, `fill`, `probabilityCv` with the exact signal
  types, voltage declarations, normals, and thresholds above.
- **Outputs:** `gate` and `eoc`, both exact 0/10 V triggers.
- **LEDs:** `step1`..`step8`, `hit`, `miss`, `eoc`, `seedPending`.
- **Telemetry:** `activeSeed`, `activeLength`, `cycleNumber`,
  `lastDecisionCode`; no methods/history.
- **New implementation files:**
  `src/js/modules/prob-seq/index.js`,
  `tests/dsp/prob-seq.test.js`, and
  `src/js/config/patches/test-prob-seq.js`.
- **Registration:** insert `prob-seq` adjacent to `seq` in
  `src/js/rack/module-manifest.js` and the identical position in
  `src/js/rack/core-definitions.js`; preserve uninterrupted aliases and bump
  the shared graph revision in `audio/worklet-engine.js`,
  `audio/worklet/processor.js`, and `audio/worklet/core-plugin.js`.
- **Factory patch:** “Test Probability Sequencer”: `clk.clock` fans out to
  `prob-seq.clock`; `prob-seq.gate` fans out to `hat.trigClosed` and
  `scope.in1`; `prob-seq.eoc` goes to `scope.in2`; `hat.out` fans out to
  `out.L` and `out.R`. Reinspect these exact source-defined ports during
  implementation before committing the patch. Use varied persisted step
  probabilities, ratchets, and A:B/PRE conditions so the patch demonstrates
  the module rather than an all-100% clock copy.
- **Documentation:** add `prob-seq` to AGENTS.md's available modules and the
  README module table. Update `docs/creating-modules.md` only if implementation
  exposes a genuinely reusable structured-step/transaction pattern not already
  covered.
- **Shared framework changes:** none beyond normal core registration, alias
  renumbering, and the required synchronized graph-revision bump. PCG and
  scheduling stay module-local.
- **Focused test command:**

  ```bash
  npm test -- tests/dsp/prob-seq.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
  ```

- **Patch validation command:**

  ```bash
  npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js
  ```

- **DSP audit:**

  ```bash
  npm run audit:dsp -- --module prob-seq --matrix --strict-voltage
  ```

- **Full pre-merge validation:** `npm test`.
- **Known assumptions:** local 0/10 V rails and thresholds are normative;
  probability targets the complete step, not individual ratchets; PRE history
  ignores PRE-family steps; fallback BPM is not an internal clock; the random
  draw schedule is one bounded result per accepted step; transport is volatile.

## DSP Audit (Not Yet Implemented — 31 July 2026)

No runtime DSP exists at this research gate, so reporting measured ranges,
spectra, or matrix results would be misleading. The implementation gate must
run the focused tests and strict matrix command above, record the result here,
and link any finding requiring cross-module work into
[`research/sound-engineering-review.md`](../sound-engineering-review.md).

## Spec-ready Gate Assessment

- Primary manuals, a qualified archived manufacturer manual, independent demo
  and review evidence, historical context, a PRNG paper, normative language
  behavior, comparable firmware, and local contracts are cited.
- Product observations, source-quality limits, contradictions, decisions,
  assumptions, and explicit non-goals are recorded.
- The complete panel, persistence, UI, telemetry, normalization, voltage,
  threshold, pulse, transport, reset, collision, RNG, condition, ratchet, and
  boundary contracts are closed.
- Tests cover initialization, every control/state field, CV/gate/trigger
  behavior, all conditions, rails, LEDs, reset, persistence, deterministic
  replay, stable buffers, and the sample-rate/block-size matrix.
- The Implementation Plan names the isolated worktree, files, integration
  points, factory patch, focused commands, audit, full validation, and shared
  framework scope.

There is no research blocker. The coordinator may mark the queue item
`spec-ready` after reviewing these decisions; implementation must not begin on
the strength of this sentence alone.
