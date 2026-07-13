# Candidate Module Queue

This is a curated backlog for new modules that should each add a distinct capability to the rack. Entries are candidates, not implementation specs. Do not implement one until it has a dedicated `research/modules/{moduleId}.md` file with cited sources, panel contract, DSP plan, and test targets.

## Selection Rules

- Prefer modules that add a new synthesis, modulation, routing, sequencing, analysis, or performance behavior.
- Avoid near-duplicates of existing modules unless the new module has a materially different workflow or sound.
- Research varied source types: manuals, product specs, announcements, reviews, demos, old magazines, zines, forum archives, papers, patents, app notes, and open-source DSP.
- Capture observed behavior from demos and reviews separately from confirmed electrical specifications.
- Keep implementation scope small enough for one module branch or worktree.

## Status Values

- `candidate` - Proposed only. Do not implement.
- `researching` - Sources are being collected in `research/modules/{moduleId}.md`.
- `spec-ready` - Research defines panel contract, voltage behavior, DSP plan, and test targets.
- `implementing` - Code and tests are in progress in a module-specific branch or worktree.
- `blocked` - Waiting on a missing source, architectural decision, or unresolved contradiction.
- `done` - Merged with tests, docs, manifest registration, and optional factory patch complete.

## Candidates

| Proposed ID | Status | Research Doc | Working Name | Category | What It Adds | Research Targets | Risk |
|-------------|--------|--------------|--------------|----------|--------------|------------------|------|
| `complex-vco` | done | research/modules/complex-vco.md | Complex Oscillator | source | Through-zero FM, phase modulation, harmonic-group outputs, balanced AM, and two sync behaviors beyond the current VCO. | Joranalogue Generate 3 manuals, FM/PM references, harmonic synthesis, demo patch walkthroughs. | High |
| `gate-delay` | done | research/modules/gate-delay.md | Dual Gate Delay | clock | Delays and lengthens short triggers into useful gates without changing clock, sequencer, or envelope modules. | Doepfer A-162 manual and patch examples, monostable timing, articulation demos. | Low |
| `wavetable` | done | research/modules/wavetable.md | Wavetable Oscillator | source | Morphing digital oscillator with table position CV, interpolation choices, and anti-aliasing trade-offs. | PPG/Waldorf history, digital oscillator articles, Serum/Vital-style wavetable notes, MusicDSP wavetable examples, product demos. | Medium |
| `pluck` | done | research/modules/pluck.md | Plucked String Voice | voice | Karplus-Strong and resonator-based pitched percussion, giving the rack a physical-model voice. | Karplus-Strong papers, CCRMA physical modeling notes, Rings-style resonator behavior, acoustic guitar/sitar demo references. | Medium |
| `resbank` | done | research/modules/resbank.md | Resonator Bank | filter | Modal, sympathetic-string, and dispersive-string resonators for bells, bodies, and struck or externally excited sounds. | Mutable Instruments Rings manual/source, modal synthesis, digital waveguides, demos. | High |
| `ensemble-vco` | done | research/modules/ensemble-vco.md | Ensemble Oscillator | source | Sixteen scale-related oscillators with phase shaping, wavefolding, cross-FM, stereo distribution, freeze, and learned scales. | 4ms Ensemble Oscillator manual/source, additive and phase-distortion synthesis, demos. | High |
| `matrix` | done | research/modules/matrix.md | Matrix Mixer | utility | Patch-programmable routing and feedback matrix for CV/audio, enabling complex sends without adding many mixers. | Matrix mixer manuals, Doepfer/AI Synthesis specs, no-input mixing articles, feedback patch demos. | Low |
| `seq-switch` | done | research/modules/seq-switch.md | Sequential Switch | sequencer | Clocked routing of one input to many outputs or many inputs to one output, adding performance-oriented signal switching. | Doepfer A-151, Buchla/Serge switching concepts, manual and trigger behavior, patch demos. | Low |
| `burst` | done | research/modules/burst.md | Burst Generator | clock | Controlled trigger bursts, ratchets, probability, and clock multiplication for percussion and sequencer accents. | Befaco Burst, Make Noise Tempi/clocking demos, probability gate modules, rhythm programming articles. | Medium |
| `chaos` | candidate | needed | Chaotic CV Generator | modulation | Non-repeating modulation from Lorenz/logistic-style systems, distinct from random and LFO modules. | Nonlinear dynamics papers, Sloths/chaos module manuals, chaos synth zines/articles, oscilloscope demos. | Medium |
| `vocoder` | candidate | needed | Filter-Bank Vocoder | effect | Analysis/synthesis envelope transfer for speech-like filtering and carrier/modulator patches. | Classic vocoder articles, EMS/Sennheiser history, DAFX filter-bank vocoder material, hardware and plugin demos. | High |
| `tape` | done | research/modules/tape.md | Tape Delay | effect | Delay with saturation, wow/flutter, age, splice/dropout behavior, and feedback tone shaping. | Space Echo/Echoplex service notes, tape delay reviews, DAFX delay modulation papers, contemporary module demos. | Medium |
| `lpg` | done | research/modules/lpg.md | Low Pass Gate | filter | Combined VCA/filter with plucky vactrol-style response, giving envelopes a different shape than VCA plus VCF patches. | Buchla low pass gate history, Make Noise Optomix, Doepfer A-101-2, vactrol response notes, percussive demo patches. | Medium |
| `quad-lfo` | done | research/modules/quad-lfo.md | Quadrature LFO | modulation | Phase-related modulation outputs for panning, filter movement, and cyclic modulation that the current LFO/Ochd pair does not target directly. | Doepfer A-143-9, Batumi quadrature modes, sine/cosine oscillator math, stereo motion demos. | Low |
| `cv-rec` | candidate | needed | CV Recorder | modulation | Records and loops control gestures as voltages, enabling automation lanes and reusable performed modulation. | Planar/Frames-style modulation recording, voltage memory modules, looper UX reviews, interpolation strategies. | Medium |
| `joystick` | done | research/modules/joystick.md | Joystick Controller | utility | Manual X/Y performance CV with optional gate and recordable gestures for hands-on patch control. | Planar, Choices, Buchla 227/222e controller history, performance demos, touch/joystick controller reviews. | Low |
| `prob-seq` | candidate | needed | Probability Sequencer | sequencer | Step sequencing with per-step probability, ratchets, skips, and conditional gates rather than fixed deterministic playback. | Elektron conditional trigs, Metropolis/Metropolix, Varigate, probability rhythm papers, performance demos. | Medium |
| `swing` | done | research/modules/swing.md | Swing Clock Processor | clock | Clock delay, shuffle, groove templates, and humanization for rhythmic patches without changing the source sequencer. | DIN sync/MIDI clock swing history, groove quantization papers, clock utility manuals, drum machine reviews. | Low |
| `pitch-track` | candidate | needed | Pitch Tracker | utility | Converts monophonic audio pitch to 1V/oct CV and gate, enabling audio-controlled synth patches. | Autocorrelation/YIN pitch detection papers, guitar synth history, envelope/pitch follower modules, latency discussions. | High |
| `formant` | done | research/modules/formant.md | Formant Filter | filter | Vocal vowel filtering with morphable formants, distinct from the current state-variable VCF. | Vowel synthesis tables, fixed formant filter banks, talkbox/vocoder history, DAFX formant filter references. | Medium |
| `shimmer` | candidate | needed | Shimmer Reverb | effect | Pitch-shifted feedback reverb for octave clouds and ambient harmonic tails, beyond the current basic reverb. | Eventide pitch/reverb history, shimmer reverb algorithms, allpass/FDN references, pedal and module demos. | High |
| `comp` | done | research/modules/comp.md | Compressor/Limiter | utility | Dynamics control, sidechain pumping, and output protection for complex patches and drum buses. | VCA compressor design, MusicDSP compressor examples, Eurorack dynamics module manuals, mix-engineering references. | Medium |

