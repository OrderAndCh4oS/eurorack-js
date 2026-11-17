/** Called during core addModule(), before the host constructs its audio node. */
export function prepareCoreModules(definitions, sampleRate) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new TypeError('Core preparation requires a positive finite sample rate');
    }
    for (const definition of definitions) {
        if (definition.prepareDSP === undefined) continue;
        if (typeof definition.prepareDSP !== 'function') {
            throw new TypeError(`Module "${definition.id}" prepareDSP must be a function`);
        }
        const result = definition.prepareDSP({ sampleRate });
        if (result && typeof result.then === 'function') {
            throw new TypeError(`Module "${definition.id}" preparation must be synchronous`);
        }
    }
}
