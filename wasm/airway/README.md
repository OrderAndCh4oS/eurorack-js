# Airway physical voice kernel

This crate adapts the actual CHIMERA `HumanVoice` model at commit
`24bd2e4ee4accf7b27d57d8bf912472880dff9f7` from
https://github.com/jamesondh/chimera-vocal-synth. It contains no recorded audio.
The model runs a glottal source, pressure/flow network, moving vocal tract,
turbulence, DC blocker, limiter and output decimator. See
[Vocal research](../../research/modules/vocal.md) and
[Beatbox research](../../research/modules/beatbox.md) for their panel, electrical
and timing contracts. Historical adapter notes are retained in
[Airway prototype research](../../research/topics/airway-prototype.md).

The kernel is shared by separate VOCAL and BEATBOX modules, each owning its own
physical state. Vocal uses continuous vowel/consonant targets and external Gate;
it never restores percussion snapshots. Beatbox uses Trig/Hit recipes with Gate
always false. See research/modules/vocal.md and research/modules/beatbox.md.

## Source and build

`vendor/chimera` preserves the pinned crate's complete source for auditability;
unused speech, creature and analysis functions are removed by release LTO. The
wrapper never constructs the upstream general `Engine`, text planner or song
scheduler. `source-lock.json` records both original and vendored checksums for
every file. The only changes to the upstream crate are:

- `GestureScore::CAPACITY` is 64 instead of 16384. Each single beat recipe has
  at most 16 gestures. A hit restores its score and never accumulates events.
- The crate manifest omits its test-only `flate2` dependency. Upstream tests are
  not redistributed in the vendor directory.
- `HumanVoice::set_source_live` preserves held score abduction when baseline
  controls update between native control ticks, retains unchanged vibrato and
  uses the native gated-pressure effort law. The original `set_source` and
  native control ordering remain unchanged. This avoids a phase-dependent
  overwrite when the rack's 64-frame grid differs from the prepared score grid.

- `HumanVoice::set_voicing_live` adds continuous voiced/unvoiced interpolation
  on a score-free Vocal instance after source updates. It scales glottal vibration
  and opens the glottis smoothly, without resetting pressure/phase or filters.

The wrapper caches M/N/B/D/G/F/S/SH targets at creation. `setVocal` blends their
calibrated targets into a full neutral-plus-vowel posture; resetting unused target
coordinates prevents stale nasal/labiodental/tongue geometry. An external CV
envelope supplies closure/release timing. This is not the general speech planner.

The wrapper uses upstream public APIs plus the documented live-update methods.
It warms the four lazy area-history
buffers with one positive-dt geometry update before freezing the layout. This
does not advance voice time or render hidden audio. Calibrated vowel/consonant
tables initialize before any snapshot. Voice controls fix roughness, drift and
vibrato depth to zero and glide to 5 ms.

Build prerequisites: Rust/Cargo with `wasm32-unknown-unknown`; the checked-in
artifact was compiled with Rust 1.99.1. Dependencies are pinned in `Cargo.lock`.
From the repository root:

```sh
npm run build:airway
cargo test --locked --manifest-path wasm/airway/Cargo.toml -p eurorack-airway
npm test -- tests/dsp/airway-kernel.test.js
```

The build writes a content-addressed scalar `.wasm`, base64 JavaScript module,
loader manifest, source/artifact checksums and dependency license notices to
`src/wasm/airway`. The CHIMERA MIT notice is retained in `vendor/chimera/LICENSE`
and in the shipped `LICENSES.txt`; the latter also includes all locked Cargo
dependencies, including build-only dependencies. The normal app build calls
`validateAirwayAssets()` and needs no Rust installation or network. It rejects
modified sources, stale/missing output, invalid provenance and checksum drift.

## Memory and real-time boundaries

The WASM binary has no host imports. It declares exactly one unshared memory
with initial and maximum size both **1 MiB**. The binary inspector rejects
additional mutable globals: the sole one is the exported `__stack_pointer`.
The tests check it returns to the same value at ABI boundaries. The indirect
function table is initialized by the module and is not modified by this ABI.

`prepareAirway(rate)` compiles once per JavaScript realm and creates a clean
Voice state plus ten prepared beat states. Beats start from the same canonical
male body/layout and render `round((lead_in - 0.003) * rate)` samples during
preparation. Each snapshot contains **complete linear memory**, including
pressure, articulator motion, RNG, score, output filters and allocator state.
There are eleven 1 MiB snapshots per rate (**11 MiB**). The cache retains at
most three rates; a live kernel retains its bank even if that rate is evicted.
Temporary preparation memory is released after setup.

The worklet must call the module's `prepareDSP({sampleRate})` hook during core
registration before creating the live AudioWorkletNode. UI mirrors and Node
tests may prepare a rate lazily. Creating a kernel instantiates its own isolated
memory and copies the already prepared baseline. Every trigger/reset copies
one fixed typed array into that existing memory at a quiescent ABI boundary.
No WASM call remains on the stack while memory is restored. No synthesis
warmup, table parsing, Rust clone, allocator operation or new JS view runs on
a hit. Hum replaces remaining scheduled F0 targets using reserved scratch
whenever live pitch changes. Its native score pitch glide is 30 ms; ordinary
baseline pitch glide remains 5 ms.

