# Tape Delay (tape)

## Hardware Reference

- **Working name**: Tape Delay
- **Module ID**: `tape`
- **Category**: `effect`
- **Primary Eurorack reference**: Strymon Magneto, a four-head dTape Echo and Looper Eurorack module with saturation, tape age, crinkle, wow/flutter, varispeed, clock/tap, infinite hold, and CV I/O [S1], [S2].
- **Historical references**: Roland/BOSS Space Echo lineage for multi-head tape echo behavior, saturation, tape age, wow/flutter, runaway feedback, and repeat-rate pitch glide [S4], [S5], [S6]; Echoplex context for moving-head tape echo lineage and slapback/counter-rhythm usage [S10].
- **Practical reference**: ModularGrid Magneto listing for Eurorack format, panel size, power, and common module taxonomy [S8].

This eurorack-js module should be an inspired-by utility/effect, not a clone of Magneto, RE-201, or Echoplex. The goal is to add a distinct tape-style delay path beyond the existing `dly` module: record-level saturation, varispeed modulation, age-dependent bandwidth, low-cut feedback tone shaping, crinkle/dropout irregularities, multi-head timing, tap/clock behavior, and freeze/infinite capture.

## Source Quality Notes

- Strymon's Magneto product page, support FAQ, and user manual are the highest-quality sources for Eurorack-specific CV ranges, head modes, varispeed behavior, and control naming. Magneto's actual dTape algorithm is proprietary, so they define the target behavior but not implementation internals [S1], [S2], [S3].
- BOSS/Roland sources are high-quality for Space Echo behavior because BOSS/Roland designed the original RE-201 lineage and modern RE-202 model. The RE-202 is a pedal rather than a Eurorack module, so its controls are behavioral references rather than voltage references [S4], [S5], [S6], [S7].
- MusicRadar is an independent hands-on review. Use it for observed sonic behavior and usability notes, not for electrical facts [S9].
- ModularGrid is a practical secondary source for Eurorack dimensions/taxonomy and community usage, not authoritative for DSP details [S8].
- DSP sources are reliable for digital delay implementation: Julius O. Smith/CCRMA for fractional delay interpolation [S11], the DAFx 2023 magnetic tape modeling paper for tape-recorder signal-chain components [S12]. They do not prescribe a small browser module panel, so the design below selects a lower-cost approximation.

## Reference Behavior

### Tape Echo Mechanics

- Tape echo records audio to a moving medium and plays it back from one or more heads. Delay time is controlled by tape speed and/or head spacing. Magneto explicitly separates tap/head spacing changes from speed/pitch changes: tap changes delay without pitch movement, while speed changes produce varispeed pitch artifacts [S2].
- Classic multi-head Space Echo designs use multiple playback heads and combinations to create rhythmic repeats. BOSS RE-202 keeps a mode selector for 12 head combinations and describes delay heads 2, 3, and 4 as 2x, 3x, and 4x the head-1 delay [S7].
- Magneto's Echo mode uses four playback heads and one record head; its Even clock examples map head 1 to 1/16, head 2 to 1/8, head 3 to dotted 1/8, and head 4 to 1/4 for a tapped quarter-note delay [S2].
- High feedback causes self-oscillation. Magneto and RE-202 both document playable runaway/self-oscillation behavior shaped by tape speed and tone controls [S1], [S2], [S4], [S7].

### Tone, Saturation, And Irregularity

- Record level is a core tape-delay control. Magneto's REC LVL feeds the record head and moves from clean repeats to fatter saturation [S1], [S2]. RE-202's Saturation control models tape compression and preamp coloration [S4], [S7].
- Tape age is primarily a bandwidth/tone control. Magneto describes fresh tape as full bandwidth and clockwise tape age as warmer repeats [S1]. BOSS describes new/aged tape as changing tone and wavering [S7].
- Wow/flutter are tape-speed fluctuations from motor/tape mechanics. Strymon describes a dedicated control for mechanically related speed variation [S1], and BOSS describes natural tape modulation from motor speed fluctuations, friction, wow, and flutter [S4].
- Crinkle/dropout behavior comes from tape irregularities. Magneto uses "Crinkle" for friction, creases, splices, and contaminants, from clean tape to mangled tape [S1].
- MusicRadar observed that the tape-mechanics controls become more pronounced at slower tape speeds, that Tape Age behaves like a low-pass filter, Crinkle makes the tape sound damaged, Wow/Flutter controls speed fluctuation, and record level ranges from warm richness to gritty distortion [S9].

