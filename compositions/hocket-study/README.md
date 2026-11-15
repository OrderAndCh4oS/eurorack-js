# Hocket Study

Two plucked voices trade notes over a seven-note sequence, with slow tone modulation and stereo reverb.

**HOCKET** routes each clock pulse to A or B. Pattern selects one of four eight-step routes; Rotate shifts the route; Swap exchanges the outputs. The melody and routing repeat together after 56 clock events.

## Try the demo

Import `hocket.mjs` through **Code → Modules → Import own module**, name it **HOCKET**, then select **Save** and **Use module**. The custom module appears under **Your modules**. Replace `HOCKET_TYPE` in `patch.js` with the immutable runtime type assigned to the imported module, available from WebMCP's `get_rack` or the current patch's code. Validate and apply that composition, then press **Start**.

Save the patch to **This browser**. Both the patch and its module revision belong to that browser profile; a local patch link will not load them on another device.

## Source backups

- `hocket.mjs`: self-contained module source; import through **Code → Modules → Import own module**, then **Save** and **Use module**.
- `patch.js`: portable composition source. Replace `HOCKET_TYPE` with the immutable runtime type assigned to your imported module.
- `session.mjs`: demonstration client for Chrome's native WebMCP CDP interface. Uses a dedicated tab and writes ignored local results alongside the source.

## Native WebMCP demonstration

The runner was exercised with Chrome 157.0.8103.78 and experimental WebMCP enabled. It expects a dedicated Chrome profile with remote debugging on `http://127.0.0.1:9237` and opens the production app at `https://eurorackjs.orderandchaos.xyz/`. Dependencies come from the repository's `npm install`.

Run these commands from the repository root, in order:

```sh
node compositions/hocket-study/session.mjs init
node compositions/hocket-study/session.mjs import
node compositions/hocket-study/session.mjs validate
node compositions/hocket-study/session.mjs apply
node compositions/hocket-study/session.mjs play
node compositions/hocket-study/session.mjs measure
node compositions/hocket-study/session.mjs save
node compositions/hocket-study/session.mjs reload
node compositions/hocket-study/session.mjs verify
```

`play` starts sound. `verify` checks the reopened patch's worklet and leaves playback stopped. Generated session IDs, resolved patch files, measurements and screenshots stay local. Re-importing in another browser creates a new immutable module type.

## Verification

87 focused DSP tests passed, covering patterns, rotation, swapping, thresholds, pulse timing, reset, buffers and LEDs at three sample rates. Native WebMCP validated and applied the patch with no wiring warnings. Live output measurements and save/reload verification passed; results are recorded in the research notes below. The runner writes raw evidence locally when used.

Module import and saving used the app's UI. The current WebMCP tools inspect modules and compose patches; they do not author modules or save patches. No account/public patch or built-in module was added.

Research, electrical contract and implementation plan: [Hocket local prototype](../../research/local-modules/hocket.md).
