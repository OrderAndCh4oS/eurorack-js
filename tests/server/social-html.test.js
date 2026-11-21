import { describe, expect, it } from 'vitest';
import { patchHtml } from '../../server/html.js';

const patchId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const baseUrl = 'https://rack.example';
const patch = overrides => ({
    name: 'Afterimage', visibility: 'public', authorName: 'Alice',
    description: 'Soft plucks and drifting echoes.',
    provenance: {}, likeCount: 0,
    images: { full: `/patches/${patchId}/images/preview/full`, social: `/patches/${patchId}/images/preview/social` },
    ...overrides
});
const render = record => new DOMParser().parseFromString(patchHtml(record, baseUrl, patchId), 'text/html');
const content = (document, name) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content');

describe('saved patch social HTML', () => {
    it('uses a concise shared description and includes the rack card image', () => {
        const document = render(patch());
        for (const name of ['description', 'og:description', 'twitter:description']) {
            expect(content(document, name)).toBe('Soft plucks and drifting echoes. — By Alice.');
        }
        expect(content(document, 'twitter:card')).toBe('summary_large_image');
        expect(content(document, 'og:image')).toBe(`${baseUrl}/patches/${patchId}/images/preview/social`);
        expect(content(document, 'twitter:image')).toBe(content(document, 'og:image'));
    });

    it('shortens long descriptions at a word boundary and keeps creator credits and visible prose', () => {
        const description = 'A gentle seven note melody leaves room for warm bass and slowly shifting tape echoes. '.repeat(8);
        const record = patch({ description, provenance: { parentId: patchId, originalCreatorName: 'Bob' } });
        const document = render(record);
        const summary = content(document, 'og:description');
        expect(summary.length).toBeLessThanOrEqual(200);
        expect(summary).toMatch(/… — By Alice\. Original by Bob\.$/);
        const excerpt = summary.split('…')[0];
        expect(description.startsWith(excerpt)).toBe(true);
        expect(description[excerpt.length]).toMatch(/[\s.,;:!?]/);
        expect(content(document, 'description')).toBe(summary);
        expect(content(document, 'twitter:description')).toBe(summary);
        expect([...document.querySelectorAll('main p')].some(p => p.textContent === description)).toBe(true);
    });

    it('collapses whitespace for cards without changing the saved description', () => {
        const description = 'Soft plucks.\n\n  Slow\t echoes.';
        const document = render(patch({ description }));
        expect(content(document, 'og:description')).toBe('Soft plucks. Slow echoes. — By Alice.');
        expect([...document.querySelectorAll('main p')].some(p => p.textContent === description)).toBe(true);
    });

    it('keeps Unicode sequences intact when a card description is shortened', () => {
        const description = '🌒 Café e\u0301chos 👨‍👩‍👧‍👦 夜の音楽 '.repeat(30);
        const summary = content(render(patch({ description, authorName: 'Zoë' })), 'og:description');
        expect(summary.length).toBeLessThanOrEqual(200);
        expect(summary).toContain('🌒 Café e\u0301chos 👨‍👩‍👧‍👦');
        expect(summary).not.toContain('\uFFFD');
        expect(summary).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
        expect(summary).toMatch(/… — By Zoë\.$/);
    });

    it('escapes user text in metadata and the visible page', () => {
        const description = '" onload="alert(1)"><script>bad()</script> & echoes';
        const authorName = 'Alice & "Friends"';
        const document = render(patch({ name: '<img src=x onerror=bad()>', description, authorName }));
        expect(content(document, 'og:description')).toBe(`${description} — By ${authorName}.`);
        expect(document.querySelector('h1').textContent).toBe('<img src=x onerror=bad()>');
        expect([...document.scripts].map(script => script.getAttribute('src'))).toEqual([
            '/js/app/theme-mode.js', '/js/patches/patch-detail.js'
        ]);
        expect(document.querySelector('[onload], [onerror]')).toBeNull();
    });

    it('preserves both long creator names within the card limit', () => {
        const authorName = 'A'.repeat(80), originalCreatorName = 'B'.repeat(80);
        const summary = content(render(patch({ description: 'Floating chords and distant plucks. '.repeat(20), authorName,
            provenance: { parentId: patchId, originalCreatorName } })), 'og:description');
        expect(summary.length).toBeLessThanOrEqual(200);
        expect(summary).toContain(`By ${authorName}. Original by ${originalCreatorName}.`);
    });

    it('uses creator credit and a summary card when no description or image is available', () => {
        const document = render(patch({ description: '', images: null }));
        expect(content(document, 'og:description')).toBe('By Alice.');
        expect(content(document, 'twitter:card')).toBe('summary');
        expect(content(document, 'og:image')).toBeUndefined();
        expect(content(document, 'twitter:image')).toBeUndefined();
    });

    it.each([patch({ visibility: 'private', name: 'Secret patch', description: 'Private notes' }), null])('omits private or missing patch metadata', record => {
        const document = render(record);
        expect(content(document, 'robots')).toBe('noindex,nofollow');
        expect(content(document, 'og:title')).toBeUndefined();
        expect(content(document, 'og:description')).toBeUndefined();
        expect(content(document, 'twitter:card')).toBeUndefined();
        expect(document.documentElement.textContent).not.toContain('Secret patch');
        expect(document.documentElement.textContent).not.toContain('Private notes');
        expect(document.documentElement.textContent).not.toContain('Alice');
    });
});
