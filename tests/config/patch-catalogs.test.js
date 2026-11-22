import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEST_PATCHES } from '../../src/js/config/test-patches.js';
import { ARCHIVED_DEMO_PATCHES, FACTORY_PATCHES } from '../../src/js/config/factory-patches.js';
import { parseImportedPatchJson } from '../../src/js/app/app.js';
import { paginateLocalPatches } from '../../src/js/patches/catalogue-state.js';

describe('patch catalogues', () => {
    it('keeps test patches and archived examples disjoint while preserving the full regression catalogue', () => {
        const tests = Object.keys(TEST_PATCHES);
        const archived = Object.keys(ARCHIVED_DEMO_PATCHES);

        expect(tests.length).toBeGreaterThan(0);
        expect(archived.length).toBeGreaterThan(0);
        expect(tests.every(name => name.startsWith('Test - '))).toBe(true);
        expect(archived.every(name => !name.startsWith('Test - '))).toBe(true);
        expect(tests.filter(name => archived.includes(name))).toEqual([]);
        expect(FACTORY_PATCHES).toEqual({ ...TEST_PATCHES, ...ARCHIVED_DEMO_PATCHES });
    });

    it('loads the test catalogue directly without importing archived musical examples', () => {
        const source = readFileSync(resolve('src/js/config/test-patches.js'), 'utf8');
        const imports = [...source.matchAll(/from ['"]\.\/patches\/([^'"]+)['"]/g)]
            .map(match => match[1]);
        const testFiles = readdirSync(resolve('src/js/config/patches'))
            .filter(name => name.startsWith('test-') && name.endsWith('.js'));

        expect(imports.sort()).toEqual(testFiles.sort());
        expect(imports).toHaveLength(Object.keys(TEST_PATCHES).length);
        expect(source).not.toMatch(/from ['"].*(?:factory-patches|patches\/index|demo-|drums-|sfx-)/);
    });

    it('keeps MIDI starter search links and page cursors valid after the rename', () => {
        const previousName = 'Test - Ableton Live';
        const starter = TEST_PATCHES['Test - MIDI In and Out'];
        const next = TEST_PATCHES['Test - Snare Only'];
        const options = { kind: 'tests', limit: 1 };
        const { nextCursor } = paginateLocalPatches([{ name: previousName }, next], options);
        for (const query of [previousName, starter.name]) {
            expect(paginateLocalPatches(Object.values(TEST_PATCHES), { ...options, query }).patches).toEqual([starter]);
        }
        expect(paginateLocalPatches([starter, next], { ...options, cursor: nextCursor }).patches).toEqual([next]);
    });

    it('archives the colon-named Trip-Hop example and every SFX and drum composition', () => {
        expect(ARCHIVED_DEMO_PATCHES['Demo: Trip-Hop']).toBeDefined();
        expect(ARCHIVED_DEMO_PATCHES['SFX - Shield Impact']).toBeDefined();
        expect(ARCHIVED_DEMO_PATCHES['Drums - Full Kit']).toBeDefined();
        expect(ARCHIVED_DEMO_PATCHES['Demo - Synth Voice 12 - Dynamic Generative']).toBeDefined();
    });

    it('provides an archive that matches the retained source patches and imports as a collection', () => {
        const json = readFileSync(resolve('archive/demo-patches/patches.json'), 'utf8');
        const archive = JSON.parse(json);
        const imported = parseImportedPatchJson(json);

        expect(archive).toMatchObject({
            schema: 'eurorack-js/patch-export',
            version: 1,
            patchVersion: 3,
            patches: ARCHIVED_DEMO_PATCHES
        });
        expect(Object.keys(archive.patches).sort()).toEqual(Object.keys(ARCHIVED_DEMO_PATCHES).sort());
        expect(imported.type).toBe('collection');
        expect(imported.names.sort()).toEqual(Object.keys(ARCHIVED_DEMO_PATCHES).sort());
        Object.entries(imported.patches).forEach(([name, patch]) => {
            expect(patch.factory).toBe(false);
            expect(patch.state).toEqual(ARCHIVED_DEMO_PATCHES[name].state);
        });
    });
});
