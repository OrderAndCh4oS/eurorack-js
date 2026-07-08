# Sequential Switch (seq-switch)

## Hardware Reference
- **Based on**: Doepfer A-151 Quad Sequential Switch, adapted for this app's directional patch cable model.
- **Manual**: https://www.doepfer.de/a100_man/A151_man.pdf
- **Manufacturer page**: https://doepfer.de/a151.htm
- **Historical/context sources**: Doepfer A-100 overview and general A-100 history.
- **Reviews/demos**: Doepfer-hosted customer demo `A155_A151_demo.mp3` by Robert Sigmuntowski, showing A-155 CV row switching with A-151.

## Specifications
- Knobs:
  - `steps`: stepped 2/3/4 stage limit. Default 4.
- Inputs:
  - `clock`: trigger/clock input. Rising edge advances to the next stage.
  - `reset`: trigger input. Rising edge resets immediately to stage 1.
  - `commonIn`: signal to route to the active one-of-four output.
  - `in1`, `in2`, `in3`, `in4`: four signals routed one-at-a-time to `commonOut`.
- Outputs:
  - `commonOut`: selected one-of-four input.
  - `out1`, `out2`, `out3`, `out4`: active output receives `commonIn`; inactive outputs are 0V.
- LEDs:
  - `stage1`, `stage2`, `stage3`, `stage4`: active stage indication. Disabled stages stay dark when the step limit is 2 or 3.
- Special modes/features:
  - The hardware is bidirectional through shared I/O jacks. This app uses directional cable metadata, so `seq-switch` exposes both directions simultaneously: 4-to-1 and 1-to-4.
  - Reset has priority over clock when both rising edges occur at the same sample.
- Contradictions or unknowns:
  - Doepfer manual revision text describes original A-151 voltage range as -8V to +8V, while the product page and later manual notes describe the version 2 unit as full A-100 range -12V to +12V. This implementation follows the version 2 behavior conceptually but clamps only to this app's normal audio/CV range.
  - Hardware switch on-resistance can cause small pitch CV drops; the app implementation is an ideal digital router and does not emulate that voltage drop.
  - Manufacturer trigger threshold is not specified. The app uses the rack trigger/clock standard: rising edge above 2.5V.

## Voltage Contract
- Audio/buffer signals: inputs and outputs support this app's standard audio range of +/-5V. Output samples are clamped to +/-5V to prevent accidental out-of-range routing from cascading.
- CV signals: DC-coupled buffer routing is supported. Pitch CV is routed sample-for-sample but without analog resistance drop.
- Clock/trigger: `clock` and `reset` treat values >2.5V as high and respond to rising edges.
- Gates: gate-like signals may be routed through buffer ports as 0/10V logic, but outputs are clamped to +/-5V because the module's general-purpose buffer ports share the app audio/CV voltage guard.
- Reset: reset rising edge sets the active stage to 1 immediately, including mid-buffer.

## DSP Implementation

### Algorithm Overview
- Maintain `stage` as a zero-based active stage.
- Quantize `steps` to 2, 3, or 4 every sample and wrap the active stage if the limit is lowered.
- Detect rising edges on `clock` and `reset` using the rack trigger threshold.
- On clock rising edge, increment `stage = (stage + 1) % steps`.
- On reset rising edge, set `stage = 0`; reset wins over clock if both happen at once.
- Route the selected `inN` to `commonOut` and `commonIn` to the selected `outN`; inactive outputs emit 0V.
- Use a short 1 ms equal-power-ish linear crossfade after stage changes. This is an app-specific de-clicking choice, not hardware-authentic modeling.

### Observed Behavior From Reviews/Demos
- Doepfer's own examples emphasize waveform switching, CV row switching, and audio-rate switching. Fast switching can become a new waveform or audio-frequency modulation rather than a slow sequential selector.
- The manufacturer-hosted A-155 + A-151 audio example demonstrates the performance use case: switching sequencer rows while the patch runs, producing longer or changing CV patterns without repatching.
- The A-151's core interaction is intentionally simple: trigger advances, reset returns to stage 1, LEDs show the selected channel.

### Key References
- Doepfer A-151 official page and manual define the panel contract, bidirectional behavior, voltage range, 2/3/4 step limit, and trigger/reset behavior.
- Doepfer A-100 overview provides historical context for the A-100 modular system and its open-ended patching model.
- Internal DSP references: existing `div` clock edge detection, `vca` smoothing/reset patterns, and `matrix` DC-coupled buffer routing.

