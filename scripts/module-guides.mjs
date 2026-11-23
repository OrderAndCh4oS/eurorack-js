import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { MODULE_DEMOS } from '../src/js/config/module-demos.js';
import { TEST_PATCH_PREVIEWS } from '../src/js/config/test-patch-previews.js';
import { CATEGORY_LABELS } from '../src/js/rack/module-manifest.js';
import { CORE_MODULE_DEFINITIONS } from '../src/js/rack/core-definitions.js';

const definitions = new Map(CORE_MODULE_DEFINITIONS.map(definition => [definition.id, definition]));

export const MODULE_GUIDES = MODULE_DEMOS.map(({ id, patch, title, intro }) => {
    const definition = definitions.get(id);
    return {
        id, title, navTitle: title, description: intro, path: `/docs/modules/${id}`,
        group: CATEGORY_LABELS[definition.category], source: `docs/modules/${id}.md`,
        patch, panel: definition.name, preview: TEST_PATCH_PREVIEWS[patch]
    };
});

// The rack thumbnail is the actual demo. Compose the share image during the
// docs build so changing a guide or patch does not require a browser capture.
export async function writeModuleSocialCard(page, root, out) {
    process.env.FONTCONFIG_FILE ??= join(root, 'scripts/module-card-fonts.conf');
    const width = 1200, height = 630;
    const xml = value => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
    const title = await sharp({ text: {
        text: xml(page.title), font: 'Space Grotesk Bold 60',
        fontfile: join(root, 'src/fonts/space-grotesk-bold-latin.24928473.woff2'),
        width: 560, wrap: 'word', rgba: true
    } }).png().toBuffer({ resolveWithObject: true });
    const rack = await sharp(join(root, 'src/patch-previews', page.preview.light.file))
        .resize({ width: 486, height: 454, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
    const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
        <rect width="1200" height="630" fill="#f4f1e7"/><rect x="648" width="552" height="630" fill="#262722"/>
        <rect x="42" y="46" width="30" height="30" fill="#ff571a"/>
        <g font-family="Space Grotesk" font-size="23" font-weight="bold" fill="#171813">
        <text x="89" y="69">EURORACK JS</text><text x="44" y="566">Module demos / ${xml(page.group)}</text></g>
        <path d="M42 510H604" stroke="#171813" stroke-width="3"/></svg>`);
    const image = await sharp(backdrop).composite([
        { input: title.data, left: 42, top: Math.round(300 - title.info.height / 2) },
        { input: rack.data, left: Math.round(924 - rack.info.width / 2), top: Math.round(315 - rack.info.height / 2) }
    ]).png({ palette: true }).toBuffer();
    const file = createHash('sha256').update(image).digest('hex') + '.png';
    await writeFile(join(out, 'social-cards', file), image);
    return { file, width, height, mimeType: 'image/png', alt: `${page.title} and its EurorackJS demo rack.` };
}
