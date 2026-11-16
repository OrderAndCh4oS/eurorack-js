# Offset

Created and measured locally on 16 November 2026.

Two plucked sequences over a low bass line, with chorus and reverb. The phrases run at different speeds and lengths.

- [Patch script](patch.js): paste into the app's Code editor, validate and apply.
- [Patch state](patch.json): final version 3 state, 18 built-in modules and 30 cables.
- [Local snapshot URL](snapshot-url.txt): opens a self-contained copy on the local server at port 4189.
- [Rack screenshot](rack.png).

The finished patch is also saved as **Offset** in the local Chrome profile used for this session. Its browser-specific link is <http://127.0.0.1:4189/#local=01M7GVPWEKX93VW14S5BR48AVY>. This requires the same profile and local server. Playback is stopped; press Start to play.

## Composition

A five-step upper plucked phrase runs against an eight-step lower phrase at half speed. A four-step bass sequence runs at quarter speed. The notes use D minor pentatonic; the main clock supplies eighth notes at approximately 112 BPM. The sequencer alignment repeats after 80 clock events, about 21.4 seconds, while a slow LFO continues changing the plucked voices' damping and position.

The sequencing reference is Make Noise's [René manual](https://www.makenoisemusic.com/wp-content/uploads/2024/03/renemanual.pdf), overview on page 7, accessed 16 November 2026: independently clocked channels can create related sequences with different timing. This patch adapts that idea using the app's CLK, DIV and SEQ modules; it does not emulate René.

## Measurement-guided adjustments

The initial version put 71–74% of left-channel spectral energy and 82–84% of right-channel energy below 250 Hz. Stereo correlation was 0.90–0.93. I reduced the bass VCA and mixer levels, and added dry plucked voices to their respective sides alongside the shared chorus/reverb path.

An intermediate version made the left channel 3.76–4.36 dB louder than the right, so I reduced the left dry and effects sends. The final left/right RMS difference is 0.70–0.92 dB. The original version was already closely balanced in level; the intended change from that baseline is less bass dominance and greater channel separation.

| Measurement | Initial version | Final version |
| --- | --- | --- |
| Integrated LUFS per capture | −27.47 to −27.33 | −26.40 to −25.86 |
| Stereo correlation | 0.90–0.93 | 0.58–0.68 |
| Energy below 250 Hz, left | 71–74% | 44–52% |
| Energy below 250 Hz, right | 82–84% | 66–72% |
| Highest estimated true peak | −13.60 dBTP | −8.89 dBTP |
| Full-scale output samples | 0 | 0 |

Each version has three separate eight-second captures at 48 kHz, with short gaps between captures. These are window measurements, not integrated measurements of an uninterrupted 24-second performance. Raw reports include the exact patch state, capture metadata and analysis implementation version in [measurements](measurements/). `balanced-*` records the intermediate, left-heavy trial; `final-*` records the finished patch.

## End-to-end checks

`session.mjs` invokes Chrome's native WebMCP tools over CDP. It discovers and uses `get_rack`, `validate_script`, `apply_draft`, `debug_rack` and `measure_audio`. The measurements run through the actual AudioWorklet → Worker → Rust/WASM path, without replacing tool registration or uploading audio.

Four temporary variants of the musical patch were captured for four seconds each. Assertions passed, and an independent read-only check of the saved reports confirmed them:

| Variant | Expected and observed |
| --- | --- |
| Same signal to both outputs | Correlation +1, zero side RMS, identical channel levels and spectra |
| Inverted right channel | Correlation −1, zero mid RMS, equal RMS/peaks and opposite DC offsets |
| Right channel at half gain | −6.0205999 dB RMS difference, correlation +1, side/mid energy ratio 1/9, unchanged spectral centroid |
| Muted OUT | Zero peak/RMS/DC/true-peak estimate, no active spectral frames, undefined loudness/correlation reported as `null` |

The stereo patch was restored and saved through the app. Reopening its local link reproduced the measured patch state exactly. `debug_rack` reported no issues. The local save dialog does not expose a description field; use the short description above when saving to an account.

These checks demonstrate useful measurement relationships and mix changes. They do not independently certify spectral, LUFS or true-peak accuracy. No subjective listening assessment was made. Capture occurs after final output processing, so it cannot rule out upstream clipping or invalid samples that were already sanitized.

## Repeating the session

The runner expects the built app at `http://127.0.0.1:4189/` and an experimental Chrome with native WebMCP and CDP at port 9237. It keeps its own tab ID in a temporary file and leaves other tabs alone. Browser access may require local sandbox permission.

```sh
node compositions/offset/session.mjs init
node compositions/offset/session.mjs trial new-capture
node compositions/offset/session.mjs verify
node compositions/offset/session.mjs open-saved
```

`trial` applies the current source and records three eight-second windows. `verify` applies the diagnostic variants, checks their reports, then restores and saves the stereo version. Neither command publishes the patch. Existing report labels are overwritten when reused.
