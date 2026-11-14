import { assert, hash, id } from './validation.js';

const DAY = 86400000;
const WINDOWS = { all: null, day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY };
const invalidCursor = () => assert(false, 'This page link is invalid. Start from the first page.', 400, 'invalid_cursor');

// The cursor carries a ranking boundary, never an offset. Its context ties it to
// the actual server-side filters; public cursors can be shared between accounts.
export function cataloguePage({ publicOnly, ownerId, query, sort, period, limit, cursor, now }) {
    assert(['newest', 'popular'].includes(sort), 'Choose Newest or Most popular.');
    assert(Object.hasOwn(WINDOWS, period), 'Choose a valid time period.');
    assert(publicOnly || sort === 'newest', 'Popularity sorting is only available for public patches.');
    assert(sort === 'popular' || period === 'all', 'Time periods apply to Most popular.');
    const context = hash({ scope: publicOnly ? 'public' : ownerId, query, sort, period, limit });
    let boundary = null, asOf = now.toISOString(), direction = 'next';
    if (cursor) {
        if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) invalidCursor();
        let value;
        try { value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { invalidCursor(); }
        if (!value || value.v !== 1 || value.context !== context || !['next', 'previous'].includes(value.direction) ||
            typeof value.asOf !== 'string' || !Number.isFinite(Date.parse(value.asOf)) || new Date(value.asOf).toISOString() !== value.asOf ||
            Date.parse(value.asOf) < 0 || Date.parse(value.asOf) > now.getTime() ||
            !Number.isSafeInteger(value.score) || value.score < 0 || value.score > 2147483647) invalidCursor();
        try { id(value.id, 'cursor'); } catch { invalidCursor(); }
        if (sort === 'newest' && value.score !== 0) invalidCursor();
        asOf = value.asOf; direction = value.direction; boundary = { id: value.id, score: value.score };
    }
    const since = WINDOWS[period] === null ? null : new Date(Date.parse(asOf) - WINDOWS[period]).toISOString();
    return {
        asOf, since, direction, boundary,
        cursorFor(record, nextDirection) {
            return Buffer.from(JSON.stringify({ v: 1, context, asOf, direction: nextDirection, id: record.id, score: record.popularityCount || 0 })).toString('base64url');
        }
    };
}
