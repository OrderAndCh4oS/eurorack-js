# Codex Module Queue Command

Use this prompt when you want Codex to process one queued module from research through implementation.

Replace `{moduleId}` with a specific queued module ID, or leave it as `next` to let Codex choose the first low-risk candidate.

```text
Process `{moduleId}` from the Eurorack module queue end to end. If `{moduleId}` is `next`, choose the first low-risk `candidate` in `research/module-queue.md`.

Follow `AGENTS.md`, `docs/creating-modules.md`, `research/README.md`, and `research/module-queue.md`.

Hard requirements:
- Do not implement before research is complete and the queue row is `spec-ready`.
- Use web research for source gathering. If network access is unavailable, request approval/escalation. If reliable citations cannot be collected, mark the queue item `blocked` and stop before implementation.
- Create or update `research/modules/{moduleId}.md` with cited sources. Include primary sources, reviews/demos, historical/context sources when useful, DSP references, observed behavior, contradictions, assumptions, panel contract, voltage contract, DSP plan, and test targets.
- Update `research/module-queue.md` as the module moves through `researching`, `spec-ready`, `implementing`, and `done` or `blocked`.
- Add an `Implementation Plan` section to the research doc before writing module code.
- Write `tests/dsp/{moduleId}.test.js` before or alongside implementation, covering initialization, voltage/output ranges, params, CV/audio/gate/trigger behavior, reset, LEDs, and buffer integrity.
- Implement `src/js/modules/{moduleId}/index.js` as a self-contained module with metadata, `createDSP()`, and declarative/custom UI.
- Register the module in `src/js/rack/module-manifest.js` with `{ id: '{moduleId}', load: () => import('../modules/{moduleId}/index.js') }`. The module definition owns `category`.
- Update `AGENTS.md`, `README.md`, and `docs/creating-modules.md` if the module adds a new module, pattern, category guidance, or workflow detail.
- Create a factory test patch at `src/js/config/patches/test-{moduleId}.js` that demonstrates the module connected to audible or visible output.
- Import that patch in `src/js/config/patches/index.js` and add it to `FACTORY_PATCHES` so it appears in the app dropdown.
- Use exact port names from each module definition's `ui.inputs[]` and `ui.outputs[]`; do not guess cable ports.
- Keep unrelated changes out of the module work.

Validation:
- Run `npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Run `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Run `npm test` before marking the queue row `done`.

Final response:
- Summarize sources researched, files changed, module behavior, test patch name, and validation results.
- If blocked, state the exact missing source, contradiction, failing test, or architecture issue and leave the queue row as `blocked`.
```

Example:

```text
Process `matrix` from the Eurorack module queue end to end. If `matrix` is `next`, choose the first low-risk `candidate` in `research/module-queue.md`.

Follow `AGENTS.md`, `docs/creating-modules.md`, `research/README.md`, and `research/module-queue.md`.

Hard requirements:
- Do not implement before research is complete and the queue row is `spec-ready`.
- Use web research for source gathering. If network access is unavailable, request approval/escalation. If reliable citations cannot be collected, mark the queue item `blocked` and stop before implementation.
- Create or update `research/modules/matrix.md` with cited sources. Include primary sources, reviews/demos, historical/context sources when useful, DSP references, observed behavior, contradictions, assumptions, panel contract, voltage contract, DSP plan, and test targets.
- Update `research/module-queue.md` as the module moves through `researching`, `spec-ready`, `implementing`, and `done` or `blocked`.
- Add an `Implementation Plan` section to the research doc before writing module code.
- Write `tests/dsp/matrix.test.js` before or alongside implementation, covering initialization, voltage/output ranges, params, CV/audio/gate/trigger behavior, reset, LEDs, and buffer integrity.
- Implement `src/js/modules/matrix/index.js` as a self-contained module with metadata, `createDSP()`, and declarative/custom UI.
- Register the module in `src/js/rack/module-manifest.js` with `{ id: 'matrix', load: () => import('../modules/matrix/index.js') }`. The module definition owns `category`.
- Update `AGENTS.md`, `README.md`, and `docs/creating-modules.md` if the module adds a new module, pattern, category guidance, or workflow detail.
- Create a factory test patch at `src/js/config/patches/test-matrix.js` that demonstrates the module connected to audible or visible output.
- Import that patch in `src/js/config/patches/index.js` and add it to `FACTORY_PATCHES` so it appears in the app dropdown.
- Use exact port names from each module definition's `ui.inputs[]` and `ui.outputs[]`; do not guess cable ports.
- Keep unrelated changes out of the module work.

Validation:
- Run `npm test -- tests/dsp/matrix.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Run `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Run `npm test` before marking the queue row `done`.

Final response:
- Summarize sources researched, files changed, module behavior, test patch name, and validation results.
- If blocked, state the exact missing source, contradiction, failing test, or architecture issue and leave the queue row as `blocked`.
```
