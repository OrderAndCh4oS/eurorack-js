# Voltage-controlled oscillator (VCO)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+VCO+Only)

1. Select **Start** and listen in stereo. The triangle goes through VCA channel 1 to the left speaker. The saw goes through channel 2 to the right. Lower each VCA knob in turn to hear the other waveform alone.
2. Turn **Coarse** to move both sounds together. In Edit, move the cable from Saw to Pls to hear the hollow pulse wave at the same pitch.

## In a composition

For a bass line, send SEQ pitch to V/Oct and put an envelope-controlled VCA after the oscillator. For a drone, leave the VCA open and tune a second VCO a fifth above it.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Coarse (`coarse`) | Tunes the oscillator across its main frequency range. |
| Fine (`fine`) | Offsets tuning in semitones for small adjustments or deliberate beating against another voice. |
| Glide (`glide`) | Smooths changes in pitch so a sudden step slides into the next note. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| V/Oct (`vOct`) | Control voltage · ±8 V | Adds a volt per octave to oscillator pitch. Use a keyboard, quantizer or sequencer here. |
| FM (`fm`) | Control voltage · ±5 V | Modulates the oscillator’s frequency. Slow movement makes vibrato and audio-rate movement adds new overtones. |
| PWM (`pwm`) | Control voltage · 0 to 5 V | Moves the high-to-low proportion of the pulse output. |
| Sync (`sync`) | Trigger · 0 to 10 V | Restarts the waveform cycle on an incoming edge to lock its phase to another source. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Tri (`triangle`) | Audio | Supplies a soft waveform with sloping sides and relatively little high-frequency energy. |
| Saw (`ramp`) | Audio | Supplies a bright sawtooth with many harmonics, a good starting point for filtering. |
| Pls (`pulse`) | Audio | Supplies a pulse wave whose width can be changed at the PWM input. |

## Design background

This panel draws on the 2hp VCO. The familiar one-volt-per-octave pitch input lets a keyboard, sequencer or another voltage source play the same voice. [Doepfer’s guide to voltage control](https://doepfer.de/a100_man/a100t_e.htm)

[Research and implementation notes](../../research/modules/vco.md)