## Proposed eurorack-js Specification

### Metadata

```javascript
{
    id: 'tape',
    name: 'TAPE',
    hp: 10,
    color: 'module-color-three',
    category: 'effect'
}
```

Use `hp: 10` so the panel can expose the tape-specific controls without becoming denser than the current browser UI can read. If implementation finds the declarative layout too crowded, use a custom renderer but keep the DSP contract unchanged.

### Controls

| Control | Param | Range | Default | Behavior |
|---------|-------|-------|---------|----------|
| Time | `time` | 0-1 | 0.45 | Nominal head-4 delay time, exponentially mapped from 50ms to 2500ms. |
| Feedback | `feedback` | 0-1 | 0.35 | Repeat regeneration. Internally clamp below runaway unless soft saturation/limiting is active. |
| Mix | `mix` | 0-1 | 0.45 | Dry/wet blend. 0 is dry only, 1 is wet only. |
| Drive | `drive` | 0-1 | 0.25 | Record-head gain into soft saturation. |
| Age | `age` | 0-1 | 0.35 | Tape bandwidth loss and repeat darkening; higher values lower the feedback low-pass cutoff and slightly increase hiss/noise. |
| Low Cut | `lowCut` | 0-1 | 0.2 | Feedback high-pass tone shaping. Low values keep bass; high values thin repeats for magnetic-drum/dub-style echoes. |
| Wow | `wow` | 0-1 | 0.15 | Combined slow wow and faster flutter delay modulation. |
| Crinkle | `crinkle` | 0-1 | 0.05 | Random dropouts, splice bumps, short friction speed perturbations, and the dropout LED amount. |
| Freeze | `freeze` | 0/1 | 0 | Infinite/hold mode. Disables record-head writes and loops the current buffer content. |
| Heads | `headMode` | 0/1/2 | 1 | Button bank: 0 = single head, 1 = even multi-head, 2 = triplet multi-head. |

### Inputs

| Input | Port | Type | Behavior |
|-------|------|------|----------|
| In | `audio` | `audio` | Audio input, +/-5V nominal. Silence when unpatched. |
| Time CV | `timeCV` | `cv` | +/-5V maps to +/-0.5 normalized `time` before clamp. |
| Speed CV | `speedCV` | `cv` | 1V/oct varispeed multiplier, useful range -3V to +3V, clamped before use. Positive voltage shortens delay and raises pitch; negative voltage lengthens delay and lowers pitch. |
| Feedback CV | `feedbackCV` | `cv` | +/-5V maps to +/-0.5 feedback amount before clamp. |
| Mix CV | `mixCV` | `cv` | +/-5V maps to +/-0.5 mix amount before clamp. |
| Tap | `tap` | `trigger` | Rising edge above 2.5V sets the nominal head-4 delay from the interval between taps, clamped to 50ms-2500ms. |
| Freeze Gate | `freezeGate` | `gate` | Gate >=1V engages freeze while high. ORed with the panel Freeze switch. |

### Outputs

| Output | Port | Type | Behavior |
|--------|------|------|----------|
| Out | `out` | `audio` | Mono processed output, soft-clipped/clamped to +/-5V. |
| Clock | `clock` | `gate` | 10V, 5ms pulse at the current head-4 delay period; follows tap/time/speed. |

### LEDs

| LED | Meaning |
|-----|---------|
| `level` | Output level normalized to 0-1 from post-mix peak. |
| `freeze` | Lit while panel Freeze or Freeze Gate is active. |
| `clock` | Lit during the generated clock pulse. |
| `dropout` | Shows current crinkle/dropout attenuation amount. |

### Normalization

- `audio` unpatched: zero-filled every process block, following the app's audio-input reset pattern.
- CV inputs unpatched: zero modulation.
- `freezeGate` unpatched: off.
- `tap` unpatched: internal time comes from the Time knob and Time CV.
- No stereo normalization in v1. Magneto/RE-202 stereo behavior, panning, psycho-acoustic widening, and mono summing are future expansion items.

