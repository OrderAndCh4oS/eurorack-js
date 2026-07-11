# Eurorack Emulator Research

This directory records hardware evidence, DSP decisions, assumptions, contradictions, and measurable acceptance targets. Normative runtime and schema contracts live in [the architecture guide](../docs/architecture.md); research documents do not override them.

## Audit Index

[DSP and Sound Engineering Audit](sound-engineering-review.md) is the central status and priority index for every registered core module. Each registered ID has exactly one canonical `research/modules/{id}.md` record with a dated audit section.

```bash
npm run audit:dsp
npm run audit:dsp -- --matrix
npm run audit:dsp -- --module vco --json
```

The harness measures runtime invariants, levels, basic signal statistics, broad spectral properties, buffer identity, reset behavior, and advisory timing. It supplements focused tests and listening; it does not prove hardware fidelity.

## Module Records

| Area | Canonical records |
|---|---|
| MIDI | [midi-cv](modules/midi-cv.md), [midi-4](modules/midi-4.md), [midi-cc](modules/midi-cc.md), [midi-clk](modules/midi-clk.md), [midi-drum](modules/midi-drum.md) |
| Clock | [clk](modules/clk.md), [div](modules/div.md), [swing](modules/swing.md), [burst](modules/burst.md) |
| Sources and voices | [nse](modules/nse.md), [vco](modules/vco.md), [wavetable](modules/wavetable.md), [pluck](modules/pluck.md), [kick](modules/kick.md), [snare](modules/snare.md), [hat](modules/hat.md) |
| Modulation | [lfo](modules/lfo.md), [quad-lfo](modules/quad-lfo.md), [rnd](modules/rnd.md), [envf](modules/envf.md), [func](modules/func.md), [adsr](modules/adsr.md), [slew](modules/slew.md), [ochd](modules/ochd.md) |
| Sequencing and pitch | [sh](modules/sh.md), [quant](modules/quant.md), [arp](modules/arp.md), [seq](modules/seq.md), [seq-switch](modules/seq-switch.md), [euclid](modules/euclid.md), [turing](modules/turing.md) |
| Filters and nonlinear | [vcf](modules/vcf.md), [lpg](modules/lpg.md), [formant](modules/formant.md), [fold](modules/fold.md), [ring](modules/ring.md) |
| Effects | [dly](modules/dly.md), [tape](modules/tape.md), [verb](modules/verb.md), [chorus](modules/chorus.md), [phaser](modules/phaser.md), [flanger](modules/flanger.md), [crush](modules/crush.md), [loop](modules/loop.md), [granulita](modules/granulita.md) |
| Utilities | [logic](modules/logic.md), [mult](modules/mult.md), [matrix](modules/matrix.md), [joystick](modules/joystick.md), [vca](modules/vca.md), [atten](modules/atten.md), [db](modules/db.md), [pwm](modules/pwm.md), [cmp2](modules/cmp2.md), [comp](modules/comp.md), [mix](modules/mix.md) |
| Analysis and recording | [scope](modules/scope.md), [spectrum](modules/spectrum.md), [plot](modules/plot.md), [spectrogram](modules/spectrogram.md), [rec](modules/rec.md) |
| Output | [out](modules/out.md) |

[Module Queue](module-queue.md) tracks candidates that are not registered yet. A queued module cannot move to implementation until its research is spec-ready.

## Topic Guides

- [Anti-aliasing](topics/anti-aliasing.md)
- [Effects](topics/effects.md)
- [Filters](topics/filters.md)
- [MIDI modules](topics/midi-modules.md)
- [Oscillators](topics/oscillators.md)

## Evidence Standard

1. Start with manufacturer pages, manuals, schematics/firmware, standards, and original papers.
2. Use independent demos, reviews, historical material, and forums to document observed behavior and contradictions.
3. State whether the target is a faithful emulation, inspired approximation, or utility adaptation.
4. Translate hardware into this project's voltage and worklet contracts explicitly.
5. Record exact test targets and label unknown behavior as an assumption.
6. Give sources a title, publisher/author, date or era where known, URL, access date for unstable pages, and a note stating what each supports.

## Module Document Minimum

Every module record should contain:

- reference hardware or utility scope;
- complete controls, inputs, outputs, normalizations, LEDs, and modes;
- voltage, timing, threshold, and reset contracts;
- DSP model and quality/performance trade-offs;
- observed behavior, contradictions, and assumptions;
- focused test targets;
- `## DSP Audit (YYYY-MM-DD)` with measured findings and next action;
- linked sources.

Cross-cutting references include the [Web Audio API](https://www.w3.org/TR/webaudio-1.0/), [Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/), [DAFx papers](https://dafx.de/paper-archive/), [Mutable Instruments source](https://github.com/pichenettes/eurorack), and manufacturer documentation. Prefer original sources over summaries for electrical or algorithmic claims.
