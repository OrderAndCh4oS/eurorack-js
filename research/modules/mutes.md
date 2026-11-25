# Performance Mutes

Four drum, bass and vocal stems can keep running while their audio comes in and out at bar boundaries. DivKid and Befaco's original 4 HP Mutes uses four independent vactrols and three-position toggles. One side of the switch springs back to the muted center. The other stays open. Unpatched inputs follow the signal at the input above, so the same stem can also feed several independently switched sends. The original module is 32 mm deep and draws 20 mA on +12 V. [Befaco, original Mutes panel and specs](https://www.befaco.org/mutes/) · [DivKid, original design notes and demos, 2018](https://divkidvideo.com/mutes/)

## Panel and voltage contract

| Rack element | Operation |
| --- | --- |
| On 1–4 | Four independent latched pass switches. Default open for inline use. Switch off for a muted resting position. |
| Hold 1–4 | Spring-return actions. From Off, press to pass the signal and release to mute. A latched On remains open after release. |
| In 1–4 | DC-coupled `any` jacks (±10 V), buffer normal 0 V. Input 1 defaults to silence. Empty inputs 2–4 take the preceding effective **input**, before its mute. A cable carrying 0 V breaks the chain at that jack. |
| Mute 1–4 | EurorackJS addition. A level at or above 1 V closes that channel regardless of On or Hold. A low gate restores the current panel selection. Nominal 0/10 V, unpatched 0 V. |
| Out 1–4, signal LEDs | Independent DC-coupled ±10 V outputs. Each LED shows the magnitude of that channel's output, including held DC, with a short display decay. |

## DSP and evidence

The circuit uses an optical attenuator per signal. DivKid cautions that physical vactrol tolerances affect pitch CV. Mylar Melodies demonstrates performing with a pair of modules and Robin Vincent's build identifies the individual vactrols. The analog response has a faster attack and a softer release. The software uses a one-pole gain envelope with 3 ms opening and 12 ms closing time constants. These are chosen musical values. The VTL5C1 data sheet uses different resistance targets for its turn-on and turn-off measurements, so its quoted milliseconds cannot directly specify a digital gain constant. Digital gain settles to exact unity or zero within a small tolerance, preserving pitch CV when fully open. A short trigger routed through a signal channel also acquires the envelope. [Befaco, v1.2 circuit diagram](https://www.befaco.org/docs/Mutes/Mutes_V1_2_Schematic.pdf) · [DivKid, designer's pitch-accuracy note and Mylar Melodies demo](https://divkidvideo.com/mutes/) · [Robin Vincent, Molten Modular DIY 05, 2019](https://www.youtube.com/watch?v=LaFtUo9Rv_o) · [PerkinElmer, VTL5C1 data sheet](https://www.farnell.com/datasheets/87223.pdf)

Track jack connectivity via the graph's topology hooks. Derive a per-channel gain target each sample so a gate can close midway through a block. Use a separate release for the LED. The DSP requires four gains, four meters and fixed-size port buffers. Reset selects the gains for the stored latches and clears samples and transient actions. [Rack port and action contracts](../../docs/architecture.md#port-contract)

## Implementation Plan

- Implement `mutes` in `utility`, branch `module/mutes`, worktree `.worktrees/mutes`. Use four `onN` switches and four `holdN` momentary actions. Number `inN`, `muteN`, `outN` and `levelN` from 1 through 4.
- Keep the four rows easy to operate from the panel. The two browser controls reproduce the latched/off and momentary gestures. LEDs report the audio/CV passing each channel.
- **Test - Performance Mutes** runs a kick and hat on separate stems. A slow square wave takes out the hat for alternate phrases. The musician can mute the kick and punch it back in by hand.
- Write `tests/dsp/mutes.test.js` before implementation. Cover all four latches, Hold press/release, simultaneous gate priority, subthreshold and exact-threshold samples, negative DC, cascade around a muted stem, a connected silent jack and disconnect. Measure the 3/12 ms envelopes at two sample rates, stable buffers, finite rails, LED level and reset.
- Run the focused DSP, rack and patch contracts, `npm run laws:check`, the strict voltage matrix, `npm test`, and a browser check of the playing demo.

Sources consulted 2026-11-25.

## DSP Audit (2026-11-25)

All 13 scenarios passed at 44.1, 48 and 96 kHz with 128- and 512-frame blocks. A separate DC fixture passed −10 V and +10 V unchanged through a settled open channel. A saved closed switch or an already-high mute gate yielded silence from frame one. The 44.1 and 96 kHz envelope measurements matched the 3 ms opening and 12 ms closing time constants. Plugging 0 V into a normalled input silenced the downstream copy independently of the upstream latch. [DSP tests](../../tests/dsp/mutes.test.js)

The Chromium demo captured audio on both outputs with the stems open and measured silence with both closed. Each of the twelve jacks has a separate pointer target at normal zoom. [Browser test](../../tests/e2e/composition-modules.spec.js)
