// Resolve at topology activation. An ordinary DSP output ends the search, so
// only the real producer and consumer participate in feedback scheduling.
export function resolveOctoRoutes(modules, physicalRoutes, blockSize, blockEndCopies) {
    const inputs = new Map(physicalRoutes.map(route => [route.destinationBuffer, route]));
    const upstreamByOutput = new Map();
    for (const { def, instance } of Object.values(modules)) {
        if (def.id !== 'octo-receive') continue;
        const trunk = inputs.get(instance.inputs.link);
        const send = trunk && modules[trunk.fromModule].instance;
        for (let lane = 1; lane <= 8; lane++) {
            const output = instance.outputs['out' + lane];
            if (!(output instanceof Float32Array) || output.length !== blockSize) {
                throw new Error(`Octo Receive output ${lane} must be a ${blockSize}-sample Float32Array`);
            }
            upstreamByOutput.set(output, send && inputs.get(send.inputs['in' + lane]));
        }
    }

    const silence = new Float32Array(blockSize);
    const resolved = new Map();
    for (const output of upstreamByOutput.keys()) {
        let cursor = output;
        const path = [];
        while (!resolved.has(cursor)) {
            // Encountering this output on its own path means a driverless loop.
            resolved.set(cursor, null);
            path.push(cursor);
            const upstream = upstreamByOutput.get(cursor);
            if (!upstream || !upstreamByOutput.has(upstream.sourceBuffer)) {
                resolved.set(cursor, upstream || null);
                break;
            }
            cursor = upstream.sourceBuffer;
        }
        const source = resolved.get(cursor);
        for (const visited of path) resolved.set(visited, source);
        // A jack always exposes its current voltage. Individual consumers may
        // independently read a delayed block when they close a feedback loop.
        blockEndCopies.push({ sourceBuffer: source?.sourceBuffer ?? silence, destinationBuffer: output });
    }

    const scalarRoutes = [];
    for (const route of physicalRoutes) {
        if (modules[route.toModule].def.id === 'octo-receive') continue; // LINK has no scalar signal.
        if (resolved.has(route.sourceBuffer)) {
            const source = resolved.get(route.sourceBuffer);
            route.fromModule = source?.fromModule ?? null;
            route.fromPort = source?.fromPort ?? null;
            route.sourceBuffer = source?.sourceBuffer ?? silence;
        }
        scalarRoutes.push(route);
    }
    return scalarRoutes;
}
