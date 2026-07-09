# Plucked String Voice (pluck)

## Hardware Reference

- **Primary hardware reference**: [2hp Pluck](https://www.twohp.com/modules/pluck), a compact Karplus-Strong physical modelling synth voice.
- **Manual**: [2hp Pluck Manual PDF](https://www.twohp.com/s/2hp_Pluck.pdf).
- **Practical secondary reference**: [ModularGrid: 2hp Pluck](https://modulargrid.net/e/2hp-pluck).
- **Context references**: [Mutable Instruments Rings manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/manual/), [Mutable Instruments Elements manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/elements/manual/), and the open-source Mutable Instruments Rings DSP code.
- **DSP references**: Karplus and Strong, Jaffe and Smith, Julius O. Smith's CCRMA Physical Audio Signal Processing pages, STK `Plucked`, and Mutable Instruments Rings string/resonator source.
- **Reviews/demos**: Verified demo sources include DivKid, Uncle Peter, and SundayAfternoonModular YouTube videos listed in Sources. Their metadata confirms the module and publisher, but the implementation should not infer electrical specifications from these demos.

This eurorack-js module should be an inspired-by physical-model voice, not a literal 2hp firmware clone. The first implementation should follow the 2hp Pluck user-facing contract where it is clear: four-voice overlap, trigger-created notes, 1V/oct pitch, damp and decay sampled at note start, 10Vpp audio output, and CV over damp/decay. It may add a single `position` control from the Rings/Elements family of plucked-string ideas to make pick position/body color patchable in the app.

## Specifications

### Confirmed 2hp Pluck Behavior

- Voice architecture: Karplus-Strong based physical modeling string synthesizer.
- Polyphony: four voices can sound at once; when another trigger arrives after four active voices, the oldest voice is replaced.
- Trigger: a trigger creates a new note using the current knob and CV state.
- Pitch: 1V/oct input is added to the pitch knob. The pitch control remains active for the most recently generated note while it rings.
- Damp: changes string size/tone/harmonic damping and affects only newly generated notes. Damp CV is bipolar and added to the knob.
- Decay: sets pluck duration and affects only newly generated notes. Decay CV is bipolar and added to the knob.
- CV ranges: 2hp manual states Damp CV and Decay CV expect -5V to +5V. V/Oct is specified as 1V/oct but the manual does not give an absolute voltage range.
- Output: 10Vpp audio output, which maps directly to eurorack-js audio at -5V to +5V.
- LED: output LED visualizes output amplitude.
- Physical-only details such as HP, depth, and current draw are not implementation-critical, but source contradictions are noted below.

### Proposed eurorack-js Panel Contract

- Module ID: `pluck`
- Display name: `PLUCK`
- Category: `voice`
- Suggested HP: 6
- Suggested color token: `module-color-eight`

Knobs:

- `pitch`: base pitch over five octaves. Proposed app range is A1 to A6, 55Hz to 1760Hz, before `vOct`; default around A3/C4 territory for immediate audible patches.
- `decay`: new-note sustain time. Low values produce muted percussive ticks; high values produce long harp-like tones. Full clockwise should approach "infinite" sustain musically but remain numerically stable.
- `damp`: harmonic damping/material. Low values are small/muted/nylon-like with strong high-frequency loss; high values are larger/brighter/steel-like with more upper partials.
- `position`: pick position/body color adapted from Rings/Elements. Low and high positions emphasize different harmonic cancellations; center positions should sound hollower from even-harmonic cancellation. This is not a 2hp Pluck control, so keep it documented as an app adaptation.

Switches/buttons:

- None in the first implementation. Four-voice operation is always enabled.
- No manual trigger button is required for the first pass; patches should use a trigger input.

Inputs:

- `trigger` (`trigger`): rising edge starts a new pluck. Expected trigger is 5-10ms at 5-10V. Use a >=1V rising-edge threshold for compatibility with existing voice/drum modules unless implementation review decides to standardize trigger inputs at >2.5V.
- `vOct` (`cv`): 1V/oct pitch input added to the pitch knob. 0V leaves the knob pitch unchanged; +1V doubles frequency.
- `decayCV` (`cv`): bipolar -5V to +5V modulation added to `decay`, scaled so +5V can push the normalized value up by 1.0 and -5V down by 1.0, then clamped to 0..1.
- `dampCV` (`cv`): bipolar -5V to +5V modulation added to `damp`, same scaling and clamping as `decayCV`.
- `positionCV` (`cv`): bipolar -5V to +5V modulation added to `position`, same scaling and clamping. This is an app adaptation from Rings/Elements behavior.

Outputs:

- `out` (`audio`): summed voice output, soft-limited or normalized to -5V to +5V.

LEDs:

- `active`: follows absolute output amplitude and decays between notes.

Normalization:

- Unpatched `trigger` is 0V and the module is silent until triggered.
- Unpatched CV inputs are 0V.
- Damp, decay, and position CV are added to the knobs and clamped.
- Pitch CV is 0V by default.
- No external audio input is planned for the first version. Rings-like external excitation is out of scope for `pluck`; a future resonator-bank or Rings-style processor can cover that workflow.

### Voltage Contract

- Audio output: -5V to +5V, 10Vpp. Internal summing must prevent clipping beyond app audio range.
- Trigger input: expected 5V to 10V pulse, 5-10ms long. Rising edge should create exactly one note until the signal returns low.
- Trigger threshold: >=1V rising edge for this voice, matching several existing eurorack-js trigger/gate voice patterns. This is an implementation assumption because the 2hp manual does not publish its comparator threshold.
- Pitch input: 1V/oct. Frequency formula should be `baseFreq * 2 ** vOct`, with any pitch knob mapping applied before the CV addition.
- Pitch tracking target: musically accurate over at least five octaves, matching the 2hp product claim. Tests should verify octave ratios, not absolute cents-level calibration.
- Damp/Decay/Position CV: -5V to +5V bipolar. Scale `cv / 5` into normalized parameter offset and clamp 0..1.
- Gate behavior: no sustain gate input in the first implementation; all notes are plucked events with internal decay.
- Reset behavior: `reset()` clears active voices, delay lines, filters, output buffer, last trigger state, and LED state.

## DSP Implementation

### Algorithm Overview

Use a four-voice Extended Karplus-Strong string model:

1. On a trigger rising edge, choose the next voice in round-robin order, replacing the oldest active voice when all voices are ringing.
2. Compute pitch from the pitch knob plus `vOct`. Store damp, decay, and position for the new note. To match 2hp behavior, only the most recently generated voice should track ongoing pitch changes while it rings; older voices should keep their trigger-time pitch.
3. Fill that voice's delay line with a filtered burst of noise or a short shaped impulse. The excitation should be normalized so louder/brighter settings do not exceed output range.
4. Process each voice as a delay loop with fractional delay, damping filter, optional pick-position comb, and safe loop gain.
5. Sum active voices, apply a DC blocker, then a conservative soft limiter to keep output within -5V to +5V.

Recommended per-voice signal path:

```text
exciter -> delay line -> damping/brightness filter -> optional dispersion/allpass -> feedback
             |                                                 |
             +---------------- output tap(s) / position mix ----+
```

Parameter mapping:

- `pitch`: exponential, five octaves. Suggested base range: 55Hz * 2 ** (pitch * 5). Add `vOct` as octaves after knob mapping.
- `decay`: map exponentially to loop gain or damping time. Suggested audible range: about 40ms to 12s. At maximum, cap feedback below 1.0, for example <=0.99995 per sample-equivalent loop update, to avoid unstable or never-clearing buffers.
- `damp`: controls excitation lowpass and loop lowpass. Lower damp should remove more high-frequency content and shorten high partials; higher damp should preserve harmonics.
- `position`: controls pick-position comb/delay tap and a small body/bridge color. Avoid exact 0 or 1 to prevent degenerate comb nulls; clamp internally to around 0.02..0.98.

Fractional delay:

- Use linear interpolation for the first pass if CPU simplicity wins. It is acceptable for a browser synth and easier to test.
- Consider a first-order allpass fractional delay if tuning or decay brightness errors become audible in long steel-string settings. CCRMA notes that linear interpolation inside high-gain waveguide feedback loops can produce audible amplitude error.

Polyphony:

- Four voices are required by the 2hp reference.
- Each voice owns its own delay buffer, filters, current frequency, envelope/energy estimate, and age counter.
- Voice is inactive once its absolute energy stays below a small threshold, e.g. RMS/peak below 1e-5 for a few buffers.

CPU and memory:

- Four delay lines sized for the lowest allowed pitch plus interpolation guard are small. At 44.1kHz and 55Hz, one period is about 802 samples; allowing lower transients and modulation, 2048 samples per voice is enough for the proposed A1 minimum. If implementation wants lower notes, size accordingly.
- Avoid modal banks with dozens of filters in the first implementation. A light body filter or pick-position comb gives useful color without the CPU and design scope of Rings.

### Observed Behavior From Reviews/Demos

- Official 2hp materials describe a range from short plucked transients to long harp-like tones, with dampening able to move from muted/small-string sounds to brighter, more harmonically rich strings.
- The manual explicitly says Damp and Decay are sampled for new notes, which creates per-note articulation in overlapping four-voice phrases rather than continuously changing every ringing voice.
- The manual says Pitch remains active for the most recently generated note, making vibrato or tuning gestures possible on the newest string while older tails continue.
- Rings/Elements documentation shows why `position` is musically useful: excitation point changes harmonic cancellations, while damping/brightness shifts material from wood/nylon toward glass/steel.
- Independent demos verified by metadata should be used as listening checks during implementation: DivKid for broad module behavior, Uncle Peter for patch/rack context, and SundayAfternoonModular for "sweet string" use cases. Do not infer exact settings or voltage behavior from those videos without watching and documenting the observations.

### Source-Quality Notes

- The 2hp manual is the strongest source for panel behavior, CV ranges, output level, and note-allocation behavior.
- The 2hp product page is primary marketing copy and is useful for headline claims: Karplus-Strong, complete voice, four-voice polyphony, and five-octave 1V/oct tracking.
- The 2hp manual and product/ModularGrid pages disagree on depth and current draw: manual says 42mm, +12V 83.45mA, -12V 4.5mA; product page says 45mm, +12V 78mA, -12V 6mA; ModularGrid says 42mm, +12V 78mA, -12V 6mA. These physical contradictions do not affect eurorack-js. Prefer the manual for functional behavior.
- ModularGrid is a useful practical cross-check and manufacturer-approved panel/spec summary, but it repeats marketing language and should not override the manual.
- Mutable Instruments Rings/Elements manuals and source are primary for their own designs, not for 2hp Pluck. Use them only to justify app-level physical-model behavior such as pick position, string resonator concepts, damping, and modal/body trade-offs.
- STK `Plucked` is an implementation reference for a simple Karplus-Strong physical model, not a Eurorack hardware spec.
- The Karplus/Strong patent page is useful historical context and notes expired status, but Google Patents itself warns that legal status is an assumption. No legal conclusion is required for this app.
- YouTube oEmbed metadata confirms demo titles and publishers but does not expose knob settings or measured audio. Treat the videos as listening references until separately reviewed.

### Assumptions and Contradictions

- Trigger threshold is not published for 2hp Pluck. Use eurorack-js-compatible >=1V rising edge unless the implementation phase standardizes all trigger ports at >2.5V.
- Absolute pitch knob range is not published beyond "five octaves." Use A1 to A6 for a useful string range; tests should assert five-octave span and 1V/oct ratios.
- 2hp Pluck does not expose a `position` parameter. The proposed `position` knob/CV is an app adaptation based on Rings/Elements and EKS pick-position references. If a stricter 2hp-inspired panel is desired, omit `position` and `positionCV`.
- 2hp Pluck likely uses implementation details not public in the manual. The eurorack-js DSP should be musically convincing and stable, not a firmware recreation.
- "Infinite harp" in marketing should be implemented as very long stable decay, not literal unity feedback.
- Four-voice polyphony in a single output can exceed 10Vpp if naively summed. Normalize or soft-limit the mixed output.

## Test Targets

- Initialization: `createDSP({ sampleRate, bufferSize })` creates params, inputs, outputs, LED state, and per-voice buffers with the requested buffer size.
- Silent idle: with no trigger, `out` remains silent or near-zero and `active` LED remains 0.
- Trigger edge: a rising edge at or above the chosen threshold creates one pluck; a sustained high trigger does not retrigger until it returns low.
- Trigger threshold: below-threshold pulses do not trigger; above-threshold pulses trigger.
- Polyphony: five quick triggers should leave four active voices and replace the oldest voice.
- Output range: all samples remain within -5V to +5V for single and four-voice cases.
- Buffer integrity: every output sample is finite; no NaN or Infinity after extreme CV, repeated triggers, or reset.
- Pitch knob: min/max span about five octaves; middle/default produces an audible musical pitch.
- V/Oct: +1V doubles the measured/estimated fundamental frequency; -1V halves it within tolerance.
- Pitch tracking of newest note: after a trigger, changing `vOct` or `pitch` should affect the most recently generated voice; older ringing voices should not jump pitch.
- Decay knob: low decay falls below a small RMS threshold quickly; high decay remains audible much longer but still decays or remains bounded.
- Decay CV: +5V lengthens decay relative to knob alone; -5V shortens it; modulation is clamped and stable.
- Damp knob: low damp produces lower high-frequency energy than high damp, measured by a simple high/low spectral or zero-crossing proxy.
- Damp CV: +5V brightens relative to knob alone; -5V mutes/darkens relative to knob alone.
- Position knob/CV: different positions produce measurably different spectra while staying in range. If `position` is omitted during implementation, mark this target not applicable.
- LED: `active` rises on audible output and decays after notes fade.
- Reset: clears outputs, voices, delay buffers, filters, trigger history, and LED.
- Spec compliance: Damp/Decay sampled at trigger time; output is 10Vpp; CV scaling follows -5V to +5V assumptions.

## Implementation Plan

- Module ID: `pluck`
- Category: `voice`
- Branch/worktree: research-only spec drafted in `/Users/orderandchaos/code/eurorack-js`; recommended implementation worktree is `../eurorack-js-pluck` on branch `module/pluck`.
- DSP model: four-voice Extended Karplus-Strong delay-line voice with filtered-noise excitation, fractional delay, damping filter, optional pick-position comb/body color, DC blocking, and soft limiting.
- Params: `pitch`, `decay`, `damp`, `position`.
- Inputs: `trigger`, `vOct`, `decayCV`, `dampCV`, `positionCV`.
- Outputs: `out`.
- LEDs: `active`.
- Factory patch: add `test-pluck` only during implementation, using a clock/trigger source and sequenced or MIDI pitch CV into `pluck`, then `pluck.out` to `out`. Verify exact port names from source modules before writing the patch.
- Focused tests: `npm test -- tests/dsp/pluck.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Full validation command: `npm test`
- Shared framework changes: none expected.
- Known assumptions: trigger threshold, pitch knob absolute range, and `position` as an app adaptation rather than a 2hp Pluck control.

## Potential Improvements

- Add an external `excite` audio input in a future resonator-oriented module rather than expanding this first voice.
- Add a `model` switch for nylon/steel/sitar after the base voice is stable and tested.
- Replace linear interpolation with allpass fractional delay if long-decay tuning or brightness artifacts are audible.
- Add a lightweight modal body filter if the first pass sounds too synthetic, but keep it optional and CPU-bounded.

## Sources

- [2hp Pluck product page](https://www.twohp.com/modules/pluck) - 2hp, current product page, accessed 2026-07-09, supports: Karplus-Strong voice description, four-voice polyphony, five-octave 1V/oct claim, module availability, and headline behavior.
- [2hp Pluck Manual PDF](https://www.twohp.com/s/2hp_Pluck.pdf) - 2hp, manual PDF, accessed 2026-07-09, supports: panel contract, Trigger/Damp/Decay/Pitch behavior, Damp/Decay CV range, four-voice voice stealing, output LED, and 10Vpp output.
- [2hp Pluck on ModularGrid](https://modulargrid.net/e/2hp-pluck) - ModularGrid, manufacturer-approved listing submitted 2018 and updated 2019, accessed 2026-07-09, supports: practical panel/spec cross-check, 2HP format, module category tags, and marketing copy cross-check.
- [Mutable Instruments Rings manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/manual/) - Mutable Instruments documentation archive, accessed 2026-07-09, supports: resonator concepts, polyphony behavior, string resonator mode, structure/brightness/damping/position roles, normalization behavior for excitation and strum.
- [Mutable Instruments Elements manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/elements/manual/) - Mutable Instruments documentation archive, accessed 2026-07-09, supports: exciter/resonator split, strike excitation, damping, brightness, position, and material/body control concepts.
- [Mutable Instruments Rings `string.h`](https://raw.githubusercontent.com/pichenettes/eurorack/master/rings/dsp/string.h) - Emilie Gillet, Mutable Instruments open-source firmware, 2015, accessed 2026-07-09, supports: KS string implementation concepts, damping filter, brightness, damping, position, dispersion, delay line sizing.
- [Mutable Instruments Rings `string_synth_part.cc`](https://raw.githubusercontent.com/pichenettes/eurorack/master/rings/dsp/string_synth_part.cc) - Emilie Gillet, Mutable Instruments open-source firmware, 2015, accessed 2026-07-09, supports: four-voice/string-synth organization, envelope behavior, chord/polyphony strategy, limiter, effects/body options.
- [Mutable Instruments Rings `resonator.cc`](https://raw.githubusercontent.com/pichenettes/eurorack/master/rings/dsp/resonator.cc) - Emilie Gillet, Mutable Instruments open-source firmware, 2015, accessed 2026-07-09, supports: modal resonator contrast, stiffness/brightness/damping/position mapping, and why a full modal bank is larger scope.
- [The Karplus-Strong Algorithm](https://ccrma.stanford.edu/~jos/pasp/Karplus_Strong_Algorithm.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/W3K, 2010/online edition, accessed 2026-07-09, supports: delay-loop string model, white-noise initial conditions, lowpass excitation for dynamic/brightness control.
- [The Extended Karplus-Strong Algorithm](https://ccrma.stanford.edu/~jos/pasp/Extended_Karplus_Strong_Algorithm.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/W3K, 2010/online edition, accessed 2026-07-09, supports: pick-direction lowpass, pick-position comb, damping, stiffness/allpass, and tuning-allpass concepts.
- [Digital Waveguide Models](https://ccrma.stanford.edu/~jos/pasp/Digital_Waveguide_Models.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/W3K, 2010/online edition, accessed 2026-07-09, supports: waveguide string model overview, damping, dispersion, and excitation theory.
- [Fractional Delay Filtering by Linear Interpolation](https://ccrma.stanford.edu/~jos/pasp/Fractional_Delay_Filtering_Linear.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/W3K, 2010/online edition, accessed 2026-07-09, supports: linear interpolation trade-offs and allpass alternative inside high-gain feedback loops.
- [STK `Plucked.cpp`](https://raw.githubusercontent.com/thestk/stk/master/src/Plucked.cpp) and [STK `Plucked.h`](https://raw.githubusercontent.com/thestk/stk/master/include/Plucked.h) - Perry R. Cook and Gary P. Scavone, Synthesis ToolKit, 1995-2023, accessed 2026-07-09, supports: simple Karplus-Strong class structure, delay length minus filter phase delay, loop gain safety, noise pluck excitation, and note on/off API.
- [US4649783A: Wavetable-modification instrument and method for generating musical sound](https://patents.google.com/patent/US4649783A/en) - Alexander R. Strong and Kevin J. Karplus, assigned to Stanford, priority 1983-02-02, publication 1987-03-17, accessed 2026-07-09, supports: historical Digitar/wavetable-modification context, stochastic modification, low-computation claims, and expired status note.
- [Digital Synthesis of Plucked-String and Drum Timbres](https://www.jstor.org/stable/3680062) - Kevin Karplus and Alex Strong, Computer Music Journal, 1983, accessed 2026-07-09, supports: original Karplus-Strong algorithm reference.
- [Extensions of the Karplus-Strong Plucked-String Algorithm](https://www.jstor.org/stable/3680063) - David A. Jaffe and Julius O. Smith III, Computer Music Journal, 1983, accessed 2026-07-09, supports: extended KS reference for pick position, tuning, damping, and musical control.
- [2hp - Pluck (Karplus Strong Plucked String Eurorack Voice)](https://www.youtube.com/watch?v=CivCZYtfayc) - DivKid, YouTube demo metadata verified through YouTube oEmbed, accessed 2026-07-09, supports: independent demo/listening reference for broad module behavior.
- [Why 2HP Pluck is AWESOME! | Patches & Racks](https://www.youtube.com/watch?v=NSk5jsc8SGY) - Uncle Peter, YouTube demo metadata verified through YouTube oEmbed, accessed 2026-07-09, supports: independent patch-context demo/listening reference.
- [2HP PLUCK - Sweet strings for your modular synth!](https://www.youtube.com/watch?v=Nu9GDow2zK8) - SundayAfternoonModular, YouTube demo metadata verified through YouTube oEmbed, accessed 2026-07-09, supports: independent string-tone demo/listening reference.
