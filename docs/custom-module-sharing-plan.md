# Custom modules in saved patches

Status: proposed, 15 November 2026. Runtime and cloud support described below are not implemented. The existing [architecture](architecture.md#plugin-registration) and [module authoring guide](creating-modules.md) remain the starting points for agents developing modules.

## Outcome

A public patch containing custom DSP modules should open in a fresh browser, show the correct panels, play through the normal rack, and support Save a copy. It must keep using the same module code after its author publishes a new version. Private account saves need the same dependency support.

Recommended first release: support reviewed, application-trusted plugins distributed with the app. These can contain new DSP, not just combinations of existing modules. Follow with user-submitted releases once storage, publication and execution policies are implemented. Keep instant publication of arbitrary agent-generated JavaScript out of the trusted plugin loader.

## Current blockers

| Boundary | Current behavior | Required change |
| --- | --- | --- |
| Server validation | `server/validation.js` constructs a core-only metadata registry. Preview upload and private/public saves reject other owners. | Resolve approved release metadata before validating state. Never execute uploaded code in an API request. |
| Patch identity | `state.plugins` stores plugin ID → integer patch contract. It does not pin package bytes. | Give every release an immutable identity and retain its files. |
| Rack loading | `RackHost.loadPatch()` validates against installed definitions. | Resolve and register all required releases before entering the existing transactional load. |
| Preview capture | `patch-preview-frame.js` has a fresh registry. It cannot see registrations made in the editor. | Load the same exact releases inside the preview frame. |
| Publication | Public saves require a preview with the saved state hash. | Make release identity part of that hash and retain current atomic save/image behavior. |
| Execution | Plugin validation and UI mirrors call `createDSP()` on the main thread; `process()` runs in the shared audio worklet. | Treat approved JavaScript as application code. Unreviewed code needs a different execution boundary. |

`createPatchService` already accepts an injected contracts registry. Reuse that seam instead of weakening `normalizePatch()` or allowing unknown module types.

## Immutable releases without changing patch v3

Use a release-specific plugin ID such as `custom-<release-digest>`, and namespace its module types under that ID. Keep friendly module names and the author's project name separate from runtime IDs. Both formats can satisfy the current lowercase/dash ID rules.

The release digest covers a canonical package payload: declarative metadata, compiled DSP/module bytes, runtime API target, bundled dependencies and assets. Generated registration wrappers inject the digest after hashing; the hash input must not contain its own digest. Also record hashes for every final served file. Define and test this packaging algorithm before shipping any releases.

The patch continues to store `plugins: { core: 1, "custom-<release-digest>": 1 }`. Its module types identify that same release. Here the integer remains the patch contract version; the digest identifies the code. Changing DSP, controls or a bundled dependency produces a new release ID, even when the patch contract is compatible. Never resolve `latest` on load.

Keep instance IDs independent of these long type IDs. `RackState.generateInstanceId()` and `PatchScriptBuilder.nextId()` currently append a counter to the type; a digest-prefixed type can exceed the cloud limit of 80 characters for an instance ID. Generate bounded IDs (for example ULIDs) for new instances, preserve explicitly supplied valid script names, and test both UI and script creation. Existing saved instance IDs stay unchanged.

This preserves strict v3 parsing, and the release IDs automatically participate in existing state, preview and dirty-state hashes. It also lets two versions coexist without replacing a plugin already loaded in an AudioWorklet context. Core behavior/versioning stays as it is; this proposal pins custom releases, not the entire core engine.

Development-only plugin IDs remain unsupported for cloud saves until packaged as releases. Packaging returns the mapping from development IDs to release IDs; applying that mapping creates a new validated draft. Do not silently substitute code when saving or loading an older patch.

## Release catalogue and validation

For the first implementation, keep reviewed release manifests and self-contained bundles in the repository. Generate a server metadata catalogue and browser release index from the same inputs. Deploy new releases through the existing build; retain older release assets in later deployments. No database migration is needed for this initial catalogue because patches already store their dependencies in JSON.

Each manifest needs the release ID, package name/version, public author credit, licence/redistribution terms, API/patch versions, module contracts, file hashes/sizes and fixed first-party asset paths. Bundle dependencies so modules cannot follow mutable third-party imports. Public release files and source attribution must not contain personal contact details or secrets.

Extract a data-only contract validator for metadata; the current module definition validator requires a `createDSP` function even when instance checks are disabled. Validate names, HP, theme/category, controls, defaults, structured state, ports, voltage ranges, telemetry bounds and ownership without importing submitted JavaScript. Build checks must compare generated metadata with the reviewed runtime definitions.

The API must resolve the release from its own catalogue, never trust metadata or executable URLs supplied with a patch. Reject missing, unknown, revoked and mismatched releases on preview upload, create, state updates, copy and publication. Forks with unchanged state must also check release availability; the current copy path can reuse stored state without revalidation. Owners must still be able to make an affected patch private, delete it, or retrieve its data without executing the missing/revoked code.

## Loading and previews

1. Read a bounded dependency list from the patch before strict module validation. Accept only `core` and exact catalogue release IDs; reject arbitrary URLs.
2. Resolve current release eligibility and metadata. Fetch only dependencies absent from the registry, with request cancellation and byte/count limits.
3. Load approved definitions through the registry. Check plugin ownership, module identities and declared contracts against the catalogue. Then use `RackHost.loadPatch()` and its existing worklet acknowledgement/rollback.
4. Leave the active rack, saved identity and URL unchanged if resolution, registration or activation fails. Obsolete loads must not replace later edits or account changes. Loaded code cannot be unloaded from a worklet, so failed attempts may leave unused approved registrations but must not change the active rack.
5. Use the same resolver in the preview frame before constructing its rack. Generate images on save, including existing thumbnail/full/social variants. Public lists and social crawlers read stored images and never run module code.

Deduplicate concurrent loads. Load only the releases used by the selected patch; do not preload an entire custom module catalogue. Extend the metadata supplied to WebMCP so agents can distinguish an installed development plugin from a release eligible for saving.

## Sharing, retention and cost

Release files are shared across patches and copies. Serve fixed, digest-addressed public assets through the CDN with long immutable caching. Revalidate the small eligibility catalogue so revocation can prevent future loads despite cached bytes. Immutable bytes alone are not proof of approval, and revocation cannot retract code a visitor has already downloaded or is running.

Keep saved patch visibility separate from release visibility. A private patch can use a public release without exposing its cables or settings. Public JavaScript releases are downloadable; do not imply that publishing a patch keeps its module source secret.

Do not compile, capture rack images, or transform assets on public page views. Existing image generation stays on Save. Put byte/count quotas on releases and uploads before adding user submissions. A patch should not duplicate its module code in every record or snapshot URL.

Deleting a patch does not delete a shared release. Keep approved releases while patches/forks depend on them. Revoked releases retain metadata and readable patch records; opening shows which module is unavailable, without discarding modules or silently loading a replacement.

User uploads would require additive database tables for release ownership/status/manifest/digest and patch-to-release references, plus object storage, rate limits and delayed cleanup. Publication must atomically ensure all required releases are public and approved. Private/unpublished releases must not leak through public patch metadata or assets. This is a later phase, not a prerequisite for the reviewed catalogue.

## Agent-generated modules

An agent can follow the development docs, author DSP and declarative controls, and prepare a reviewed release. Current WebMCP patch tools cannot create or register a new module type. Merely passing tests does not make generated JavaScript safe to import on a public visitor's origin; top-level code, validation and UI mirrors can run before audio starts.

For immediate self-service generation and sharing, evaluate a restricted DSP language or verified, metered WASM runtime with a declarative panel schema. That requires bounded memory and execution, restricted host imports, no arbitrary DOM renderer/event handlers, and fault recovery that preserves the rest of the rack. Ordinary WASM memory isolation does not supply an audio deadline or a per-call instruction budget. Prove those properties and measure audio performance before selecting the runtime.

Composites built from existing DSP are another option for a later feature, but do not satisfy the separate requirement to invent new DSP. A browser worker/iframe can isolate a prototype, but its routing latency, timing and failure behavior need evaluation before treating it as a drop-in audio module.

## Implementation sequence

1. Build the deterministic package format and reviewed catalogue. Extract metadata validation, use bounded instance IDs, and add release/namespace collision checks. Follow the existing research and DSP test workflow for the first real custom module.
2. Add one dependency resolver shared by rack opening and preview capture; retain the existing load transaction and stale-operation guards.
3. Extend server validation, copy/publication checks and WebMCP metadata. Keep source files out of patch bodies and use the normal Save dialog and canonical patch URL.
4. Verify the complete flow with a reviewed fixture plugin in two clean browser contexts. Commit and deploy the feature only after save, preview, loading and rollback work together.
5. Add an isolated generated-DSP prototype and user release storage as separately scoped work. Do not expose raw JavaScript submission as an interim public endpoint.

Required acceptance checks:

- A custom patch saves privately, publishes with images, opens anonymously in a fresh browser, plays, forks privately and saves again with identical release dependencies.
- A newer release does not change the old patch; both releases can coexist in one rack/tab. Module and plugin ownership collisions reject cleanly.
- Preview capture, server validation and live rendering agree on controls/ports/defaults, and preview hashes change when the release changes.
- Unknown/missing/revoked releases and tampered metadata fail before activation. Revision conflicts, cancelled loads and offline failures preserve the current rack.
- Owners can make a revoked-release patch private or delete it. Long namespaced module types still produce cloud-valid instance IDs from the UI and scripts.
- No uploaded code executes in request handlers. Public list/social/image requests never execute DSP. Private data does not leak through release or patch routes.
- Repeated loads use cached files. Runtime blocks have bounded output with no NaN/Infinity and pass the existing voltage/sample-rate/block-size audits. Approval tests are not presented as a sandbox.
- Existing core-only saves, imports, snapshot links, MIDI mappings and patches remain valid without migration.

## References

- Repository: [registry](../src/js/rack/registry.js), [host](../src/js/app/rack-host.js), [patch format](../src/js/app/patch-format.js), [server validation](../server/validation.js), [patch service](../server/patch-service.js), [preview frame](../src/js/patches/patch-preview-frame.js).
- W3C, [Web Audio API — AudioWorklet](https://www.w3.org/TR/webaudio/#AudioWorklet), working draft, accessed 15 November 2026. Defines worklet processing and loading; application code still owns module trust and lifecycle.
- WebAssembly project, [Security](https://webassembly.org/docs/security/), accessed 15 November 2026. Describes module isolation, host boundaries and limits; it does not establish a bounded real-time execution budget for this application.
