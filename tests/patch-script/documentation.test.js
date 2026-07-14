import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { executePatchScript } from '../../src/js/patch-script/builder.js';
import { compilePatchDescription } from '../../src/js/patch-script/compiler.js';
import { loadCorePlugin, pluginRegistry } from '../../src/js/rack/registry.js';

const DOCUMENTS = [
    'README.md',
    'docs/patch-workbench.md',
    'docs/patch-workbench-guide.md'
];

function executableExamples(markdown) {
    return [...markdown.matchAll(/<!-- executable-patch -->\s*```javascript\s*\n([\s\S]*?)```/g)]
        .map(match => match[1]);
}

beforeAll(async () => {
    await loadCorePlugin();
});

describe('patch workbench documentation', () => {
    for (const filename of DOCUMENTS) {
        it(`keeps every executable example in ${filename} valid`, async () => {
            const markdown = await readFile(filename, 'utf8');
            const examples = executableExamples(markdown);
            expect(examples.length).toBeGreaterThan(0);
            examples.forEach((source, index) => {
                expect(() => compilePatchDescription(executePatchScript(source), {
                    registry: pluginRegistry,
                    blockSize: 16
                }), `${filename} example ${index + 1}`).not.toThrow();
            });
        });
    }
});
