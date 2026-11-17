# Four vocal club sketches

Original composition, 17 November 2026. Research precedes patch construction.
The requested inspiration is Creepy Nuts. The musical idea is a late-night
doorway: a beatbox knocks, a low hum answers, a higher vocal hook opens up, and
a spoken invitation completes the idea. The user chose four separate patches.
Each has its own complete arrangement and one featured vocal module. No source
recording, lyrics or melody is copied.

## Research and decisions

- TV Asahi / EIGHT-JAM, [Creepy Nuts production interview](https://post.tv-asahi.co.jp/post-245704/),
  18 March 2024; accessed 17 November 2026. Matsunaga describes a Latin-flavoured
  riff combining harpsichord, kalimba and piano over a five-kick Jersey-club
  groove, then exchanging drafts with R-Shitei. Adopt the rhythmic foundation,
  a bright plucked motif, and clear space for vocal replies.
- Sean D / LiFTED, [The super eclectic sounds of Creepy Nuts](https://liftedasia.com/ja/articles/creepy-nuts),
  19 February 2025; accessed 17 November 2026. First-person interview confirms
  the Jersey-club/Latin starting point and describes making space for rap and
  using instrumental sections as scene transitions. Each patch leaves room
  around its foreground voice and gives the plucked motif an answering role.
- Tim Cant / Native Instruments, [How to make a Jersey club track](https://www.native-instruments.com/blogs/blog/jersey-club),
  22 September 2023; accessed 17 November 2026. The production tutorial gives
  five kick attacks at sixteenths 1, 5, 9, 12, 15 and recommends tight leads,
  limited reverb and headroom. Adopt the general five-hit rhythm at approximately
  140 BPM. Melody, drum additions and section structure are original decisions.

These are documented production references, not a claim to have auditioned
the linked videos in this session. This is an instrumental/vocal-machine
adaptation, not a reconstruction of either artist's voice or a Japanese rap.
SPEECH currently prepares English only.

## Composition contract

- D minor/pentatonic centre. A short bright motif ties the sections together.
- **Neon Knock / BEATBOX:** approximately 140 BPM, interlocking lip-kick,
  tongue-tick and Pf attacks against the five-kick foundation. A four-way
  parallel gain mixer makes the physical percussion audible beside the drums.
- **Low Answer / BEATBOX PRO:** approximately 135 BPM, a two-bar phrase uses
  all ten physical sounds. Two sound sequencers alternate through an external
  sequential switch; the rhythm leaves a quarter-note space for each Hum.
  A separate gesture lane changes decay, mouth shape and noise, while the
  pitch lane and attack bend retain the low answering motif. PRO Env lightly
  moves the plucked answering voice's excitation position.
- **Neon Chant / VOCAL:** approximately 143 BPM, a female tract at D4 with
  M/N/W closures opening into vowels. A held breath connects the melody;
  external 85 ms articulations give it rhythmic syllables without clip resets.
- **Midnight Caller / SPEECH:** approximately 140 BPM. Original text:
  "Knock twice. Step inside. We move after midnight." A four-bar trigger
  preserves whole phrases. Alternate takes are faster and three semitones
  higher via external Rate/Pitch CV; the mallet reply waits for Busy to fall.
- Conventional kick, snare and hat keep the groove recognizable through the
  changes. No long wash or dense harmony covers the articulation.
- External clocks, sequencers and gate lengths supply the rhythm. No hidden
  voice mode, internal song transport or sample playback is added to the modules.
- PRO uses the actual Hum sound so its voiced controls have an audible source.
  VOCAL uses a small
  lit consonant pool, continuous breath during its section and external release
  articulation. SPEECH completes whole words with Finish retrigger behavior.
- Each instrument has a separate mix level. Keep final output below clipping.

## Implementation and verification plan

Read actual UI contracts and DSP timing before generating the patch. SEQ
advances before its first clocked output; PROB SEQ evaluates step one first.
Use conditional half-bars to express the 16-step kick pattern with eight steps.
Preserve full speech gesture precision through the shared URL codec.

Save JSON, editable workbench source, a validated local URL, render and measured
results under `compositions/`. Render the decoded snapshot through compileGraph;
verify each featured source sounds prominently, rhythm counts, finite output,
no clipping and repeatable phrase boundaries. Check all four real AudioWorklet
patches and profile them independently. The separate arrangements also avoid
stacking four expensive physical voice models in one audio callback.

## Completed verification

All four patches passed strict v3 normalization, shared-URL round trips and
editable workbench compilation. The prepared SPEECH gestures retain their full
numeric precision. Every graph has zero feedback edges and unique input
destinations. The five-kick pattern was measured at sixteenths 1, 5, 9, 12, 15.

Each decoded patch was rendered for 22 seconds at 48 kHz / 128 samples through
the production graph and independently played in Chromium's real AudioWorklet
for three seven-second output captures. All four browser tests passed with no
page errors, non-finite samples or clipped output. Screenshots were inspected.

| Patch | Actual BPM | Offline peak, full scale | Offline RMS | Browser block p99 |
| --- | ---: | ---: | ---: | ---: |
| Neon Knock | 139.99 | 0.4504 | 0.0448 | 2 ms |
| Low Answer (revised) | 135.24 | 0.6048 | 0.0608 | 2 ms |
| Neon Chant | 143.25 | 0.3220 | 0.0598 | 2 ms |
| Midnight Caller | 139.99 | 0.4839 | 0.0543 | 2 ms |

The measured callback deadline was 2.667 ms. Timing is specific to this machine
and uses the browser profiler's millisecond resolution. These signal and runtime
checks do not substitute for a human listening judgment.

SPEECH starts at 1.714, 8.572 and 15.430 seconds. Its alternating deliveries last
3.854, 2.769 and 3.854 seconds, leaving space before each new trigger. Busy gates
off the mallet's triggers until the spoken phrase finishes.

The `compositions/` directory contains a JSON patch, exact shared URL, editable
workbench text, stereo WAV preview, screenshot, offline measurements and browser
profile for each sketch. `vocal-club-patches.json` indexes the four patches.

## Playing the sketches

Start one patch at a time. The top row supplies the groove, the middle row
features its vocal instrument, and the bottom row contains the mallet answer,
short effects and output mix.

- **Neon Knock:** change Shape, Snap and Pressure; its adjacent SEQ selects the
  mouth sounds. The following MIX supplies gain for the quieter physical hits.
- **Low Answer:** the two sound SEQs alternate bars. The gesture SEQ controls
  Decay/Shape directly and Noise through an inverted attenuator; its second
  attenuator channel changes lip geometry. Hum Voice, Hum Tension and Hum Fry
  operate during the longer Hum answers. FUNC and its pitch MIX set attack bend.
- **Neon Chant:** change the lit sound pool, Release, Morph and the tract controls.
  The two GATE DELAY channels provide held breath and short articulation gates.
- **Midnight Caller:** edit the text and press Apply. The two-step delivery SEQ
  alternates Rate and Pitch CV; leave Finish enabled to preserve whole phrases.

## Low Answer audition correction — 17 November 2026

User feedback: "Low Answer doesn't show off the module only playing one sound".
The first version was too narrowly focused on Hum. Replace it with this
two-bar eighth-note phrase, keeping a rest after each Hum:

| Bar | 1 | & | 2 | & | 3 | & | 4 | & |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | B | t | Pf | ! | m | rest | ^K | P! |
| B | B | tss | K | t | m | rest | kch | ! |

The recipes and names come from the vendored CHIMERA beatbox source cited in
`research/modules/beatbox-pro.md`. Sound CV selects `floor(knob + 2 × volts)`;
use addresses at the centre of each bin. SEQ supplies up to 4 V, so the sound
MIX scales by 1.25 to reach the entire bank. Both bars start on B, avoiding a
wrong sound at the sequential switch's brief crossfade. Wrap remains enabled.
Reduce conventional backing drums and the mallet answer so the varied mouth
sounds remain the foreground. Revalidate actual triggered indices, per-sound
signal energy, CV ranges, headroom and real-browser output before delivery.

Correction verified: the 22-second render contains 87 hits and repeats the
exact intended 14-hit / two-bar pattern. All ten sound indices trigger, with
nonzero per-sound voice energy (RMS 0.060–0.202 V over each sound's time slices).
Sound CV spans centred addresses through 4.75 V. The gesture lane spans
0.08–3 V, Noise CV -1.5 to -0.04 V, and Lips CV -0.48 to +0.25 V.
The browser independently observed every sound index 0–9 through live worklet
telemetry while capturing 21 seconds of finite, unclipped output. Its focused
test passed; p99 block time remains 2 ms. JSON, code, URL, WAV, screenshot and
measurement files now describe this revision. The other three patches are
unchanged. The four-way gain MIX deliberately saturates brief high-amplitude
click transients; final output retains approximately 4.4 dB of headroom.