### Code Notes
- This is an app-adapted utility/sequencer module, not a component-level analog switch emulation.
- The 1 ms crossfade is intentionally short enough for clocked routing while reducing discontinuity clicks for audio-rate source changes.
- Outputs clamp to +/-5V after crossfade. This matches the app's audio standard more than Doepfer's larger A-100 hardware range.

## Panel Contract
- Width: 6 HP in this app. The hardware A-151 is 4 HP, but this implementation exposes both directional routing paths at once and needs more panel room for the extra jacks.
- Color token: `module-color-five`.
- Category: `sequencer`.
- Control layout:
  - Four LEDs for active stage.
  - One stepped `Steps` knob from 2 to 4.
  - `Clk` and `Rst` trigger inputs.
  - `Com In`, `In1`-`In4` buffer inputs.
  - `Com Out`, `Out1`-`Out4` buffer outputs.
- Normalization:
  - Unpatched signal inputs read 0V.
  - No hidden clock/reset normalization.

## Test Targets
- Initialization creates default params, buffers, outputs, and four LED values.
- `steps` defaults to 4 and quantizes/clamps to 2/3/4.
- Clock rising edges advance stage and only one LED is active.
- Reset rising edge returns to stage 1 and wins over clock.
- 4-to-1 routing copies only the selected input to `commonOut`.
- 1-to-4 routing copies `commonIn` only to the selected output and clears inactive outputs.
- Step limit wraps correctly for 2-step and 3-step sequences.
- Output samples remain finite and within +/-5V.
- Reset clears stage, output buffers, edge state, and LEDs.
- Audio switching crossfade produces finite intermediate values without NaN.

## Implementation Plan
- Module ID: `seq-switch`
- Category: `sequencer`
- Branch/worktree: current `main` worktree, per user instruction to "just work here"
- DSP model: app-adapted Doepfer A-151-style sequential switch with ideal DC-coupled routing and short de-click crossfade
- Params: `steps`
- Inputs: `clock`, `reset`, `commonIn`, `in1`, `in2`, `in3`, `in4`
- Outputs: `commonOut`, `out1`, `out2`, `out3`, `out4`
- LEDs: `stage1`, `stage2`, `stage3`, `stage4`
- Factory patch: `src/js/config/patches/test-seq-switch.js`
- Focused tests: `tests/dsp/seq-switch.test.js`
- Full validation command: `npm test`
- Known assumptions: 2.5V trigger threshold, ideal routing with no switch resistance/drop, +/-5V output clamping, reset priority over clock

## Potential Improvements
- Add an optional no-slew mode for fully discontinuous hardware-style switching.
- Add a manual advance button if the renderer supports momentary buttons consistently.
- Add a reverse/random direction option only if future research justifies diverging from the low-risk A-151 contract.

## Sources
- [Doepfer A-151 Quad Sequential Switch product page](https://doepfer.de/a151.htm) - Doepfer Musikelektronik, current product page, accessed 2026-07-08, supports: bidirectional 4-position switching, trigger/reset behavior, 2/3/4 step switch, +/-12V revised voltage range, 4 HP, current draw, technical note about protection resistor and pitch CV drops.
- [Doepfer A-151 Quad Sequential Switch manual PDF](https://www.doepfer.de/a100_man/A151_man.pdf) - Doepfer Musikelektronik, manual PDF metadata updated 2025, accessed 2026-07-08, supports: panel inventory, LEDs, trigger rising edge, reset rising edge, original -8V/+8V limitation, version 2 full A-100 voltage range, user examples including waveform switching and tone sequencing.
- [Doepfer A-100 Analog Modular System overview](https://doepfer.de/a100e.htm) - Doepfer Musikelektronik, accessed 2026-07-08, supports: A-100 historical/product context and open-ended modular patching model.
- [A155_A151_demo.mp3](https://www.doepfer.de/A100_sounds/A155_A151_demo.mp3) - Robert Sigmuntowski, hosted by Doepfer, accessed 2026-07-08, supports: observed/demo use of A-155 with A-151 to switch CV rows on the fly.
- [Doepfer A-100](https://en.wikipedia.org/wiki/Doepfer_A-100) - Wikipedia contributors, accessed 2026-07-08, supports: high-level context for A-100 and A-151's place among Eurorack switching/sequencing utilities; secondary context only.
- Internal reference: `src/js/modules/div/index.js` - existing clock edge threshold and trigger processing pattern.
- Internal reference: `src/js/modules/matrix/index.js` - existing DC-coupled buffer routing and output clamping pattern.
- Internal reference: `src/js/modules/vca/index.js` and `src/js/utils/slew.js` - existing app practice for short smoothing to avoid audible discontinuities.
