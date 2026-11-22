export const MAX_SCRIPT_BYTES = 128 * 1024;
export const MAX_RESULT_BYTES = 1024 * 1024;

function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}

export function assertScriptSource(source) {
    if (typeof source !== 'string' || source.length > MAX_SCRIPT_BYTES || byteLength(source) > MAX_SCRIPT_BYTES) {
        const message = `Patch script source must be a string of at most ${MAX_SCRIPT_BYTES / 1024} KiB of UTF-8 text.`;
        throw Object.assign(new Error(message), {code: 'source-limit'});
    }
}

export function decodeEvaluationResult(json) {
    if (typeof json !== 'string' || json.length > MAX_RESULT_BYTES || byteLength(json) > MAX_RESULT_BYTES) {
        throw new Error('Patch result is too large or invalid (1 MiB maximum)');
    }
    const result = JSON.parse(json);
    if (!result || !Array.isArray(result.modules) || !Array.isArray(result.connections) ||
        !result.midiMappings || typeof result.midiMappings !== 'object' || Array.isArray(result.midiMappings)) {
        throw new Error('Invalid patch evaluator response');
    }
    // Results are data only. Bound nesting before the compiler recursively walks
    // parameter objects, and reject prototype-shaped keys at the trust boundary.
    const pending = [[result, 0]];
    let values = 0;
    while (pending.length) {
        const [value, depth] = pending.pop();
        if (++values > 65_536 || depth > 32) throw new Error('Patch result is too complex');
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Patch values must be finite');
        if (!value || typeof value !== 'object') continue;
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid patch result key');
            pending.push([child, depth + 1]);
        }
    }
    return result;
}