## Voltage Contract

- Audio input: +/-5V nominal. Values above nominal are allowed into the record saturation stage, but output must remain within +/-5V.
- Audio output: +/-5V nominal and bounded. Use a final soft clip or clamp to prevent self-oscillation from exceeding the rack standard.
- CV inputs:
  - `timeCV`: bipolar CV, +/-5V = +/-0.5 normalized Time.
  - `speedCV`: pitch-style CV, -3V to +3V = 1V/oct over a six-octave control span before practical clamp. Use `speedRatio = 2 ** clamp(speedCV, -3, 3)`.
  - `feedbackCV` and `mixCV`: bipolar CV, +/-5V = +/-0.5 normalized parameter movement.
- Trigger input: `tap` rising edge threshold is >2.5V. Ignore retriggers closer than 10ms to avoid switch bounce and audio-rate false taps.
- Gate input: `freezeGate` is high at >=1V.
- Gate output: `clock` emits 0V low and 10V high for 5ms per pulse.
- Pitch tracking: no audio pitch CV output. `speedCV` follows 1V/oct behavior only for varispeed delay motion and self-oscillation pitch.
- Reset behavior: clear buffers, filters, modulation phases, PRNG/dropout state, tap history, clock pulse state, outputs, and LEDs.

## DSP Plan

### Model Choice

Use an inspired-by tape-delay approximation:

1. Mono circular delay buffer with a 4 second maximum allocation.
2. Record path: input gain, tape saturation, optional freeze write inhibit.
3. Tape path: multi-head fractional reads from one delay buffer.
4. Feedback path: selected wet-head mix through low-cut, age low-pass, soft saturation, and feedback gain.
5. Mechanics: slow wow LFO, faster flutter LFO, and smoothed random crinkle modulation applied to delay read time.
6. Output path: dry/wet mix, bounded output, level LED.

Do not implement Magneto's looper, phrase sampler, spring reverb, reverse transport, pause/scrub, send/return, stereo panning, custom head levels, pitch quantize, or per-head feedback in v1. Those features are real but would turn this queue item into several modules.

### Delay Time And Head Modes

Compute a base head-4 delay in samples:

```javascript
const normalizedTime = clamp(time + timeCV[i] / 10, 0, 1);
const baseMs = expMap(normalizedTime, 50, 2500);
const speedRatio = Math.pow(2, clamp(speedCV[i], -3, 3));
const head4DelaySamples = baseMs * sampleRate / 1000 / speedRatio;
```

Apply wow/flutter/crinkle as a small modulation around each read delay:

```javascript
const wowOffset = wowDepthSamples * (
    Math.sin(wowPhase) * 0.65 +
    Math.sin(flutterPhase) * 0.25 +
    crinkleNoise * 0.10
);
const readDelay = clamp(headDelay + wowOffset, minDelaySamples, maxDelaySamples);
```

Head ratios:

| `headMode` | Head ratios relative to head 4 | Notes |
|------------|--------------------------------|-------|
| 0 Single | `[1.0]` | Direct tape delay. |
| 1 Even | `[0.25, 0.5, 0.75, 1.0]` | Space Echo/Magneto-style rhythmic repeats. |
| 2 Triplet | `[1 / 6, 1 / 3, 2 / 3, 1.0]` | Triplet subdivision option inspired by Magneto head spacing. |

Normalize wet-head gains so multi-head modes do not exceed the single-head wet level for the same input. Suggested wet gains before normalization: Single `[1]`; Even `[0.35, 0.45, 0.65, 1.0]`; Triplet `[0.35, 0.5, 0.75, 1.0]`.

### Fractional Delay

Use cubic or 3rd-order Lagrange interpolation for moving delay reads if implementation cost is acceptable. Linear interpolation is acceptable for v1 if output is already tape-bandlimited, but tests should allow small timing tolerances. CCRMA notes that linear interpolation is inexpensive and can sound good at high sample rates, but its amplitude error is more audible in feedback loops; allpass interpolation removes amplitude error at the cost of delay error and state complexity [S11]. This module should prefer stable behavior and low CPU over perfect tape transport modeling.

### Saturation And Tone

