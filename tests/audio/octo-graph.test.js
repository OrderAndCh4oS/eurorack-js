import { beforeAll, describe, expect, it } from 'vitest';
import { compileGraph } from '../../src/js/audio/graph.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

beforeAll(loadCorePlugin);

const size = 16;
const lanes = [1, 2, 3, 4, 5, 6, 7, 8];

function wire(fromModule, fromPort, toModule, toPort) {
    return { fromModule, fromPort, toModule, toPort };
}

function endpoint(type) {
    const def = pluginRegistry.get(type);
    return { def, order: 0, instance: def.createDSP({ bufferSize: size }) };
}

function scalar(order, sample) {
    const input = new Float32Array(size);
    const output = new Float32Array(size);
    return {
        order,
        def: { id: 'scalar', ui: {
            inputs: [{ id: 'in', port: 'in', signal: 'any' }],
            outputs: [{ id: 'out', port: 'out', signal: 'any' }]
        } },
        instance: {
            inputs: { in: input }, outputs: { out: output },
            process(block) {
                for (let i = 0; i < size; i++) output[i] = sample(input[i], block * size + i);
            }
        }
    };
}

function runBlock(graph, modules, block) {
    for (const id of graph.processOrder) {
        graph.route(id);
        modules[id].instance.process(block);
    }
    graph.commitFeedback();
}

