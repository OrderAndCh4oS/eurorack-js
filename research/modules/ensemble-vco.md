# Ensemble Oscillator (ensemble-vco)

## Research Status

- Queue status: `spec-ready` before implementation.
- Target: feature-faithful main synthesis and performance workflow of the 4ms Ensemble Oscillator, implemented independently and named generically.
- Distinct role: one coherent chordal/timbral source rather than a rack of detuned copies of the current VCO.

## Sources

### Primary sources

- [4ms Ensemble Oscillator product page](https://4mscompany.com/enosc.php) (accessed 2026-07-13) specifies 16 sine-based oscillators, 30 writable scales in three groups, Twist/Warp/Cross-FM algorithms, stereo and freeze modes, two 1 V/oct inputs, +/-5 V CV, and 2.5 V gate thresholds.
- [Ensemble Oscillator manual v1.1f](https://4mscompany.com/media/ENOSC/manual/Ensemble-Osc-manual-v1.1f.pdf) (4ms Company and Matthias Puech, 2020; accessed 2026-07-13) defines every control, scale repetition, crossfading, Learn, Freeze, and stereo algorithm.
- [4ms `enosc` firmware](https://github.com/4ms/enosc) (accessed 2026-07-13) is the official implementation reference for scale tables, quantization, phase distortion, wave shaping, and modulation order. Its licence must be checked before any direct reuse; this implementation copies no firmware code.

### Context, demos, and DSP references

- The official product page links manufacturer and independent demonstrations including Loopop, SonicState, and Perfect Circuit. Observed targets include pure additive chords, organ/string clusters, metallic cross-FM, narrow pulsar tones, and stereo detuned motion.
- [Julius O. Smith, Sinusoidal Modeling](https://ccrma.stanford.edu/~jos/sasp/Sinusoidal_Modeling.html) supports additive oscillator banks and amplitude normalization.
- [Casio CZ phase-distortion patent US4631726A](https://patents.google.com/patent/US4631726A/en) provides historical phase-distortion context; the manual remains normative for the three Twist mappings.
- Local anti-aliasing and oscillator guidance: `research/topics/anti-aliasing.md` and `research/topics/oscillators.md`.

## Source Quality And Scope

- Manufacturer documentation wins for algorithms, ranges, and electrical behavior. Reviews/demos establish musical targets only.
- Core panel modes, Learn, Freeze, custom scales, and stereo are in scope. Hardware calibration, bootloader, firmware update, and physical shift-button gestures are out.
- The app uses explicit controls for shift functions. It also exposes `mono` because the engine cannot implement Out A normalization based on whether Out B is connected.

## Panel Contract

### Metadata

- ID/name/category: `ensemble-vco` / `ENSEMBLE` / `source`
- Width/color: 16 HP / `module-color-seven`

### Parameters

- Pitch/scale: `root`, `pitch`, `fine`, `spread`, `scale`, `scaleGroup`, `detune`, `oscillatorCount`.
- Mix/timbre: `balance`, `crossfade`, `crossFm`, `crossFmMode`, `twist`, `twistMode`, `warp`, `warpMode`.
- Performance: `stereoMode`, `freezeMode`, `freeze`, `learnMode`, `learnNote`, `scaleMemory`.
- `scaleMemory` is a sparse object of slot indexes to arrays of up to 16 finite semitone offsets. It is a patch-persisted parameter; factory scales remain immutable constants.

### Inputs

| Port | Signal | Behavior |
| --- | --- | --- |
| `root`, `pitch` | `cv` | Independent 1 V/oct inputs, practical -2..+6 V. Root moves on the scale grid; Pitch transposes continuously after quantization. |
| `scaleCv`, `spreadCv`, `balanceCv`, `crossFmCv`, `twistCv`, `warpCv` | `cv` | Bipolar +/-5 V offsets around panel controls. |
| `learn`, `freeze` | `trigger` | Rising edge above 2.5 V. Learn samples Pitch while Learn mode is active; Freeze toggles the selected subset. |

### Outputs and LEDs

- `mono`, `outA`, and `outB` are +/-5 V audio. Mono includes all active oscillators; A/B use the chosen stereo allocation.
- LEDs `learn`, `freeze`, and `scale` report modes and scale changes.

## Synthesis Contract

- Oscillator count is 1-16. Voices start as sine oscillators placed on the selected scale grid.
- Scale groups: 10 equal-tempered sets, 10 unquantized octave-repeating sets, and 10 free-interval repeating sets. Root/Spread crossfade smoothly between adjacent allowed pitches; Pitch is continuous.
- Cross FM modes: root modulates all, each modulates the next, or highest modulates all.
- Twist modes: Ramp phase skew, Pulsar phase compression, and Crush phase quantization.
- Warp modes: Fold (up to six folds), Cheb (orders up to 16), and Segment (eight piecewise shapes).
- Stereo modes: odd/even, low/high halves, and root/rest.
- Freeze modes: root only, lower subset, and odd-numbered oscillators. Frozen pitch state ignores pitch/grid controls but still receives timbre and balance changes.

## Learn And Persistence

- Entering Learn mode targets the selected scale slot. `learnNote` plus Add stores a semitone offset; Delete removes the last note; Fine adjusts it.
- A rising edge on `learn` samples the `pitch` input and appends a note.
- Leaving Learn mode writes a new immutable `scaleMemory` object through `onParamChange`; Reset Factory removes the selected override.
- Patch v3 already accepts nested finite-number parameter values, so no schema version or legacy migration is added.

## DSP Plan

Maintain 16 normalized phases and per-voice current/target pitch. Build target pitches from group/scale/root/spread, then slew/crossfade between grid notes using `crossfade`. Apply continuous Pitch and fine tuning, detune symmetrically, then calculate all base sines before Cross FM so algorithms use a stable previous-sample modulation vector. Apply Twist to phase, Warp to the twisted sine, balance weights, and stereo routing. Normalize by active weighted energy and soft-limit outputs.

Factory scale data is project-authored from standard interval sets and harmonic series; do not copy proprietary tables. Learned overrides are validated, sorted, de-duplicated, limited to 16 notes, and required to include 0 semitones.

## Assumptions And Deviations

- Explicit mode controls replace shift gestures for discoverability and MIDI mapping.
- A sparse patch-local scale memory replaces hardware global nonvolatile memory, making shared patches deterministic.
- Crossfading and waveform algorithms target documented behavior, not bit-identical firmware output.
- No changes are made to `vco`, `wavetable`, `chorus`, or other existing module DSP.

## Test Targets

- Contract, stable 16-voice state, finite +/-5 V outputs, LEDs, reset, and no process-time allocation.
- Oscillator-count normalization and 1 V/oct Pitch transposition.
- Representative ratios from every scale group and smooth Root/Spread movement.
- Each Cross FM, Twist, Warp, stereo, and freeze mode produces its documented distinct behavior.
- Learn input threshold/edge behavior, add/delete/fine actions, factory reset, finite scale validation, and patch encode/decode round-trip.
- Mono and stereo energy remain useful and bounded at 1 and 16 voices.

## Implementation Plan

- Module ID/category: `ensemble-vco` / `source`.
- DSP: 16 preallocated sine-derived voices with scale quantization, modulation, shaping, freeze, and stereo routing.
- UI: custom renderer with `telemetry: { fields: [], methods: [] }`; full declarative UI contract remains available to validation and patch serialization.
- Factory patch: `Test: Ensemble VCO`, slowly modulated through output.
- Focused validation: `npm test -- tests/dsp/ensemble-vco.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- Known constraint: keep the existing full-audit timeout; no timeout increase without measured evidence.

## DSP Audit (2026-07-11)

- **Focused coverage**: voice normalization, scale groups, pitch, shaping/FM/stereo/freeze modes, learned-scale persistence, reset, buffer identity, and voltage bounds are covered by `tests/dsp/ensemble-vco.test.js`.
- **Measured status**: the 44.1/48/96 kHz by 128/512-sample matrix completed 44 scenarios per configuration with zero errors or voltage flags, finite/stable buffers, and a measured maximum of 669.1 us/block.
- **Next action**: profile 16-voice deep-shaping modes before adding further oscillators or oversampling.
