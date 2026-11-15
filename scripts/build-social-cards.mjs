import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS_PAGES } from './docs-manifest.mjs';

// Run deliberately after updating the Introduction rack preview or docs metadata:
// node scripts/build-social-cards.mjs
// Cards are committed static PNGs. Rendering needs neither a local HTTP server
// nor a runtime image service; all browser assets are embedded from source files.
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;
const FONT_FILE = 'src/fonts/space-grotesk-bold-latin.24928473.woff2';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const absoluteRoot = root => root instanceof URL ? fileURLToPath(root) : resolve(root);

async function readSources(root) {
    root = absoluteRoot(root);
    const previewRoot = join(root, 'src/patch-previews/introduction');
    const [previewText, font, introduction, script, docsManifest] = await Promise.all([
        readFile(join(previewRoot, 'manifest.json'), 'utf8'),
        readFile(join(root, FONT_FILE)),
        readFile(join(root, 'src/introduction.html'), 'utf8'),
        readFile(join(root, 'scripts/build-social-cards.mjs')),
        readFile(join(root, 'scripts/docs-manifest.mjs'))
    ]);
    const preview = JSON.parse(previewText);
    const variant = [...preview.variants].sort((a, b) => a.width - b.width).find(image => image.width >= 960);
    if (!variant || !/^[a-f0-9]{64}\.webp$/.test(variant.file)) throw new Error('A hashed Introduction preview of at least 960px is required.');
    const rack = await readFile(join(previewRoot, variant.file));
    if (`${sha256(rack)}.webp` !== variant.file) throw new Error('The Introduction preview content does not match its filename.');
    const description = introduction.match(/<meta\s+name="description"\s+content="([^"]+)"\s*\/?\s*>/i)?.[1];
    if (!description) throw new Error('The Introduction page needs a meta description for its social card.');
    return { root, preview, variant, rack, font, description, script, docsManifest };
}

function fingerprint(sources) {
    return sha256(JSON.stringify({
        version: 1,
        width: WIDTH,
        height: HEIGHT,
        generator: sha256(sources.script),
        docsManifest: sha256(sources.docsManifest),
        introductionDescription: sources.description,
        rackState: sources.preview.stateHash,
        rackRenderer: sources.preview.rendererVersion,
        rackImage: sha256(sources.rack),
        fontFile: FONT_FILE,
        font: sha256(sources.font)
    }));
}

/** Safe to import during the normal build: no browser is started here. */
export async function getSocialCardSourceFingerprint(root = PROJECT_ROOT) {
    return fingerprint(await readSources(root));
}

