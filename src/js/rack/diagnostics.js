import { getModulePorts } from './module-contract.js';

function portTargets(moduleId, direction, ports) {
    return ports.map(({ port }) => ({ moduleId, direction, port }));
}

/**
 * Inspect a validated patch without starting audio or constructing DSP instances.
 * Reachability is deliberately module-level: CV and triggers can contribute to
 * sound, and unused individual ports are normal. This does not prove audibility.
 */
export function analyseRackConnections(patch, registry) {
    const modules = patch.modules;
    const cables = patch.cables;
    const nodes = new Map();
    for (const module of modules) {
        const definition = registry.get(module.type);
        if (!definition) throw new Error(`Module type "${module.type}" not found`);
        if (definition.role === 'spacer') continue;
        const inputs = getModulePorts(definition, 'input');
        const audioOutput = definition.role === 'audio-output';
        nodes.set(module.id, {
            inputs,
            outputs: getModulePorts(definition, 'output'),
            audioOutput,
            terminalInputs: new Set(audioOutput ? inputs.map(input => input.port) : definition.diagnostics?.terminalInputs || []),
            incoming: [],
            outgoing: []
        });
    }

    cables.forEach(cable => {
        const source = nodes.get(cable.fromModule);
        const destination = nodes.get(cable.toModule);
        if (!source || !destination) throw new Error('Rack diagnostics require valid cable endpoints');
        source.outgoing.push(cable);
        destination.incoming.push(cable);
    });

    const useful = new Set();
    const pending = [];
    nodes.forEach((node, id) => {
        // A monitor needs a signal before its control inputs are useful.
        // PLOT's trigger alone is not a signal to display; with audio, it is
        // a legitimate contribution to the display just like any other CV.
        if (node.incoming.some(cable => node.terminalInputs.has(cable.toPort))) pending.push(id);
    });

    while (pending.length) {
        const id = pending.pop();
        if (useful.has(id)) continue;
        useful.add(id);
        nodes.get(id).incoming.forEach(cable => pending.push(cable.fromModule));
    }

    const issues = [];
    if (nodes.size && ![...nodes.values()].some(node => node.audioOutput)) {
        issues.push({ code: 'missing-output', severity: 'info', message: 'No OUT module', moduleIds: [] });
    }

    nodes.forEach((node, id) => {
        let issue;
        if (node.audioOutput && !node.incoming.length) {
            issue = {
                code: 'output-unconnected', message: 'No input connected',
                ports: portTargets(id, 'input', node.inputs)
            };
        } else if (!node.incoming.length && !node.outgoing.length) {
            issue = { code: 'module-unconnected', message: 'No cables connected' };
        } else if (!node.outgoing.length && node.outputs.length && !useful.has(id)) {
            issue = {
                code: 'outputs-unconnected', message: 'Outputs are unconnected',
                ports: portTargets(id, 'output', node.outputs)
            };
        } else if (!useful.has(id)) {
            issue = { code: 'no-output-route', message: 'No route to an output or monitor' };
        }
        // One actionable diagnosis per module avoids repeating the same cause.
        if (issue) issues.push({ ...issue, severity: 'warning', moduleIds: [id] });
    });

    return { issues, moduleCount: modules.length, cableCount: cables.length };
}
