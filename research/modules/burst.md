# Burst Generator (burst)

## Hardware Reference
- **Based on**: Befaco Burst, adapted as a software clock/trigger utility rather than a component-level clone.
- **Manufacturer page**: https://www.befaco.org/burst-2/
- **Manual**: https://befaco.org/docs/Burst/Burst_User_Manual.pdf
- **Firmware**: https://github.com/Befaco/burst
- **Schematic**: https://befaco.org/docs/Burst/Burst_V3_Schematic.pdf
- **ModularGrid**: https://www.modulargrid.net/e/befaco-burst-
- **Review/demo**: DivKid, "Befaco - Burst (more than a basic burst!)", https://www.youtube.com/watch?v=KMNqizaTN1o
- **Context references**: Make Noise TEMPI for clocking workflows, Mutable Instruments Branches for probability gates, Toussaint/Bjorklund rhythm literature for evenly distributed rhythmic events.

## Research Summary
Befaco Burst is a pingable trigger-burst generator. A trigger input or manual trigger starts a finite burst, and the module distributes a selected number of trigger pulses inside a stored or pinged time window. The hardware then layers four musical controls over that burst: quantity, distribution curve, time division/multiplication, and pass probability.

For eurorack-js, this should be a **Befaco-inspired utility adaptation**. The app should preserve the core musical contract, voltage behavior, and timing model, while making the module usable without hardware-only gestures such as rotary-encoder tap tempo and long-press hidden modes.

Status: research complete and implemented. The queue row is coordinator-owned and tracks final completion in `research/module-queue.md`.

## Source Quality And Contradictions
- Primary sources agree on the core contract: trigger-activated bursts, ping/tap time window, quantity, distribution, time division/multiplication, probability, one-shot/cycle modes, tempo output, EOC output, and main trigger output.
- Quantity maximum: Befaco's current page, manual, and firmware define 32 as the maximum. ModularGrid lists 64, and DivKid's 2018 video description mentions 1-16. The app should follow the current Befaco/manual/firmware value: 1-32.
- Time division/multiplication maximum: the manual describes a maximum of eight in each direction. The public firmware maps the analog control to a smaller integer span in the visible source. The app should follow the manual-facing contract, `/8` through `x8`, because this is the documented user behavior.
- Power/depth specs differ across sources: Befaco page lists 56 mA +12V, 10 mA -12V, 25 mm depth; the manual lists 50 mA +12V, 10 mA -12V, 30 mm depth; ModularGrid lists 50 mA +12V, 25 mA -12V, 30 mm depth. These do not affect software behavior.
- Output voltage is not explicitly specified in the manual. The firmware uses microcontroller digital outputs, so hardware pulses are likely logic-level triggers. The app should use its standard 0/10V trigger pulses for interoperability.
- The manual says EOC is a trigger; firmware holds EOC for about 30 ms. The app trigger standard is 5-10 ms, so EOC should default to 10 ms unless an implementation intentionally exposes a longer gate-like EOC.

## Hardware Panel Contract
- Width: 8 HP.
- Controls:
  - Quantity encoder: sets trigger count and acts as tap tempo on press.
  - LED round display: shows trigger quantity, burst progress, and parameter/CV changes.
  - Quantity CV attenuator: scales quantity CV.
  - Distribution knob: shifts pulse spacing from linear to logarithmic/exponential-like curves.
  - Time Div/Mult knob: divides or multiplies the time window by integer ratios.
  - Probability knob: pass/inhibit probability for generated bursts.
  - Manual trigger button: starts a burst manually.
  - Cycle switch: loops the burst after it has been triggered.
- Inputs:
  - Ping: trigger/clock input used to set the time-window length from intervals between pings.
  - Quantity CV: bipolar control added to the quantity setting through the attenuator.
  - Distribution CV: summed with the distribution knob.
  - Time Div/Mult CV: summed with the time control and quantized to integer factors.
  - Probability CV: summed with the probability knob.
  - Trigg: trigger/gate input that initializes or retriggers the burst.
- Outputs:
  - Tempo: clock at the stored internal/pinged tempo.
  - EOC: end-of-cycle pulse when a burst completes.
  - Out: main trigger burst output.
