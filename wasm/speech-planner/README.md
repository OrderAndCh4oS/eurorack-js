# Speech preparation

English text is prepared in a Worker using pinned CHIMERA pronunciation and
articulatory planning. The returned JSON contains sparse gestures for two
calibrated bodies; it contains no audio. The AudioWorklet never runs this crate.

The `data/cmudict.txt.gz` dictionary and `data/CMUDICT-LICENSE.txt` come from
CHIMERA commit `24bd2e4ee4accf7b27d57d8bf912472880dff9f7`, under `public/data`.
The asset builder fingerprints this crate, the dictionary, and vendored engine.
Run `npm run build:speech` after changes and retain generated license notices.
