# HOCKET browser-local demo

Status: browser-local prototype implemented with focused DSP validation passing; native browser/WebMCP validation is pending. Not a module-queue candidate or a built-in module.

## Purpose

Create one small module through **Code → Modules**, then use WebMCP to compose and validate a patch containing its registered local revision. HOCKET splits an incoming clock between two instruments using repeatable patterns. Its behavior should be easy to see, hear, and test while exercising authoring, local persistence, worklet registration, and patch tooling.

Read alongside [Architecture](../../docs/architecture.md), [Creating Modules](../../docs/creating-modules.md), and [Sound engineering review](../sound-engineering-review.md). Local source is trusted JavaScript. This prototype must remain browser-local and must not bypass the built-in-only account/public-patch boundary.

## Research

### Primary sources

All web sources accessed 2026-11-15.

1. **Branches manual**, Mutable Instruments / Émilie Gillet, official documentation archive, undated; hardware produced 2015–2021. [Manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/branches/manual/). Incoming events choose output A or B. Toggle mode chooses whether to keep or change the previous destination; at its extreme it alternates destinations. This supports the exclusive routing concept, not HOCKET's specific patterns or implementation.
2. **Branches product and technical information**, Mutable Instruments / Émilie Gillet, official archive. [Product/specifications](https://pichenettes.github.io/mutable-instruments-documentation/modules/branches/). The original hardware specifies +5V output levels and a 0.6V gate threshold. HOCKET deliberately uses the app's clock and trigger conventions instead.
3. **DivSkip web manual**, Making Sound Machines and DivKid, contemporary manufacturer documentation. [Manual](https://makingsoundmachines.com/divskip/manual/). Its channels process a rising-edge trigger input into A/B outputs; the manual specifies 0–10V outputs and 5ms pulses in trigger mode. It includes complementary rhythmic processing and paired instrument patterns. Its patch suggestions include alternating between related sounds with different decays. This supports a compact rhythm-routing utility and the two-voice demonstration. HOCKET does not reproduce DivSkip's modes, pattern library, timing, or panel.

### Demonstration references and limits

- **Mutable Instruments Branches**, DivKid, independent demonstration. [Video page](https://divkidvideo.com/videos/mutable-instruments-branches/). Identified as a practical demonstration of Bernoulli routing; the page description was reviewed. The video/audio was not auditioned, so this document makes no listening-based claims about it.
- The DivSkip manufacturer's illustrated patch examples above establish usable routing and performance ideas. They do not establish the sound quality of this prototype, which requires its own browser/audio validation.

### Decision and assumptions

This is an original **utility adaptation**, not a hardware emulation. Use deterministic patterns rather than randomness so that both the musical result and WebMCP checks are repeatable. Keep pitch generation in the existing sequencer and sound generation in existing voices. No oscillator, probability engine, audio input, CV pitch output, gate-latch mode, or automatic timeout reset is needed.

There is no source contradiction to resolve: Branches and DivSkip have different electrical and functional contracts. Neither defines this prototype's thresholds, reset precedence, pattern choices, or pulse length. The choices below are explicit application decisions.

## Panel contract

| Item | ID / port | Behavior |
| --- | --- | --- |
| Module | `hocket-demo` | Display name `HOCKET`; 6HP; category `clock`; shared color token `module-color-six` |
| Pattern knob | `pattern` | Integer 0–3, default 0; selects the sequence below |
| Rotate knob | `rotate` | Integer 0–7, default 0; offsets the selected pattern by that many steps |
| Swap switch | `swap` | 0/1, default 0; exchanges A and B |
| Clock input | `clock` | Trigger signal; rising above 2.5V advances once |
| Reset input | `reset` | Trigger signal; rising to at least 1V resets the sequence |
| A output | `a` | 0/10V trigger |
| B output | `b` | 0/10V trigger, mutually exclusive with A |
| Activity LEDs | `a`, `b` | 50ms activity hold after the corresponding event; bounded values 0–1; independent of electrical trigger length |

Both inputs declare `voltage: { min: 0, max: 10, normal: 0 }`. No input normalization between jacks. Missing clock means no events; missing reset means free progression. No hidden button combinations or alternate modes.

| Pattern value | Eight successive destinations |
| --- | --- |
| 0 | `ABABABAB` |
| 1 | `AABBAABB` |
| 2 | `AABAABAB` |
| 3 | `AAABABBB` |

## Timing and voltage contract

- The next step begins at zero. Each clock edge reads `pattern[(step + rotate) % 8]`, applies Swap, emits the chosen trigger, and advances the step modulo eight.
- Output high is exactly 10V; low is 0V. Pulse duration is `ceil(sampleRate * 0.008)` samples, beginning on the clock-edge sample.
- A new edge cancels any previous pulse before starting the selected pulse, so A and B never overlap. At input periods shorter than 8ms, pulses can be truncated or a repeated destination can stay high; this is explicitly not an audio-rate event multiplier. Normal demo clock rates are far below this limit.
- A reset rising edge clears both pulses and sets the next step to zero. If reset and clock rise on the same sample, reset is processed first and the clock emits the first rotated/swapped step. A held reset does not repeatedly reset the counter.
- Pattern, Rotate, and Swap are sampled on clock edges. Changing controls between clocks must not produce extra triggers or alter a pulse already in progress.
- Clock equality at 2.5V is low. Reset equality at 1V is high. Negative voltages are low. Non-finite input values should be treated as low, and non-finite control values should fall back to defaults.
- `reset()` clears counters, edge history, input/output samples, and LEDs. All typed-array identities remain stable. It does not replace parameter values with defaults.

## DSP model

Use a small pattern table, one step counter, one pulse countdown, an active destination, and previous clock/reset samples. Allocate buffers and pattern storage once in `createDSP()`. The inner loop uses comparisons, integer indexing, and assignments, with no allocations and no browser APIs. Both outputs are written on every sample, including inactive/tail samples.

Exact trigger steps are appropriate here; smoothing would make edge thresholds ambiguous. The module adds negligible work compared with a voice or effect. It performs no audio processing and therefore introduces no oscillator aliasing or audio filtering trade-off. Use declarative controls rather than a custom renderer. Each LED has a separate `ceil(sampleRate * 0.05)`-sample hold, reported at the end of a process block. Both LEDs may briefly appear lit when successive events occur within 50ms, while electrical A/B pulses remain exclusive. A reset edge clears both LED holds.

## Demo patch: two interlocking voices

Working title: **Hocket Study**. Plain description: “Two plucked voices trade notes over a repeating seven-note sequence.”

One clock advances HOCKET and a seven-step melodic sequencer. The pitch CV feeds both channels of S&H; A samples channel 1 and triggers the lower PLUCK voice, while B samples channel 2 and triggers the upper voice. Separate held pitches matter because PLUCK continuously tracks pitch CV for its latest active note: connecting both voices directly to the sequencer would retune the inactive voice's ringing note. Give the voices distinct decay, brightness, and octave settings so the routing is obvious. Mix them toward opposite sides, then use a modest stereo reverb and OUT. Start on pattern 2 with Rotate 0 and Swap off.

Suggested phrase intervals are `[0, 3, 7, 10, 12, 7, 5]` semitones over a common base note. The seven-note pitch loop and eight-step routing pattern repeat together every 56 clock events. Use approximately 3–4 events/second, leaving enough space to hear both voices. Longer decays may overlap even though trigger events are exclusive; this is hocket-inspired articulation, not a guarantee of non-overlapping audio.

Read actual `pluck`, `seq`, `clk`, mixer, reverb, and output definitions before choosing their parameter values and port names. Do not reuse an unverified port table. Optional slow modulation may move one voice's timbre after the basic routing works. Avoid unrelated drums or layers during initial validation because they hide routing failures.

## Test targets — before implementation

1. Initialization: declared defaults, exact buffer sizes, all zeros, stable array identities.
2. Exhaustively verify all 4 patterns × 8 rotations × 2 Swap settings across at least two cycles; every accepted edge chooses exactly one destination.
3. Clock threshold: 2.5V does not trigger; 2.5001V does. Held high triggers only once. Test negative, non-finite, and disconnected inputs.
4. Reset threshold: below 1V does not reset; 1V does. Verify held reset, later reset edges, and simultaneous reset/clock priority.
5. Pulses: exact sample counts at 44.1, 48, and 96kHz; block sizes 128 and 512; edges and tails across block boundaries; outputs only 0 or 10V and never simultaneously high.
6. Parameter minimum/maximum and invalid finite/fractional inputs: deterministic integer clamping; changing controls without an edge does not create events.
7. Faster-than-pulse clocks follow the documented retrigger/truncation policy without NaN, overlap, or runaway counters.
8. Reset clears all internal histories, samples, and LEDs while preserving identities and parameter settings.
9. Browser: register/use the local definition, discover its immutable runtime type, validate/apply a patch through WebMCP, inspect debugger results, and start the actual AudioWorklet. Confirm audible output and sustained runtime stability; distinguish meter measurements from listening.
10. Persistence: refresh/reopen a browser-saved patch and verify its exact immutable module revision resolves locally. Confirm account/public-save rejection remains intact; do not upload module source as patch content.

## Implementation Plan

- **Module ID:** authored `hocket-demo`; browser runtime owns an immutable `local-<lowercase ULID>` revision/type.
- **Category:** `clock`.
- **Branch/worktree:** existing task workspace for this research document; local prototype source and tests are task artifacts, not edits to core module registration. No queue entry or built-in module branch is required for this browser-local exercise. Notes live under `research/local-modules/` because `research/modules/` is audited against the registered built-in catalogue.
- **DSP model:** deterministic single-clock, complementary pattern router described above.
- **Params:** `pattern`, `rotate`, `swap`.
- **Inputs:** `clock`, `reset`.
- **Outputs:** `a`, `b`.
- **LEDs:** `a`, `b`.
- **Factory patch:** none. Build an owned browser-local demo through WebMCP after local module registration; keep a source and patch backup in task artifacts.
- **Focused tests:** [hocket-local-demo.test.js](../../tests/dsp/hocket-local-demo.test.js), written before the DSP implementation, validates the standalone [hocket.mjs](../../compositions/hocket-study/hocket.mjs) using the existing module-contract validator without adding it to the core manifest.
- **Full validation:** run the local harness over the sample-rate/block-size matrix; then verify the real browser authoring, worklet, WebMCP, and persistence flow. `audit:dsp --module hocket-demo` cannot discover an unregistered core module and must not be reported as validating this local revision. Run repository checks if any framework bug fixes become necessary.
- **Known assumptions:** deterministic original patterns; 8ms trigger width; app-standard thresholds; explicit reset precedence; fast-clock limitation; browser-local persistence only.

## Validation record

2026-11-15: wrote the focused tests before the prototype and confirmed the expected missing-source failure. Implemented the self-contained definition and ran `npm test -- tests/dsp/hocket-local-demo.test.js`: **87 tests passed**. Coverage includes all 64 pattern/rotation/Swap settings across two cycles, contract and pulse checks at 44.1/48/96kHz with 128/512-sample blocks, threshold and reset precedence, control clamping, 50ms LED holds, fast clocks, and stable finite buffers. No core registration files or factory patch catalogues were changed.

Browser validation completed in Chrome 157.0.8103.78 with experimental WebMCP enabled:

- Imported the self-contained source through **Code → Modules**, saved it, and explicitly selected **Use module**. Module authoring is not exposed by the current WebMCP tool set, so this step used browser UI automation.
- Used the real CDP `WebMCP.invokeTool` interface for `describe_modules`, `get_rack`, `validate_script`, `apply_draft`, and `debug_rack`. There was no tool-registration stub. The 13-module, 24-cable draft validated and applied with no diagnostics.
- Started the actual AudioWorklet through the Start button. Sampled stereo output for 20.02 seconds using analyser windows: left peak 0.08335, right peak 0.09189; RMS 0.00632 and 0.00657. No non-finite or full-scale samples were observed. These are overlapping sampled windows, not continuous true-peak analysis or a listening assessment.
- An independent compiled-graph check at 48kHz/128 confirmed same-sample pitch capture for 57 trigger events, the intended phrase intervals, and the combined 56-event repeat.
- Saved **Hocket Study** to **This browser**, reloaded, opened it from **My patches**, and verified that the same immutable local module revision resolved and ran in the worklet again. The reopened rack again reported no debugger issues. Left the saved patch open and stopped.
- No account/public save or deployment was performed. The existing account-save rejection remains unchanged; this exercise did not test an authenticated rejection attempt.

Reproducible client and source: [compositions/hocket-study](../../compositions/hocket-study/). The runner writes raw validation evidence and browser-specific IDs into ignored local files. The source and patch are local prototype artifacts, not additions to the built-in module catalogue.
