# MIDI drum triggers

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI-DRUM)

1. Select your MIDI input and the kit’s channel. Start the rack and send the notes assigned to N1 through N4. The first two strike kick and snare, the next two operate the closed and open inputs of one hi-hat.
2. Reassign N2 to a pad you can reach easily. Play the two hat pads in quick succession and listen to the closed stroke cut the open one short.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

For finger drumming, keep the first four pads as a kit and use the spare triggers for envelopes or tuned percussion. The velocity jack can add touch to a VCA.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Chan (`channel`) | Chooses the MIDI channel to listen to. Drum machines often use channel 10. |
| N1 (`note1`), N2 (`note2`), N3 (`note3`), N4 (`note4`), N5 (`note5`), N6 (`note6`), N7 (`note7`), N8 (`note8`) | Chooses the MIDI note number that will fire the correspondingly numbered trigger. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Kick (`trig1`), Snr (`trig2`), CHat (`trig3`), OHat (`trig4`), LTom (`trig5`), MTom (`trig6`), Clap (`trig7`), Ride (`trig8`) | Trigger | Sends a short pulse when the matching pad note arrives. Patch it to a percussion voice or envelope trigger. |
| Vel (`velocity`) | Control voltage · 0 to 10 V | Reports the strength of active pad hits as a voltage, taking the strongest when several coincide. |

## Design background

A pad controller generally sends ordinary MIDI notes. The assignments turn their note numbers into percussion destinations and leave pitch selection on the drum modules.

[Research and implementation notes](../../research/modules/midi-drum.md)