Record-head saturation:

```javascript
const driveGain = 1 + drive * 8;
const recorded = Math.tanh(input * driveGain) / Math.tanh(driveGain);
```

Feedback path:

1. Wet multi-head sum.
2. One-pole high-pass controlled by `lowCut`, approx 20Hz-1000Hz.
3. One-pole low-pass controlled by `age`, approx 18000Hz fresh to 1200Hz old.
4. Soft saturation with a lower drive than the record stage.
5. Feedback gain clamp, target max around 0.98 in normal use. Allow musical self-oscillation near max through bounded saturation, never unbounded numeric growth.

Tape hiss/noise should be very low and only mixed into the wet/feedback path as `age` and `crinkle` increase. Keep noise deterministic or seedable in tests.

### Crinkle And Dropouts

Use a small deterministic PRNG inside the DSP instance.

- At low `crinkle`, add slow random delay jitter and rare shallow dropouts.
- At high `crinkle`, add more frequent wet-path attenuation events, short splice bumps, and higher dropout LED brightness.
- Dropouts should affect wet/repeats more than dry input.
- Event lengths should be musical and testable, for example 10ms-80ms.
- Never allow crinkle to write NaN, create denormal explosions, or resize the buffer.

### Tap And Clock

- `tap` measures interval between valid rising edges. First tap stores time; second and later taps update internal tapped delay time. If no valid interval exists, Time knob drives delay.
- Tapped delay should either update the effective time immediately with a short smoothing ramp or slew delay samples over 10ms-30ms to avoid clicks.
- `clock` output follows head-4 delay and emits a 10V pulse for 5ms each period. If delay time changes, keep phase continuous where practical.

### Freeze

Freeze is Magneto-style Infinite adapted to a compact module:

- When active, stop writing new record/feedback material into the delay buffer.
- Continue reading the existing buffer at the current speed/time, so `speedCV`, `wow`, `age`, and `lowCut` still affect playback.
- Input still passes through dry path according to `mix`; at `mix = 1`, freeze is wet-only.

## Expected Differences From Hardware

- The module is mono, while Magneto and RE-202 are stereo-capable.
- No physical erase/record/playback head hysteresis model. The record path uses soft saturation and filtering rather than magnetic hysteresis.
- No spring reverb, Sound-on-Sound looper, phrase sampler, reverse, pause/scrub, send/return, custom panning, or clock outputs per head.
- Delay range is 50ms-2500ms nominal, not Magneto's 15 second tap range or two minute loop range. This keeps browser memory and test runtime small.
- Crinkle/dropout is a musical stochastic approximation. Exact tape defects and splice mechanics are not specified by manufacturers.
- `speedCV` copies Magneto's useful 1V/oct concept, but the module is not expected to be a calibrated oscillator except during feedback self-oscillation.

## Assumptions And Contradictions

- **Delay range**: Magneto documents very wide delay/loop ranges [S2], while a focused browser module should use a smaller range. Use 50ms-2500ms nominal with a 4 second buffer to cover modulation and slow speed.
- **Pitch behavior**: Magneto separates tap/head spacing from speed and pitch [S2]. This module exposes both Time CV and Speed CV; Time CV is a standard parameter modulation path, while Speed CV is the varispeed/pitch path.
- **Electrical levels**: Magneto specifies 20Vpp max audio I/O and -5V to +5V continuous CV for several inputs [S2], while eurorack-js standard audio is +/-5V and gate/trigger levels are app-defined. Use the app standards for all behavior.
- **Tape aging details**: BOSS and Strymon agree that age changes tone/wavering, but exact curves are not public [S1], [S7]. Use low-pass bandwidth reduction plus modest noise/dropout increase.
- **Wow/flutter rates**: No source gives a required numeric LFO mix for this module. Choose musical low-frequency ranges and test qualitative behavior.
- **Review typo**: MusicRadar writes "Wow and utter" in one sentence, clearly meaning "Wow and Flutter" from the surrounding context and the hardware control name [S9].

## Test Targets

Focused tests should be written before implementation in `tests/dsp/tape.test.js`.

1. **Initialization**
   - Creates `params`, `inputs`, `outputs`, `leds`, delay buffer, filters, PRNG state, and clock state at default sample rate/buffer size.
   - Defaults match the panel contract.

