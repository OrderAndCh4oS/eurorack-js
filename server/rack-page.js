import { readFile } from 'node:fs/promises';
import { patchHead } from './html.js';

export function introductionImageSource({ variants, darkVariants }) {
    const path = variant => `/patch-previews/introduction/${variant.file}`;
    const fallback = variants.find(variant => variant.width === 1280);
    if (!fallback || !variants.some(variant => variant.width >= 1920)) throw new Error('Introduction needs 1280px and 1920px image variants');
    const srcset = images => [...images].sort((a, b) => a.width - b.width).map(variant => `${path(variant)} ${variant.width}w`).join(', ');
    return {
        attributes: `src="${path(fallback)}" srcset="${srcset(variants)}" data-dark-srcset="${srcset(darkVariants)}" width="${fallback.width}" height="${fallback.height}"`,
        ratio: fallback.width / fallback.height
    };
}

let shell;
export function rackShell() {
    shell ||= Promise.all([
        readFile(new URL('../src/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/patch-previews/introduction/manifest.json', import.meta.url), 'utf8')
    ]).then(([html, manifest]) => {
        const { attributes } = introductionImageSource(JSON.parse(manifest));
        return html.replace('data-demo-image', attributes);
    }).catch(error => {
        shell = null;
        throw error;
    });
    return shell;
}

export function withRackHead(html, head) {
    return html.replace(/<title>[^<]*<\/title>/, () => head);
}

export async function rackPage(patch, baseUrl, patchId) {
    // Only anonymous public metadata reaches HTML; the editor loads the saved
    // state separately through the authenticated API, including for owners.
    return withRackHead(await rackShell(), patchHead(patch, baseUrl, patchId));
}
