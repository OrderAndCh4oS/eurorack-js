# Wavetable oscillator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Wavetable)

1. Start the demo. The LFO scans the oscillator’s Position input and the oscillator goes through a VCA to both speakers.
2. Lower Scan to hear one position clearly. Sweep Pos by hand, then compare the same sweep in another Bank. Morph changes how the oscillator crosses from one wave to the next.

## In a composition

For a slow pad, use a gentle position sweep and a long envelope. A step sequence patched to Position makes a single bass note change character on each beat.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Coarse (`coarse`) | Sets the oscillator’s base pitch. |
| Fine (`fine`) | Makes small tuning adjustments around the base pitch. |
| Bank (`bank`) | Selects a family of wave shapes. |
| Pos (`position`) | Chooses a position within the current bank. |
| Scan (`scanAmt`) | Sets how much the Position input moves the table position. |
| FM (`fmAmt`) | Sets the amount of frequency modulation from the FM input. |
| Level (`level`) | Sets the oscillator’s audio output level. |
| Morph (`interp`) | Chooses discrete wave steps or a smooth transition between adjacent waves. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| V/Oct (`vOct`) | Control voltage · ±10 V | Plays the oscillator at one volt per octave. |
| FM (`fm`) | Control voltage · ±5 V | Supplies frequency modulation for changing pitch or adding overtones. |
| Pos (`position`) | Control voltage · ±5 V | Scans through the waves in the bank, with depth set by Scan. |
| Bank (`bankCv`) | Control voltage · ±5 V | Moves the bank selection under voltage control. |
| Sync (`sync`) | Trigger · 0 to 10 V | Resets oscillator phase from an external pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the selected waveform at the played pitch. |

## Design background

Wavetable synthesis arranges repeating wave shapes in an addressable collection. This oscillator builds its banks procedurally and lets you choose smooth or stepped movement through them. The Synthesis Technology E350 offers a hardware example of scanning between waves. [Synthesis Technology E350 Morphing Terrarium](https://synthtech.com/eurorack/E350/)

[Research and implementation notes](../../research/modules/wavetable.md)
