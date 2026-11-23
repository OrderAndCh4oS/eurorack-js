# Delay

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Delay)

1. Start the patch. A saw wave feeds Delay while a slow LFO changes Time. Listen to the shifting pitch and colour of the delayed copy against the dry tone.
2. Turn Mix up and then Feedback up gradually. Move Time by hand to hear the repeats bend. For individually countable echoes, replace the sustained input with a pluck.

## In a composition

For dub repeats, match the delay time to a gap in the rhythm and use feedback to decide how many beats the tail fills. For a drone, slight time modulation keeps the texture moving.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets the time before the delayed copy is heard. |
| Fdbk (`feedback`) | Returns part of each echo to the delay line. Higher settings produce more repeats. |
| Mix (`mix`) | Balances the immediate input and delayed sound. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | Supplies the sound to echo. |
| Time (`timeCV`) | Control voltage · 0 to 5 V | Changes the delay time, producing bends when moved during a repeat. |
| Fdbk (`feedbackCV`) | Control voltage · 0 to 5 V | Changes how much sound recirculates, useful for sending a single accent into repeats. |
| Mix (`mixCV`) | Control voltage · 0 to 5 V | Changes the dry/wet balance from another module. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the blend of the original sound and its echoes. |

## Design background

A digital delay stores recent audio and reads it back later. Varying the read time during playback changes the apparent pitch of the delayed material.

[Research and implementation notes](../../research/modules/dly.md)
