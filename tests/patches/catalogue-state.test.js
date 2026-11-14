import { describe, expect, it } from 'vitest';
import { CATALOGUE_PAGE_SIZE, catalogueUrl, paginateLocalPatches, parseCatalogueLocation } from '../../src/js/patches/catalogue-state.js';

const origin = 'https://rack.example';
const names = page => page.patches.map(patch => patch.key);
const fixture = (key, created = '2026-11-14T10:00:00.000Z', extra = {}) => ({ key, name: key, created, ...extra });

describe('catalogue URLs', () => {
    it('round-trips public search, popular period and opaque page cursor', () => {
        const state = { view: 'public', query: 'plucks & bells', sort: 'popular', period: 'week', cursor: 'cursor+/=', localCursor: null };
        const url = catalogueUrl(state, origin);
        expect(new URL(url).pathname).toBe('/patches');
        expect(parseCatalogueLocation(new URL(url))).toEqual(state);
        expect(CATALOGUE_PAGE_SIZE).toBe(24);
    });

    it('round-trips separate account and browser pages under My patches', () => {
        const state = { view: 'mine', query: 'quiet', sort: 'newest', period: 'all', cursor: 'account-token', localCursor: 'browser-token' };
        expect(parseCatalogueLocation(new URL(catalogueUrl(state, origin)))).toEqual(state);
    });

    it('keeps rack and saved patch routes out of catalogue navigation', () => {
        for (const path of ['/', '/patches/01K00000000000000000000000', '/patches/extra/', '/patches//']) {
            expect(parseCatalogueLocation(new URL(path, origin))).toBeNull();
        }
        expect(parseCatalogueLocation(new URL('/patches/', origin))?.view).toBe('public');
    });

    it('normalizes invalid or irrelevant filters and omits defaults and unknown fields', () => {
        const state = parseCatalogueLocation(new URL('/patches?view=tests&sort=popular&period=year&q=%20%20drum%20%20&localCursor=other&extra=x', origin));
        expect(state).toEqual({ view: 'tests', query: 'drum', sort: 'newest', period: 'all', cursor: null, localCursor: null });
        expect(catalogueUrl(state, origin)).toBe(`${origin}/patches?view=tests&q=drum`);
        expect(catalogueUrl(parseCatalogueLocation(new URL('/patches?view=unknown&sort=unknown&period=week', origin)), origin)).toBe(`${origin}/patches`);
        expect(parseCatalogueLocation(new URL('/patches?sort=popular&period=unknown', origin)).period).toBe('all');
    });

    it('bounds search and cursor values before they reach the catalogue', () => {
        const url = new URL('/patches', origin);
        url.searchParams.set('q', `  ${'a'.repeat(150)}  `);
        url.searchParams.set('cursor', 'x'.repeat(5000));
        const state = parseCatalogueLocation(url);
        expect(state.query).toBe('a'.repeat(100));
        expect(state.cursor).toBeNull();
    });
});

