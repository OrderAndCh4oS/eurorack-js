# Formant filter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Formant)

1. Start the patch. A saw wave gives the filter a rich set of harmonics, and the LFO sweeps the Vowel input. Both speakers carry the result.
2. Lower the LFO’s rate and turn Vowel slowly. Try Shift to move the group of peaks up or down, then use Mix to compare the shaped sound with the original saw.

## In a composition

For a talking bass line, sequence the pitch and the vowel on separate lanes. For a choir-like drone, hold one vowel and apply small changes in Shift.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Vowel (`vowel`) | Moves through the A, E, I, O and U resonance shapes. |
| Res (`resonance`) | Changes how narrowly the individual formant peaks stand out. |
| Shift (`shift`) | Moves the entire set of peaks higher or lower together. |
| Drive (`drive`) | Sets how strongly the input drives the shaped sound. |
| Mix (`mix`) | Balances the original sound with the vowel-filtered result. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | Supplies the sound from which the filter will emphasize vowel bands. |
| Vowel (`vowelCV`) | Control voltage · ±5 V | Sweeps through vowel shapes from another module. |
| Shift (`shiftCV`) | Control voltage · ±5 V | Moves the group of formant frequencies together. |
| Res (`resCV`) | Control voltage · ±5 V | Modulates the emphasis of the resonances. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the dry and formant-filtered blend. |

## Design background

Formants are concentrations of energy in a spectrum. The vocal tract shapes vowels with such resonances, which makes a moving filter bank an effective musical approximation. [Doepfer A-104 formant filter](https://doepfer.de/a104.htm)

[Research and implementation notes](../../research/modules/formant.md)
