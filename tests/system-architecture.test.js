import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FACTORY_PATCHES } from '../src/js/config/factory-patches.js';
import { CATEGORY_ORDER, MODULE_MANIFEST } from '../src/js/rack/module-manifest.js';

const CATEGORY_LABELS = {
    midi: 'MIDI',
    clock: 'Clock',
    source: 'Sources',
    voice: 'Voices',
    modulation: 'Modulation',
    sequencer: 'Sequencers',
    quantizer: 'Quantizer',
    filter: 'Filters',
    effect: 'Effects',
    utility: 'Utility',
    output: 'Output',
    other: 'Other'
};

describe('visual system architecture guide', () => {
    let document;
    let definitions;

    beforeAll(async () => {
        const html = readFileSync(resolve('src/system-architecture.html'), 'utf8');
        document = new DOMParser().parseFromString(html, 'text/html');
        definitions = await Promise.all(MODULE_MANIFEST.map(async entry => (
            (await entry.load()).default
        )));
    });

    it('derives its headline and catalog totals from the current module manifest', () => {
        const moduleCount = MODULE_MANIFEST.length;
        const facts = [...document.querySelectorAll('.fact')];
        const moduleFact = facts.find(fact => fact.querySelector('span')?.textContent === 'built-in modules');
        const startupDiagram = document.querySelector('#startup .mermaid').textContent;
        const catalogHeading = document.querySelector('#catalog h3').textContent;
        const catalogDiagram = document.querySelector('#catalog .mermaid').textContent;

        expect(moduleFact.querySelector('b').textContent).toBe(String(moduleCount));
        expect(startupDiagram).toContain(`load + validate ${moduleCount} definitions`);
        expect(catalogHeading).toContain(`${moduleCount} built-in modules by category`);
        expect(catalogDiagram).toContain(`module library · ${moduleCount}`);
    });

    it('lists every current category, module id, and category total', () => {
        const catalogDiagram = document.querySelector('#catalog .mermaid').innerHTML;

        CATEGORY_ORDER.forEach(category => {
            const categoryDefinitions = definitions.filter(definition => definition.category === category);

            expect(catalogDiagram).toContain(`${CATEGORY_LABELS[category]} · ${categoryDefinitions.length}`);
            categoryDefinitions.forEach(definition => {
                const escapedId = definition.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                expect(catalogDiagram).toMatch(new RegExp(`(^|[\\s·>])${escapedId}(?=$|[\\s·<"])`, 'm'));
            });
        });
    });

    it('tracks the current factory patch and focused DSP suite totals', () => {
        const fileMap = document.querySelector('#files').textContent;
        const qualitySection = document.querySelector('#quality').textContent;
        const dspSuiteCount = readdirSync(resolve('tests/dsp'))
            .filter(filename => filename.endsWith('.test.js')).length;

        expect(fileMap).toContain(`${Object.keys(FACTORY_PATCHES).length} factory`);
        expect(qualitySection).toContain(`${dspSuiteCount} focused DSP suites`);
    });

    it('documents current runtime-state, output, URL, and graph-revision behavior', () => {
        const pageText = document.body.textContent;

        expect(pageText).toContain('CV Recorder lane buffers');
        expect(pageText).toContain('hard-limit stereo');
        expect(pageText).toContain('immutable deployed core-token snapshot');
        expect(pageText).toContain('ordered-module digest');
        expect(pageText).not.toContain('Gesture recordings');
        expect(document.querySelectorAll('#quality > .grid-2 > article.card')).toHaveLength(2);
    });
});
