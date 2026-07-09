---
name: queue-module-processor
description: Coordinate queue-item work with high-effort subagents in isolated workspaces. Use when asked to process a queue item end to end, enforce research/spec/implementation/validation gates, or adapt a repo-specific queue workflow such as the Eurorack module queue.
---

# Queue Module Processor

## Workflow

Use this skill when a user asks to process an item from a queue or backlog through research, specification, implementation, review, validation, and completion. The coordinator remains responsible for state transitions, integration, and the final response even when subagents do much of the work.

1. Read the repository-specific instructions and queue documents before changing state or code.
2. Select the target item. If the user says `next`, choose the first suitable low-risk candidate according to the queue's rules.
3. Set up isolated workspaces for subagents when the repo allows it. Prefer worktrees or equivalent separate working directories.
4. Launch or delegate to high-effort subagents for research, implementation, and validation/review. If the tool supports reasoning/model settings, request the highest available reasoning effort for each subagent.
5. Enforce gates. Research and source collection must finish before the queue row moves to `spec-ready`; implementation must not begin until the row is `spec-ready`.
6. Integrate only the files needed for the selected item. Do not revert unrelated user changes.
7. Run focused validation and the repository's full validation before marking the queue row complete.

## Subagent Roles

Use these roles unless the repository instructions define stricter ones:

- Coordinator: current workspace. Owns queue updates, gate decisions, integration, final validation, and final response.
- Research subagent: isolated research workspace. Collects sources, drafts the research/spec document, records contradictions and assumptions, and proposes test targets.
- Implementation subagent: isolated implementation workspace. Starts only after the coordinator confirms `spec-ready`; writes tests and implementation against the approved spec.
- Validation/review subagent: isolated or read-only review context. Checks the diff, contract consistency, docs, fixtures, and validation results.

If workspaces or worktrees cannot be created because of permissions or environment constraints, request approval or follow the user's explicit instruction to work in the current workspace. Record that fallback in the item's implementation plan or equivalent project document.

## Gate Rules

Treat queue status changes as part of the deliverable:

- Move `candidate` to `researching` before source gathering.
- Move `researching` to `spec-ready` only after the research document has citations, contracts, assumptions, implementation plan inputs, and test targets.
- Move `spec-ready` to `implementing` immediately before implementation work begins.
- Move `implementing` to `done` only after focused and full validation pass.
- Move the row to `blocked` if required research, citations, permissions, architecture prerequisites, or validation cannot be resolved.

When blocked, stop at the appropriate gate and state the exact blocker. Do not implement around missing research or unreliable citations.

## Repository References

For the Eurorack module queue workflow in this repository, read `references/eurorack-module-queue.md` before acting. It contains the exact prompt template, required files, queue status rules, validation commands, and final response requirements.
