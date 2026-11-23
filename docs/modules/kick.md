# Kick drum

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Kick+Only)

1. Start the patch. The clock strikes Kick and also triggers Plot, so each hit appears at the same point on the display. Kick itself feeds both speakers.
2. Lengthen Decay to hear the pitched body, then change Click and watch the front of the waveform. Keep the clock slow enough to hear the whole tail.

## In a composition

For a low electronic bass drum, tune the tail to the bass line. For a tight rhythmic anchor, shorten Decay and use a little click to bring out the beat.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Pitch (`pitch`) | Tunes the low, ringing body of the kick. |
| Decay (`decay`) | Sets how long the drum rings after a strike. |
| Tone (`tone`) | Changes the harmonic content of the body, from rounder to more driven. |
| Click (`click`) | Adjusts the short attack at the front of the hit. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger | Strikes the drum on a rising pulse. |
| V/O (`pitchCV`) | Control voltage | Tunes the drum from a one-volt-per-octave source. |
| Dcy (`decayCV`) | Control voltage | Changes the length of the tail from hit to hit. |
| Tone (`toneCV`) | Control voltage | Modulates the harmonic colour of the body. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the complete kick sound. |

## Design background

This synthesised drum separates a fast attack from a decaying tonal body, two features that make a bass drum recognizable even through a small speaker. [2hp Kick](https://www.twohp.com/modules/p/kick)

[Research and implementation notes](../../research/modules/kick.md)
