import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { Marked } from 'marked';
import { highlightPatchScript } from '../src/js/patch-script/syntax-highlighter.js';
import { DOCS_PAGES, RACK_HOME } from './docs-manifest.mjs';
import introductionDemo from '../src/js/config/patches/demo-introduction.js';
import { PATCH_PREVIEW_RENDERER_VERSION } from '../src/js/patches/patch-preview.js';
import { getSocialCardSourceFingerprint } from './build-social-cards.mjs';
import { introductionImageSource, withRackHead } from '../server/rack-page.js';

export { DOCS_PAGES } from './docs-manifest.mjs';
const ORIGIN = 'https://eurorackjs.orderandchaos.xyz';
const REPOSITORY = 'https://github.com/OrderAndCh4oS/eurorack-js/blob/main/';
const published = new Map(DOCS_PAGES.map(page => [page.source, page.path]));
export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

/** Resolve against the Markdown source, not the generated HTML directory. */
export function resolveDocumentLink(href, source) {
    const value = String(href).trim();
    if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
    if (value.startsWith('#')) return value;
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
        try {
            const url = new URL(value, ORIGIN);
            return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null;
        } catch { return null; }
    }
    const match = value.match(/^([^?#]*)([?#].*)?$/);
    const filename = match[1], suffix = match[2] || '';
    const resolved = posix.normalize(filename.startsWith('/') ? filename.slice(1) : posix.join(posix.dirname(source), filename));
    if (published.has(resolved)) return published.get(resolved) + suffix;
    if (filename.startsWith('/')) return value;
    // Repository-only references (source, research, archives) remain usable.
    if (resolved.startsWith('../') || resolved === '..') return null;
    return REPOSITORY + resolved.split('/').map(encodeURIComponent).join('/') + suffix;
}

const plainText = tokens => tokens.map(token => token.tokens ? plainText(token.tokens) : token.text || '').join('');
const headingSlug = text => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';

export function renderMarkdown(markdown, source, { extractHeader = false } = {}) {
    const headings = [], usedIds = new Set();
    let codeCount = 0, tableCount = 0;
    const renderer = {
        heading({ tokens, depth }) {
            const title = plainText(tokens), base = headingSlug(title);
            let id = base, suffix = 0;
            while (usedIds.has(id)) id = `${base}-${++suffix}`;
            usedIds.add(id);
            if (depth === 2 || depth === 3) headings.push({ id, title, depth });
            return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}<a class="docs-heading-link" href="#${escapeHtml(id)}" aria-label="Link to ${escapeHtml(title)}">#</a></h${depth}>\n`;
        },
        link({ href, title, tokens }) {
            const content = this.parser.parseInline(tokens), url = resolveDocumentLink(href, source);
            if (!url) return content;
            return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${content}</a>`;
        },
        image({ href, title, text }) {
            const url = resolveDocumentLink(href, source);
            return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">` : escapeHtml(text);
        },
        html({ text }) {
            // Repository Markdown is trusted, but arbitrary embedded HTML is not
            // part of the public docs format. Keep code inert and omit comments.
            return /^\s*<!--[\s\S]*-->\s*$/.test(text) ? '' : escapeHtml(text);
        },
        code({ text, lang }) {
            const language = (lang || 'text').split(/\s/)[0], id = `docs-code-${++codeCount}`;
            const highlighted = ['js', 'javascript'].includes(language) ? highlightPatchScript(text) : escapeHtml(text);
            return `<div class="docs-code"><div class="docs-code-toolbar"><span>${escapeHtml(language)}</span><button type="button" data-copy-code aria-label="Copy code example ${codeCount}" aria-controls="${id}">Copy</button></div><pre tabindex="0"><code id="${id}" class="language-${escapeHtml(language)}">${highlighted}\n</code></pre></div>\n`;
        },
        table({ header, rows }) {
            const cell = (value, tag) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}${value.align ? ` class="docs-cell-${escapeHtml(value.align)}"` : ''}>${this.parser.parseInline(value.tokens)}</${tag}>`;
            return `<div class="docs-table" tabindex="0" role="region" aria-label="Table ${++tableCount}"><table><thead><tr>${header.map(value => cell(value, 'th')).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => cell(value, 'td')).join('')}</tr>`).join('')}</tbody></table></div>\n`;
        }
    };
    const parser = new Marked({ gfm: true, renderer });
    const tokens = parser.lexer(markdown);
    let title = '', intro = '';
    if (extractHeader) {
        if (tokens[0]?.type === 'heading' && tokens[0].depth === 1) title = plainText(tokens.shift().tokens);
        while (tokens[0]?.type === 'space') tokens.shift();
        if (tokens[0]?.type === 'paragraph') intro = parser.parser([tokens.shift()]);
    }
    const html = parser.parser(tokens);
    return { html, headings, title, intro };
}

