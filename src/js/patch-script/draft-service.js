import { newRequestId } from '../patches/cloud-client.js';
import { PATCH_LIMITS } from '../patches/limits.js';
import { analyseRackConnections } from '../rack/diagnostics.js';
import { compilePatchDescription } from './compiler.js';
import { assertScriptSource, MAX_RESULT_BYTES } from './evaluator-limits.js';
import { evaluatePatchScript } from './evaluator.js';
import { formatPatchScript } from './formatter.js';

export function draftError(code, message) {
    return Object.assign(new Error(message), {code});
}

const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
function fingerprint(value) {
    if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${fingerprint(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

// Bound untrusted declarations before the compiler creates any DSP mirrors or rows.
function checkDescription(description) {
    let nodes = 0;
    function visit(value, depth = 0) {
        if (++nodes > 50000 || depth > 32) throw draftError('patch-limit', 'Patch data is too large.');
        if (typeof value === 'number' && !Number.isFinite(value)) throw draftError('invalid-patch', 'Patch numbers must be finite.');
        if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key)) throw draftError('invalid-patch', 'Invalid patch property.');
                visit(child, depth + 1);
            }
        }
    }
    visit(description);
    if (!Array.isArray(description?.modules) || !Array.isArray(description?.connections)) {
        throw draftError('invalid-patch', 'Script must describe modules and connections.');
    }
    if (description.modules.length > PATCH_LIMITS.modules ||
        description.connections.length > PATCH_LIMITS.cables ||
        JSON.stringify(description).length > MAX_RESULT_BYTES) {
        throw draftError('patch-limit', `Use at most ${PATCH_LIMITS.modules} modules and ${PATCH_LIMITS.cables} cables.`);
    }
    for (const module of description.modules) {
        const {row, index} = module.placement || {};
        if (row !== undefined && (!Number.isInteger(row) || row < 1 || row > PATCH_LIMITS.rows) ||
            index !== undefined && (!Number.isInteger(index) || index < 0 || index >= PATCH_LIMITS.modules)) {
            throw draftError('patch-limit', `Use rows 1–${PATCH_LIMITS.rows} and positions 0–${PATCH_LIMITS.modules - 1}.`);
        }
    }
}

/** One shared validate/apply boundary for the editor and WebMCP. Drafts never leave this tab. */
export class PatchDraftService {
    #drafts = new Map();
    #fingerprint = null;
    #revision = 0;
    #busy = false;

    constructor({app, registry, document: documentRef = globalThis.document,
        evaluate = evaluatePatchScript, createId = newRequestId, now = Date.now,
        ttlMs = 15 * 60 * 1000, maxDrafts = 4} = {}) {
        Object.assign(this, {app, registry, document: documentRef, evaluate, createId, now, ttlMs, maxDrafts});
    }

