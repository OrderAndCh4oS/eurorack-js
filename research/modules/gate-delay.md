# Dual Gate Delay (gate-delay)

## Research Status

- Queue status: `spec-ready` before implementation.
- Target: feature-faithful software adaptation of the Doepfer A-162 timing workflow, not a component-level circuit model.
- Distinct role: turn short 5-10 ms clock/sequencer triggers into delayed gates that can sustain ADSR stages and stagger modulation.

## Sources

### Primary sources

- [Doepfer A-162 Dual Trigger Delay product page](https://doepfer.de/a162.htm) (accessed 2026-07-13) documents two independent channels, rising-edge operation, delay and length from about 2 ms to more than 10 seconds, LEDs, and an approximately +12 V hardware output.
- [Doepfer A-162 user manual](https://doepfer.de/a100_man/A162_man.pdf) (Doepfer, circa 2003; accessed 2026-07-13) confirms the two controls and ports per channel, 0-10 second manual ranges, timing diagram, delayed-modulation patch, and stereo pseudo-echo patch.
- [Doepfer A-152 manual](https://doepfer.de/a100_man/A152_man.pdf) (accessed 2026-07-13) uses the A-162 to delay gates until a changed CV has settled and notes that adequate pulse width is required for reliable downstream triggering.

### Context and observed use

- [Doepfer Trautonium system notes](https://www.doepfer.de/traut/traut_e.htm) use an A-162 to enlarge quantizer triggers to a usable envelope gate length.
- [Navs Modular Lab A-162 modification notes](http://navsmodularlab.blogspot.com/2011/02/162-trigger-delay-modification.html) provide practitioner context for alternate timing ranges. Electrical claims defer to Doepfer.

### DSP references

- The implementation is a pair of sample-counted monostables. No external DSP algorithm is required; the important constraints are rising-edge detection, state across blocks, deterministic retriggering, and integer sample deadlines.

## Source Quality And Decisions

- Doepfer describes the minimum as both zero and roughly 2 ms. The app uses an exact zero position followed by an exponential 2 ms-10 s range, preserving immediate timing while giving useful low-end resolution.
- Hardware outputs about +12 V. Eurorack-js gates are 0/10 V, so local interoperability takes precedence.
- The sources do not define overlapping-trigger behavior precisely. The app uses a deterministic retriggerable monostable: a new edge replaces a pending delay; when its delayed event arrives, the output goes high and its length restarts.

## Panel Contract

### Metadata

- ID: `gate-delay`
- Name: `GATE DELAY`
- Category: `clock`
- Width: 6 HP
- Color: `module-color-five`

### Parameters

| Param | Label | Range | Default | Meaning |
| --- | --- | --- | --- | --- |
| `delay1` | Dly 1 | 0-1 | 0 | Exact zero, then exponential 2 ms-10 s. |
| `length1` | Len 1 | 0-1 | 0.35 | Exact zero, then exponential 2 ms-10 s. |
| `delay2` | Dly 2 | 0-1 | 0 | Second channel delay. |
| `length2` | Len 2 | 0-1 | 0.35 | Second channel length. |

### Ports and LEDs

| Direction | Port | Signal | Contract |
| --- | --- | --- | --- |
| Input | `trig1`, `trig2` | `trigger` | Rising edge at >=1 V; unpatched normal 0 V. |
| Output | `gate1`, `gate2` | `gate` | 0 V low, 10 V high. |

- LEDs `gate1` and `gate2` are 1 while the corresponding output is high.

## Voltage And Timing Contract

- Input accepts standard 5-10 V triggers and 0/10 V gates; a held-high input triggers once.
- Each timing value is converted to an integer sample count at the instance sample rate. Timing continues across arbitrary process block sizes.
- A zero-length delayed event produces no high sample. Non-zero lengths produce at least one high sample.
- `reset()` clears edge history, pending delays, active lengths, outputs, and LEDs.

## DSP Plan

Maintain `lastHigh`, `pendingSamples`, and `remainingSamples` for each channel. Per sample: detect a rising edge, schedule the delay, decrement pending state, start/restart the output when the delayed event matures, then write 10 V while remaining length is positive. Allocate all input/output arrays once in `createDSP()`.

## Assumptions And Deviations

- No CV over delay or length; the A-162 panel is manual.
- No alternate capacitor/range switch; the exponential mapping covers articulation and long delay use in one range.
- This module intentionally does not modify `clk`, `seq`, `adsr`, or `func`.

## Test Targets

- Complete metadata, params, buffers, UI ports, and LEDs.
- Threshold and held-high edge behavior.
- Exact immediate, delayed, and cross-block timing at low deterministic sample rates.
- Pending replacement, active retrigger, independent channels, zero length, reset, finite buffers, and 0/10 V bounds.

## Implementation Plan

- Module ID/category: `gate-delay` / `clock`.
- Branch/worktree: current workspace; parallel worktrees were not requested and existing uncommitted voice demos must remain intact.
- DSP: two retriggerable sample-counted monostables.
- Factory patch: `Test: Gate Delay`, clocking an ADSR-controlled VCA.
- Focused validation: `npm test -- tests/dsp/gate-delay.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- Full validation: `npm test`.

## DSP Audit (2026-07-11)

- **Focused coverage**: initialization, thresholds, held gates, exact timing, retriggering, channel independence, reset, finite buffers, and 0/10 V bounds are covered by `tests/dsp/gate-delay.test.js`.
- **Measured status**: the 44.1/48/96 kHz by 128/512-sample matrix completed 9 scenarios per configuration with zero errors or voltage flags, finite/stable buffers, and a measured maximum of 92.9 us/block.
- **Next action**: retain sample-count timing tests when timing ranges or trigger thresholds change.
