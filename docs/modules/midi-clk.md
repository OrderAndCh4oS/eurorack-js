# MIDI clock and transport

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI-CLK)

1. Select the MIDI input in MIDI Setup and enable clock transmission in the sending software or hardware. Start the rack, then start the external transport. Clock advances SEQ while Reset takes it back to its first step on a new start.
2. Change Div while the transport runs. The rack plays the same sequence at a different subdivision. Change the sender’s tempo and listen to the rack follow.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

Use this to keep a rack bass line aligned with a drum machine. Send the Run output to a gate-controlled part if you want its activity to follow the external transport.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Div (`division`) | Selects which musical subdivision of the incoming MIDI clock produces a pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger | Produces timing pulses at the chosen division for an external-clock input. |
| Rst (`reset`) | Trigger | Sends a short pulse on MIDI Start. Use it to return a sequencer to its beginning. |
| Run (`run`) | Gate | Stays high while the MIDI transport runs and falls when it stops. |

## Design background

MIDI timing clock sends 24 ticks per quarter note. Separate Start, Continue and Stop messages describe the transport. [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages)

[Research and implementation notes](../../research/modules/midi-clk.md)
