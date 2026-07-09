# Eurorack Module Queue Workflow

Use this reference when processing a Eurorack module from `research/module-queue.md`.

## Prompt Template

Replace `{moduleId}` with a specific queued module ID, or leave it as `next` to choose the first low-risk `candidate`.

```text
Process `{moduleId}` from the Eurorack module queue end to end. If `{moduleId}` is `next`, choose the first low-risk `candidate` in `research/module-queue.md`.

Follow `AGENTS.md`, `docs/creating-modules.md`, `research/README.md`, and `research/module-queue.md`.

Use subagents working in isolated workspaces:
- Use high reasoning effort for the coordinator and every subagent. When launching subagents, request the highest available reasoning effort/model setting for research, implementation, and validation work.
- Act as the coordinator in the current workspace. Keep ownership of queue status updates, final integration, validation, and the final response.
- Start a research subagent in a dedicated research workspace or worktree for source gathering and spec drafting. Recommended branch/worktree: `research/{moduleId}` at `../eurorack-js-{moduleId}-research`.
- Start an implementation subagent only after the queue row is `spec-ready`. Use a separate implementation workspace or worktree. Recommended branch/worktree: `module/{moduleId}` at `../eurorack-js-{moduleId}`.
- Start a validation/review subagent after implementation to inspect the diff, check docs/patch/manifest consistency, and run or recommend focused validation.
- Subagents may work in parallel only where the gates allow it. Research may parallelize source collection, but implementation must not begin until the coordinator confirms the research doc is complete and the queue row is `spec-ready`.
- Keep shared framework changes separate from module implementation unless the research doc's Implementation Plan explicitly requires them.
- If worktrees cannot be created because of permissions or environment constraints, request approval/escalation. If the user explicitly says to work in the current workspace, document that in the Implementation Plan and continue there.

Hard requirements:
- Do not implement before research is complete and the queue row is `spec-ready`.
- Use web research for source gathering. If network access is unavailable, request approval/escalation. If reliable citations cannot be collected, mark the queue item `blocked` and stop before implementation.
- Create or update `research/modules/{moduleId}.md` with cited sources. Include primary sources, reviews/demos, historical/context sources when useful, DSP references, observed behavior, contradictions, assumptions, panel contract, voltage contract, DSP plan, and test targets.
- Update `research/module-queue.md` as the module moves through `researching`, `spec-ready`, `implementing`, and `done` or `blocked`.
- Add an `Implementation Plan` section to the research doc before writing module code. Include module ID, category, branch/worktree or workspace path, DSP model, params, inputs, outputs, LEDs, factory patch needs, focused tests, full validation command, and known assumptions.
- Write `tests/dsp/{moduleId}.test.js` before or alongside implementation, covering initialization, voltage/output ranges, params, CV/audio/gate/trigger behavior, reset, LEDs, and buffer integrity.
- Implement `src/js/modules/{moduleId}/index.js` as a self-contained module with metadata, `createDSP()`, and declarative/custom UI.
- Register the module in `src/js/rack/module-manifest.js` with `{ id: '{moduleId}', load: () => import('../modules/{moduleId}/index.js') }`. The module definition owns `category`.
- Update `AGENTS.md`, `README.md`, and `docs/creating-modules.md` if the module adds a new module, pattern, category guidance, or workflow detail.
- Create a factory test patch at `src/js/config/patches/test-{moduleId}.js` that demonstrates the module connected to audible or visible output.
- Import that patch in `src/js/config/patches/index.js` and add it to `FACTORY_PATCHES` so it appears in the app dropdown.
- Use exact port names from each module definition's `ui.inputs[]` and `ui.outputs[]`; do not guess cable ports.
- Keep unrelated changes out of the module work. Do not revert user changes.

Coordinator workflow:
1. Intake: read the queue and choose the target. Confirm the candidate is distinct and low-risk when `{moduleId}` is `next`.
2. Workspace setup: create or assign the research workspace/worktree and launch the research subagent with high reasoning effort.
3. Research gate: review the research subagent's citations and spec. If complete, update the row to `spec-ready`; if not, request more research or mark `blocked`.
4. Implementation setup: create or assign the implementation workspace/worktree, add the Implementation Plan to the research doc, update the row to `implementing`, and launch the implementation subagent with high reasoning effort.
5. Integration: bring implementation changes into the coordinator workspace, resolving only the module-related files.
6. Review/validation: launch a validation/review subagent with high reasoning effort or perform the review directly. Fix any issues found.
7. Completion: run all required validation. Only after full validation passes, update the row to `done`.

Validation:
- Run `npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Run `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Run `npm test` before marking the queue row `done`.

Final response:
- Summarize subagents/workspaces used.
- Summarize sources researched.
- Summarize files changed.
- Summarize module behavior.
- State the factory test patch name.
- State focused and full validation results.
- If blocked, state the exact missing source, contradiction, failing test, permission issue, or architecture issue and leave the queue row as `blocked`.
```

## Research Gate Checklist

Before moving the row to `spec-ready`, confirm that `research/modules/{moduleId}.md` includes:

- Primary sources, plus reviews/demos and historical or context sources when useful.
- DSP references or comparable implementation references.
- Observed behavior, contradictions, assumptions, and source-quality notes.
- Full panel contract: params, switches, buttons, inputs, outputs, LEDs, and normalization behavior.
- Voltage contract translated into the app's standards.
- DSP plan and trade-offs.
- Test targets for initialization, ranges, params, CV/audio/gate/trigger behavior, switches/modes, LEDs, reset, and buffer integrity.

## Implementation Plan Checklist

Add this section before writing module code:

- Module ID and category.
- Branch/worktree or workspace path.
- DSP model and known assumptions.
- Params, inputs, outputs, LEDs, and factory patch needs.
- Focused test command and full validation command.
- Any shared framework changes required by the implementation.