2. **Output Ranges And Silence**
   - Unpatched/zero audio input produces silence except optional near-zero hiss when age/crinkle are explicitly raised; default must be silence.
   - Output remains within +/-5V under high input, high drive, and high feedback.
   - No output sample is NaN or infinite.

3. **Delay Timing**
   - An impulse appears near the expected head-4 delay for single-head mode.
   - Even mode produces taps near 0.25x, 0.5x, 0.75x, and 1.0x the head-4 delay.
   - Triplet mode produces taps near 1/6, 1/3, 2/3, and 1.0x.

4. **Control Extremes**
   - `time` minimum and maximum map to the expected delay range.
   - `mix = 0` returns dry input; `mix = 1` returns wet-only after the delay.
   - `feedback = 0` gives one repeat; higher feedback gives decaying repeats; max feedback stays bounded.
   - `drive` compresses high input more than low input and never hard-clips internally to NaN.
   - `age` reduces high-frequency content in repeats.
   - `lowCut` reduces low-frequency content in repeats.
   - `wow` creates time-varying delay output without discontinuities.
   - `crinkle` produces deterministic wet attenuation/dropout events with the seeded PRNG and drives `leds.dropout`.

5. **CV Inputs**
   - `timeCV` at +5V and -5V shifts normalized time by about +/-0.5 before clamp.
   - `speedCV` follows 1V/oct ratios within clamp: +1V roughly halves delay time, -1V roughly doubles delay time.
   - `feedbackCV` and `mixCV` apply +/-0.5 modulation and clamp safely.

6. **Tap, Gate, And Clock**
   - `tap` ignores sub-threshold voltages and triggers on rising edges >2.5V.
   - Two taps set a new delay interval within clamp.
   - Very short tap intervals are clamped/ignored according to the bounce rule.
   - `freezeGate` engages freeze at >=1V and releases below 1V.
   - `clock` output emits 0V/10V pulses with 5ms duration.

7. **Freeze**
   - When freeze is active, new input no longer writes into the wet buffer.
   - Existing buffer content keeps playing and can still be affected by speed/tone controls.
   - `leds.freeze` reflects panel or gate freeze.

8. **Reset And Buffer Integrity**
   - `reset()` clears buffers, filter states, outputs, LEDs, tap history, clock state, dropout state, and modulation phases.
   - Processing fills the full output buffers every block.
   - Audio input follows the app's unpatched-input reset pattern when routing replaces the module input buffer.

## Implementation Plan