- Hidden/alternate behavior:
  - Manual trigger overrides probability on the hardware.
  - Default behavior always emits the first trigger; a long trigger-button hold toggles a mode that removes the initial trigger and allows zero-output inhibited bursts.
  - Firmware includes non-retrigger and probability-affects-EOC hidden settings. These are useful to document but should not be required for the first app version unless the custom UI has room for advanced switches.

## App Panel Contract
- Module ID: `burst`
- Name: `Burst`
- Category: `clock`
- Width: 8 HP.
- Suggested color token: `module-color-two` or another clock-family token chosen by the implementation branch.
- DSP model: Befaco-inspired pingable burst generator with deterministic sample-accurate scheduling.
- Params:
  - `tempo`: internal fallback tempo in BPM, default 120. Used before the first valid ping/tap and when no ping cable is present.
  - `quantity`: integer 1-32, default 4.
  - `quantityCvAmount`: 0-1 attenuator, default 1.
  - `distribution`: -1 to 1, default 0. Negative and positive values bend spacing in opposite directions; 0 is linear.
  - `timeFactor`: quantized `/8` through `/2`, `x1`, `x2` through `x8`, default `x1`.
  - `probability`: 0-1 pass probability, default 1. `1` means every burst passes; `0` means external-triggered bursts are fully inhibited.
  - `cycle`: 0/1 switch, default 0.
  - `includeFirstPulse`: 0/1 switch, default 1. This exposes the useful hardware long-press behavior without requiring hidden UI gestures.
  - `retrigger`: 0/1 switch, default 1. If 1, a trigger during a burst restarts it; if 0, in-flight triggers are ignored.
- Inputs:
  - `trig` (`trigger`): starts the burst on a rising edge.
  - `ping` (`trigger`): updates the base time window from the interval between the last two ping rising edges.
  - `quantityCv` (`cv`): -5V subtracts 16 triggers, 0V leaves quantity unchanged, +5V adds 16 triggers, with attenuator.
  - `distributionCv` (`cv`): summed with distribution, clamped to the full curve range.
  - `timeCv` (`cv`): summed with time factor, quantized to integer division/multiplication.
  - `probabilityCv` (`cv`): summed with probability, clamped 0-1.
- Outputs:
  - `out` (`trigger`): 0/10V trigger train.
  - `tempo` (`trigger`): 0/10V internal tempo trigger.
  - `eoc` (`trigger`): 0/10V end-of-cycle trigger.
- LEDs:
  - `out`: high while `out` pulse is active.
  - `tempo`: high while tempo pulse is active.
  - `eoc`: high while EOC pulse is active.
  - `active`: 1 while a burst is running.
  - Optional richer UI: a ring/binary count display showing quantity when idle and current pulse index while active.
- Normalization:
  - Unpatched trigger/CV inputs read 0V.
  - Before a valid ping arrives, the internal time window comes from `tempo`.
  - A single ping does not change the tempo; two valid ping edges are required to measure a window.

## Voltage Contract
- Trigger inputs: rising edges use the rack clock threshold, `>2.5V`, matching existing clock modules.
- `trig`: any high gate can start a burst on its rising edge. Holding the input high should not repeatedly retrigger.
- `ping`: two rising edges define the master time window. Ignore outlier windows below a small guard such as 1 ms to avoid divide-by-zero or runaway scheduling.
- `quantityCv`: app mapping follows the manual: -5V = -16 triggers, 0V = 0 offset, +5V = +16 triggers. Clamp final quantity to 1-32.
- `distributionCv`, `timeCv`, and `probabilityCv`: hardware accepts broader CV around the pot position. In the app, accept typical bipolar CV, clamp safely, and document the effective scaling in tests.
- Outputs: all trigger outputs are 0V low and 10V high.
- Main output pulse width: 10 ms by default, matching the public firmware's `TRIGGER_LENGTH`; if the spacing between pulses is shorter than 10 ms, shrink pulses so they cannot overlap, with a 1 ms minimum.
- Tempo output pulse width: 10 ms.
- EOC output pulse width: 10 ms in the app for rack-standard trigger compatibility, even though the hardware firmware uses a longer EOC pulse.
- Cycle mode: after the first trigger starts cycling, bursts repeat at the quantized time window until cycle is switched off. A new trigger in cycle mode restarts phase when `retrigger` is enabled.
- Reset: `reset()` clears pulse scheduling, last trigger/ping states, active burst, outputs, and LEDs; it should preserve current params.