export function renderSiteNavigation(path) {
    const active = path.startsWith('/docs') ? '/docs' : path;
    const patchLinks = [['/', 'Rack'], ['/?new=1', 'New patch'], ['/patches?view=mine', 'My patches'], ['/patches', 'Public patches'], ['/patches?view=tests', 'Test patches']];
    const siteLinks = [['/introduction', 'Introduction'], ['/docs', 'Docs']];
    const links = entries => entries.map(([href, label]) => `<a href="${escapeHtml(href)}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    return `<nav class="patch-navigation" aria-label="Patch views">
    <div class="patch-view-tabs">${links(patchLinks)}</div>
    <div class="patch-site-links">${links(siteLinks)}</div>
    <div class="patch-account-actions">
        <button type="button" data-theme-mode-toggle aria-pressed="false" hidden>Dark mode</button>
        <button id="patchProfile" type="button" aria-haspopup="dialog" hidden>My profile</button>
        <button id="patchAccount" type="button">Sign in</button>
    </div>
</nav>
<div id="patchNotice" class="patch-notice" role="status" aria-live="polite" hidden></div>`;
}

export function renderSocialImageTags(card) {
    if (!card) throw new Error('A social card is required for published pages');
    const url = `${ORIGIN}/social-cards/${card.file}`;
    return `<meta property="og:image" content="${url}"><meta property="og:image:type" content="${escapeHtml(card.mimeType)}"><meta property="og:image:width" content="${card.width}"><meta property="og:image:height" content="${card.height}"><meta property="og:image:alt" content="${escapeHtml(card.alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${url}"><meta name="twitter:image:alt" content="${escapeHtml(card.alt)}">`;
}

export async function readSocialCards(root) {
    const manifest = JSON.parse(await readFile(join(root, 'src/social-cards/manifest.json'), 'utf8'));
    if (manifest.sourceFingerprint !== await getSocialCardSourceFingerprint(root)) {
        throw new Error('Social cards are stale. Run npm run build:social-cards, then rebuild.');
    }
    for (const path of [RACK_HOME.path, '/introduction', ...DOCS_PAGES.map(page => page.path)]) {
        const card = manifest.cards[path];
        if (!card || !/^[a-f0-9]{64}\.png$/.test(card.file) || card.width !== 1200 || card.height !== 630 || card.mimeType !== 'image/png' || !card.alt) {
            throw new Error(`Missing or invalid social card: ${path}`);
        }
        const image = await readFile(join(root, 'src/social-cards', card.file));
        if (createHash('sha256').update(image).digest('hex') + '.png' !== card.file) throw new Error(`Social card content hash does not match: ${path}`);
    }
    return manifest.cards;
}

function publicPageHead({ title, description, path }, socialCard) {
    const fullTitle = `${title} · Eurorack`;
    return `<title>${escapeHtml(fullTitle)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${ORIGIN}${escapeHtml(path)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="EurorackJS"><meta property="og:locale" content="en_GB"><meta property="og:title" content="${escapeHtml(fullTitle)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${ORIGIN}${escapeHtml(path)}">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}"><meta name="twitter:description" content="${escapeHtml(description)}">
${renderSocialImageTags(socialCard)}`;
}

export function renderRackHome(shell, socialCard) {
    return withRackHead(shell, publicPageHead(RACK_HOME, socialCard));
}

export function renderSitePage({ title, description, path, content, socialCard, styles = [] }) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
${publicPageHead({ title, description, path }, socialCard)}
<link rel="preload" href="/fonts/space-grotesk-bold-latin.24928473.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/industrial-theme.css">
<script type="module" blocking="render" src="/js/app/theme-mode.js"></script>
<link rel="stylesheet" href="/patch-library.css"><link rel="stylesheet" href="/site.css">${styles.map(style => `<link rel="stylesheet" href="${escapeHtml(style)}">`).join('')}
</head><body class="site-page">
<a class="site-skip-link" href="#main-content">Skip to content</a>
${renderSiteNavigation(path)}
${content}
<footer class="site-footer"><span>Eurorack JS · A modular synthesizer in your browser</span><nav aria-label="Footer"><a href="/docs">Docs</a><a href="https://github.com/OrderAndCh4oS/eurorack-js">GitHub</a><a href="/privacy-policy">Privacy</a><a href="/terms-of-service">Terms</a></nav></footer>
<script type="module" src="/js/ui/content-page.js"></script>
</body></html>\n`;
}

function sidebar(current) {
    const groups = [...new Set(DOCS_PAGES.map(page => page.group))];
    return `<aside class="docs-sidebar"><details class="docs-menu" open><summary>Contents</summary><nav aria-label="Documentation">${groups.map(group => `<div class="docs-nav-group"><p>${escapeHtml(group)}</p><ul>${DOCS_PAGES.filter(page => page.group === group).map(page => `<li><a href="${page.path}"${page.path === current.path ? ' aria-current="page"' : ''}>${escapeHtml(page.navTitle)}</a></li>`).join('')}</ul></div>`).join('')}</nav></details></aside>`;
}

export function renderDocPage(page, markdown, { socialCard } = {}) {
    const { html, headings, intro } = renderMarkdown(markdown, page.source, { extractHeader: true });
    const index = DOCS_PAGES.findIndex(entry => entry.path === page.path), previous = DOCS_PAGES[index - 1], next = DOCS_PAGES[index + 1];
    const pagination = `<nav class="docs-pagination" aria-label="More documentation">${previous ? `<a rel="prev" href="${previous.path}"><span>← Previous</span><strong>${escapeHtml(previous.navTitle)}</strong></a>` : '<span></span>'}${next ? `<a rel="next" href="${next.path}"><span>Next →</span><strong>${escapeHtml(next.navTitle)}</strong></a>` : ''}</nav>`;
    const toc = `<aside class="docs-toc"><details open><summary>On this page</summary><nav aria-label="On this page"><ol>${headings.map(heading => `<li class="docs-toc-level-${heading.depth}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a></li>`).join('')}</ol></nav></details></aside>`;
    const content = `<main id="main-content" data-content-page data-page-title="${escapeHtml(page.title)} · Eurorack" class="docs-page${page.path === '/docs' ? ' docs-index' : ''}" tabindex="-1"><div class="docs-layout">${sidebar(page)}<article class="docs-article"><header class="docs-header"><p class="docs-eyebrow">Documentation / ${escapeHtml(page.group)}</p><h1>${escapeHtml(page.title)}</h1><div class="docs-intro">${intro}</div></header><div class="docs-prose">${html}</div>${pagination}<p class="docs-source"><a href="${REPOSITORY}${page.source}">View Markdown on GitHub <span aria-hidden="true">↗</span></a></p></article>${toc}</div></main>`;
    return renderSitePage({ ...page, content, socialCard, styles: ['/docs.css'] });
}

export async function renderIntroduction(root, socialCard) {
    const introduction = await readFile(join(root, 'src/introduction.html'), 'utf8');
    const preview = JSON.parse(await readFile(join(root, 'src/patch-previews/introduction/manifest.json'), 'utf8'));
    const stateHash = createHash('sha256').update(JSON.stringify(introductionDemo.state)).digest('hex');
    if (preview.stateHash !== stateHash || preview.rendererVersion !== PATCH_PREVIEW_RENDERER_VERSION) {
        throw new Error('Introduction preview is stale. Run npm run build:introduction-preview against the local preview server.');
    }
    for (const variant of [...preview.variants, ...preview.darkVariants]) {
        if (!/^[a-f0-9]{64}\.webp$/.test(variant.file)) throw new Error('Invalid introduction image filename');
        const image = await readFile(join(root, 'src/patch-previews/introduction', variant.file));
        if (createHash('sha256').update(image).digest('hex') + '.webp' !== variant.file) throw new Error('Introduction image content hash does not match');
    }
    // Match the hero's height-constrained rack, grid and padding.
    // Keep the full rack visible without downloading pixels for empty side margins.
    const { attributes, ratio } = introductionImageSource(preview);
    const sizes = `(max-width: 680px) calc(100vw - 50px), (max-width: 980px) min(calc(92vw - 34px), ${Math.ceil(520 * ratio)}px), min(calc(46.1vw - 34px), ${(54 * ratio).toFixed(3)}svh, ${Math.ceil(560 * ratio)}px)`;
    const image = `<img ${attributes} sizes="${sizes}" fetchpriority="high" decoding="async" alt="The EurorackJS demo patch, with its modules and patch cables.">`;
    const replacements = {
        '<!-- SITE_NAVIGATION -->': renderSiteNavigation('/introduction'),
        '<!-- INTRODUCTION_PREVIEW -->': image,
        '<!-- SOCIAL_IMAGE_TAGS -->': renderSocialImageTags(socialCard),
        '{{INTRODUCTION_DEMO_NAME}}': escapeHtml(introductionDemo.name),
        '{{INTRODUCTION_DEMO_DESCRIPTION}}': escapeHtml(introductionDemo.description),
        '{{INTRODUCTION_DEMO_URL}}': '/?demo=introduction'
    };
    let html = introduction;
    for (const [placeholder, value] of Object.entries(replacements)) {
        if (!html.includes(placeholder)) throw new Error(`Introduction placeholder is missing: ${placeholder}`);
        html = html.replaceAll(placeholder, String(value));
    }
    return html;
}

export async function buildDocs({ root, out }) {
    const socialCards = await readSocialCards(root);
    await mkdir(join(out, 'docs'), { recursive: true });
    for (const page of DOCS_PAGES) {
        const markdown = await readFile(join(root, page.source), 'utf8');
        const destination = join(out, page.path === '/docs' ? 'docs/index.html' : `${page.path.slice(1)}.html`);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, renderDocPage(page, markdown, { socialCard: socialCards[page.path] }));
    }
    await writeFile(join(out, 'introduction.html'), await renderIntroduction(root, socialCards['/introduction']));
    const paths = ['/', '/introduction', ...DOCS_PAGES.map(page => page.path), '/patches', '/privacy-policy', '/terms-of-service'];
    await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${ORIGIN}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
    return socialCards;
}
