# Snare drum

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Snare+Only)

1. Start the patch. The clock strikes Snare, whose output goes through the mixer to both speakers. Listen first to the beginning of the hit and then to the tail.
2. Turn Snap up and down while keeping Decay fixed. Then tune Pitch to hear the drum body change beneath the noisy part.

## In a composition

For a short backbeat, shorten Decay and leave enough snap to cut through the mix. For a sustained industrial hit, extend the tail and send it to a reverb.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Snap (`snap`) | Controls the sharp, noisy component associated with the snare wires. |
| Decay (`decay`) | Sets how long the body and rattle last after a strike. |
| Pitch (`pitch`) | Tunes the tonal component under the rattle. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger | Starts a snare hit on a rising pulse. |
| V/O (`pitchCV`) | Control voltage | Tunes the tonal body from a one-volt-per-octave source. |
| Dcy (`decayCV`) | Control voltage | Changes the duration of the hit under voltage control. |
| Snp (`snapCV`) | Control voltage | Changes the noisy attack for accents and ghost notes. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the mixed snare body and rattle. |

## Design background

A snare drum’s head and vibrating wires contribute different parts of its sound. Synthesised snares recreate that contrast with tonal and noise components. [2hp Snare](https://www.twohp.com/modules/p/snare)

[Research and implementation notes](../../research/modules/snare.md)