## DSP Implementation

### Algorithm Overview
1. Maintain `baseWindowSeconds` from `tempo` or measured ping interval.
2. On each sample, detect rising edges for `trig` and `ping`.
3. On ping rising edge, update `baseWindowSeconds` when there is a previous ping interval.
4. Compute burst settings at burst start and hold them for the burst duration, matching the firmware's temporary-value pattern:
   - `effectiveQuantity = clamp(round(quantity + quantityCv * quantityCvAmount * 16 / 5), 1, 32)`
   - `effectiveWindow = baseWindowSeconds * timeFactor`
   - `effectiveProbability = clamp(probability + probabilityCvScaling, 0, 1)`
   - `effectiveDistribution = clamp(distribution + distributionCvScaling, -1, 1)`
5. On trigger rising edge:
   - If a burst is active and `retrigger` is false, ignore it.
   - If manual-trigger UI support is added, manual trigger should bypass probability like the hardware.
   - Otherwise, sample a random value once per external-triggered burst; inhibit the whole burst if it exceeds `effectiveProbability`.
6. Generate an ordered list of pulse start times inside the effective time window:
   - For one pulse, emit at time 0 when `includeFirstPulse` is true.
   - For multiple pulses, include a start pulse at time 0 by default, then distribute remaining pulses through the window.
   - Linear distribution uses even spacing.
   - Positive distribution bends toward shorter intervals at one end; negative bends in the opposite direction. Use a monotonic power curve, not a lookup table, unless implementing the firmware's exact exponent table is preferred.
7. During processing, set `out` to 10V during each scheduled pulse window and 0V otherwise.
8. Emit `eoc` when the last pulse has completed or when a silent/inhibited burst reaches its window end, depending on `probabilityAffectsEOC` decision. First implementation should keep EOC deterministic and emit on completed burst windows even if the main output was silent.
9. In cycle mode, schedule the next burst at the window boundary. Keep phase aligned to the measured ping grid when possible.
10. Emit `tempo` triggers from an independent phase accumulator using `baseWindowSeconds`.

### Distribution Model
The hardware firmware uses a curve table and a power function to produce non-linear timing. The app can use an equivalent monotonic normalized-position model:

```text
t = index / (quantity - 1)
curve = 1 + abs(distribution) * 4
if distribution > 0: pos = pow(t, curve)
if distribution < 0: pos = 1 - pow(1 - t, curve)
if distribution == 0: pos = t
time = pos * effectiveWindow
```

This is not bit-identical to the firmware, but it preserves the audible behavior: even bursts at center, accelerating/decelerating bursts away from center, and "bouncing ball"/scrape effects at extremes.

### Observed Behavior From Reviews/Demos
- Befaco's page describes ratcheting, doubles, triplets, quintuplets, polyrhythms, fast transient clusters for hand-clap-like sounds, cycle-mode master-clock use, and non-linear distributed clocks.
- DivKid's review/demo frames Burst as more than a fixed-rate burst source: it uses pings to set a time window, creates eighths/triplets/sixteenths/quintuplets/septuplets from a quarter-note clock, demonstrates clap/percussion synthesis, looped rhythm generation, melodic ratchets, probability-based density reduction, and "wonky" humanized clocks via distribution modulation.
- Make Noise TEMPI provides the broader clocking context: modular clock utilities often combine external tempo, tap tempo, divisions/multiplications, phase/mute variation, state recall, and performance-oriented programming.
- Mutable Instruments Branches provides the probability-gate reference: incoming triggers can be routed or inhibited according to a Bernoulli-style random decision, with extreme settings becoming deterministic.

