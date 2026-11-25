# Performance Mutes

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Performance+Mutes)

1. Press **Start**. A kick plays quarter notes at 120 BPM. After the first bar, sixteenth-note hats join for a bar. The square LFO repeats that two-bar arrangement through Mute 2.
2. Turn channel 1 off. Hold **Hold 1** to punch the kick back in, then release it. The kick clock keeps running throughout.
3. Disconnect Mute 2 to let the hats play every bar. The signal LEDs show what each stem sends to the mixer.

## In a composition

Patch an entire drum mix through one channel and bass through another before the master mixer. A sustained high gate mutes a stem for the length of a breakdown. A short divider pulse makes a brief dip. For a dub send, leave the next input empty and route its output to a delay. You can tap that channel's Hold button to send just one snare hit to the delay.

## Panel reference

### Controls

| Control | Gesture |
| --- | --- |
| 1–4 (`on1`, `on2`, `on3`, `on4`) | On latches the channel open. Off leaves it muted between punches. |
| Hold 1–4 (`hold1`, `hold2`, `hold3`, `hold4`) | Press for momentary pass-through. Release to return to the latch setting. |

### Inputs

| Jack | Signal and operation |
| --- | --- |
| In 1–4 (`in1`, `in2`, `in3`, `in4`) | Audio or CV, ±10 V. An empty input follows the nearest patched input above it, before its switch. An empty first input supplies 0 V. |
| Mute 1–4 (`mute1`, `mute2`, `mute3`, `mute4`) | A gate at 1 V or higher closes the corresponding channel, even while Hold is pressed. |

### Outputs

| Jack | Signal and operation |
| --- | --- |
| Out 1–4 (`out1`, `out2`, `out3`, `out4`) | Four DC-coupled outputs pass positive and negative signals. Each gain opens over a 3 ms time constant and closes over 12 ms. |

## Design background

DivKid and Befaco used optical attenuators so a performer can switch a loud stem mid-waveform with a short, musical tail. The rack adds a mute gate for each stem and retains the original input cascade. [Befaco Mutes](https://www.befaco.org/mutes/) · [Research and implementation notes](../../research/modules/mutes.md)
