import { executePatchScript } from './builder.js';

export function evaluatePatchScript(source, { timeoutMs = 2000, WorkerClass = globalThis.Worker } = {}) {
    if (typeof WorkerClass !== 'function') return Promise.resolve().then(() => executePatchScript(source));
    return new Promise((resolve, reject) => {
        const worker = new WorkerClass(new URL('./evaluator-worker.js', import.meta.url), { type: 'module' });
        const id = `${Date.now()}-${Math.random()}`;
        const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error(`Patch script exceeded the ${timeoutMs}ms evaluation limit`));
        }, timeoutMs);
        worker.onmessage = event => {
            if (event.data.id !== id) return;
            clearTimeout(timer);
            worker.terminate();
            if (event.data.ok) resolve(event.data.description);
            else {
                const error = new Error(event.data.error?.message || 'Patch script evaluation failed');
                error.stack = event.data.error?.stack || error.stack;
                reject(error);
            }
        };
        worker.onerror = event => {
            clearTimeout(timer);
            worker.terminate();
            reject(new Error(event.message || 'Patch script worker failed'));
        };
        worker.postMessage({ id, source });
    });
}
