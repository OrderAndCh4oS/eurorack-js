# Custom modules in saved patches

Status: decided, 15 November 2026. This decision replaces the proposed custom plugin release catalogue.

## Decision

Account saves, both private and public, accept built-in modules only. They reject external or browser-local plugin dependencies and module JavaScript. WebMCP and the Code editor's **Patch** tab compose patches from already registered module types.

The **Modules** tab supports a user's own code in their browser. Creating, importing or saving a draft does not execute it. **Use module** explicitly runs it and adds it to the rack. This local authoring feature does not publish code or create dependencies that another browser can download.

New modules must be developed and tested locally, then submitted through a [GitHub pull request](https://github.com/OrderAndCh4oS/eurorack-js/pulls). Maintainer review, merge and deployment make them part of the built-in module set. Only then can users include them in account and public patches.

There is no uploaded plugin catalogue, automatic publication of generated DSP, or self-service module release workflow.

## Why

The existing plugin API executes trusted JavaScript. Module registration and UI mirrors can call `createDSP()` on the main thread, and production DSP runs in the shared audio worklet. Loading submitted code would give it that trust. Passing tests does not establish that arbitrary code is safe to execute for visitors.

Keeping account patches limited to built-ins lets server validation, browser loading and cloud preview capture use the same shipped definitions. Patch records contain module types, settings and cables, not executable code. No release catalogue, dependency download service or database migration is needed for this decision.

## Local development and contributions

The trusted plugin API remains available for local development and embedding. In **Code → Modules**, drafts and immutable executable revisions stay in browser local storage. A revision loads when the user chooses **Use module** or opens a browser-saved patch that needs it; browsing the list does not run drafts. Editing a draft does not replace the revision used by an older patch. There is no account sync, and patch state or snapshot links do not bundle its source for another browser.

Local source is self-contained and cannot use import declarations, dynamic imports or re-exports. These authoring restrictions are not a security sandbox. The module executes as trusted JavaScript when activated.

Agents and contributors should read [Codebase Architecture and Schemas](architecture.md), then [Creating Modules](creating-modules.md). Follow that guide's [contribution workflow](creating-modules.md#contribute-a-module) for research, tests, DSP audits, browser/audio checks and the PR contents. A local plugin prototype must be integrated as a built-in for a contribution to the hosted app.

Maintainer review remains required after testing. Contributions should describe the DSP model, dependencies, known limitations, test results and manual listening checks. A pull request is a proposal; it does not make a module available to users until merged and deployed.

## Enforcement

- Reject non-core plugin dependencies and unknown module types at account save and cloud preview boundaries, including copies and publication.
- Keep strict patch and module contract validation; do not accept submitted definitions or executable URLs in patch data.
- Explain the restriction and point module authors to the contribution guide.
- Keep a user's own module drafts and executable revisions browser-local; do not run them when browsing source or opening public patch data.
- Preserve the local trusted-plugin API and existing built-in patch behavior.

The version 3 patch format retains its plugin contracts for local and embedded use. That capability does not change the built-in-only policy for account and public patches.
