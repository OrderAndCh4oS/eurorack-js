import { MAX_SCRIPT_BYTES, MAX_RESULT_BYTES, assertScriptSource, decodeEvaluationResult } from './evaluator-limits.js';

export { MAX_SCRIPT_BYTES, MAX_RESULT_BYTES };

const hosts = new WeakMap();
const MAX_CONCURRENT_EVALUATIONS = 4;

function cancelled() {
    return new DOMException('Patch evaluation cancelled', 'AbortError');
}

function createHost(documentRef) {
    const windowRef = documentRef.defaultView;
    const frame = documentRef.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Isolated patch evaluator');
    frame.referrerPolicy = 'no-referrer';
    frame.dataset.patchEvaluator = '';
    frame.src = new URL('../../patch-script-sandbox.html', import.meta.url).href;
    let resolveReady;
    let rejectReady;
    const host = { frame, pending: new Set(), closed: false, ready: false,
        promise: new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; }) };
    const onReady = event => {
        if (host.closed || event.source !== frame.contentWindow || event.origin !== 'null' ||
            event.data?.type !== 'eurorack-patch-sandbox-ready') return;
        host.ready = true;
        clearTimeout(timer);
        windowRef.removeEventListener('message', onReady);
        resolveReady();
    };
    const timer = setTimeout(() => host.dispose(new Error('Patch evaluator did not start')), 5000);
    host.dispose = (error = cancelled()) => {
        if (host.closed) return;
        host.closed = true;
        clearTimeout(timer);
        windowRef.removeEventListener('message', onReady);
        windowRef.removeEventListener('pagehide', onPageHide);
        for (const finish of [...host.pending]) finish(error);
        rejectReady(error);
        frame.remove();
        if (hosts.get(documentRef) === host) hosts.delete(documentRef);
    };
    const onPageHide = event => { if (!event.persisted) host.dispose(); };
    windowRef.addEventListener('message', onReady);
    windowRef.addEventListener('pagehide', onPageHide);
    hosts.set(documentRef, host);
    try { documentRef.body.appendChild(frame); }
    catch (error) { host.dispose(error); }
    return host;
}

/** Prewarm before registering WebMCP tools: no iframe navigation during a call. */
export function preparePatchEvaluator({ signal, document: documentRef = globalThis.document } = {}) {
    if (signal?.aborted) return Promise.reject(cancelled());
    if (!documentRef?.body || typeof documentRef.defaultView?.MessageChannel !== 'function') {
        return Promise.reject(new Error('Isolated patch evaluation is not available in this browser'));
    }
    let host = hosts.get(documentRef);
    if (host && !host.frame.isConnected) { host.dispose(); host = null; }
    host ||= createHost(documentRef);
    if (!signal) return host.promise;
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(cancelled());
        signal.addEventListener('abort', onAbort, { once: true });
        host.promise.then(() => {
            signal.removeEventListener('abort', onAbort);
            if (signal.aborted) reject(cancelled());
            else resolve();
        }, error => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
        });
    });
}

export function disposePatchEvaluator({ document: documentRef = globalThis.document } = {}) {
    hosts.get(documentRef)?.dispose();
}

/**
 * The persistent iframe has an opaque origin; each fresh worker inherits its
 * CSP. A worker on the app's own origin is not an execution sandbox. Deliberately
 * fail closed when this browser boundary is unavailable; there is no eval fallback.
 */
export async function evaluatePatchScript(source, {
    timeoutMs = 2000,
    signal,
    document: documentRef = globalThis.document
} = {}) {
    assertScriptSource(source);
    await preparePatchEvaluator({ document: documentRef, signal });
    if (signal?.aborted) throw cancelled();
    const windowRef = documentRef?.defaultView;
    const host = hosts.get(documentRef);
    if (!host || host.closed) throw new Error('Patch evaluator was closed');
    if (host.pending.size >= MAX_CONCURRENT_EVALUATIONS) throw new Error('Too many patch evaluations are running');
    const executionLimit = Math.max(1, Math.min(10_000, Number.isFinite(timeoutMs) ? timeoutMs : 2000));

    return new Promise((resolve, reject) => {
        const frame = host.frame;
        const channel = new windowRef.MessageChannel();
        let settled = false;
        let timer;
        const finish = (error, description) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            host.pending.delete(finish);
            // The host remains mounted. Cancel terminates just this worker and
            // revokes its Blob URL, including on timeout or document disposal.
            channel.port1.postMessage({ type: 'cancel' });
            channel.port1.close();
            channel.port2.close();
            if (error) reject(error);
            else resolve(description);
        };
        const onAbort = () => finish(cancelled());
        channel.port1.onmessage = event => {
            if (event.data?.ok === false) {
                const message = typeof event.data.message === 'string' ? event.data.message.slice(0, 1000) : 'Patch script evaluation failed';
                finish(new Error(message));
                return;
            }
            try { finish(null, decodeEvaluationResult(event.data?.json)); }
            catch (error) { finish(error); }
        };
        channel.port1.onmessageerror = () => finish(new Error('Invalid patch evaluator response'));
        host.pending.add(finish);
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => finish(new Error(`Patch script exceeded the ${executionLimit}ms evaluation limit`)), executionLimit);
        try { frame.contentWindow.postMessage({ type: 'eurorack-patch-evaluate', source }, '*', [channel.port2]); }
        catch (error) { finish(error); }
    });
}
