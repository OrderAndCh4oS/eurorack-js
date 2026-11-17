# Mouth Music

Revised 2026-11-17 after the original sounded like “disjointed clips,” then
adapted to the user-requested separate VOCAL and BEATBOX modules.

The current composition uses VOCAL for an eight-step phrase at approximately
84 BPM. Pitch and vowel sequences share one clock. A retriggered 777 ms Gate
maintains airflow across the approximately 357 ms step interval. Pitch and
vowel CV have 20 ms and 50 ms external slew. Selected steps produce 95 ms
pressure accents, scaled to 0–0.8 V and smoothed over 30 ms, adding up to
3.2 cmH2O to the 6 cmH2O baseline.

The same external accent envelope is attenuated to 0–5 V and slewed over
20 ms into Artic. It closes an M consonant, then releases into the running
vowel. Articulation changes physical mouth targets without replacing its
state. Consonant selection remains on the VOCAL panel. No percussion module
or hidden phrase sequencer participates in this patch.

Melody: E3 E3 G3 F#3 / E3 E3 A3 F#3. Rounded O/U postures open toward A/E.
Short quiet room reverb is the only effect; output level is .32.

## Files

- `compositions/Mouth Music.txt`: editable workbench source.
- `compositions/mouth-music.json`: validated v3 patch with resolved defaults.
- `compositions/mouth-music-url.txt`: local snapshot URL (normal compact URL rounding).
- `compositions/mouth-music.wav`: ten-second stereo preview of the decoded URL.
- `compositions/mouth-music-measurements.json`: production graph measurements.
- `compositions/mouth-music-original/`: earlier arrangement adapted to separate
  VOCAL/BEATBOX paths and an explicit mixer; screenshot is historical.

## Verification

The compiler accepts ten modules and nineteen cables without warnings or
feedback. A ten-second production graph/WASM render at 48 kHz/128 frames loads
the decoded snapshot. Vocal Gate has zero falls; articulation spans 0–.989.
Output peak is .180 or less, RMS approximately .042–.043. Dry and stereo output
are finite with no full-scale samples. These establish continuity and signal
integrity, not a subjective listening judgment.

See [Vocal](../modules/vocal.md), [Beatbox](../modules/beatbox.md), and
[the original adapter research](../topics/airway-prototype.md).
