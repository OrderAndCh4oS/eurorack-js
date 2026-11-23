# Audio looper

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Loop)

1. Start the demo and press Rec. Move the VCO’s pitch while recording its triangle, then press Rec again to finish the phrase. Raise Mix toward the loop so you can hear the recorded gesture.
2. Enable Rev to reverse the order of the gesture, then try 1/2 to hear it play more slowly and lower. Change the live oscillator to tell it apart from the captured layer.

## In a composition

For a tape-loop texture, overdub a few short figures at different pitches and play the result at half speed. Replace mode is useful when you want each take to become the entire phrase.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Len (`length`) | Sets the recording/playback length limit for the loop. |
| Mix (`mix`) | Balances the live input with the recorded loop. |
| Lvl (`level`) | Sets the level of loop playback. |
| Rev (`reverse`) | Plays the captured phrase backward. |
| 1/2 (`halfSpeed`) | Plays the loop at half speed, lowering it by an octave. |
| Mode (`mode`) | Chooses Sound on Sound, Dub, Replace or Infinite Overdub. The choice controls how much of the previous pass remains when recording again. |
| Rec (`record`) | Starts or finishes a recording or overdub. |
| Clr (`clear`) | Erases the current captured loop. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`in`) | Audio | Supplies the mono sound for the recording and dry path. |
| Rec (`recTrig`) | Trigger | Toggles recording from an external trigger. |
| Rev (`reverseTrig`) | Trigger | Toggles the playback direction on a pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the selected mix of live signal and loop playback. |

## Design background

The four recording modes borrow the compact, performance-oriented approach of 2hp Loop. Recording audio preserves the musician’s timing and tone together. [2hp Loop](https://www.twohp.com/modules/p/loop)

[Research and implementation notes](../../research/modules/loop.md)
