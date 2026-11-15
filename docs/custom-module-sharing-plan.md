# Custom modules in saved patches

Status: decided, 15 November 2026. This decision replaces the proposed custom plugin release catalogue.

## Decision

The hosted app accepts built-in modules only. Account saves, both private and public, reject external plugin dependencies and user-submitted module JavaScript. WebMCP and the Code editor can still compose patches from existing modules; they do not install new module code.

New modules must be developed and tested locally, then submitted through a [GitHub pull request](https://github.com/OrderAndCh4oS/eurorack-js/pulls). Maintainer review, merge and deployment make them part of the built-in module set. Only then can users include them in account and public patches.

There is no uploaded plugin catalogue, automatic publication of generated DSP, or self-service module release workflow.

## Why

The existing plugin API executes trusted JavaScript. Module registration and UI mirrors can call `createDSP()` on the main thread, and production DSP runs in the shared audio worklet. Loading submitted code would give it that trust. Passing tests does not establish that arbitrary code is safe to execute for visitors.

Keeping hosted patches limited to built-ins lets server validation, browser loading and preview capture use the same shipped definitions. Patch records contain module types, settings and cables, not executable code. No release catalogue, dependency download service or database migration is needed for this decision.

## Local development and contributions

The trusted plugin API remains available for local development and embedding. Registering a plugin does not publish it, and a local save or snapshot link does not bundle its source for another browser.

Agents and contributors should read [Codebase Architecture and Schemas](architecture.md), then [Creating Modules](creating-modules.md). Follow that guide's [contribution workflow](creating-modules.md#contribute-a-module) for research, tests, DSP audits, browser/audio checks and the PR contents. A local plugin prototype must be integrated as a built-in for a contribution to the hosted app.

Maintainer review remains required after testing. Contributions should describe the DSP model, dependencies, known limitations, test results and manual listening checks. A pull request is a proposal; it does not make a module available to users until merged and deployed.

## Enforcement

- Reject non-core plugin dependencies and unknown module types at hosted save and preview boundaries, including copies and publication.
- Keep strict patch and module contract validation; do not accept submitted definitions or executable URLs in patch data.
- Explain the restriction and point module authors to the contribution guide.
- Preserve the local trusted-plugin API and existing built-in patch behavior.

The version 3 patch format can retain its plugin contracts for local and embedded use. That capability does not change the hosted app's built-in-only policy.
