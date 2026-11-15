import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentViews } from '../../src/js/ui/content-views.js';

const origin = 'https://eurorackjs.orderandchaos.xyz';
const location = path => new URL(path, origin);
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const response = html => ({ ok: true, text: async () => html });
const page = (path, name, extra = '') => `<!doctype html><html><head>
    <title>${name} · Eurorack</title>
    <link rel="canonical" href="${origin}${path}">
    <meta name="description" content="${name} description">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${name}">
    <meta property="og:url" content="${origin}${path}">
    <meta property="og:image" content="${origin}/${name}.png">
    <meta property="og:image:alt" content="${name} image">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${origin}/${name}.png">
    ${extra}
    </head><body><main data-content-page data-page-title="Fallback title"><h1>${name}</h1><h2 id="section">Section</h2></main></body></html>`;
const tag = selector => document.head.querySelector(selector);
const value = name => tag(`meta[name="${name}"], meta[property="${name}"]`)?.content;

let views;
let fetch;
beforeEach(() => {
    document.head.innerHTML = `<title>Rack title</title>
        <link rel="canonical" href="${origin}/patches/saved">
        <meta name="description" content="Saved rack description">
        <meta property="og:title" content="Saved rack">
        <meta property="og:image" content="${origin}/rack.png">
        <meta name="twitter:card" content="summary">
        <meta name="robots" content="noindex">
        <meta name="theme-color" content="#ff4f17">
        <link rel="stylesheet" href="/rack.css">
        <script id="analytics" type="application/json">{}</script>`;
    document.body.innerHTML = '<div id="contentView" hidden></div>';
    document.body.className = '';
    fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    views = new ContentViews({ document, surface: document.getElementById('contentView') });
});
afterEach(() => {
    views.hide();
    vi.unstubAllGlobals();
});

describe('content view metadata', () => {
    it('uses the fetched head and restores the rack metadata without replacing unrelated tags or title', async () => {
        const unrelated = ['meta[name="theme-color"]', 'link[rel="stylesheet"]', '#analytics'].map(tag);
        fetch.mockResolvedValue(response(page('/introduction', 'Introduction', '<meta name="twitter:creator" content="@creator">')));

        await views.show(location('/introduction'));
        expect(document.title).toBe('Introduction · Eurorack');
        expect(tag('link[rel="canonical"]').href).toBe(`${origin}/introduction`);
        expect(value('description')).toBe('Introduction description');
        expect(value('robots')).toBe('index, follow, max-image-preview:large');
        expect(value('og:title')).toBe('Introduction');
        expect(value('og:image:alt')).toBe('Introduction image');
        expect(value('twitter:card')).toBe('summary_large_image');
        expect(value('twitter:creator')).toBe('@creator');
        expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
        expect(unrelated.every(node => node.isConnected)).toBe(true);

        document.title = 'Current rack · Eurorack';
        views.hide();
        expect(document.title).toBe('Current rack · Eurorack');
        expect(tag('link[rel="canonical"]').href).toBe(`${origin}/patches/saved`);
        expect(value('description')).toBe('Saved rack description');
        expect(value('robots')).toBe('noindex');
        expect(value('og:title')).toBe('Saved rack');
        expect(value('og:image')).toBe(`${origin}/rack.png`);
        expect(value('twitter:card')).toBe('summary');
        expect(value('twitter:creator')).toBeUndefined();
        expect(value('og:image:alt')).toBeUndefined();
        expect(unrelated.every(node => node.isConnected)).toBe(true);
    });

    it('caches each page head, replaces absent social fields, and reapplies metadata on same-page reopening', async () => {
        fetch.mockImplementation(async path => response(page(path, path === '/docs' ? 'Docs' : 'Introduction',
            path === '/docs' ? '<meta property="og:locale" content="en_GB">' : '')));
        const originalHref = window.location.href;
        await views.show(location('/docs'));
        await views.show(location('/introduction'));
        expect(value('og:locale')).toBeUndefined();
        await views.show(location('/docs'));
        expect(value('og:locale')).toBe('en_GB');
        expect(fetch).toHaveBeenCalledTimes(2);

        views.hide();
        await views.show(location('/docs'));
        const section = document.getElementById('section');
        section.scrollIntoView = vi.fn();
        await views.show(location('/docs#section'));
        expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(tag('link[rel="canonical"]').href).toBe(`${origin}/docs`);
        expect(value('og:title')).toBe('Docs');
        expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(window.location.href).toBe(originalHref);
    });

    it('does not apply a late response after a newer content navigation', async () => {
        const pending = deferred();
        fetch.mockImplementation(path => path === '/docs' ? pending.promise : Promise.resolve(response(page(path, 'Introduction'))));
        const older = views.show(location('/docs'));
        const oldSignal = fetch.mock.calls[0][1].signal;
        await views.show(location('/introduction'));
        expect(oldSignal.aborted).toBe(true);
        pending.resolve(response(page('/docs', 'Docs')));
        await older;
        expect(value('og:title')).toBe('Introduction');
        expect(tag('link[rel="canonical"]').href).toBe(`${origin}/introduction`);
        expect(document.title).toBe('Introduction · Eurorack');
    });

    it('restores the rack on hide and ignores a request that completes after it', async () => {
        fetch.mockResolvedValueOnce(response(page('/introduction', 'Introduction')));
        await views.show(location('/introduction'));
        const pending = deferred();
        fetch.mockReturnValueOnce(pending.promise);
        const request = views.show(location('/docs'));
        views.hide();
        document.title = 'Rack again';
        pending.resolve(response(page('/docs', 'Docs')));
        await request;
        expect(value('og:title')).toBe('Saved rack');
        expect(document.title).toBe('Rack again');
        expect(views.surface.hidden).toBe(true);
    });

    it('removes added metadata when the rack originally had none and leaves failed pages unapplied', async () => {
        document.head.innerHTML = '<title>Rack</title><meta name="viewport" content="width=device-width">';
        fetch.mockResolvedValueOnce({ ok: false });
        await views.show(location('/docs'));
        expect(value('og:title')).toBeUndefined();
        fetch.mockResolvedValueOnce(response(page('/docs', 'Docs')));
        await views.show(location('/docs'));
        expect(value('og:title')).toBe('Docs');
        views.hide();
        expect(tag('link[rel="canonical"]')).toBeNull();
        expect(value('description')).toBeUndefined();
        expect(value('og:title')).toBeUndefined();
        expect(value('twitter:card')).toBeUndefined();
        expect(value('robots')).toBeUndefined();
        expect(value('viewport')).toBe('width=device-width');
    });
});