- **Module ID**: `tape`
- **Category**: `effect`
- **Branch/worktree**: Research-only pass in `/Users/orderandchaos/code/eurorack-js`; implementation should use a future `module/tape` worktree/branch before code changes.
- **DSP model**: Inspired-by mono tape delay with circular buffer, multi-head reads, cubic or linear fractional interpolation, record-head saturation, age/low-cut feedback filters, wow/flutter modulation, deterministic crinkle/dropouts, tap/clock handling, freeze write inhibit, and bounded output.
- **Params**: `time`, `feedback`, `mix`, `drive`, `age`, `lowCut`, `wow`, `crinkle`, `freeze`, `headMode`.
- **Inputs**: `audio`, `timeCV`, `speedCV`, `feedbackCV`, `mixCV`, `tap`, `freezeGate`.
- **Outputs**: `out`, `clock`.
- **LEDs**: `level`, `freeze`, `clock`, `dropout`.
- **Factory patch**: During implementation, add `src/js/config/patches/test-tape.js` only if factory-patch scope is approved. Suggested patch: VCO or noise burst through `tape` into `out`, with `clock` into `scope` or `plot` for visible timing.
- **Focused tests**: `npm test -- tests/dsp/tape.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- **Full validation command**: `npm test`
- **Known assumptions**: Mono v1, reduced delay range, proprietary hardware algorithms approximated with filters/saturation/modulated delay, no looper/sampler/spring/reverse/pause/stereo panning, deterministic PRNG for tests.
- **Shared framework changes**: None expected. Use existing declarative UI where possible; use a custom renderer only if the 10HP control layout is not readable.

## Potential Improvements

- Stereo output with head panning modes.
- Per-head level and feedback buttons.
- Reverse and pause/tape-stop transport.
- Sound-on-Sound looper mode derived from the current `loop` module.
- Spring reverb send after delay.
- Send/return insert path if the app adds internal module sidechain routing.
- Pitch quantize for self-oscillation.
- Optional high-quality allpass or Lagrange interpolation setting.

## Sources

- [S1] [Strymon Magneto Tape Delay & Looper Eurorack Module](https://www.strymon.net/product/magneto/) - Strymon, product page, current page accessed 2026-07-09. Supports: Eurorack tape-delay reference, four-head dTape, saturation, age, crinkle, wow/flutter, spring, transport, CV/control overview, specs summary.
- [S2] [Magneto User Manual REV B](https://www.strymon.net/manuals/Magneto_UserManual_REVB.pdf) - Strymon, May 2018, accessed 2026-07-09. Supports: panel controls, modes, speed/pitch behavior, head spacing, CV ranges, trigger ranges, clock outputs, block diagram, audio level specs.
- [S3] [Magneto Support FAQ](https://www.strymon.net/support/magneto/) - Strymon, current support page accessed 2026-07-09. Supports: delay/tap ranges, speed CV 1V/oct notes, loop/sample behavior, CV input types, transport behavior, stereo handling, firmware notes.
- [S4] [BOSS RE-202 Space Echo](https://www.boss.info/us/products/re-202/) - BOSS/Roland, product page, accessed 2026-07-09. Supports: Space Echo history, RE-201 behavior, saturation, wow/flutter, tape age, repeat-rate pitch glide, runaway feedback, control list, specifications.
- [S5] [History of the Space Echo](https://articles.boss.info/history-of-the-space-echo/) - Paul White/BOSS Articles, 2022 era, accessed 2026-07-09. Supports: historical timeline, Space Echo lineage, Warp/Twist context, continued use.
- [S6] [Space Echo Sounds and How to Use Them](https://articles.boss.info/space-echo-sounds-and-how-to-use-them/) - Paul White/BOSS Articles, 2022 era, accessed 2026-07-09. Supports: tape saturation explanation, user-level Space Echo control behavior, Warp/Twist behavior.
- [S7] [RE-202 Reference Manual](https://static.roland.com/assets/media/pdf/RE-202_reference_eng01_W.pdf) - BOSS/Roland, reference manual, accessed 2026-07-09. Supports: panel descriptions, tape new/aged behavior, saturation, wow/flutter, mode selector, head combinations, repeat-rate and intensity behavior.
- [S8] [Strymon Magneto on ModularGrid](https://modulargrid.net/e/strymon-magneto) - ModularGrid, page last changed 2024-12-02, accessed 2026-07-09. Supports: 28HP/41mm/210mA specs, Eurorack categories, common feature summary.
- [S9] [Strymon Magneto review](https://www.musicradar.com/reviews/strymon-magento) - Philip Wise, MusicRadar, 2018-08-20, accessed 2026-07-09. Supports: independent observed behavior for tape age, crinkle, wow/flutter, record saturation, self-oscillation, head spacing, transport controls, send/return, looper/sample workflows.
- [S10] [Mike Battle Oral History](https://www.namm.org/library/oral-history/mike-battle) - NAMM Oral History Program, interview date 2002-07-19, accessed 2026-07-09. Supports: Echoplex inventor context and early tape-echo musical use.
- [S11] [Fractional Delay Filtering by Linear Interpolation](https://ccrma.stanford.edu/~jos/pasp/Fractional_Delay_Filtering_Linear.html) - Julius O. Smith III, CCRMA/Stanford, Physical Audio Signal Processing, accessed 2026-07-09. Supports: fractional delay interpolation, linear interpolation trade-offs, feedback-loop amplitude-error warning, allpass alternative.
- [S12] [Neural modeling of magnetic tape recorders](https://arxiv.org/abs/2305.16862) - Otto Mikkonen, Alec Wright, Eloi Moliner, Vesa Valimaki, DAFx 2023/arXiv, submitted 2023-05-26, accessed 2026-07-09. Supports: tape-recorder signal chain components: hysteretic nonlinearity/filtering, fluctuating transport delay, and additive noise.
