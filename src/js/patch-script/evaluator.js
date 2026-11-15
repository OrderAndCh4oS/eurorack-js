import { MAX_SCRIPT_BYTES, MAX_RESULT_BYTES, assertScriptSource, decodeEvaluationResult } from './evaluator-limits.js';

export { MAX_SCRIPT_BYTES, MAX_RESULT_BYTES };

/**
 * The iframe has an opaque origin and its blob worker inherits a network-denying
 * CSP. A worker on the app's own origin is not an execution sandbox. Deliberately
 * fail closed when this browser boundary is unavailable; there is no eval fallback.
 */
export function evaluatePatchScript(source, {
    timeoutMs = 2000,
    signal,
    document: documentRef = globalThis.document
} = {}) {
    try { assertScriptSource(source); } catch (error) { return Promise.reject(error); }
    if (signal?.aborted) return Promise.reject(new DOMException('Patch evaluation cancelled', 'AbortError'));
    const windowRef = documentRef?.defaultView;
    if (!documentRef?.body || typeof windowRef?.MessageChannel !== 'function') {
        return Promise.reject(new Error('Isolated patch evaluation is not available in this browser'));
    }
    const executionLimit = Math.max(1, Math.min(10_000, Number.isFinite(timeoutMs) ? timeoutMs : 2000));

    return new Promise((resolve, reject) => {
        const frame = documentRef.createElement('iframe');
        frame.hidden = true;
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('title', 'Isolated patch evaluator');
        frame.referrerPolicy = 'no-referrer';
        frame.dataset.patchEvaluator = '';
        frame.src = new URL('../../patch-script-sandbox.html', import.meta.url).href;
        const channel = new windowRef.MessageChannel();
        let settled = false;
        let connected = false;
        let timer;
        const finish = (error, description) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            windowRef.removeEventListener('message', onReady);
            channel.port1.close();
            channel.port2.close();
            frame.remove();
            if (error) reject(error);
            else resolve(description);
        };
        const onAbort = () => finish(new DOMException('Patch evaluation cancelled', 'AbortError'));
        const onReady = event => {
            if (connected || event.source !== frame.contentWindow || event.origin !== 'null' ||
                event.data?.type !== 'eurorack-patch-sandbox-ready') return;
            connected = true;
            clearTimeout(timer);
            timer = setTimeout(() => finish(new Error(`Patch script exceeded the ${executionLimit}ms evaluation limit`)), executionLimit);
            frame.contentWindow.postMessage({ type: 'eurorack-patch-evaluate', source }, '*', [channel.port2]);
        };
        channel.port1.onmessage = event => {
            if (!connected) return;
            if (event.data?.ok === false) {
                const message = typeof event.data.message === 'string' ? event.data.message.slice(0, 1000) : 'Patch script evaluation failed';
                finish(new Error(message));
                return;
            }
            try { finish(null, decodeEvaluationResult(event.data?.json)); }
            catch (error) { finish(error); }
        };
        channel.port1.onmessageerror = () => finish(new Error('Invalid patch evaluator response'));
        windowRef.addEventListener('message', onReady);
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => finish(new Error('Patch evaluator did not start')), 5000);
        documentRef.body.appendChild(frame);
    });
}
