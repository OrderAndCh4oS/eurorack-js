import { assertScriptSource, decodeEvaluationResult } from './evaluator-limits.js';

// Replaced with a bundled, import-free worker by scripts/build.mjs. Only this
// trusted bootstrap runs in the frame; user source runs in the disposable worker.
const workerSource = __PATCH_WORKER_SOURCE__;
// The asset can be requested directly or embedded by another site. Never trust
// the parent to have supplied sandbox="allow-scripts": without it the worker
// would inherit this app's origin and could read its storage for a hostile parent.
const isolated = window.origin === 'null' && parent !== window;
const pending = new Set();

window.addEventListener('message', event => {
    if (!isolated || event.source !== parent || event.data?.type !== 'eurorack-patch-evaluate' || !event.ports[0]) return;
    const port = event.ports[0];
    let worker;
    let objectUrl;
    let finished = false;
    const finish = data => {
        if (finished) return;
        finished = true;
        pending.delete(finish);
        worker?.terminate();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (data) port.postMessage(data);
        port.close();
    };
    if (pending.size >= 4) {
        finish({ ok: false, message: 'Too many patch evaluations are running' });
        return;
    }
    pending.add(finish);
    port.onmessage = message => { if (message.data?.type === 'cancel') finish(); };
    try {
        assertScriptSource(event.data.source);
        objectUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
        worker = new Worker(objectUrl);
        worker.onmessage = message => {
            try {
                if (typeof message.data?.error === 'string') throw new Error(message.data.error.slice(0, 1000));
                decodeEvaluationResult(message.data?.json);
                finish({ ok: true, json: message.data.json });
            } catch (error) {
                finish({ ok: false, message: error.message });
            }
        };
        worker.onerror = () => finish({ ok: false, message: 'Patch script evaluation failed' });
        worker.onmessageerror = () => finish({ ok: false, message: 'Invalid patch evaluator response' });
        worker.postMessage({ source: event.data.source });
    } catch (error) {
        finish({ ok: false, message: error.message });
    }
});
window.addEventListener('pagehide', () => { for (const finish of [...pending]) finish(); });
if (isolated) parent.postMessage({ type: 'eurorack-patch-sandbox-ready' }, '*');
