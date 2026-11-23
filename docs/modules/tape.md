# Tape echo

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Tape)

1. Start the rack. A saw goes through Tape and an LFO moves the delay time. The scope compares the audio output with the echo’s clock pulse.
2. Change Heads to alter the spacing of the taps. Bring up Wow and then Drive separately so you can hear pitch movement apart from the roughening of the repeats.

## In a composition

For a dub rhythm, patch a sparse snare into Tape and use Tap to set the spacing. Freeze can hold a fragment while the rest of the arrangement moves on.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets the basic spacing of the echo repeats. |
| Fdbk (`feedback`) | Returns echo to the recording path so it repeats again. |
| Mix (`mix`) | Balances the input with the tape echo return. |
| Drive (`drive`) | Pushes the recording stage into saturation for a denser repeat. |
| Age (`age`) | Increases the worn-tape character of the repeats. |
| Low Cut (`lowCut`) | Reduces low frequencies in the echo path so bass builds up less readily. |
| Wow (`wow`) | Adds small fluctuations in transport speed, heard as pitch movement. |
| Crnk (`crinkle`) | Adds irregular disturbances associated with a creased or worn tape. |
| Freeze (`freeze`) | Holds the echo material for continued playback. |
| Heads (`headMode`) | Selects a single playback tap or one of two differently spaced multi-head patterns. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | Supplies the mono signal to record into the echo. |
| Time (`timeCV`) | Control voltage · ±5 V | Changes the basic echo spacing under voltage control. |
| Speed (`speedCV`) | Control voltage · ±5 V | Varies the simulated transport speed, bending the echoes. |
| Fdbk (`feedbackCV`) | Control voltage · ±5 V | Changes the strength of the repeated feedback path. |
| Mix (`mixCV`) | Control voltage · ±5 V | Moves the dry/echo blend. |
| Tap (`tap`) | Trigger | Measures the interval between incoming pulses to set the echo time. |
| Freeze (`freezeGate`) | Gate | Holds the echo material while the gate is high. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the dry and echo mix. |
| Clock (`clock`) | Gate | Sends a timing pulse at the echo period for synchronizing other modules. |

## Design background

The model borrows the architecture of a tape echo. Playback heads at different distances hear different moments, while changes in transport speed affect timing and pitch together. Roland’s RE-201 Space Echo appeared in 1974. [Roland and BOSS history of the Space Echo](https://articles.boss.info/history-of-the-space-echo/)

[Research and implementation notes](../../research/modules/tape.md)
