# Synth Voice Demos

The factory patch menu includes twelve numbered `Demo - Synth Voice` patches. They translate the patching principles in Monotrail Tech Talk's 2023 video [How to make a GOOD eurorack synth voice - with Nano modules](https://www.youtube.com/watch?v=jOI35EmHxZ4) into the modules and voltage contracts available in this emulator.

These are learning demos, not isolated module test patches. Open them in order to build up the signal-flow model, or treat each as a starting point and move one cable at a time.

## Principles

1. Start with an explicit voice path: pitch and gate control an oscillator, envelope, filter, VCA, and output.
2. Prefer useful range and simultaneous waveform outputs over a large number of hidden oscillator modes.
3. Mix audio at different points in the chain; moving a source before or after a filter changes which frequencies survive.
4. Use DC-coupled utilities for both audio and CV. A single modulation input becomes much more useful when several sources are mixed, scaled, inverted, or offset first.
5. Keep related oscillators on the same pitch CV when stable FM ratios or layered tuning matter.
6. Explore sync, PWM, FM, filter modes, and resonance as independent timbre controls.
7. Use separate envelopes for amplitude, filter motion, and accents when one contour is too restrictive.
8. Modulate envelope timing so articulation evolves instead of repeating exactly.
9. Use VCAs before modulation destinations. A VCA controls the amount of CV just as readily as the amount of audio.
10. Quantity matters: several simple mixers, envelopes, LFOs, and VCAs often create more motion than one complex source.
11. Use end-of-cycle signals to chain events and create patches that can run without a conventional sequencer.

## Demo Index

| Patch | Main lesson | Try next |
|---|---|---|
| `01 - Subtractive` | One envelope opens the filter and final VCA in the classic oscillator to filter to VCA path. | Move the oscillator cable from ramp to triangle or pulse. |
| `02 - Waveform Blend` | Simultaneous triangle, ramp, and pulse outputs are mixed while an unsynced LFO moves pulse width. | Solo each mixer channel, then rebuild the blend. |
| `03 - Tracked FM` | Carrier and modulator receive the same sequence, preserving their pitch relationship; an attenuverter keeps FM depth useful. | Change the modulator coarse tuning or FM attenuation. |
| `04 - Sync Sweep` | A steady oscillator hard-syncs the sequenced oscillator while a slow scaled LFO sweeps the sync frequency. | Reverse or increase the sweep with the attenuverter. |
| `05 - Oscillator Stack` | Two lightly detuned oscillators and a lower tracking oscillator create a larger source before filtering. | Remove the lower oscillator, then compare its mixer level at 0.2 and 0.8. |
| `06 - Post-filter Noise` | Noise is added after the tonal source's filter, retaining high-frequency detail while sharing the final amplitude envelope. | Move noise before the filter and compare the result. |
| `07 - Mixed CV` | Envelope, slow motion, and faster detail are combined in a DC-coupled mixer before the only cutoff CV input. | Mute each modulation channel to identify its time scale. |
| `08 - Filter Modes` | Low-pass, band-pass, and high-pass outputs are available together and can form a new response when mixed. | Solo band-pass, then add a small amount of high-pass. |
| `09 - Envelopes and Accents` | Independent amplitude and filter envelopes provide separate articulation; a divided clock adds periodic filter accents. | Lengthen only the amplitude release, then only the filter release. |
| `10 - Animated Envelope` | Unsynced LFOs alter attack and release while the inverted envelope pulls resonance in the opposite direction. | Disconnect one timing CV to hear which motion it contributed. |
| `11 - VCA Modulation` | A fast LFO passes through a VCA whose level is controlled by a slow LFO, so filter modulation depth evolves over time. | Raise `modVca` channel gain carefully to move toward audio-rate filter FM. |
| `12 - Dynamic Generative` | A cycling function generator clocks an envelope and a second function; two VCAs animate a four-source waveform mix before filter and output. | Change cycle rise/fall independently or reroute end-of-cycle to another trigger input. |

## Emulator Adaptations

- The core VCO has triangle rather than sine output. Triangle is used where the video calls for a mellow waveform or sine-like FM source.
- The core VCO has no dedicated sub-octave outputs. The stack and generative patches use separately tuned VCOs that share the same pitch source where tracking is required.
- VCO FM is linear Hz-per-volt in this implementation; there is no exponential/linear selector. The tracked FM demo therefore focuses on ratio stability and depth control.
- The VCF has one cutoff CV input plus resonance CV. `Mixed CV` demonstrates the video's recommended external-mixer solution explicitly.
- The VCA is DC-coupled and its signal ports use the `any` contract. It can control CV or audio, although its panel provides channel gain plus CV rather than the exact Nano ALT control layout and summing normalizations.
- The dynamic generative patch preserves the end-of-cycle and multi-timescale idea rather than copying Nano-specific sub outputs, normalizations, and attenuverters literally.

The source video demonstrates patching ideas on Nano ONA, MAR, FONT, QUART, SARA, and ALT hardware. The factory patches are original software adaptations and do not claim component-level emulation of those modules.
