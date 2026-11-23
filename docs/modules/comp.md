# Stereo compressor and limiter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+COMP)

1. Start the patch. A triangle and a saw reach the stereo inputs, while a clocked kick feeds Sidechain. The scope shows the detector envelope and gain reduction. Listen to the stereo tones dip around each kick.
2. Lower Threshold to deepen the dip, then extend Release and hear how long the tones take to recover. Use Byp to compare levels with the processing switched out.

## In a composition

For a dance bass, let the kick drive the detector and time the recovery to the offbeat. For gentle bus compression, leave Sidechain empty and let the stereo material drive its own gain changes.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Thrs (`threshold`) | Sets the level above which gain reduction begins. |
| Ratio (`ratio`) | Sets how strongly levels above the threshold are reduced in compressor mode. |
| Atk (`attack`) | Sets how quickly gain reduction develops after the level rises. |
| Rel (`release`) | Sets how quickly gain returns as the detector level falls. |
| Make (`makeup`) | Raises the processed level to compensate for the level lost to compression. |
| SCF (`sideFilter`) | Sets the cutoff of the detector filter. The filter affects what drives compression. |
| Mix (`mix`) | Blends uncompressed and compressed sound for parallel compression. |
| Mode (`mode`) | Chooses compressor or limiter operation. The limiter applies stronger restraint to peaks. |
| Det (`detector`) | Chooses a slower average-energy (RMS) reading or a peak-sensitive reading. |
| Filt (`filterMode`) | Turns the detector filter off or selects high-pass or low-pass operation. |
| Byp (`bypass`) | Switches the processing out for comparison with the original signal. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`inL`), R (`inR`) | Audio | Feeds this side of the stereo program. Both sides share gain reduction to preserve their balance. |
| SC (`sidechain`) | Audio | Supplies a separate sound to drive the detector, such as a kick ducking a pad. |
| Thr (`thresholdCV`) | Control voltage | Changes the level at which compression starts. |
| Atk (`attackCV`) | Control voltage | Changes how fast the compressor reacts to an onset. |
| Rel (`releaseCV`) | Control voltage | Changes how fast the gain recovers. |
| Mak (`makeupCV`) | Control voltage | Changes the post-compression gain. |
| Flt (`filterCV`) | Control voltage | Moves the cutoff of the detector filter. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`outL`), R (`outR`) | Audio | Carries the corresponding side of the processed stereo mix. |
| Env (`env`) | Control voltage · 0 to 10 V | Reports the level sensed by the detector as a control voltage. |
| GR (`gr`) | Control voltage · 0 to 10 V | Reports the amount of gain reduction for a scope or another CV destination. |

## Design background

This is a stereo-linked feed-forward dynamics processor. The detector measures level, then applies one gain change to both channels to keep the stereo image stable.

[Research and implementation notes](../../research/modules/comp.md)