### Implementation Trade-Offs
- Use sample counters rather than `Date.now()` or block-time scheduling so bursts remain deterministic across buffer sizes and tests.
- Freeze effective params per burst to avoid zipper-like timing changes mid-burst; CV changes take effect on the next burst. This matches the firmware's `_Temp` approach.
- Use `Math.random()` only behind an injectable/random function if tests need deterministic probability behavior. Otherwise, tests should use probability extremes 0 and 1.
- Do not emulate EEPROM, calibration, or long-press gestures. Use explicit params for hidden behavior that materially affects patching.
- Use app-standard 10V triggers even if hardware logic outputs are likely 5V.

## Test Targets
- Initialization:
  - Creates params, inputs, outputs, and LEDs.
  - Defaults to 120 BPM, quantity 4, linear distribution, time factor x1, probability 1, cycle off.
- Output ranges:
  - `out`, `tempo`, and `eoc` are always 0V or 10V and never NaN.
  - Buffers are filled every process call.
- Trigger behavior:
  - `trig` rising edge starts one burst.
  - Held-high trigger does not retrigger.
  - Retrigger switch restarts active burst when enabled and ignores in-flight triggers when disabled.
- Ping behavior:
  - First ping alone does not change tempo.
  - Second ping sets the time window.
  - Tempo output follows the measured window.
- Quantity:
  - Quantity clamps to 1-32.
  - Quantity CV subtracts/adds triggers according to -5V/0V/+5V mapping and the attenuator.
  - Quantity changes during an active burst affect the next burst, not the current one.
- Time division/multiplication:
  - Time factor x1 fits burst inside the base window.
  - `/2` produces a burst in half the base window.
  - `x2` stretches burst over twice the base window.
  - Factors clamp to `/8` and `x8`.
- Distribution:
  - Center distribution produces evenly spaced pulses.
  - Negative and positive extremes produce monotonic accelerating/decelerating intervals in opposite directions.
  - Distribution CV shifts/clamps the curve.
- Probability:
  - Probability 1 always passes external-triggered bursts.
  - Probability 0 inhibits external-triggered bursts while still producing deterministic EOC behavior per app decision.
  - Probability CV modulates/clamps the pass probability.
- Cycle:
  - Cycle off produces one burst per trigger.
  - Cycle on repeats after a trigger and stops repeating when switched off.
  - Cycle mode remains phase-stable with a pinged window.
- LEDs:
  - `active` is high during a burst.
  - `out`, `tempo`, and `eoc` mirror their pulse outputs.
- Reset:
  - Clears active burst, edge state, outputs, and LEDs.
  - Does not wipe user params.
- Spec compliance:
  - Main pulse width is 10 ms at normal spacing.
  - Pulse width shrinks safely when pulse spacing is shorter than 10 ms.
  - EOC fires at burst completion.

## Implementation Plan
- Module ID: `burst`
- Category: `clock`
- Branch/worktree: implemented through an isolated implementation subagent workspace and integrated by the coordinator.
- DSP model: Befaco-inspired pingable trigger burst generator with sample-accurate pulse scheduling, per-burst parameter freeze, probability inhibit, cycle mode, and app-standard trigger voltages.
- Params: `tempo`, `quantity`, `quantityCvAmount`, `distribution`, `timeFactor`, `probability`, `cycle`, `includeFirstPulse`, `retrigger`.
- Inputs: `trig`, `ping`, `quantityCv`, `distributionCv`, `timeCv`, `probabilityCv`.
- Outputs: `out`, `tempo`, `eoc`.
- LEDs: `active`, `out`, `tempo`, `eoc`; optional richer ring/count display if a custom renderer is added.
- Factory patch: `src/js/config/patches/test-burst.js`, driving `ping` and `trig` from `clk`, `out` to `kick`, `eoc` to `hat`, and `tempo`/`out` to `scope`.
- Focused tests: `tests/dsp/burst.test.js`.
- Full validation command: `npm test -- tests/dsp/burst.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`; before merge, run `npm test`.
- Known assumptions: app uses 10V trigger outputs; EOC is shortened to rack-standard 10 ms; time div/mult follows the manual's `/8..x8` range rather than the narrower public firmware mapping; hidden hardware gestures are exposed as explicit params only where they affect patch behavior.

