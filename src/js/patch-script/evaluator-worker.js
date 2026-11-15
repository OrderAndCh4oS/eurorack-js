import { executePatchScript } from './builder.js';
import { MAX_RESULT_BYTES, assertScriptSource } from './evaluator-limits.js';

// Build embeds this worker in an opaque-origin, CSP-restricted frame. Never
// instantiate this module as a same-origin worker to evaluate untrusted scripts.
const send = self.postMessage.bind(self);
const stringify = JSON.stringify.bind(JSON);
const encode = new TextEncoder().encode.bind(new TextEncoder());
const stop = self.close.bind(self);
// Avoid nested worker proliferation. Origin isolation and CSP provide the
// security boundary; this is an additional resource limit, not a sandbox alone.
for (const name of ['Worker', 'SharedWorker']) {
    Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false });
}

self.onmessage = event => {
    self.onmessage = null;
    try {
        assertScriptSource(event.data.source);
        const description = executePatchScript(event.data.source);
        const json = stringify(description);
        if (typeof json !== 'string' || json.length > MAX_RESULT_BYTES || encode(json).byteLength > MAX_RESULT_BYTES) {
            throw new Error('Patch result is too large (1 MiB maximum)');
        }
        send({ json });
    } catch (error) {
        send({ error: String(error?.message || 'Patch script evaluation failed').slice(0, 1000) });
    } finally {
        stop();
    }
};
