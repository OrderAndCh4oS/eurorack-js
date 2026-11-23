import { CATEGORY_ORDER } from '../rack/module-manifest.js';

export const CATALOGUE_PAGE_SIZE = 24;

const VIEWS = new Set(['public', 'mine', 'tests']);
const PERIODS = new Set(['all', 'day', 'week', 'month', 'year']);
const CURSOR_LIMIT = 4096;
const CURSOR_PREFIX = 'local1.';
const searchText = value => typeof value === 'string' ? value.trim().slice(0, 100).trim() : '';
const boundedCursor = value => typeof value === 'string' && value.length > 0 && value.length <= CURSOR_LIMIT ? value : null;

function catalogueState(state = {}) {
    const view = VIEWS.has(state.view) ? state.view : 'public';
    const sort = view === 'public' && state.sort === 'popular' ? 'popular' : 'newest';
    return {
        view,
        query: searchText(state.query),
        ...(view === 'tests' && CATEGORY_ORDER.includes(state.category) ? { category: state.category } : {}),
        sort,
        period: sort === 'popular' && PERIODS.has(state.period) ? state.period : 'all',
        cursor: boundedCursor(state.cursor),
        localCursor: view === 'mine' ? boundedCursor(state.localCursor) : null
    };
}

export function parseCatalogueLocation(location) {
    const url = typeof location === 'string' ? new URL(location, 'https://catalogue.invalid') : location;
    if (url && /^\/docs\/modules\/?$/.test(url.pathname)) return catalogueState({ view: 'tests' });
    if (!url || !/^\/patches\/?$/.test(url.pathname)) return null;
    const params = new URLSearchParams(url.search);
    return catalogueState({ view: params.get('view'), category: params.get('category'), query: params.get('q'), sort: params.get('sort'), period: params.get('period'), cursor: params.get('cursor'), localCursor: params.get('localCursor') });
}

export function catalogueUrl(state, base = globalThis.location?.origin) {
    const normalized = catalogueState(state);
    const url = new URL('/patches', base);
    if (normalized.view !== 'public') url.searchParams.set('view', normalized.view);
    if (normalized.query) url.searchParams.set('q', normalized.query);
    if (normalized.category) url.searchParams.set('category', normalized.category);
    if (normalized.sort !== 'newest') url.searchParams.set('sort', normalized.sort);
    if (normalized.period !== 'all') url.searchParams.set('period', normalized.period);
    if (normalized.cursor) url.searchParams.set('cursor', normalized.cursor);
    if (normalized.localCursor) url.searchParams.set('localCursor', normalized.localCursor);
    return url.href;
}

function invalidCursor() {
    return Object.assign(new Error('This page link is no longer valid. Start from the first page.'), { code: 'invalid_cursor' });
}

function encodeCursor(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return CURSOR_PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor, kind, query) {
    try {
        if (!boundedCursor(cursor) || !cursor.startsWith(CURSOR_PREFIX)) throw invalidCursor();
        const encoded = cursor.slice(CURSOR_PREFIX.length);
        if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw invalidCursor();
        const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
        if (!value || Array.isArray(value) || value.kind !== kind || value.query !== query ||
            !['after', 'before'].includes(value.direction) || typeof value.key !== 'string' || !value.key || value.key.length > 512 ||
            Object.keys(value).length !== (kind === 'local' ? 5 : 4) ||
            (kind === 'local' && (!Number.isSafeInteger(value.created) || Math.abs(value.created) > 8640000000000000)) ||
            encodeCursor(value) !== cursor) throw invalidCursor();
        return value;
    } catch { throw invalidCursor(); }
}

const compareKeys = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function paginateLocalPatches(records, { query = '', cursor = null, kind, limit = CATALOGUE_PAGE_SIZE } = {}) {
    if (!['tests', 'local'].includes(kind)) throw new Error('Unknown patch catalogue.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Page size must be between 1 and 50.');
    const normalizedQuery = searchText(query).toLowerCase();
    const boundary = cursor === null || cursor === undefined ? null : decodeCursor(cursor, kind, normalizedQuery);
    const order = new Map();
    const rows = records.map((record, index) => {
        const key = String((kind === 'tests' && record.catalogueKey) || (record.key ?? record.id ?? record.name));
        if (!key || key.length > 512 || order.has(key)) throw new Error('Could not read the patch catalogue.');
        order.set(key, index);
        return { record, key, created: Date.parse(record.created || record.createdAt) || 0 };
    }).filter(({ record, key }) => {
        const guide = record.guide;
        const text = `${record.name || ''} ${record.description || ''} ${record.authorName || ''}${guide ? ` ${guide.id} ${guide.title} ${guide.intro}` : ''}`;
        return text.toLowerCase().includes(normalizedQuery) || (kind === 'tests' && key.toLowerCase().includes(normalizedQuery));
    });
    if (boundary && kind === 'tests' && !order.has(boundary.key)) throw invalidCursor();
    // Test catalogues have an authored order, but cursors anchor on the patch key
    // rather than a numeric offset so inserting earlier tests cannot skip racks.
    const compare = kind === 'tests'
        ? (a, b) => order.get(a.key) - order.get(b.key)
        : (a, b) => b.created - a.created || compareKeys(b.key, a.key);
    if (kind === 'local') rows.sort(compare);
    const candidates = boundary ? rows.filter(row => boundary.direction === 'after' ? compare(row, boundary) > 0 : compare(row, boundary) < 0) : rows;
    const page = boundary?.direction === 'before' ? candidates.slice(-limit) : candidates.slice(0, limit);
    const makeCursor = (row, direction) => encodeCursor({ kind, query: normalizedQuery, direction, key: row.key, ...(kind === 'local' ? { created: row.created } : {}) });
    const first = page[0], last = page.at(-1);
    if (!first) return {
        patches: [],
        previousCursor: boundary?.direction === 'after' && rows.some(row => compare(row, boundary) <= 0) ? makeCursor(boundary, 'before') : null,
        nextCursor: boundary?.direction === 'before' && rows.some(row => compare(row, boundary) >= 0) ? makeCursor(boundary, 'after') : null
    };
    return {
        patches: page.map(row => row.record),
        previousCursor: rows.some(row => compare(row, first) < 0) ? makeCursor(first, 'before') : null,
        nextCursor: rows.some(row => compare(row, last) > 0) ? makeCursor(last, 'after') : null
    };
}
