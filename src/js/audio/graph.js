import { getNestedValue } from '../utils/nested-access.js';
import { getModulePort } from '../rack/module-contract.js';

function compareModuleIds(modules, a, b) {
    const aOrder = modules[a]?.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = modules[b]?.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aRackOrder = modules[a]?.rackOrder ?? Number.MAX_SAFE_INTEGER;
    const bRackOrder = modules[b]?.rackOrder ?? Number.MAX_SAFE_INTEGER;
    if (aRackOrder !== bRackOrder) return aRackOrder - bRackOrder;
    return a.localeCompare(b);
}

function findStronglyConnectedComponents(moduleIds, adjacency) {
    let nextIndex = 0;
    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const components = [];

    function visit(id) {
        indices.set(id, nextIndex);
        lowLinks.set(id, nextIndex);
        nextIndex += 1;
        stack.push(id);
        onStack.add(id);

        for (const next of adjacency.get(id) || []) {
            if (!indices.has(next)) {
                visit(next);
                lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(next)));
            } else if (onStack.has(next)) {
                lowLinks.set(id, Math.min(lowLinks.get(id), indices.get(next)));
            }
        }

        if (lowLinks.get(id) !== indices.get(id)) return;
        const component = [];
        let current;
        do {
            current = stack.pop();
            onStack.delete(current);
            component.push(current);
        } while (current !== id);
        components.push(component);
    }

    moduleIds.forEach(id => {
        if (!indices.has(id)) visit(id);
    });
    return components;
}

export function compileGraph({ modules, cables, blockSize }) {
    const moduleIds = Object.keys(modules);
    const adjacency = new Map(moduleIds.map(id => [id, new Set()]));
    const destinations = new Set();

    const routes = cables.map((cable, index) => {
        const source = modules[cable.fromModule];
        const destination = modules[cable.toModule];
        if (!source) throw new Error(`Cable ${index} references missing source module "${cable.fromModule}"`);
        if (!destination) throw new Error(`Cable ${index} references missing destination module "${cable.toModule}"`);

        const sourcePort = getModulePort(source.def, 'output', cable.fromPort);
        const destinationPort = getModulePort(destination.def, 'input', cable.toPort);
        if (!sourcePort) throw new Error(`Module "${cable.fromModule}" has no output port "${cable.fromPort}"`);
        if (!destinationPort) throw new Error(`Module "${cable.toModule}" has no input port "${cable.toPort}"`);

        const destinationKey = `${cable.toModule}\u0000${cable.toPort}`;
        if (destinations.has(destinationKey)) {
            throw new Error(`Input "${cable.toModule}.${cable.toPort}" has more than one source`);
        }
        destinations.add(destinationKey);

        const sourceBuffer = getNestedValue(source.instance.outputs, cable.fromPort);
        const destinationBuffer = getNestedValue(destination.instance.inputs, cable.toPort);
        if (!(sourceBuffer instanceof Float32Array) || sourceBuffer.length !== blockSize) {
            throw new Error(`Output "${cable.fromModule}.${cable.fromPort}" must be a ${blockSize}-sample Float32Array`);
        }
        if (!(destinationBuffer instanceof Float32Array) || destinationBuffer.length !== blockSize) {
            throw new Error(`Input "${cable.toModule}.${cable.toPort}" must be a ${blockSize}-sample Float32Array`);
        }

        adjacency.get(cable.fromModule).add(cable.toModule);
        return {
            ...cable,
            sourceBuffer,
            destinationBuffer,
            normal: destinationPort.voltage.normal,
            delayedBuffer: null
        };
    });

    const components = findStronglyConnectedComponents(moduleIds, adjacency);
    const componentByModule = new Map();
    components.forEach((component, componentIndex) => {
        component.forEach(id => componentByModule.set(id, componentIndex));
    });
    routes.forEach(route => {
        if (componentByModule.get(route.fromModule) === componentByModule.get(route.toModule)) {
            route.delayedBuffer = new Float32Array(blockSize);
        }
    });

    const componentGraph = new Map(components.map((_, index) => [index, new Set()]));
    const inDegree = new Map(components.map((_, index) => [index, 0]));
    routes.forEach(route => {
        const from = componentByModule.get(route.fromModule);
        const to = componentByModule.get(route.toModule);
        if (from !== to && !componentGraph.get(from).has(to)) {
            componentGraph.get(from).add(to);
            inDegree.set(to, inDegree.get(to) + 1);
        }
    });

    const componentOrder = component => [...component].sort((a, b) => compareModuleIds(modules, a, b));
    const queue = components
        .map((_, index) => index)
        .filter(index => inDegree.get(index) === 0)
        .sort((a, b) => compareModuleIds(modules, componentOrder(components[a])[0], componentOrder(components[b])[0]));
    const processOrder = [];
    while (queue.length) {
        const componentIndex = queue.shift();
        processOrder.push(...componentOrder(components[componentIndex]));
        for (const next of componentGraph.get(componentIndex)) {
            inDegree.set(next, inDegree.get(next) - 1);
            if (inDegree.get(next) === 0) queue.push(next);
        }
        queue.sort((a, b) => compareModuleIds(modules, componentOrder(components[a])[0], componentOrder(components[b])[0]));
    }

    const routesByDestination = new Map(moduleIds.map(id => [id, []]));
    routes.forEach(route => routesByDestination.get(route.toModule).push(route));

    return {
        processOrder,
        routes,
        route(moduleId) {
            for (const route of routesByDestination.get(moduleId) || []) {
                route.destinationBuffer.set(route.delayedBuffer || route.sourceBuffer);
            }
        },
        commitFeedback() {
            routes.forEach(route => route.delayedBuffer?.set(route.sourceBuffer));
        }
    };
}