    observe() {
        const patch = this.app.host.serializePatch();
        const record = this.app.patchLibrary?.active;
        const context = fingerprint({source: record?.source || null, id: record?.id || record?.key || null,
            account: this.app.patchLibrary?.accountGeneration || 0});
        // Empty rows are available for placement even though patch v3 omits them.
        const layout = fingerprint({patch, rows: this.app.host.state.getRowCount()});
        const next = context + '\n' + layout;
        if (next !== this.#fingerprint) { this.#fingerprint = next; this.#revision++; }
        return {patch, fingerprint: layout, context, revision: this.#revision};
    }

    getRack() {
        const {patch, revision} = this.observe();
        const state = this.app.host.state;
        const rows = state.getRowNumbers().map(row => state.getRowSpace(row, this.registry));
        return {patch: copy(patch), rows, revision, audioRunning: !!this.app.host.engine?.running && this.app.host.audioCtx?.state === 'running',
            hasUnsavedChanges: this.app.patchLibrary?.isDirty(patch) ?? false,
            source: formatPatchScript(patch, this.registry),
            diagnostics: analyseRackConnections(patch, this.registry)};
    }

    prune() {
        for (const [id, draft] of this.#drafts) if (draft.expiresAt <= this.now()) this.#drafts.delete(id);
    }

    async exclusive(operation) {
        if (this.#busy) throw draftError('busy', 'A patch operation is still running. Try again when it finishes.');
        this.#busy = true;
        try { return await operation(); } finally { this.#busy = false; }
    }

    async validate(source, {signal, expectedRevision} = {}) {
        return this.exclusive(async () => {
            signal?.throwIfAborted();
            assertScriptSource(source);
            const base = this.observe();
            if (expectedRevision !== undefined && expectedRevision !== base.revision) {
                throw draftError('rack-changed', 'The rack changed. Read it again before validating.');
            }
            const description = await this.evaluate(source, {signal, document: this.document});
            signal?.throwIfAborted();
            checkDescription(description);
            const compiled = compilePatchDescription(description, {
                registry: this.registry, sampleRate: this.app.host.sampleRate, blockSize: this.app.host.blockSize
            });
            const draftId = await this.createId();
            signal?.throwIfAborted();
            const current = this.observe();
            if (base.fingerprint !== current.fingerprint || base.context !== current.context) {
                throw draftError('rack-changed', 'The rack changed during validation. Validate again.');
            }
            const draft = freeze(copy({...compiled, draftId, source, baseFingerprint: base.fingerprint,
                baseContext: base.context, revision: base.revision, expiresAt: this.now() + this.ttlMs}));
            this.prune();
            while (this.#drafts.size >= this.maxDrafts) this.#drafts.delete(this.#drafts.keys().next().value);
            this.#drafts.set(draftId, draft);
            return copy({draftId, patch: draft.patch, diagnostics: draft.diagnostics,
                revision: draft.revision, expiresAt: draft.expiresAt});
        });
    }

    requireEditor() {
        if (this.app.inPlayerView) throw draftError('player-read-only', 'Open the desktop editor to edit patches.');
    }

    requireCurrentEditor(expectedRevision) {
        if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw draftError('invalid-input', 'Provide the revision from get_rack.');
        this.requireEditor();
        if (this.app.patchLibrary?.replacing) throw draftError('busy', 'A patch is opening.');
        if (this.observe().revision !== expectedRevision) throw draftError('rack-changed', 'The rack changed. Read it again before editing.');
    }

    async apply(draftId, {signal, isCurrent = () => true, onUnsavedChanges = 'prompt'} = {}) {
        return this.exclusive(async () => {
            this.prune();
            const draft = this.#drafts.get(draftId);
            if (!draft) throw draftError('draft-not-found', 'This draft expired or was already applied. Validate again.');
            if (draft.baseContext !== this.observe().context) throw draftError('rack-changed', 'A different patch or account is open. Read it and validate again.');
            const account = this.app.patchLibrary?.accountGeneration;
            const skipPrompt = onUnsavedChanges === 'keep' || onUnsavedChanges === 'discard';
            const beforeApply = () => {
                signal?.throwIfAborted();
                this.requireEditor();
                if (draft.expiresAt <= this.now()) throw draftError('draft-not-found', 'This draft expired. Validate again.');
                if (account !== this.app.patchLibrary?.accountGeneration) throw draftError('rack-changed', 'Your account changed. Validate again.');
                if (!isCurrent()) throw draftError('source-changed', 'The code changed. Validate again.');
                const current = this.observe();
                // The editor dialog can save the rack under a new identity. Tool decisions belong to one revision.
                if (draft.baseFingerprint !== current.fingerprint || (skipPrompt && draft.revision !== current.revision)) {
                    throw draftError('rack-changed', 'The rack changed. Read it and validate again.');
                }
                if (onUnsavedChanges === 'keep' && this.app.patchLibrary?.isDirty(current.patch)) {
                    throw draftError('unsaved-changes', 'The rack has unsaved edits. To replace them with this draft, retry apply_draft with the same draftId and discardUnsavedChanges set to true.');
                }
            };
            beforeApply();
            const applied = await this.app.loadPatchState(copy(draft.patch), {beforeApply, edit: true, signal, skipPrompt});
            if (applied === false) { signal?.throwIfAborted(); return {applied: false}; }
            this.#drafts.delete(draftId);
            this.observe();
            return {applied: true};
        });
    }

    dispose() { this.#drafts.clear(); }
}
