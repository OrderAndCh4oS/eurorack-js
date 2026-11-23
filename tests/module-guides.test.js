import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MODULE_GUIDES, writeModuleSocialCard } from '../scripts/module-guides.mjs';
import { renderDocPage } from '../scripts/build-docs.mjs';
import { TEST_PATCHES } from '../src/js/config/test-patches.js';
import { CORE_MODULE_DEFINITIONS } from '../src/js/rack/core-definitions.js';
import { testPatchAt } from '../src/js/ui/patch-library.js';

const origin = 'https://eurorackjs.orderandchaos.xyz';

describe('musician module guides', () => {
    it('provides exactly one guide per built-in module', () => {
        expect(MODULE_GUIDES.map(guide => guide.id).sort()).toEqual(CORE_MODULE_DEFINITIONS.map(def => def.id).sort());
    });

    it('renders distinct narrow and wide letters in the share-card title', async () => {
        const out = await mkdtemp(join(tmpdir(), 'module-guide-card-'));
        try {
            await mkdir(join(out, 'social-cards'));
            const widths = [];
            for (const title of ['IIIIII', 'WWWWWW']) {
                const card = await writeModuleSocialCard({ ...MODULE_GUIDES[0], title }, process.cwd(), out);
                const titleRegion = await sharp(join(out, 'social-cards', card.file))
                    .extract({ left: 42, top: 200, width: 560, height: 200 }).png().toBuffer();
                const { info } = await sharp(titleRegion).trim().png().toBuffer({ resolveWithObject: true });
                widths.push(info.width);
            }
            expect(widths[1]).toBeGreaterThan(widths[0] * 2);
        } finally {
            await rm(out, { recursive: true, force: true });
        }
    });

    it.each(MODULE_GUIDES)('documents the panel and opens the illustrated demo for $id', async guide => {
        const definition = CORE_MODULE_DEFINITIONS.find(def => def.id === guide.id);
        const markdown = await readFile(guide.source, 'utf8');
        const socialCard = { file: 'example.png', width: 1200, height: 630, mimeType: 'image/png', alt: guide.title };
        const page = new DOMParser().parseFromString(renderDocPage(guide, markdown, { socialCard }), 'text/html');
        expect(page.querySelector('.docs-header h1').textContent).toBe(guide.title);
        expect(page.querySelector('.docs-intro').textContent).toBe(guide.description);
        expect(page.querySelector('link[rel=canonical]').href).toBe(origin + guide.path);
        expect(page.querySelectorAll('.docs-prose > ol:first-of-type > li').length).toBeGreaterThanOrEqual(2);
        for (const section of ['try-the-patch', 'in-a-composition', 'panel-reference', 'design-background']) {
            expect(page.getElementById(section)).not.toBeNull();
        }
        const demo = page.querySelector('.docs-demo');
        const patch = testPatchAt(new URL(demo.querySelector('a').getAttribute('href'), origin));
        expect(patch).toBe(TEST_PATCHES[guide.patch]);
        expect(patch.state.modules.some(module => module.type === guide.id)).toBe(true);
        expect(demo.querySelector('img').getAttribute('src')).toBe('/patch-previews/' + guide.preview.light.file);
        expect(demo.querySelector('img').dataset.darkSrcset).toBe('/patch-previews/' + guide.preview.dark.file);
        expect(page.querySelector(`a[href$="/research/modules/${guide.id}.md"]`)).not.toBeNull();

        const { knobs = [], switches = [], buttons = [], actions = [], inputs, outputs } = definition.ui;
        for (const [heading, fields] of [['controls', [...knobs, ...switches, ...buttons, ...actions]], ['inputs', inputs], ['outputs', outputs]]) {
            if (!fields?.length) continue;
            const table = page.getElementById(heading).nextElementSibling;
            const documented = [...table.querySelectorAll('tbody td:first-child code')].map(code => code.textContent);
            expect(documented.sort()).toEqual(fields.map(field => field.param || field.port || field.id).sort());
        }
    });

    it('only treats known built-in test patches at the rack root as playable links', () => {
        for (const path of ['/?test=constructor', '/?test=missing', '/?test=Test+-+Chorus#patch', '/patches?test=Test+-+Chorus']) {
            expect(testPatchAt(new URL(path, origin))).toBeNull();
        }
    });
});
