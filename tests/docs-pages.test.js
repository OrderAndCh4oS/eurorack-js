import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { DOCS_PAGES, readSocialCards, renderDocPage, renderIntroduction, renderMarkdown, renderRackHome, resolveDocumentLink } from '../scripts/build-docs.mjs';
import sharp from 'sharp';

let socialCards;
beforeAll(async () => { socialCards = await readSocialCards(process.cwd()); });

function expectSocialCard(page, card) {
    const url = `https://eurorackjs.orderandchaos.xyz/social-cards/${card.file}`;
    expect(page.querySelector('meta[name="twitter:card"]').content).toBe('summary_large_image');
    expect(page.querySelector('meta[name="twitter:image"]').content).toBe(url);
    expect(page.querySelector('meta[property="og:image"]').content).toBe(url);
    expect(page.querySelector('meta[property="og:image:type"]').content).toBe('image/png');
    expect(page.querySelector('meta[property="og:image:width"]').content).toBe('1200');
    expect(page.querySelector('meta[property="og:image:height"]').content).toBe('630');
    expect(page.querySelector('meta[property="og:image:alt"]').content).toBe(card.alt);
    expect(page.querySelector('meta[name="twitter:image:alt"]').content).toBe(card.alt);
    expect(page.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
}

describe('published Markdown documentation', () => {
    it('maps published guides locally and repository files to their source', () => {
        expect(resolveDocumentLink('patch-workbench.md#builder-api', 'docs/webmcp.md')).toBe('/docs/patch-workbench#builder-api');
        expect(resolveDocumentLink('../src/js/app/webmcp.js', 'docs/webmcp.md')).toBe('https://github.com/OrderAndCh4oS/eurorack-js/blob/main/src/js/app/webmcp.js');
        expect(resolveDocumentLink('/patches?view=tests', 'docs/index.md')).toBe('/patches?view=tests');
        expect(resolveDocumentLink('javascript:alert(1)', 'docs/index.md')).toBeNull();
    });
    it('keeps embedded markup and code inert', () => {
        const { html } = renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n```js\nconst example = "<img onerror=x>";\n```', 'docs/index.md');
        const page = new DOMParser().parseFromString(html, 'text/html');
        expect(page.querySelector('script, img, a[href^="javascript:"]')).toBeNull();
        expect(page.querySelector('pre code').textContent).toBe('const example = "<img onerror=x>";\n');
    });
    for (const entry of DOCS_PAGES) {
        it(`renders ${entry.path} with navigable headings and metadata`, async () => {
            const html = renderDocPage(entry, await readFile(entry.source, 'utf8'), { socialCard: socialCards[entry.path] });
            const page = new DOMParser().parseFromString(html, 'text/html');
            expectSocialCard(page, socialCards[entry.path]);
            expect(page.querySelectorAll('h1')).toHaveLength(1);
            expect(page.title).toBe(`${entry.title} · Eurorack`);
            expect(page.querySelector('main[data-content-page]').dataset.pageTitle).toBe(page.title);
            expect(page.querySelector('link[rel="canonical"]').href).toBe(`https://eurorackjs.orderandchaos.xyz${entry.path}`);
            for (const anchor of page.querySelectorAll('a[href^="#"]')) {
                expect(page.getElementById(decodeURIComponent(anchor.hash.slice(1))), anchor.outerHTML).not.toBeNull();
            }
            expect(page.querySelector('a[href$=".md"]')?.href).toMatch(/^https:\/\/github.com\//);
        });
    }
    it('includes the rack and its own share metadata in the homepage HTML', async () => {
        const html = renderRackHome(await readFile('src/index.html', 'utf8'), socialCards['/']);
        const page = new DOMParser().parseFromString(html, 'text/html');
        expect(page.getElementById('rack-container')).not.toBeNull();
        expectSocialCard(page, socialCards['/']);
        const canonical = 'https://eurorackjs.orderandchaos.xyz/';
        expect(page.querySelector('link[rel="canonical"]').href).toBe(canonical);
        expect(page.querySelector('meta[property="og:url"]').content).toBe(canonical);
        const description = page.querySelector('meta[name="description"]').content;
        expect(description.length).toBeGreaterThan(0);
        for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
            expect(page.querySelector(selector).content).toBe(page.title);
        }
        for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) {
            expect(page.querySelector(selector).content).toBe(description);
        }
    });
    it('gives Introduction a composed social card distinct from its rack thumbnail', async () => {
        const html = await renderIntroduction(process.cwd(), socialCards['/introduction']);
        const page = new DOMParser().parseFromString(html, 'text/html');
        expectSocialCard(page, socialCards['/introduction']);
        expect(page.querySelector('.marketing-rack img').getAttribute('src')).toMatch(/^\/patch-previews\/introduction\//);
    });
    it('ships distinct, optimized 1200×630 PNGs for every public content page', async () => {
        const cards = Object.values(socialCards);
        expect(new Set(cards.map(card => card.file)).size).toBe(DOCS_PAGES.length + 2);
        for (const card of cards) {
            const image = await readFile(`src/social-cards/${card.file}`);
            const metadata = await sharp(image).metadata();
            expect(metadata).toMatchObject({ format: 'png', width: 1200, height: 630 });
            expect(image.length).toBe(card.bytes);
            expect(image.length).toBeLessThan(800 * 1024);
            expect(card.alt.length).toBeLessThanOrEqual(420);
        }
    });
});