function cardDocument(card, sources) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:Card;src:url(data:font/woff2;base64,${sources.font.toString('base64')}) format('woff2');font-weight:700;font-style:normal;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
body{background:#f0eee2;color:#0b0b09;font-family:Card,sans-serif;font-weight:700;font-synthesis:none}
.card{width:100%;height:100%;border:4px solid #0b0b09;padding:0 36px;display:grid;grid-template-rows:86px 1fr 54px}
header{display:flex;align-items:center;gap:16px;border-bottom:4px solid #0b0b09;font-size:30px;line-height:1}
.brand{background:#ff4a0a;padding:11px 15px 12px;letter-spacing:0}
.section{font-family:'Courier New',Courier,monospace;font-weight:700;font-size:18px;line-height:1.2;margin-left:auto}
main{display:grid;grid-template-columns:1.14fr 1fr;gap:32px;min-height:0;padding:28px 0}
.copy{align-self:center;min-width:0;padding-right:4px}
h1{font-size:64px;line-height:1.03;letter-spacing:0;text-transform:uppercase;margin:0;max-height:205px;overflow-wrap:normal}
p{font-family:'Courier New',Courier,monospace;font-weight:400;font-size:22px;line-height:1.4;letter-spacing:0;margin:25px 0 0;max-width:530px}
.rack{min-width:0;min-height:0;border-left:4px solid #0b0b09;padding-left:28px;display:flex;align-items:center;justify-content:center}
img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
footer{border-top:4px solid #0b0b09;display:flex;align-items:center;font-family:'Courier New',Courier,monospace;font-weight:400;font-size:17px;line-height:1;letter-spacing:0}
</style></head><body><article class="card"><header><span class="brand">EURORACKJS</span>${card.section ? `<span class="section">${html(card.section)}</span>` : ''}</header><main><div class="copy"><h1>${html(card.title)}</h1><p>${html(card.description)}</p></div><div class="rack"><img alt="" src="data:image/webp;base64,${sources.rack.toString('base64')}"></div></main><footer>eurorackjs.orderandchaos.xyz${html(card.path)}</footer></article></body></html>`;
}

export async function buildSocialCards(root = PROJECT_ROOT) {
    const sources = await readSources(root);
    const target = join(sources.root, 'src/social-cards');
    const cards = [
        { path: '/introduction', title: 'Modular synthesis', description: sources.description, section: '' },
        ...DOCS_PAGES.map(page => ({ path: page.path, title: page.path === '/docs' ? 'Documentation' : page.navTitle,
            description: page.description, section: page.path === '/docs' ? '' : 'DOCUMENTATION' }))
    ];
    let previous;
    try { previous = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }

    const [{ chromium }, { default: sharp }] = await Promise.all([import('@playwright/test'), import('sharp')]);
    const browser = await chromium.launch({ headless: true });
    const rendered = [];
    try {
        const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
        // Rendering is completely local. Fail any accidental external request.
        await page.route('**/*', route => route.abort());
        for (const card of cards) {
            await page.setContent(cardDocument(card, sources), { waitUntil: 'load' });
            await page.evaluate(async () => {
                await document.fonts.ready;
                if (!document.fonts.check('700 64px Card')) throw new Error('Social-card font did not load.');
                await Promise.all([...document.images].map(image => image.decode()));
                const title = document.querySelector('h1');
                const copy = document.querySelector('.copy');
                const main = document.querySelector('main');
                let size = 64;
                while ((title.scrollWidth > title.clientWidth || title.scrollHeight > 205 || copy.getBoundingClientRect().height > main.clientHeight - 56) && size > 48) {
                    title.style.fontSize = `${--size}px`;
                }
                if (title.scrollWidth > title.clientWidth || title.scrollHeight > 205 || copy.getBoundingClientRect().height > main.clientHeight - 56) throw new Error('Social-card text does not fit.');
                for (const element of document.querySelectorAll('header, h1, p, img, footer')) {
                    const rect = element.getBoundingClientRect();
                    if (rect.left < 4 || rect.top < 4 || rect.right > 1196 || rect.bottom > 626) throw new Error('Social-card content leaves the canvas.');
                }
            });
            const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
            const image = await sharp(screenshot).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
            const file = `${sha256(image)}.png`;
            rendered.push({ image, path: card.path, record: { file, url: `/social-cards/${file}`, width: WIDTH, height: HEIGHT,
                bytes: image.length, mimeType: 'image/png', alt: `EurorackJS — ${card.title}. A rack of modules connected with coloured patch cables.` } });
        }
    } finally { await browser.close(); }

    await mkdir(target, { recursive: true });
    for (const result of rendered) await writeFile(join(target, result.record.file), result.image);
    const manifest = { version: 1, sourceFingerprint: fingerprint(sources), width: WIDTH, height: HEIGHT,
        cards: Object.fromEntries(rendered.map(result => [result.path, result.record])) };
    await writeFile(join(target, 'manifest.json.tmp'), `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(join(target, 'manifest.json.tmp'), join(target, 'manifest.json'));
    const retained = new Set(rendered.map(result => result.record.file));
    for (const card of Object.values(previous?.cards || {})) {
        if (/^[a-f0-9]{64}\.png$/.test(card.file) && !retained.has(card.file)) {
            await unlink(join(target, card.file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
    }
    for (const result of rendered) console.log(`${result.path}: ${WIDTH}×${HEIGHT}, ${result.record.bytes.toLocaleString('en-GB')} bytes`);
    return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await buildSocialCards();
}
