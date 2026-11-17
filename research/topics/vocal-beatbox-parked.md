# Vocal and beatbox experiments — parked

Parked at the user's request on 17 November 2026.

Branch: `archive/vocal-beatbox-experiments`.
Base: `main` at `610ce95`.

This branch preserves VOCAL, SPEECH, BEATBOX and BEATBOX PRO, their shared
CHIMERA physical-model engine, the English text planner, source provenance,
committed WASM assets, tests, research, patches and audition renders.

The user judged the modules weak after audition and asked to leave the work
on a pushed branch. Earlier feedback included disjointed articulation, controls
with little audible effect and a Pro example that demonstrated only Hum.
The revised Low Answer example covers all ten sounds, but the overall result
still did not justify shipping these modules. Development is stopped.

Numerical validation establishes signal integrity and contract behavior;
it does not establish musical usefulness, speech naturalness or intelligibility.
Historical passing tests and measurements are retained as evidence, not release
approval. Multiple concurrent physical voices also remain a performance concern.

There is no merge or deployment request. Keep this work off `main` unless the
user explicitly decides to revisit it. No further work is scheduled.

## Recovering the snapshot

Check out this branch, install the existing package dependencies if needed,
then run `npm run build` and `npm run dev`. Normal builds validate the committed
native artifacts; Rust is needed only to regenerate them.

`compositions/` includes the final musical sketches, earlier audition patches,
editable workbench text, shared-URL files, WAV previews and measurements.
The URLs target the local development server used during the session. The
JSON and workbench sources are the durable patch artifacts; temporary `dist/`
redirect pages are not part of this archive.

The four module research documents and `research/compositions/neon-knock.md`
describe the final panel contracts, musical routing, known limitations and
validation history. Unrelated compositions in the working checkout were
deliberately excluded from this archive commit.