Each prepared state also contains an exact rendered-frame counter and a score
end frame derived from the maximum `Gesture.end()` (including ramp-out and
release holds). The wrapper returns the remaining output-frame duration on a
hit. It deliberately does not subtract `HumanVoice.clock`, which advances at
the start of each 64-frame control interval and can run ahead of rendering.
Rendering splits at the actual expiry, retires finished gestures and enables
ordinary free tongue-tip targets without snapping or resetting the physical
voice. Gate, pressure, source, RNG and filter states continue naturally. Until
expiry the recipe retains tongue-tip control even while baseline vowel targets
are updated. The adapter uses this duration for its temporary accent envelope.

The JS API is `prepareAirway(rate)` and `createAirwayKernel(rate)`, returning:

- `setVoice(f0, vowel, pressure, breath, tension, fry, gate)`
- `setVocal(f0, vowel, pressure, breath, tension, fry, gate, consonant, amount)`
  applies live targets only; never call it on a running beat score.
- `trigger(soundIndex, f0)` returns remaining gesture samples, and `reset()`
- `render(count)`, which returns the same 2048-sample Float32Array; consume only
  the first `count` samples (`0 <= count <= 2048`)
- `dispose()`, `remainingGestureSamples` and read-only allocation/memory/stack
  diagnostics for tests

The adapter must call `setVoice` immediately after `trigger` to reapply all
current baseline controls and Gate, then update targets on its absolute
64-sample grid and on gate edges. This is essential because a snapshot retains
the canonical preparation controls until the current values are reapplied.

Output is the normalized upstream signal. The module adapter owns the 1 ms
restore bridge, sample-exact edges, 64-sample control grid, Level/Accent gain,
and bounded +/-5 V output. Snapshots and diagnostics are internal runtime data,
never serialized patches. `dispose()` frees the voice and releases references;
`reset()` restores the baseline without reallocating it.

## Validation

The kernel tests check source and artifact checksums, a fixed memory maximum,
the complete mutable-global inventory, allocator counters, boundary stack
values, independent instances, stable pointers, subdivision-independent output,
repeated alternating restores, 240 BPM sixteenths, sample-adjacent triggers,
extreme controls, silent reset and finite output. All ten sounds are rendered
for 0.6 seconds at 44.1, 48 and 96 kHz; first energy above 10% of each rendered
peak must occur within 11 ms before the adapter's 1 ms bridge. The narrow ABI
also has a native Rust test checking recipe bounds and finite model output.
Additional tests cover exact full-score expiry, held-gate recovery for all ten
sounds, gate changes during a score, allocation-free continuous Hum retargets,
recipe tongue-tip ownership and identical output across an expiry boundary
regardless of rendering subdivision.
Repeated unchanged controls must produce exactly the same waveform as one
initial update for all ten sounds. Moving baseline controls must remain live
without losing the held score contribution or allocating; extra unchanged
updates between those changes must also preserve the exact waveform.

Browser deadline profiling, representative rack tests and listening are
separate integration gates, not claims established by these kernel tests.

## Percussion extension

BEATBOX and BEATBOX PRO use `airway_configure_beat` to retime post-onset
endings/releases and retain canonical targets in a reserved 16-gesture vector.
`airway_set_beat` applies non-accumulating physical mouth/noise/voicing controls.
Both retain one fixed memory and the existing preparation phase. Tune consumes
fresh model output through the JS bandlimited streaming reader; no PCM sound
library is stored. See the two module research specs for ranges and tests.

## Vocal alphabet bank

`airway_set_phoneme` controls A–Z, SH/CH/TH/DH/NG/ZH continuously. All targets
and compound release definitions are prepared at construction. The 0..1
articulation amount traces vowel/release/closure for CH/J/Q/X, without a timer,
score or physical-state reset. The original eight-consonant ABI remains for
regression coverage. See research/modules/vocal.md for the exact mapping.

`airway_set_vocal_controls` adds live brightness, roughness, voicing, nasality,
twang, glide and articulator speed. Targets remain canonical and score-free.

## Female vocal tract

`airway_create_female` constructs the upstream female body and its calibrated
vowel/consonant tables. Pitch remains an independent live source parameter.
The JS adapter prepares a female baseline only (no percussion snapshots), with
the same fixed 1 MiB memory limit and allocation-free control/render ABI. VOCAL
owns both prepared models and crossfades for 80 ms when the tract selector
changes. Only the selected model renders in steady state. The existing male
constructor and percussion bank keep their prior behavior. Native and JS tests
check anatomy, calibration, equal-pitch spectral differences, all phonemes,
fixed buffers/allocation counts and reset behavior across supported rates.
