# Resonator Bank (resbank)

## Research Status

- Queue status: `spec-ready` before implementation.
- Target: feature-faithful main-panel adaptation of Mutable Instruments Rings under a distinct project name.
- Models: modal resonator, sympathetic strings, and dispersive/modulated string; 1/2/4 voice tail polyphony.

## Sources

### Primary sources

- [Rings manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/manual/) (Mutable Instruments, 2015; accessed 2026-07-13) defines the three models, polyphony, normalizations, controls, odd/even outputs, 1 V/oct behavior, and damping from under 100 ms to about 10 seconds.
- [Rings original description](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/original_blurb/) records the design intent: an external or internal exciter driving resonant structures rather than a conventional oscillator voice.
- [Rings open-source page](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/open_source/) and [MIT-licensed source repository](https://github.com/pichenettes/eurorack/tree/master/rings) expose the reference modal filters, string waveguides, voice allocation, excitation, and limiting code.

### DSP, history, and observed behavior

- [Julius O. Smith, Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/) covers modal synthesis, digital waveguides, loop filters, fractional delay, and dispersion.
- [Karplus and Strong, Digital Synthesis of Plucked-String and Drum Timbres](https://doi.org/10.1016/0148-9267(83)90215-X) is the foundational plucked-string loop reference.
- [Mutable Instruments Rings overview](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/) links manufacturer and independent demonstrations. Listening targets are long overlapping tails, hollow position notches, metallic inharmonic modes, and playable single-CV normalization.
- Local comparisons: `research/modules/pluck.md`, `research/topics/filters.md`, and `research/topics/oscillators.md`.

## Source Quality And Scope

- The reference firmware is MIT licensed, but the implementation remains idiomatic JavaScript and copies no lookup tables or trademarked panel identity.
- Main-panel behavior is in scope. Calibration, firmware loading, reverb/FM easter eggs, and undocumented modes are not.
- Hardware mixes both components when only one output is patched. The engine cannot observe output connection state, so the app exposes a dedicated `mix` output alongside `odd` and `even`.

## Panel Contract

### Metadata

- ID/name/category: `resbank` / `RESBANK` / `filter`
- Width/color: 14 HP / `module-color-three`

### Parameters

| Param | Range | Default | Behavior |
| --- | --- | --- | --- |
| `frequency` | 0-1 | 0.45 | Coarse pitch across five octaves in semitone steps. |
| `frequencyAmt` | -1..1 | 0 | Bipolar frequency-CV attenuverter; unpatched normal gives fine tune behavior. |
| `structure`, `brightness`, `damping`, `position` | 0-1 | model-specific musical defaults | Main resonator controls. |
| `structureAmt`, `brightnessAmt`, `dampingAmt`, `positionAmt` | -1..1 | 0 | Bipolar CV attenuverters. |
| `model` | 0,1,2 | 0 | Modal, Sympathetic, String. |
| `polyphony` | 0,1,2 | 0 | 1, 2, or 4 voices. |

### Inputs and outputs

| Direction | Port | Signal | Normal/behavior |
| --- | --- | --- | --- |
| Input | `vOct` | `cv` | 0 V; 1 V/oct. |
| Input | `frequencyCv` | `cv` | 1/12 V when unpatched so its attenuverter becomes fine tuning. |
| Input | `structureCv`, `brightnessCv`, `dampingCv`, `positionCv` | `cv` | 0 V; +/-5 V spans the control through its attenuverter. |
| Input | `strum` | `trigger` | >=1 V rising edge; unpatched enables pitch-step/transient detection. |
| Input | `audio` | `audio` | External excitation; unpatched enables internal pulse/noise exciter. |
| Output | `mix`, `odd`, `even` | `audio` | Explicit sum and complementary components, each +/-5 V. |

- LEDs `model` and `voice` indicate selected model and the most recently allocated voice.

## Voltage And Behavioral Contract

- Audio is nominal +/-5 V; internal limiter/soft saturation prevents runaway feedback.
- Pitch follows 1 V/oct around the coarse root. Frequencies are limited below 0.45 * sample rate.
- A strum freezes the old voice tail and allocates the next voice round-robin.
- With unpatched audio, modal mode uses a filtered impulse while string modes use a position-shaped noise burst.
- With unpatched strum, a meaningful V/oct step triggers; if V/oct is also unpatched, a sharp external audio transient triggers.
- Reset clears filters, delay lines, detectors, voice allocation, outputs, and LEDs.

## DSP Plan

### Modal model

Run parallel two-pole band-pass resonators. `structure` bends modal spacing between harmonic and inharmonic ratios, `brightness` weights high modes and exciter cutoff, `damping` maps Q/decay, and `position` applies sinusoidal pickup/excitation weights. Use approximately 60, 28, or 12 modes for 1, 2, or 4 voices.

### Sympathetic model

Use several fractional-delay comb strings tuned from unison through fifth/octave-related ratios according to `structure`. The active string receives the exciter; the others receive a bounded sympathetic feed. Brightness and damping control the loop low-pass and gain.

### String model

Use one extended Karplus-Strong delay per voice with fractional linear reads, one-pole loss filtering, a short all-pass dispersion section, and slow bridge-position modulation derived from `structure`. Position shapes excitation and the two pickup outputs.

All arrays and delay lines are allocated in `createDSP()`. Per-sample coefficients are clamped and finite. Module-specific helpers remain inside the module file.

## Assumptions And Deviations

- The AudioWorklet reports input connection lifecycle separately from stable
  sample buffers. Audio/Strum normalizations use that state, so patched silence
  remains distinct from an unpatched port.
- Exact fixed-point firmware lookup tables and hidden algorithms are not copied.
- The explicit `mix` output is a software-panel adaptation and the documented default for mono patches.
- Resolution reduction is a deliberate CPU/fidelity trade-off also present in the reference behavior.

## Test Targets

- An exhaustive panel guard covers every declared knob, mode button, input, output, and LED so UI additions require matching behavioral tests.
- Contract, stable buffers, voltage bounds, finite output, reset, and LEDs.
- Modal impulse rings at the requested pitch; structure/brightness/damping/position each measurably change spectrum or decay.
- Sympathetic and string modes are non-silent and spectrally distinct.
- 1 V/oct approximately doubles the root response.
- Internal and external excitation paths, pitch-step auto-strum, explicit strum, held-high behavior, and 1/2/4 voice overlap.
- `mix` approximates a bounded combination of the complementary outputs.

## Implementation Plan

- Module ID/category: `resbank` / `filter`.
- DSP: independent JS modal filters and fractional-delay strings informed by the cited MIT source and physical-model literature.
- Factory patch: `Test - Resonator Bank`, sequenced via internal exciter into stereo output.
- Panel validation: the six CV sockets use a three-column, two-row grid so
  jack bodies and labels remain distinct at the module's 14 HP width.
- Focused validation: `npm test -- tests/dsp/resbank.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- Full validation must retain the current DSP-audit timeout.

## DSP Audit (2026-07-11)

- **Focused coverage**: modal/string models, controls, excitation paths, pitch tracking, voice allocation, reset, buffer identity, and voltage bounds are covered by `tests/dsp/resbank.test.js`.
- **Measured status**: the 44.1/48/96 kHz by 128/512-sample matrix completed 25 scenarios per configuration with zero errors or voltage flags, finite/stable buffers, and a measured maximum of 535.6 us/block. Modal coefficients are updated per block/voice rather than per sample.
- **Next action**: listening-test long 4-voice tails and remeasure if modal resolution or feedback limits change.

## Individual Contract Audit (2026-07-30)

- **Normalization defects found**: the module scanned each block for nonzero
  Audio samples and high Strum values to infer patch state. A patched silent
  Audio input therefore invoked the internal exciter, while a patched-low Strum
  input incorrectly left pitch-step and audio-transient auto-strumming enabled.
- **Remediation**: Audio and Strum use AudioWorklet connection lifecycle state.
  The internal exciter is available only when Audio is unpatched; automatic
  pitch/audio allocation is available only when Strum is unpatched. Connected
  silence and disconnect restoration have explicit regressions.
- **Voltage/reset contract**: V/Oct and the four attenuverted CVs explicitly
  declare -5..+5 V. Reset clears every stable input/output and detector/voice
  state while restoring Frequency CV's documented 1/12 V normal.
- **Coverage**: focused tests exercise all three models, all controls and CV
  attenuverters, 1 V/oct, 1/2/4 voices, explicit/internal/external excitation,
  exact cable normals, trigger threshold/held state, three outputs, LEDs,
  reset, rails, finite samples, and stable buffers.
- **Runtime/voltage result**: the strict 44.1/48/96 kHz by 128/512 matrix
  completed all 25 scenarios with no errors or voltage flags, stable buffers, a
  5 V peak, and a worst observed advisory runtime of 489.9 microseconds/block.
- **Status**: complete for the documented Rings-inspired adaptation.