## Processing the Queue

Move one row at a time through these gates. Parallel work is allowed, but each module needs its own branch or worktree and should avoid shared infrastructure changes unless the change has been planned separately.

1. Intake: confirm the candidate adds a distinct capability and does not duplicate an existing module.
2. Research: create `research/modules/{moduleId}.md`, collect varied sources, and update the row to `researching`.
3. Spec readiness: document panel controls, ports, voltage behavior, DSP approach, assumptions, contradictions, and test targets; then update the row to `spec-ready`.
4. Implementation: create a module branch or worktree, write `tests/dsp/{moduleId}.test.js` first, implement a worklet-safe `src/js/modules/{moduleId}/index.js` with stable buffers, register both the lazy manifest entry and static `core-definitions.js` import, and update docs.
5. Validation: run focused tests, module contract tests, and patch tests when patches changed.
6. Merge: run the full suite, update the queue row to `done`, and include the research doc in the same module change.

For a copy-paste prompt that tells Codex to perform the whole flow, use `docs/codex-process-module-command.md`.

Recommended branch names:

- `research/{moduleId}` for source gathering and module spec work.
- `module/{moduleId}` for implementation.

Recommended worktree path:

```bash
git worktree add ../eurorack-js-{moduleId} -b module/{moduleId}
```

## Intake Gate

A candidate may move from `candidate` to `researching` only when:

- It has a proposed module ID that is lowercase and unique.
- It has a clear reason to exist beyond existing modules.
- It has at least three likely source lanes, including one primary source lane and one review/demo lane.
- Its risk level is understood well enough to choose research depth.

## Spec-Ready Gate

A candidate may move from `researching` to `spec-ready` only when the research doc includes:

- Source list with citations and notes on what each source supports.
- Panel contract: knobs, switches, buttons, inputs, outputs, LEDs, and normalization behavior.
- Voltage contract: audio, CV, gate, trigger, clock, pitch, and reset behavior where relevant.
- DSP plan: chosen algorithm, trade-offs, source references, and expected deviations from hardware.
- Test plan: initialization, ranges, each control, each input, trigger behavior, reset, LEDs, and buffer integrity.
- Open questions and assumptions.

## Implementation Plan Template

Before writing module code, add a short plan to the research doc:

```markdown
## Implementation Plan
- Module ID:
- Category:
- Branch/worktree:
- DSP model:
- Params:
- Inputs:
- Outputs:
- LEDs:
- Factory patch:
- Focused tests:
- Full validation command:
- Known assumptions:
```

## Validation Gate

Minimum focused validation for a new module:

```bash
npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
```

If adding or changing a factory patch, also run:

```bash
npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js
```

Before merge, run:

```bash
npm test
```

## Next Research Pass

For each selected candidate:

1. Create `research/modules/{moduleId}.md` from the research template.
2. Collect at least one primary source, one independent review or demo, and one DSP implementation reference.
3. List exact panel controls and ports before writing tests.
4. Define the app-specific voltage behavior and any assumptions.
5. Write focused DSP tests before creating `src/js/modules/{moduleId}/index.js`.
