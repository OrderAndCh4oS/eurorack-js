import { assertScriptSource, decodeEvaluationResult } from './evaluator-limits.js';

// Replaced with a bundled, import-free worker by scripts/build.mjs. Only this
// trusted bootstrap runs in the frame; user source runs in the disposable worker.
const workerSource = __PATCH_WORKER_SOURCE__;
// The asset can be requested directly or embedded by another site. Never trust
// the parent to have supplied sandbox="allow-scripts": without it the worker
// would inherit this app's origin and could read its storage for a hostile parent.
const isolated = window.origin === 'null' && parent !== window;
let started = false;

window.addEventListener('message', event => {
    if (!isolated || started || event.source !== parent || event.data?.type !== 'eurorack-patch-evaluate' || !event.ports[0]) return;
    started = true;
    const port = event.ports[0];
    let worker;
    let objectUrl;
    let finished = false;
    const finish = data => {
        if (finished) return;
        finished = true;
        worker?.terminate();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        port.postMessage(data);
        port.close();
    };
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
if (isolated) parent.postMessage({ type: 'eurorack-patch-sandbox-ready' }, '*');