describe('Octo cable routing', () => {
    it('preserves eight simultaneous signals sample for sample on both ends of a trunk fan-out', () => {
        const signals = [
            (_, t) => Math.sin(t) * 5,
            () => 7 / 12,
            (_, t) => 11.125 - t,
            (_, t) => t >= size - 1 && t <= size ? 10 : 0,
            (_, t) => t < size ? 0 : 10,
            (_, t) => (t % 8) / 8 - 0.5,
            () => 0,
            (_, t) => -4 + t / 64
        ];
        const modules = {
            near: endpoint('octo-send'), far: endpoint('octo-receive'), split: endpoint('octo-receive')
        };
        const lanesIn = [], lanesOut = [];
        for (const lane of lanes) {
            modules['source' + lane] = scalar(9, signals[lane - 1]);
            modules['sink' + lane] = scalar(0, value => value);
            lanesIn.push(wire('source' + lane, 'out', 'near', 'in' + lane));
            lanesOut.push(wire('far', 'out' + lane, 'sink' + lane, 'in'));
        }
        const trunks = [wire('near', 'link', 'far', 'link'), wire('near', 'link', 'split', 'link')];
        const outputs = { ...modules.far.instance.outputs };
        for (let block = 0; block < 4; block++) {
            // Unplug a middle input, leave lane 8 in place, then unplug just one trunk.
            const driven = block < 2 ? lanesIn : lanesIn.filter(cable => cable.toPort !== 'in3');
            const cables = [...lanesOut, ...driven, ...(block < 3 ? trunks : trunks.slice(1))];
            const graph = compileGraph({ modules, cables, blockSize: size });
            runBlock(graph, modules, block);
            for (const lane of lanes) {
                const source = modules['source' + lane].instance.outputs.out;
                const silent = new Float32Array(size);
                const expected = block >= 2 && lane === 3 ? silent : source;
                const port = 'out' + lane;
                expect(modules.far.instance.outputs[port]).toBe(outputs[port]);
                expect(outputs[port]).toEqual(block === 3 ? silent : expected);
                expect(modules['sink' + lane].instance.inputs.in).toEqual(outputs[port]);
                expect(modules.split.instance.outputs[port]).toEqual(expected);
                if (block < 2) expect(modules.near.instance.inputs['in' + lane]).toEqual(source);
            }
        }
    });

    it('traces crossed lane numbers and resolves a driverless lane loop to zero independently', () => {
        const modules = {
            A: endpoint('octo-send'), B: endpoint('octo-receive'),
            C: endpoint('octo-send'), D: endpoint('octo-receive'),
            source: scalar(2, (_, t) => t - 3), other: scalar(3, () => -4.5),
            sink: scalar(0, value => value)
        };
        const cables = [
            wire('A', 'link', 'B', 'link'), wire('C', 'link', 'D', 'link'),
            wire('source', 'out', 'A', 'in2'), wire('B', 'out2', 'C', 'in7'), wire('D', 'out7', 'sink', 'in'),
            wire('other', 'out', 'C', 'in2'), wire('D', 'out2', 'A', 'in8'),
            wire('B', 'out4', 'C', 'in6'), wire('D', 'out6', 'A', 'in4')
        ];
        modules.B.instance.outputs.out4.fill(5);
        modules.D.instance.outputs.out6.fill(6);
        const graph = compileGraph({ modules, cables, blockSize: size });
        expect(graph.routes.filter(route => route.delayedBuffer)).toHaveLength(0);
        for (let block = 0; block < 3; block++) {
            runBlock(graph, modules, block);
            expect(modules.D.instance.outputs.out7).toEqual(modules.source.instance.outputs.out);
            expect(modules.sink.instance.inputs.in).toEqual(modules.source.instance.outputs.out);
            expect(modules.B.instance.outputs.out8).toEqual(modules.other.instance.outputs.out);
            expect(modules.B.instance.outputs.out4).toEqual(new Float32Array(size));
            expect(modules.D.instance.outputs.out6).toEqual(new Float32Array(size));
        }
    });

    it('matches direct self-feedback, two-module feedback, and current-block fan-out on the same trunk', () => {
        const makeModules = () => ({
            a: scalar(5, value => value + 1), b: scalar(4, value => value - 3),
            self: scalar(3, value => value * 0.5 + 4), listen: scalar(1, value => value),
            feed: scalar(6, (_, t) => Math.cos(t)), sink: scalar(2, value => value)
        });
        const paths = [['a', 'b', 1], ['b', 'a', 2], ['self', 'self', 3], ['a', 'listen', 1], ['feed', 'sink', 4]];
        const direct = makeModules();
        const snake = { ...makeModules(), near: endpoint('octo-send'), far: endpoint('octo-receive') };
        const directGraph = compileGraph({
            modules: direct, blockSize: size, cables: paths.map(([from, to]) => wire(from, 'out', to, 'in'))
        });
        const snakeGraph = compileGraph({
            modules: snake, blockSize: size, cables: [
                wire('near', 'link', 'far', 'link'),
                ...['a', 'b', 'self', 'feed'].map((from, index) => wire(from, 'out', 'near', 'in' + (index + 1))),
                ...paths.map(([, to, lane]) => wire('far', 'out' + lane, to, 'in'))
            ]
        });
        const feedback = graph => graph.routes.filter(route => route.delayedBuffer)
            .map(route => [route.fromModule, route.fromPort, route.toModule, route.toPort]).sort();
        expect(feedback(snakeGraph)).toEqual(feedback(directGraph));
        for (let block = 0; block < 8; block++) {
            runBlock(directGraph, direct, block);
            runBlock(snakeGraph, snake, block);
            for (const id of Object.keys(direct)) {
                expect(snake[id].instance.inputs.in).toEqual(direct[id].instance.inputs.in);
                expect(snake[id].instance.outputs.out).toEqual(direct[id].instance.outputs.out);
            }
            expect(snake.far.instance.outputs.out1).toEqual(direct.a.instance.outputs.out);
            expect(snake.far.instance.outputs.out3).toEqual(direct.self.instance.outputs.out);
        }
    });

    it('validates every physical cable even on a trunk without consumers', () => {
        const modules = {
            a: endpoint('octo-send'), b: endpoint('octo-send'), c: endpoint('octo-receive'),
            scalar: scalar(0, value => value)
        };
        const compile = (...cables) => compileGraph({ modules, cables, blockSize: size });
        expect(() => compile(wire('a', 'link', 'scalar', 'in'))).toThrow(/LINK/);
        expect(() => compile(wire('scalar', 'out', 'c', 'link'))).toThrow(/LINK/);
        expect(() => compile(wire('c', 'link', 'b', 'in1'))).toThrow(/no output port/);
        expect(() => compile(wire('a', 'link', 'c', 'link'), wire('b', 'link', 'c', 'link')))
            .toThrow(/more than one source/);
        expect(() => compile(wire('c', 'out2', 'b', 'in1'), wire('scalar', 'out', 'b', 'in1')))
            .toThrow(/more than one source/);
    });
});
