import { describe, expect, it } from 'vitest';
import { compileGraph } from '../../src/js/audio/graph.js';

function definition(id) {
    return {
        id,
        ui: {
            inputs: [{ id: 'in', port: 'in', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } }],
            outputs: [{ id: 'out', port: 'out', signal: 'any', voltage: { min: -10, max: 10 } }]
        }
    };
}

function moduleRecord(id, order) {
    return {
        type: id,
        def: definition(id),
        order,
        rackOrder: order,
        instance: {
            inputs: { in: new Float32Array(4) },
            outputs: { out: new Float32Array(4) }
        }
    };
}

describe('compiled audio graph', () => {
    it('rejects multiple sources for one input', () => {
        const modules = { a: moduleRecord('a', 0), b: moduleRecord('b', 1), c: moduleRecord('c', 2) };
        expect(() => compileGraph({
            modules,
            blockSize: 4,
            cables: [
                { fromModule: 'a', fromPort: 'out', toModule: 'c', toPort: 'in' },
                { fromModule: 'b', fromPort: 'out', toModule: 'c', toPort: 'in' }
            ]
        })).toThrow('more than one source');
    });

    it('uses the previous block for every edge inside a feedback component', () => {
        const modules = { a: moduleRecord('a', 0), b: moduleRecord('b', 1) };
        const graph = compileGraph({
            modules,
            blockSize: 4,
            cables: [
                { fromModule: 'a', fromPort: 'out', toModule: 'b', toPort: 'in' },
                { fromModule: 'b', fromPort: 'out', toModule: 'a', toPort: 'in' }
            ]
        });

        graph.route('a');
        modules.a.instance.outputs.out.fill(modules.a.instance.inputs.in[0] + 1);
        graph.route('b');
        modules.b.instance.outputs.out.fill(modules.b.instance.inputs.in[0] + 2);
        graph.commitFeedback();
        expect([...modules.a.instance.inputs.in]).toEqual([0, 0, 0, 0]);
        expect([...modules.b.instance.inputs.in]).toEqual([0, 0, 0, 0]);

        graph.route('a');
        graph.route('b');
        expect([...modules.a.instance.inputs.in]).toEqual([2, 2, 2, 2]);
        expect([...modules.b.instance.inputs.in]).toEqual([1, 1, 1, 1]);
    });
});

