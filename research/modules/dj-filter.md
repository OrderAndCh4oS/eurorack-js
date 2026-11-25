# Stereo DJ Filter

Sketch #1 needs a master-bus gesture that takes out the bass for a build and restores the original stereo mix on the drop. The reference is WMD's 8 HP, 40 mm Overseer. On its main control, counterclockwise removes treble, noon opens the signal and clockwise removes bass. WMD's master-insert demonstration uses bypass to bring a swept mix straight back in. [WMD, Overseer panel guide](https://wmdevices.com/pages/overseer) · [WMDevices, MSCL and Overseer performance tutorial, 2019](https://www.youtube.com/watch?v=SfVmgNVhLC0) · [Clockface Modular, dimensions and panel description](https://en.clockfacemodular.com/products/wmd-overseer-black-panel)

## Panel and voltage contract

| Rack control or jack | Operation |
| --- | --- |
| Sweep | Bipolar −1…+1, default 0. Master CV adds one full side of travel per 5 V. Center with neutral offsets passes the input sample for sample. |
| Resonance | 0…1, default 0. Maps from Q = 0.707 to 3.5. Res CV adds one full range per 5 V. |
| Tilt, Tilt route | −1…+1, default 0. Shift the engaged cutoffs oppositely by up to one octave per side. Route to LP, both (default) or HP. Tilt CV adds to the knob. |
| LP CV amount, HP CV amount | Bipolar attenuverters. Positive modulation raises the respective cutoff. Default 0. Both filters can engage at once. The +5 V position supplies the attenuverters with a manual offset when the respective jack is empty. A patched 0 V overrides its normal. |
| Limit | Limited (default) keeps endpoint cutoffs at 220 Hz (LP) and 2 kHz (HP). Full reaches 20 Hz and 18 kHz, subject to the sample-rate cap. |
| Bypass, active LED | Latching bypass with a short stereo crossfade. LED lit while filtering is enabled, including at noon. |
| L/R in, L/R out | ±5 V audio, 0 V normal. The rack normals open R to L. A patched silent right input remains silent. Each side has independent filter memory. |
| Master, LP, HP, Tilt, Res in | Five bipolar ±5 V CV jacks, all buffers normal to 0 V. LP and HP have the switchable internal voltage described above. |

## Model and assumptions

Use separate two-pole trapezoidal state-variable LP and HP sections in series on each channel. Exponential cutoff travel is useful across both bass and percussion. A short blend at the center detent brings each filter into circuit continuously. Smooth panel edits and bypass transitions, retain sample-wise cutoff CV, and constrain cutoff below Nyquist. Soft-limit a resonant peak to ±5 V while preserving dry samples everywhere on the nominal rails. Reset clears all four filter memories, outputs and input buffers. The original resonance stays stable without self-oscillation. WMD publishes the master CV range and switch functions, and leaves the pole count, cutoff law, maximum Q and tilt offset unspecified. The numerical choices above and mono-to-stereo normal are rack adaptations. [WMD panel guide](https://wmdevices.com/pages/overseer) · [Andrew Simper, Cytomic, trapezoidal SVF, 2014–16](https://cytomic.com/files/dsp/SvfLinearTrapezoidalSin.pdf)

Erica's alternative uses 24 dB/octave filters and can self-oscillate above roughly one o'clock on Resonance. That topology would add a pitched tone to the quiet part of a drop. This module follows the Overseer's bounded resonance. Contemporary coverage identifies both stereo tilt and the performance bypass as distinct features. [Ģirts Ozoliņš, Erica Synths, DJ VCF Stereo manual](https://www.ericasynths.lv/media/DJVCFS_Manual.pdf) · [Chris Meyer, NAMM 2017 booth report](https://www.linkedin.com/pulse/modular-namm-20176-wmd-4ms-make-noise-chris-meyer)

## Implementation Plan

- Put `dj-filter` in `filter` on branch `module/dj-filter` in `.worktrees/dj-filter`. Use the shared panel and port contract with stable worklet buffers.
- Persist `sweep`, `resonance`, `tilt`, `lpAmount`, `hpAmount`, `limit`, `tiltRoute`, `offset` and `bypass`. Expose `inL`, `inR`, `masterCV`, `lpCV`, `hpCV`, `tiltCV`, `resCV`, `outL`, `outR` and the `active` LED.
- **Test - Stereo DJ Filter** puts different harmonically rich voices on each side. It opens at center and lets a performer sweep, tilt and return to dry while both voices play.
- Write `tests/dsp/dj-filter.test.js` first. Compare low/high tone gains for both sweep directions and both limit settings. Test CV against the equivalent knob move, resonance at cutoff, stereo tilt and routing, simultaneous HP/LP, silence, unplug/replug, bypass, reset and stable finite buffers.
- Validate the focused tests, module and patch contracts, Bend rack laws, six strict-voltage configurations and full `npm test`. Check the actual demo at stereo OUT in Chromium.

Sources consulted 2026-11-25.

## DSP Audit (2026-11-25)

All 19 scenarios passed at 44.1, 48 and 96 kHz with 128- and 512-frame blocks. Both outputs stayed within ±5 V and retained their buffer identities. In the limited range, the LP endpoint passed more than 90% of an 80 Hz tone and less than 2% of a 4 kHz tone. The HP endpoint passed more than 90% at 8 kHz and less than 2% at 80 Hz. A patch saved in Bypass returned its exact dry samples from frame one. [Filter response and switching tests](../../tests/dsp/dj-filter.test.js)

At 48 kHz, Chromium captured independent left and right audio on the demo and switched bypass from the panel while the patch ran. [Browser test](../../tests/e2e/composition-modules.spec.js)
