import { expect, test } from '@playwright/test';

const names = page => page.locator('.patch-entry h3').allTextContents();
const emptyState = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} };
const patchState = { ...emptyState, modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }] };
const patchId = '01K00000000000000000000000';
const nextPatchId = '01K00000000000000000000002';
const publicRecord = (name, id = patchId) => ({ id, name, description: '', authorName: 'Test maker', visibility: 'public', moduleCount: 1, revision: 1, canEdit: false, likeCount: 10, likedByMe: false, provenance: {}, images: null });

test('restores a test catalogue page through links, reload and browser history', async ({ page }) => {
    await page.goto('/patches?view=tests');
    await expect(page.locator('.patch-entry')).toHaveCount(24);
    const first = await names(page);
    const navigation = page.getByRole('navigation', { name: 'Module tests pages', exact: true });
    await navigation.getByRole('link', { name: 'Next', exact: true }).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect.poll(() => names(page)).not.toEqual(first);
    const second = await names(page);
    expect(second).toHaveLength(24);
    expect(second.filter(name => first.includes(name))).toEqual([]);
    const secondUrl = page.url();

    await page.reload();
    await expect.poll(() => names(page)).toEqual(second);
    await navigation.getByRole('link', { name: 'Previous', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(first);
    await page.goBack();
    await expect(page).toHaveURL(secondUrl);
    await expect.poll(() => names(page)).toEqual(second);
    await page.goForward();
    await expect.poll(() => names(page)).toEqual(first);

    await page.goto(secondUrl);
    await page.getByRole('searchbox').fill('Test - Chorus');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.patch-entry')).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get('q')).toBe('Test - Chorus');
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue('Test - Chorus');
    await expect.poll(() => names(page)).toEqual(['Test - Chorus']);
});

test('keeps public sorting, time filters and search in shareable paginated URLs', async ({ page }, testInfo) => {
    const requests = [];
    await page.route('**/api/public-patches?**', async route => {
        const params = new URL(route.request().url()).searchParams;
        requests.push(Object.fromEntries(params));
        const period = params.get('period') || 'all';
        const sort = params.get('sort') || 'newest';
        const query = params.get('q') || '';
        const nextPage = params.get('cursor') === 'next-page';
        const prefix = `${sort} ${period} ${query}`.trim();
        await route.fulfill({ json: {
            patches: [publicRecord(`${prefix} ${nextPage ? 'C' : 'A'}`, nextPage ? nextPatchId : patchId), publicRecord(`${prefix} ${nextPage ? 'D' : 'B'}`, nextPage ? '01K00000000000000000000003' : '01K00000000000000000000001')],
            nextCursor: nextPage ? null : 'next-page', previousCursor: nextPage ? 'previous-page' : null
        } });
    });
    await page.route(`**/api/patches/${nextPatchId}`, route => route.fulfill({ json: { ...publicRecord('Opened rack', nextPatchId), state: patchState } }));
    await page.goto('/patches?sort=popular&period=week&q=drift');
    await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue('popular');
    await expect(page.getByRole('combobox', { name: 'Time period', exact: true })).toHaveValue('week');
    await expect(page.getByRole('searchbox')).toHaveValue('drift');
    await expect.poll(() => names(page)).toEqual(['popular week drift A', 'popular week drift B']);
    const pagination = page.getByRole('navigation', { name: 'Shared racks pages', exact: true });
    await pagination.getByRole('link', { name: 'Next', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(['popular week drift C', 'popular week drift D']);
    const pagedUrl = page.url();
    expect(new URL(pagedUrl).searchParams.get('cursor')).toBe('next-page');
    expect(requests.at(-1)).toMatchObject({ q: 'drift', sort: 'popular', period: 'week', cursor: 'next-page' });
    await page.reload();
    await expect.poll(() => names(page)).toEqual(['popular week drift C', 'popular week drift D']);

    await page.locator('.patch-entry').first().getByRole('button', { name: 'Open in rack', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/patches/${nextPatchId}$`));
    await expect(page.locator('#module-osc')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(pagedUrl);
    await expect.poll(() => names(page)).toEqual(['popular week drift C', 'popular week drift D']);
    await pagination.getByRole('link', { name: 'Previous', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(['popular week drift A', 'popular week drift B']);

    for (const period of ['day', 'month', 'year', 'all']) {
        await page.getByRole('combobox', { name: 'Time period', exact: true }).selectOption(period);
        await expect.poll(() => names(page)).toEqual([`popular ${period} drift A`, `popular ${period} drift B`]);
        expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
        expect(new URL(page.url()).searchParams.get('period') || 'all').toBe(period);
    }
    await page.goBack();
    await expect(page.getByRole('combobox', { name: 'Time period', exact: true })).toHaveValue('year');
    await expect.poll(() => names(page)).toEqual(['popular year drift A', 'popular year drift B']);
    await page.setViewportSize({ width: 360, height: 800 });
    const sizing = await page.locator('#patchLibrary').evaluate(node => ({ width: node.clientWidth, contentWidth: node.scrollWidth }));
    expect(sizing.contentWidth).toBe(sizing.width);
    await page.screenshot({ path: testInfo.outputPath('public-filters-mobile.png') });

    await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('newest');
    await expect(page.getByRole('combobox', { name: 'Time period', exact: true })).toBeHidden();
    expect(new URL(page.url()).searchParams.has('period')).toBe(false);
    await expect.poll(() => names(page)).toEqual(['newest all drift A', 'newest all drift B']);
    await page.getByRole('searchbox').fill('bell');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(['newest all bell A', 'newest all bell B']);
    expect(new URL(page.url()).searchParams.get('q')).toBe('bell');
});

test('paginates browser saves and resets their cursor when searching', async ({ page }) => {
    const bank = Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
        const name = `Local rack ${String(index).padStart(2, '0')}`;
        return [name, { name, state: emptyState, created: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }];
    }));
    await page.addInitScript(value => localStorage.setItem('eurorack-patches', JSON.stringify(value)), bank);
    await page.goto('/patches?view=mine');
    await expect(page.locator('.patch-entry')).toHaveCount(24);
    const first = await names(page);
    const navigation = page.getByRole('navigation', { name: 'This browser pages', exact: true });
    await navigation.getByRole('link', { name: 'Next', exact: true }).click();
    await expect(page.locator('.patch-entry')).toHaveCount(6);
    const second = await names(page);
    expect(second.filter(name => first.includes(name))).toEqual([]);
    expect(new URL(page.url()).searchParams.get('localCursor')).toBeTruthy();
    await page.reload();
    await expect.poll(() => names(page)).toEqual(second);
    await navigation.getByRole('link', { name: 'Previous', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(first);
    await navigation.getByRole('link', { name: 'Next', exact: true }).click();
    await page.getByRole('searchbox').fill('29');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect.poll(() => names(page)).toEqual(['Local rack 29']);
    expect(new URL(page.url()).searchParams.has('localCursor')).toBe(false);
    expect(new URL(page.url()).searchParams.get('q')).toBe('29');
});
