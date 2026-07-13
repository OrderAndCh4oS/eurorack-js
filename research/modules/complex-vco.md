# Complex Oscillator (complex-vco)

## Research Status

- Queue status: `spec-ready` before implementation.
- Target: feature-faithful Generate 3-inspired oscillator implemented independently in JavaScript.
- Reason to exist: the current `vco` remains a compact subtractive oscillator; this module adds signed through-zero FM, phase modulation, harmonic grouping, balanced AM, and dual sync.

## Sources

### Primary and detailed sources

- [Joranalogue Generate 3 product page](https://joranalogue.com/products/generate-3) (accessed 2026-07-13) specifies a triangle core, 1 V/oct tracking, through-zero linear FM and phase modulation, fundamental/even/odd harmonic groups, balanced AM, reset/flip sync, and LF mode.
- [Generate 3 user manual](https://cdn.shopify.com/s/files/1/1594/2421/files/generate-3-user-manual.pdf) (Joranalogue; accessed 2026-07-13) is the primary panel and electrical reference.
- [Generate 3 Extensive User Guide](https://cdn.shopify.com/s/files/1/1594/2421/files/generate-3-extensive-user-guide.pdf?v=1633508998) (Simon De Rycke/BRiES, 2021; accessed 2026-07-13) documents normalizations, AC filtering below roughly 16 Hz, core octave relationship, output spectra, sync behavior, and practical patches.

### Historical, demo, and DSP context

- [John Chowning, The Synthesis of Complex Audio Spectra by Means of Frequency Modulation](https://ccrma.stanford.edu/sites/default/files/user/jc/fm_synthesis_paper.pdf) provides the canonical FM sideband context.
- [Julius O. Smith, Sinusoidal Modeling](https://ccrma.stanford.edu/~jos/sasp/Sinusoidal_Modeling.html) supports additive harmonic construction and Nyquist-limited partial selection.
- The BRiES guide links several hours of independent patch demonstrations and is used for observed behavior, while electrical facts defer to the manufacturer manual.
- Local references: `research/topics/oscillators.md` and `research/topics/anti-aliasing.md`.

## Panel Contract

### Metadata

- ID/name/category: `complex-vco` / `CPLX VCO` / `source`
- Width/color: 12 HP / `module-color-six`

### Parameters

`coarse` (0-1), `fine` (-12..12 semitones), `range` (Audio/LF), `expFmAmt` (-1..1), `tzFmAmt` (-1..1), `tzFmAc` (off/on), `tzFmBias` (off/on), `phaseAmt` (-1..1), and bipolar `fundLevel`, `evenLevel`, `oddLevel` (-1..1).

### Inputs

| Port | Signal | Behavior |
| --- | --- | --- |
| `vOct` | `cv` | 1 V/oct pitch. |
| `expFm` | `cv` | Exponential pitch modulation through `expFmAmt`. |
| `tzFm` | `cv` | Linear signed FM through `tzFmAmt`; normalized to +5 V when unpatched. |
| `phase` | `cv` | Through-zero phase modulation through `phaseAmt`; normalized 0 V. |
| `reset` | `trigger` | Hard phase reset on >=1 V rising edge. |
| `flip` | `trigger` | Reverses phase direction on >=1 V rising edge. |
| `fundAm`, `evenAm`, `oddAm` | `cv` | Balanced amplitude modulation; normalized to +5 V. |

### Outputs and LEDs

- Audio outputs `core`, `fund`, `even`, `odd`, and `full`, each bounded to +/-5 V.
- `core` is triangle at half the harmonic-generator frequency. `fund` is sine; `even` contains 2,4,6... partials; `odd` contains 3,5,7...; `full` sums the three controlled channels.
- LEDs `positive` and `negative` show current full-output polarity/level.

## Voltage Contract

- Audio and modulation CV accept nominal +/-5 V. Pitch follows 1 V/oct.
- Audio mode targets roughly 10 Hz-20 kHz before modulation; LF mode targets 0.003-30 Hz.
- Through-zero FM may produce negative instantaneous frequency and must run the phase backwards rather than clamp at zero.
- Phase input at full positive amount spans +/-2.5 cycles (900 degrees total range).
- Trigger threshold is the app-standard >=1 V. Outputs use app-standard +/-5 V, not hardware headroom.

## DSP Plan

Use a normalized signed phase accumulator. Base pitch is exponential; exponential FM adds octaves and linear FM adds signed Hz. `flip` multiplies direction by -1. `reset` sets phase to zero. AC mode processes TZFM through a first-order 16 Hz high-pass; bias adds +5 V before the attenuverter.

Generate the triangle core analytically. Generate harmonic outputs with additive sine sums capped below 0.45 * sample rate: fundamental alone, even partials weighted 1/n, and odd partials from 3 upward weighted 1/n. Apply the modulated phase to harmonic outputs only. Unpatched AM inputs use +5 V normalization so their bipolar controls act as direct levels; patched inputs become four-quadrant multipliers. Soft-limit each output to +/-5 V.

## Trade-Offs And Deviations

- This is not a transistor/OTA circuit model. Precision, normalizations, spectra, and modulation workflows are the fidelity targets.
- Additive harmonic limiting is preferred to naive discontinuous saw/square construction because the module is expected to tolerate deep audio-rate modulation.
- The module is monophonic/multiphonic in the spectral sense, not a two-oscillator Buchla-style complex oscillator.
- Existing oscillator utilities and the existing `vco` are not changed.

## Test Targets

- Initialization, stable arrays, params, ports, LEDs, reset, and finite +/-5 V outputs.
- 1 V/oct doubling and Audio/LF ranges.
- Negative TZFM reverses phase while remaining finite; AC mode rejects DC; bias changes the signed rate.
- Phase modulation changes waveform without changing long-term base period.
- FFT/DFT assertions identify the fundamental, even-only, and odd-without-fundamental groups.
- Reset and flip are rising-edge only. Balanced AM handles positive, zero, and negative modulation.

## Implementation Plan

- Module ID/category: `complex-vco` / `source`.
- DSP: signed phase, limited additive harmonics, normalized balanced AM, high-pass-coupled optional TZFM.
- Factory patch: `Test: Complex VCO`, sequenced through a VCA/output with self-modulation.
- Focused validation: `npm test -- tests/dsp/complex-vco.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- Known assumption: exact analogue transfer curves are approximated; contracts above are normative.

## DSP Audit (2026-07-11)

- **Focused coverage**: audio/LF tracking, signed through-zero FM, phase modulation, harmonic separation, balanced AM, sync, reset, buffer identity, and voltage bounds are covered by `tests/dsp/complex-vco.test.js`.
- **Measured status**: the 44.1/48/96 kHz by 128/512-sample matrix completed 23 scenarios per configuration with zero errors or voltage flags, finite/stable buffers, and a measured maximum of 477.9 us/block.
- **Next action**: profile additive partial count at low fundamentals before increasing the 31-harmonic ceiling.
