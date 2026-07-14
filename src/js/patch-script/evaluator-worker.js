import { executePatchScript } from './builder.js';

self.onmessage = event => {
    try {
        self.postMessage({ id: event.data.id, ok: true, description: executePatchScript(event.data.source) });
    } catch (error) {
        self.postMessage({
            id: event.data.id,
            ok: false,
            error: { message: error.message, stack: error.stack || '' }
        });
    }
};
