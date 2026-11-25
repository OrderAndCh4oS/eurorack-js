# Stereo DJ Filter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Stereo+DJ+Filter)

1. Press **Start**. A saw bass plays on the left and a kick and hat play on the right. At the center of **Sweep** both signals pass through dry.
2. Turn Sweep left and listen to the hat lose its edge. Sweep right and listen to the bass and kick thin out. With the knob still raised, press **Bypass** on a downbeat to bring the whole mix back.
3. Engage the filter again. Set Sweep partway left, raise **Res**, then turn **Tilt**. The boosted cutoff moves higher on one side and lower on the other.

## In a composition

Put the filter between a stereo drum bus and OUT. Use **Limit** when you want the beat to stay audible at the end of a sweep. Select **Full** for a deeper cut before the drop. To automate the sweep, patch a bipolar controller into Master and begin with the Sweep knob centered.

## Panel reference

### Controls

| Control | What it does |
| --- | --- |
| Sweep (`sweep`) | Left removes highs. Right removes lows. Noon passes the original stereo pair when the cutoff CVs are neutral. |
| Res (`resonance`) | Raises a peak around each active cutoff. |
| Tilt (`tilt`) | Raises the cutoff on the left and lowers it on the right when turned clockwise. |
| LP CV, HP CV (`lpAmount`, `hpAmount`) | Attenuvert the individual cutoff inputs. Positive CV with a positive amount raises the cutoff. Both filters can work at once. |
| Range (`limit`) | Limit stops LP at 220 Hz and HP at 2 kHz before Tilt. Full permits a deeper sweep. |
| Tilt to (`tiltRoute`) | Sends the stereo offset to LP, both filters or HP. |
| Bias (`offset`) | +5 V makes an unpatched LP or HP CV amount into a manual cutoff offset. |
| Bypass (`bypass`) | Crossfades to the dry stereo pair in 3 ms. The LED lights when the filter is engaged. |

### Inputs

| Jack | Signal and operation |
| --- | --- |
| L, R (`inL`, `inR`) | ±5 V audio. A single cable in L feeds both sides. Patching R gives independent stereo channels. |
| Master (`masterCV`) | −5 V sweeps toward LP and +5 V toward HP. Adds to Sweep. |
| LP, HP (`lpCV`, `hpCV`) | Independent ±5 V cutoff inputs with panel attenuverters. |
| Tilt, Res (`tiltCV`, `resCV`) | ±5 V modulation added to stereo offset or resonance. |

### Outputs

| Jack | Signal and operation |
| --- | --- |
| L, R (`outL`, `outR`) | Independent ±5 V audio. Route each side to its matching OUT input. |

## Design background

WMD's Overseer put both directions of a DJ filter and an engage switch on one stereo insert. The rack retains the center detent, stereo tilt, independent CV and stable resonance, using a digital state-variable filter for each stage. [WMD Overseer](https://wmdevices.com/pages/overseer) · [Research and implementation notes](../../research/modules/dj-filter.md)