describe('local cursor pages', () => {
    it('walks authored test order forward and backward without missing or duplicating racks', () => {
        const records = ['VCO', 'LFO', 'VCF', 'ADSR', 'Noise'].map(key => fixture(key));
        const first = paginateLocalPatches(records, { kind: 'tests', limit: 2 });
        const second = paginateLocalPatches(records, { kind: 'tests', limit: 2, cursor: first.nextCursor });
        const third = paginateLocalPatches(records, { kind: 'tests', limit: 2, cursor: second.nextCursor });
        expect([...names(first), ...names(second), ...names(third)]).toEqual(records.map(patch => patch.key));
        expect(first.previousCursor).toBeNull();
        expect(third.nextCursor).toBeNull();
        const back = paginateLocalPatches(records, { kind: 'tests', limit: 2, cursor: third.previousCursor });
        expect(names(back)).toEqual(names(second));
        expect(names(paginateLocalPatches(records, { kind: 'tests', limit: 2, cursor: back.previousCursor }))).toEqual(names(first));
    });

    it('orders browser saves by creation time and a deterministic key for ties', () => {
        const records = [fixture('A'), fixture('B'), fixture('older', '2026-11-13T10:00:00.000Z'), fixture('newer', '2026-11-14T11:00:00.000Z')];
        const first = paginateLocalPatches(records, { kind: 'local', limit: 2 });
        const second = paginateLocalPatches(records, { kind: 'local', limit: 2, cursor: first.nextCursor });
        expect([...names(first), ...names(second)]).toEqual(['newer', 'B', 'A', 'older']);
        expect(names(paginateLocalPatches(records, { kind: 'local', limit: 2, cursor: second.previousCursor }))).toEqual(names(first));
        expect(records.map(patch => patch.key)).toEqual(['A', 'B', 'older', 'newer']);
    });

    it('filters before paging and binds cursors to the search and catalogue', () => {
        const records = [fixture('filter one'), fixture('other'), fixture('filter two'), fixture('last', undefined, { description: 'a filter patch' })];
        const first = paginateLocalPatches(records, { kind: 'tests', query: 'FILTER', limit: 1 });
        const second = paginateLocalPatches(records, { kind: 'tests', query: ' filter ', limit: 1, cursor: first.nextCursor });
        const third = paginateLocalPatches(records, { kind: 'tests', query: 'filter', limit: 1, cursor: second.nextCursor });
        expect([...names(first), ...names(second), ...names(third)]).toEqual(['filter one', 'filter two', 'last']);
        expect(third.nextCursor).toBeNull();
        expect(() => paginateLocalPatches(records, { kind: 'tests', query: 'other', cursor: first.nextCursor })).toThrow(expect.objectContaining({ code: 'invalid_cursor' }));
        expect(() => paginateLocalPatches(records, { kind: 'local', query: 'filter', cursor: first.nextCursor })).toThrow(expect.objectContaining({ code: 'invalid_cursor' }));
    });

    it('handles Unicode keys and same-name records with distinct identities', () => {
        const records = [fixture('海 🫧', undefined, { name: 'Same' }), fixture('écho', undefined, { name: 'Same' }), fixture('夜', undefined, { name: 'Same' })];
        const first = paginateLocalPatches(records, { kind: 'tests', limit: 1 });
        const url = catalogueUrl({ view: 'tests', cursor: first.nextCursor }, origin);
        const second = paginateLocalPatches(records, { kind: 'tests', limit: 1, cursor: parseCatalogueLocation(new URL(url)).cursor });
        expect(names(first)).toEqual(['海 🫧']);
        expect(names(second)).toEqual(['écho']);
    });

    it('uses the anchor key rather than an offset when an earlier test entry is inserted', () => {
        const records = ['VCO', 'LFO', 'VCF', 'ADSR'].map(key => fixture(key));
        const first = paginateLocalPatches(records, { kind: 'tests', limit: 2 });
        records.unshift(fixture('New test'));
        expect(names(paginateLocalPatches(records, { kind: 'tests', limit: 2, cursor: first.nextCursor }))).toEqual(['VCF', 'ADSR']);
    });

    it('continues a browser page if its anchor was deleted', () => {
        const records = ['D', 'C', 'B', 'A'].map(key => fixture(key));
        const first = paginateLocalPatches(records, { kind: 'local', limit: 2 });
        expect(names(paginateLocalPatches(records.filter(patch => patch.key !== 'C'), { kind: 'local', limit: 2, cursor: first.nextCursor }))).toEqual(['B', 'A']);
    });

    it('rejects malformed, excessive and stale test cursors with a recoverable error', () => {
        const records = ['A', 'B'].map(key => fixture(key));
        for (const cursor of ['garbage', 'local1.====', 'local1.eyJraW5kIjoidGVzdHMifQ', 'x'.repeat(5000)]) {
            expect(() => paginateLocalPatches(records, { kind: 'tests', cursor })).toThrow(expect.objectContaining({ code: 'invalid_cursor' }));
        }
        const page = paginateLocalPatches(records, { kind: 'tests', limit: 1 });
        expect(() => paginateLocalPatches(records.slice(1), { kind: 'tests', cursor: page.nextCursor })).toThrow(expect.objectContaining({ code: 'invalid_cursor' }));
    });

    it('returns empty pages without navigation for an empty search result', () => {
        expect(paginateLocalPatches([fixture('A')], { kind: 'local', query: 'missing' })).toEqual({ patches: [], previousCursor: null, nextCursor: null });
    });
});
