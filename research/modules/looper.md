# 2hp Loop - Minimal Looper (loop)

## Hardware Reference

- **Based on**: [2hp Loop](https://www.twohp.com/modules/loop)
- **Manufacturer**: 2hp
- **ModularGrid**: [2hp Loop](https://www.modulargrid.net/e/2hp-loop)

## Specifications

### Physical

- **Width**: 2HP
- **Depth**: 46mm
- **Power**: +12V 83mA, -12V 8mA, +5V 0mA
- **Audio quality**: 24-bit, 48kHz hardware recording/playback
- **Recording time**: Up to 5 minutes

### Description

2hp Loop is a compact high-fidelity Eurorack looper with a deliberately minimal interface. It focuses on the essentials: record audio, layer or replace material using one of four recording modes, then alter playback with reverse and half-speed.

This is the right target for eurorack-js because many existing modules are based on 2hp designs and because the feature set is small enough to implement rigorously. Larger loopers such as Lúbadh, Morphagene, ADDAC112, and Nebulae should remain expansion references rather than the first emulation target.

This module is distinct from `rec`:
- `rec` records stereo audio and exports a WAV file.
- `loop` records into a live RAM buffer and immediately plays/overdubs that buffer as an instrument/effect.

## Features

From 2hp Loop:

- High-fidelity looper
- Up to five minutes of recording time
- Four recording modes: Sound on Sound, Dub, Replace, Infinite / Frippertronics
- Reverse playback
- Half-speed playback
- Minimal, immediate interface

## Recording Modes

| Mode | Behavior | Implementation Notes |
|------|----------|----------------------|
| **Sound on Sound** | Layers new input over existing loop while preserving old material | Mix input into buffer with high feedback |
| **Dub** | Overdub mode with more active replacement/decay | Mix input with lower feedback than Sound on Sound |
| **Replace** | New input replaces existing buffer while recording | Write input directly to buffer |
| **Infinite / Frippertronics** | Long feedback decay for evolving tape-loop textures | Keep loop running and write input with feedback decay |

The four modes are 2hp-inspired write modes used when recording after a loop already exists. First-pass recording always stops at the selected length limit, then manual recording can be enabled again for overdub or replacement. The exact hardware gain/feedback curves are not published on the product page. Use musical approximations and document them in code/tests.

## Proposed eurorack-js Module

### Metadata

```javascript
{
    id: 'loop',
    name: 'LOOP',
    hp: 6,
    category: 'effect'
}
```

### Controls

Keep the panel small, but use 6HP in the browser implementation so the record button, mode buttons, three small knobs, and I/O rows remain readable.

| Control | Param | Range | Description |
|---------|-------|-------|-------------|
| **Mode** | `mode` | 0-3 | Sound on Sound, Dub, Replace, Infinite |
| **Record** | `record` | 0/1 | Toggle recording/overdub |
| **Reverse** | `reverse` | 0/1 | Reverse playback direction |
| **Half** | `halfSpeed` | 0/1 | Half-speed playback, one octave down |
| **Length** | `length` | 0-1 | First-pass recording cutoff; 100% is 60 seconds |
| **Mix** | `mix` | 0-1 | Dry/wet blend |
| **Level** | `level` | 0-1 | Output level |

### Inputs

| Input | Type | Behavior |
|-------|------|----------|
| **In** | audio | Audio input, ±5V nominal |
| **Rec** | trigger | Rising edge toggles recording |
| **Rev** | trigger/gate | Toggles or gates reverse depending implementation |

### Outputs

| Output | Type | Behavior |
|--------|------|----------|
| **Out** | audio | Looper output |
| **End** | trigger | Optional end-of-loop pulse; useful in modular patches, but can be phase 2 |

### Indicators

- **REC LED**: high while recording
- **PLAY LED**: high when a loop exists and is playing
- **MODE LED/state**: indicates the active recording mode

## Voltage Specs

- Audio input/output: ±5V nominal
- Trigger threshold: rising edge at >2.5V
- Gate high: ≥1V
- Trigger/gate outputs: 0V / 10V

## Behavior

### First Recording Pass

1. Press **Record** or receive `Rec` trigger.
2. Input is written from buffer position 0.
3. Press **Record** again to stop, or wait for the `length` cutoff.
4. The recorded length becomes the active loop length.
5. Recording turns off and playback starts automatically.

### Playback

- Playback loops continuously once a loop exists.
- `reverse` flips playhead direction.
- `halfSpeed` sets playback ratio to 0.5.
- Reverse and half-speed can combine.
- Output is scaled by `level`.

### Overdub / Record Modes

When recording after a loop already exists:

```javascript
// Sound on Sound / Dub / Infinite differ by feedback and input gain.
buffer[pos] = buffer[pos] * feedback + input * inputGain;

// Replace ignores old buffer content.
buffer[pos] = input;
```

Suggested starting mappings:

| Mode | feedback | inputGain |
|------|----------|-----------|
| Sound on Sound | 1.0 | 0.8 |
| Dub | 0.85 | 0.9 |
| Replace | 0.0 | 1.0 |
| Infinite | 0.97 | 0.7 |

Clamp buffer values to a safe audio range after writes.

## DSP Implementation

### Buffer Structure

Use a RAM-only mono buffer in v1. Do not serialize audio into patch JSON.

```javascript
const maxSeconds = 300; // hardware target: five minutes
const maxSamples = Math.ceil(sampleRate * maxSeconds);
const buffer = new Float32Array(maxSamples);
```

Five minutes mono Float32 is about 53MB at 44.1kHz. That is large but manageable for one module instance. If memory becomes a problem, use 60 seconds as the emulator default and document it as a practical browser constraint.

### State

```javascript
const state = {
    hasLoop: false,
    recording: false,
    playing: false,
    recordHead: 0,
    playHead: 0,
    loopLength: 0,
    endPulse: 0,
    lastRecTrig: 0,
    lastRevTrig: 0
};
```

### Interpolated Playback

Half-speed playback requires fractional reads:

```javascript
function readInterpolated(buffer, position, loopLength) {
    const i0 = Math.floor(position);
    const frac = position - i0;
    const a = buffer[i0 % loopLength];
    const b = buffer[(i0 + 1) % loopLength];
    return a + (b - a) * frac;
}
```

### Playback Advance

```javascript
const direction = reverse ? -1 : 1;
const ratio = halfSpeed ? 0.5 : 1;
playHead += direction * ratio;
```

Wrap the playhead into `[0, loopLength)`. Emit a short `End` trigger when wrapping if the `End` output is included.

### Click Prevention

Clicks are the main looper risk. Implement:

1. Short record start fade-in.
2. Short record stop fade-out where possible.
3. Crossfade at loop wrap.
4. Output gain smoothing.
5. Clear at block boundary or with a short mute ramp.

### Unpatched Input Handling

Follow the standard audio-input reset pattern used in other modules:

```javascript
if (this.inputs.in !== ownIn) {
    ownIn.fill(0);
    this.inputs.in = ownIn;
}
```

## Simplified Implementation

For the first implementation:

1. One mono loop buffer.
2. Record, playback, overdub, reverse, half-speed.
3. Four record modes.
4. `In`, `Rec`, `Rev`, `Out`; optional `End` in phase 2.
5. No clocking, start/length CV, granular playback, stereo, loop banks, or file persistence.
6. Custom UI only if the default toolkit cannot make the 2HP control layout readable.

## Module UI

Suggested compact panel:

```
┌ LOOP ┐
│ MODE │
│ REC  │
│ REV  │
│ HALF │
│ LEVL │
│ In   │
│ Rec  │
│ Rev  │
│ Out  │
└──────┘
```

The hardware target is 2HP, but the browser module uses `hp: 6` to avoid cramped controls while keeping the feature set 2hp-inspired.

## Suggested Module Spec

```javascript
{
    id: 'loop',
    name: 'LOOP',
    hp: 6,
    color: '#6f4a8e',
    category: 'effect',

    params: {
        mode: 0,
        record: 0,
        reverse: 0,
        halfSpeed: 0,
        length: 1,
        mix: 1,
        level: 0.8
    },

    inputs: {
        in: 'audio',
        recTrig: 'trigger',
        reverseTrig: 'trigger'
    },

    outputs: {
        out: 'audio'
    },

    leds: ['recording', 'playing']
}
```

## Patch Ideas

1. **Minimal part layering**: VCO + VCA into LOOP, record short tonal phrases in Sound on Sound mode.
2. **Frippertronics bed**: Slow notes into LOOP, Infinite mode, half-speed on for octave-down ambience.
3. **Reverse stabs**: Drum or pluck phrase into LOOP, toggle Reverse from a sequencer gate.
4. **Replace rhythm**: Feed a drum pattern, use Replace mode to punch in new loop content.
5. **Two-loop patch**: Use two LOOP instances for pseudo-dual behavior, one forward and one half-speed reverse.

## Implementation Plan

### Phase 1: 2hp Loop Core

- Add `src/js/modules/loop/index.js`.
- Add `loop` to `src/js/rack/module-manifest.js` under `effect`.
- Implement mono record/playback with first-pass loop length.
- Implement four record modes.
- Implement reverse and half-speed playback.
- Implement level control and recording/playing LEDs.
- Add `tests/dsp/loop.test.js`.
- Add `src/js/config/patches/test-loop.js`.
- Update README and AGENTS module lists/port reference.

### Phase 2: Modular Patchability

- Add `End` trigger output.
- Add clear trigger or long-press clear behavior in UI.
- Add tests for trigger thresholds and end pulse width.

### Phase 3: Expanded Looper References

Only after the 2hp-style looper is stable:

- Lúbadh-style feedback/tape coloration and dual-deck patch ideas
- 4ms DLD-style clocked loop length
- 4ms STS-style start/length controls
- Morphagene-style splice/gene behavior
- ADDAC112/Nebulae-style granular loop-buffer processing

## Testing Priorities

1. Initializes with runtime `sampleRate` and `bufferSize`.
2. Outputs silence with no loop and no input.
3. First recording pass defines a stable loop length.
4. Playback reproduces recorded samples.
5. Half-speed uses interpolated reads and stays stable.
6. Reverse playback reads backward without NaN or out-of-range indices.
7. Each record mode writes expected buffer values.
8. Clear/reset behavior resets buffer, heads, LEDs, and loop state.
9. Trigger inputs edge-detect correctly.
10. Patch serialization stores params only, not audio buffer contents.

## Open Decisions

- **Buffer length**: True 2hp target is five minutes, but browser memory may justify a shorter default.
- **Panel width**: Actual module is 2HP; emulator uses 6HP for readable controls.
- **Reverse input**: Decide whether `Rev` is a trigger toggle or gate-held reverse. Gate-held is more modular; trigger toggle may match a button better.
- **End output**: Useful in Eurorack patches, but not required for 2hp-style MVP.
- **Clear behavior**: Hardware details need verification from the getting-started guide; emulator can use a clear button or record-long-press equivalent.

## Sources

- [2hp Loop](https://www.twohp.com/modules/loop)
- [ModularGrid - 2hp Loop](https://www.modulargrid.net/e/2hp-loop)
- [Instruō Lúbadh](https://www.instruomodular.com/product/lubadh/)
- [Make Noise Morphagene](https://www.makenoisemusic.com/modules/morphagene/)
- [4ms Stereo Triggered Sampler](https://4mscompany.com/sts.php)
- [4ms Dual Looping Delay](https://4mscompany.com/dld.php)
- [Strymon Magneto](https://www.strymon.net/product/magneto/)
- [ADDAC112 VC Looper & Granular Processor](https://www.addacsystem.com/en/products/modules/addac100-series/addac112)
- [Qu-Bit Nebulae](https://www.qubitelectronix.com/shop/nebulae)