## Potential Improvements
- Add a custom renderer with a ring display and momentary Tap/Trig buttons to more closely match the Befaco panel.
- Add deterministic seeded probability for reproducible generative patches.
- Add a "probability affects EOC" advanced switch if users need the hidden firmware behavior.
- Add a distribution model option that exactly ports the firmware exponent table.

## Sources
- [Befaco Burst product page](https://www.befaco.org/burst-2/) - Befaco, page published 2019-11-04 and modified 2025-09-10, accessed 2026-07-09, supports: module purpose, feature list, 32-trigger current spec, 8 HP, pingable clock, voltage-controlled quantity/distribution/time/probability, tempo/EOC outputs, ratcheting and cycle-mode use cases.
- [Befaco Burst User Manual PDF](https://befaco.org/docs/Burst/Burst_User_Manual.pdf) - Befaco, accessed 2026-07-09, supports: full panel inventory, ping/tap time window concept, 1-32 quantity, quantity CV -5V/0V/+5V mapping, distribution CV behavior, time division/multiplication behavior, trigger/retrigger behavior, probability/inhibit behavior, cycle switch, EOC and tempo outputs.
- [Befaco Burst firmware repository](https://github.com/Befaco/burst) - Befaco, code by Jeremy Bernstein and Eloi Flores, accessed 2026-07-09, supports: public implementation reference, 10 ms trigger length, 32 max repetitions, calibration/hidden modes, per-burst temp params, probability inhibit logic, distribution curve implementation, ping/tap clock measurement, EOC handling.
- [Befaco Burst v3 schematic](https://befaco.org/docs/Burst/Burst_V3_Schematic.pdf) - Befaco, accessed 2026-07-09, supports: official hardware revision context and resource trail; not used for app voltage decisions where the manual/firmware/user-facing behavior is clearer.
- [Befaco Burst on ModularGrid](https://www.modulargrid.net/e/befaco-burst-) - ModularGrid, submitted 2017-06-27 and last changed 2021-10-21, accessed 2026-07-09, supports: secondary practical specs, manufacturer-approved listing, category tags, market context; contradicts current primary sources on max quantity and power draw.
- [Befaco - Burst (more than a basic burst!)](https://www.youtube.com/watch?v=KMNqizaTN1o) - DivKid, published 2018-06-15, accessed 2026-07-09, supports: independent demo/review observations for pinged ratchets, polyrhythms, clap-like transient clusters, looping rhythm generation, probability variation, melodic ratchets, and humanized/wonky clocks.
- [Make Noise TEMPI product page](https://www.makenoisemusic.com/modules/tempi/) - Make Noise, accessed 2026-07-09, supports: clocking-workflow context including external tempo, tap tempo, CV tempo, programmable divisions/multiplications, phase, mutes, and stored timing states.
- [Make Noise TEMPI manual PDF](https://www.makenoise-manuals.com/tempi/tempi-manual.pdf) - Make Noise, accessed 2026-07-09, supports: clock module reference for external tempo lock after two pulses, tap tempo, variable clock outputs, 50% duty clock vs 10 ms trigger options, and performance-oriented clock programming.
- [Mutable Instruments Branches manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/branches/manual/) - Mutable Instruments documentation archive, accessed 2026-07-09, supports: Bernoulli/probability gate behavior, probability CV/knob extremes becoming deterministic, latch/toggle context, and trigger routing/inhibit design vocabulary.
- [Mutable Instruments eurorack source: Branches](https://github.com/pichenettes/eurorack/tree/master/branches) - Mutable Instruments / Emilie Gillet, accessed 2026-07-09, supports: open-source probability gate implementation reference.
- [The Euclidean Algorithm Generates Traditional Musical Rhythms](https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf) - Godfried Toussaint, Bridges 2005, accessed 2026-07-09, supports: rhythm-programming context for distributing pulses/events evenly in time and Bjorklund-style pulse distribution concepts.
- [The Distance Geometry of Music](https://arxiv.org/abs/0705.4085) - Demaine, Gomez-Martin, Meijer, Rappaport, Taslakian, Toussaint, Winograd, Wood, 2007, accessed 2026-07-09, supports: broader mathematical context for evenness and distributed onset patterns in rhythm.
