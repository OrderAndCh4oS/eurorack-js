# Quadrature LFO (`quad-lfo`)

Status: research complete and implemented. The queue row is coordinator-owned and tracks final completion in `research/module-queue.md`.

## Summary

`quad-lfo` is a phase-coherent quadrature modulation source: one sine oscillator with fixed outputs at 0, 90, 180, and 270 deg. It fills the gap between the existing waveform LFO and ochd-style drifting modulation by providing stable phase relationships for panning, filter movement, cyclic crossfades, barberpole-style patches, and audio-rate sine/cosine modulation.

The module should be an inspired-by/adapted utility, not a component-level clone. The main hardware references are Doepfer A-143-9 for a voltage controlled quadrature sine oscillator and Xaoc Batumi for a modern Eurorack quadrature LFO mode. The DSP model should use a floating-point phase accumulator and direct sine/cosine evaluation rather than modeling analog sine-core imperfections.

## Source Notes

### Primary and Manufacturer Sources

- [Doepfer A-143-9 Voltage Controlled Quadrature LFO/VCO](https://doepfer.de/a1439.htm), Doepfer Musikelektronik, official product page, accessed 2026-07-09. Supports the core four-output contract, 90 deg phase spacing, sine/cosine/inverted sine/inverted cosine labels, three range switch behavior, exponential CV inputs, non-1V/oct note, output level, LEDs, and intended applications.
- [A-126 and A-143-9 connection document](https://doepfer.de/a100_man/A126_A143_9_connection.pdf), Doepfer Musikelektronik, connection note, accessed 2026-07-09. Supports the A-143-9 use case as an external sine/cosine quadrature oscillator for Doepfer frequency shifting modules.
- [Xaoc Devices Batumi](https://xaocdevices.com/main/batumi/), Xaoc Devices, official product page, accessed 2026-07-09. Supports the modern quad LFO reference, synchronized quadrature mode, sine/square/assignable outputs, reset/sync inputs, and broad frequency range.
- [Batumi operator's manual](https://xaocdevices.com/manuals/xaoc_batumi_manual.pdf), Xaoc Devices, rev. 1974/5.3, 2022, accessed 2026-07-09. Supports exact quadrature behavior: LFO 1 is master, channels 2-4 are shifted by 90, 180, and 270 deg in quadrature mode; also supports reset/sync, pause/reverse/next-wave functions in synced modes, output voltage ranges, and CV scaling.

### Practical Secondary Sources

- [Doepfer A-143-9 on ModularGrid](https://modulargrid.net/e/doepfer-a-143-9), ModularGrid, accessed 2026-07-09. Confirms 8 HP, 50 mm depth, +30 mA/-30 mA current draw, LFO/oscillator tags, and common rack adoption. Electrical behavior should defer to the Doepfer page.
- [Doepfer A-143-9 at Thomann](https://www.thomann.co.uk/doepfer_a1439.htm), Thomann, retailer page, accessed 2026-07-09. Confirms concise market description: quadrature LFO/VCO with simultaneous sine and cosine signals and four 90 deg shifted outputs.
- [Xaoc Devices Batumi on ModularGrid](https://modulargrid.net/e/xaoc-devices-batumi), ModularGrid, accessed 2026-07-09. Confirms 10 HP, 45 mm depth, +45 mA/-15 mA current draw, and manufacturer-approved practical specs.

### Reviews, Demos, and Observed Use

- [A-143-9 Lin-FM & Buchla Saw Modification](https://navsmodularlab.blogspot.com/2014/09/a-143-9-lin-fm-buchla-saw-modification.html), Navs Modular Lab, Navs, 2014-09-02, accessed 2026-07-09. Reports the A-143-9 sine as pure with minimal DC offset, describes it as useful for FM, and links mono and quadrature stereo FM sound examples. This is a user modification and listening source, not an authority for factory specs.
- [Quadrature glossary](https://learningmodular.com/glossary/quadrature/), Learning Modular, Chris Meyer, 2016-11-16, accessed 2026-07-09. Explains quadrature as a 90 deg phase relationship, notes sine/cosine as the classic pair, and describes stereo chasing and ping-pong motion when phase-shifted LFOs drive panners.
- [XAOC Devices - Batumi](https://www.youtube.com/watch?v=0I3jo8bpfU8), DivKid, YouTube demo metadata accessed through oEmbed 2026-07-09. Manufacturer-linked independent demo reference. It was not used for electrical facts.
- [XAOC Devices Batumi Demo](https://www.youtube.com/watch?v=BsgXiE8zYs0), Perfect Circuit, YouTube demo metadata accessed through oEmbed 2026-07-09. Manufacturer-linked retailer demo reference. It was not used for electrical facts.

### DSP References

- [All About Direct Digital Synthesis](https://www.analog.com/en/resources/analog-dialogue/articles/all-about-direct-digital-synthesis.html), Eva Murphy and Colm Slattery, Analog Devices Analog Dialogue, 2004-08, accessed 2026-07-09. Supports phase accumulator plus phase-to-amplitude conversion as a standard digital oscillator design and notes phase-offset generation.
- [MT-085: Fundamentals of Direct Digital Synthesis (DDS)](https://www.analog.com/media/en/training-seminars/tutorials/MT-085.pdf), Analog Devices tutorial, rev. 0, 2008-10, accessed 2026-07-09. Supports the numerically controlled oscillator structure, phase accumulator, sine/cosine lookup concept, and phase-address mapping. The implementation can use `Math.sin` instead of a lookup table because this module has only four outputs and modest CPU cost.

## Hardware Findings

### Doepfer A-143-9

The A-143-9 is a voltage-controlled sine quadrature LFO/VCO with four outputs at fixed 90 deg intervals:

- 0 deg: sine
- 90 deg: cosine
- 180 deg: inverted sine
- 270 deg: inverted cosine

Doepfer describes it as a quadrature sine source rather than a saw/triangle waveshaper, with low-distortion sine/cosine outputs. It has a manual frequency control, a three-position range switch, two exponential frequency CV inputs, and a polarizer on the second CV input. Doepfer explicitly says it is not an exact 1V/oct VCO.

Doepfer's published manual ranges are:

- H: about 30 Hz to 3.5 kHz by manual control, beyond 20 kHz with added external CV.
- M: about 1 Hz to 150 Hz by manual control.
- L: about 0.1 Hz to 10 Hz by manual control, extendable down to several minutes with external CV.

Doepfer states the output level is about 5 Vpp, meaning about +/-2.5 V, adjustable internally with a trim pot. The app should not copy that exact level because existing app CV and audio conventions are bipolar +/-5 V. Xaoc Batumi also documents sine outputs at +/-5 V, so the app-level decision is defensible.

Known A-143-9 applications include external sine/cosine oscillator use for frequency shifters, pure sine/cosine LFO modulation, quadrature and barberpole effects, crossfades, and experimental FM.

### Xaoc Batumi

Batumi is a quad digital LFO with free, quadrature, phase, and divide modes. In quadrature mode, channel 1 is the master and the other channels are fixed at 90, 180, and 270 deg offsets. The manual documents sine, square, and assignable outputs at -5 V to +5 V. Batumi's CV inputs use 1V/oct scaling for frequency/phase/division control, and reset/sync behavior can reset or synchronize the cycle. In synchronized modes, additional reset inputs can pause, reverse, or change the waveform.

For this app module, Batumi supports the usefulness of reset and hold/pause behavior, but the waveform set and multi-mode channel architecture are out of scope. `quad-lfo` should stay focused on one oscillator with four sine phase taps.

## Source Quality, Contradictions, and Decisions

- Output voltage differs across references. Doepfer A-143-9 is about +/-2.5 V, while Batumi and this app's bipolar modulation convention use +/-5 V. Decision: `quad-lfo` outputs should be +/-5 V for useful app-standard modulation. Users can attenuate downstream.
- CV scaling differs across references. Doepfer says A-143-9 is not exact 1V/oct; Batumi documents 1V/oct CV inputs. Decision: use exponential octave scaling for predictable musical modulation, but do not present the module as a calibrated pitch VCO. Tests should verify monotonic octave-style response, not precision pitch tracking claims.
- Frequency range differs. Doepfer can reach high audio and ultrasonic rates with CV; Batumi reaches 500 Hz and warns of precision/amplitude limitations above 100 Hz. Decision: keep useful slow, mid, and audio-rate ranges, but clamp internally to avoid meaningless above-Nyquist behavior. The module is a modulation source first.
- Reset/hold behavior is not part of the A-143-9 panel. Decision: include reset and hold as app adaptations inspired by Batumi and by expected digital LFO ergonomics.
- A separate Doepfer A-143-9 manual PDF was not found; direct likely manual paths returned 404. The official product page is the primary A-143-9 source.
- Perfect Circuit's product page was not accessible reliably because of Cloudflare; it is not cited for specifications.

## Intended Module Contract

### Identity

- Module ID: `quad-lfo`
- Display name: `Quad LFO`
- Category: `modulation`
- Suggested width: 8 HP
- Suggested color token: `module-color-eight`
- Model type: inspired-by/adapted quadrature sine LFO, not a faithful clone.

### Parameters

| Param | Label | Range | Default | Behavior |
| --- | --- | --- | --- | --- |
| `rate` | Rate | 0..1 | 0.35 | Exponential manual frequency within the selected range. |
| `range` | Range | `low`, `mid`, `high` | `low` | Three-position range selection inspired by A-143-9. |
| `rateCvAmt` | CV Amt | -1..1 | 0 | Bipolar attenuverter for the `rateMod` input. |

Suggested range mapping:

| Range | Manual frequency | Notes |
| --- | --- | --- |
| `low` | 0.1 Hz to 10 Hz | Matches the useful A-143-9 low range; negative CV may extend toward multi-minute cycles. |
| `mid` | 1 Hz to 150 Hz | Matches the A-143-9 mid range. |
| `high` | 30 Hz to 3500 Hz | Matches the A-143-9 manual high range, with internal clamping below Nyquist. |

Implementation may use a small nonzero minimum such as 1/600 Hz after CV so very slow cycles remain stable.

### Inputs

| Port | Label | Type | Voltage contract | Behavior |
| --- | --- | --- | --- | --- |
| `rateCV` | 1V/OCT | `cv` | Expected +/-5 V | Direct exponential frequency CV. Use octave-style scaling for predictability, but do not claim calibrated pitch tracking. |
| `rateMod` | FM | `cv` | Expected +/-5 V | Exponential frequency modulation through `rateCvAmt`, modeled after the A-143-9 polarizer input. |
| `reset` | Reset | `trigger` | Rising edge at >=1 V | Resets oscillator phase to 0 before computing the current sample. |
| `hold` | Hold | `gate` | Active above 2 V | Freezes phase while held; outputs continue to report the frozen phase. |

Effective octave modulation should be:

```text
octaves = clamp(rateCV, -5, 5) + clamp(rateMod, -5, 5) * rateCvAmt
frequency = baseFrequency * 2 ** octaves
```

Clamp final frequency to a practical range, for example 1/600 Hz to `min(5000, sampleRate * 0.45)` Hz. The high clamp is a DSP safety limit, not a musical promise.

### Outputs

| Port | Label | Type | Voltage contract | Behavior |
| --- | --- | --- | --- | --- |
| `out0` | 0 | `cv` | +/-5 V | `sin(phase)` |
| `out90` | 90 | `cv` | +/-5 V | `sin(phase + 0.25 cycles)`, equivalent to cosine |
| `out180` | 180 | `cv` | +/-5 V | Inverted `out0` |
| `out270` | 270 | `cv` | +/-5 V | Inverted `out90` |

At phase 0 after reset, outputs should be approximately:

```text
out0 = 0 V
out90 = +5 V
out180 = 0 V
out270 = -5 V
```

### LEDs

Use one signed LED per phase output:

- `led0`
- `led90`
- `led180`
- `led270`

Each LED should reflect the final output sample normalized to roughly -1..1. Doepfer uses two LEDs for positive and negative portions of the sine output; the app adaptation uses four LEDs because four phase outputs are the main user-facing contract.

### Normalization

No internal cable normalization is required. Inputs should behave as 0 V when unpatched. There is no audio input path and no need for the unpatched-audio silence reset pattern.

## DSP Plan

Use a single phase accumulator in cycles:

```text
phase = (phase + frequency / sampleRate) modulo 1
```

For each sample:

1. Read and clamp `rateCV` and `rateMod`.
2. Compute base frequency from `rate` and `range` using exponential mapping.
3. Apply octave-style CV modulation.
4. Clamp frequency to the supported DSP range.
5. Detect reset rising edge using the app gate threshold convention: current sample >=1 V and previous sample <1 V.
6. If reset rises, set phase to 0 before output generation.
7. If `hold` is not active, advance phase by `frequency / sampleRate`.
8. Compute four outputs from the same phase using `Math.sin`.
9. Update LEDs from the final sample values.

The phase convention should be documented in tests. If the implementation advances phase after output generation, reset tests should expect the exact phase-zero sample. If it advances before output generation, tests should allow the first reset sample to be one sample ahead. Prefer output-before-advance for clearer reset behavior.

No PolyBLEP is required because the module emits sine waves only. No recursive quadrature oscillator should be used unless there is a strong reason; recursive oscillators can drift in amplitude or phase and require correction. Direct sine/cosine evaluation is straightforward, stable at LFO rates, and inexpensive for four outputs per sample.

The model intentionally omits:

- Analog sine-core distortion.
- Phase error between quadrature taps.
- Internal output-level trim.
- Temperature drift.
- Doepfer's internal A-132-2 connection option.
- Batumi's square/assignable wave outputs and multi-mode architecture.

## Test Targets

Tests should be written before implementation in `tests/dsp/quad-lfo.test.js`.

1. Initialization: creates all inputs, outputs, params, LEDs, and buffers at the requested buffer size.
2. Output ranges: all four outputs stay finite and within +/-5 V plus small floating tolerance.
3. Buffer integrity: process fills every sample and produces no NaN or Infinity.
4. Phase relationships: at a known frequency and sample rate, `out180` is approximately `-out0`, `out270` is approximately `-out90`, and `out90` is a quarter-cycle offset from `out0`.
5. Reset behavior: a rising edge at >=1 V resets phase; sub-threshold signals do not; edge memory updates after detection.
6. Hold behavior: hold above 2 V freezes phase and outputs; releasing hold resumes from the frozen phase.
7. Rate knob: increasing `rate` increases zero-crossing count or measured cycle advance.
8. Range switch: `low`, `mid`, and `high` produce increasing frequency spans and stay within internal clamps.
9. Direct CV input: positive `rateCV` increases frequency and negative `rateCV` decreases frequency.
10. Attenuverted CV input: `rateMod` follows `rateCvAmt`; negative `rateCvAmt` reverses modulation direction.
11. LED state: LEDs reflect the last output sample normalized to -1..1.
12. Reset method: clears phase, edge memory, outputs, and LEDs to deterministic states.
13. Spec compliance: confirms the app-standard +/-5 V output decision and fixed 0/90/180/270 deg phase taps.

## Implementation Plan

- Module ID: `quad-lfo`
- Category: `modulation`
- Branch/worktree: implemented through an isolated implementation subagent workspace and integrated by the coordinator.
- DSP model: adapted DDS-style phase accumulator with direct sine/cosine evaluation and fixed quadrature phase taps.
- Params: `rate`, `range`, `rateCvAmt`.
- Inputs: `rateCV`, `rateMod`, `reset`, `hold`.
- Outputs: `out0`, `out90`, `out180`, `out270`.
- LEDs: `led0`, `led90`, `led180`, `led270`.
- Factory patch: `src/js/config/patches/test-quad-lfo.js`, routing `out0`/`out90` to scope and modulation destinations for phase visualization and motion.
- Focused tests: `npm test -- tests/dsp/quad-lfo.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Full validation command: `npm test`
- Known assumptions: outputs use app-standard +/-5 V rather than Doepfer's about +/-2.5 V; frequency CV uses octave-style scaling but is not a calibrated pitch VCO; reset and hold are digital app adaptations; high-rate behavior is clamped to practical DSP limits; analog imperfections and Batumi's extra waveforms/modes are out of scope.

## Completion Assessment

This document has primary citations, practical secondary sources, demo/context sources, DSP references, panel and voltage contracts, assumptions and contradictions, a DSP plan, test targets, and an implementation plan. The implementation is complete and validated; the queue status is changed only by the coordinator.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/quad-lfo.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
