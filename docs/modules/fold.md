# Wavefolder

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Fold)

1. Start the rack. The triangle goes into Fold, an LFO moves the fold amount and a low-pass filter follows the result.
2. Open the downstream filter to hear the upper harmonics. Increase Fold slowly, then shift Sym and hear how differently the two halves of the wave fold.

## In a composition

For a West Coast-style bass voice, send a short envelope to Fold CV so each attack blooms with harmonics. Use slower modulation for an evolving drone.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Fold (`fold`) | Increases the amount of folding and therefore the density of new harmonics. |
| Sym (`sym`) | Offsets the fold’s symmetry to change harmonic balance. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | Supplies the waveform to fold. A simple triangle leaves room to hear new harmonics. |
| Fold (`foldCV`) | Control voltage · ±5 V | Modulates fold depth. |
| Sym (`symCV`) | Control voltage · ±5 V | Modulates the symmetry of the folding operation. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the folded waveform. |

## Design background

Wavefolding is a form of waveshaping. Driving a simple shape through successive folds adds frequency components at the source of the voice.

[Research and implementation notes](../../research/modules/fold.md)
