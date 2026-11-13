import { expect, test } from '@playwright/test';
import { openTestPatch } from './patch-library-helpers.js';

const origin = 'http://127.0.0.1:4176';
async function signedInPage(browser, identity) {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'eurorack-test-user', value: identity, url: origin }]);
    const page = await context.newPage(); await page.goto(origin);
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary?.user);
    return { context, page };
}
const entry = (page, name) => page.locator('.patch-entry').filter({ has: page.getByRole('heading', { name, exact: true }) });

test('two users publish, like, fork, resave and revoke public image access', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const alice = await signedInPage(browser, 'alice');
    const bob = await signedInPage(browser, 'bob');
    const anonymous = await browser.newContext();
    const name = `Signal study ${Date.now()}`;
    const errors = []; alice.page.on('pageerror', error => errors.push(error.message)); bob.page.on('pageerror', error => errors.push(error.message));
    try {
        await openTestPatch(alice.page, 'Test - VCO Only');
        await alice.page.locator('#savePatchCopy').click();
        let dialog = alice.page.getByRole('dialog');
        await dialog.getByLabel('Patch name', { exact: true }).fill(name);
        await dialog.getByLabel('Save to', { exact: true }).selectOption('cloud');
        await expect(dialog.getByLabel('Visibility', { exact: true })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Save copy', exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 30000 });
        const original = await alice.page.evaluate(() => window.eurorackApp.patchLibrary.active);
        await expect(alice.page).toHaveURL(`${origin}/patches/${original.id}`);
        expect(original.id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
        expect(original.visibility).toBe('private');
        expect(original.requiresSaveBeforePublish).toBe(true);
        expect(original.images.thumbnail).toBeTruthy();
        expect((await anonymous.request.get(`${origin}/api/patches/${original.id}`)).status()).toBe(404);

        // A copied Test patch needs the same later-save gate as a community fork.
        await alice.page.locator('[data-patch-view="mine"]').click();
        await entry(alice.page, name).getByRole('button', { name: 'Make public', exact: true }).click();
        dialog = alice.page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Save and publish', exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await alice.page.locator('[data-patch-view="rack"]').click();

        // A deliberate subsequent Save publishes the current editor snapshot.
        await alice.page.locator('#savePatch').click(); dialog = alice.page.getByRole('dialog');
        await dialog.getByLabel('Visibility', { exact: true }).selectOption('public');
        await dialog.getByLabel('Description (optional)', { exact: true }).fill('A rack-only sharing test.');
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 30000 });
        const publicRecord = await (await anonymous.request.get(`${origin}/api/patches/${original.id}`)).json();
        await expect(alice.page).toHaveURL(`${origin}/patches/${original.id}`);
        expect(publicRecord.visibility).toBe('public'); expect(publicRecord.authorName).toBe('Alice');
        expect(publicRecord.requiresSaveBeforePublish).toBe(false);
        const html = await (await anonymous.request.get(`${origin}/patches/${original.id}`)).text();
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        expect(html).toContain('property="og:image"'); expect(html).not.toContain('fixture-alice');
        const image = await anonymous.request.get(`${origin}${publicRecord.images.social}`);
        expect(image.status()).toBe(200); expect(image.headers()['cache-control']).toContain('no-store');
        expect((await image.body()).subarray(1, 4).toString()).toBe('PNG');

        await bob.page.locator('[data-patch-view="public"]').click();
        const shared = entry(bob.page, name); await expect(shared).toBeVisible();
        await shared.getByRole('button', { name: 'Thumbs up · 0', exact: true }).click();
        await expect(shared.getByRole('button', { name: 'Thumbs up · 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await shared.getByRole('button', { name: 'Save a copy', exact: true }).click();
        dialog = bob.page.getByRole('dialog');
        await dialog.getByLabel('Patch name', { exact: true }).fill(`${name} fork`);
        await expect(dialog.getByLabel('Public name', { exact: true })).toHaveValue('Bob');
        await expect(dialog.getByLabel('Visibility', { exact: true })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Save copy', exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 30000 });
        await bob.page.locator('[data-patch-view="mine"]').click();
        const forkCard = entry(bob.page, `${name} fork`); await expect(forkCard).toBeVisible();
        const forkId = await forkCard.getAttribute('data-patch-id');
        const fork = await (await bob.context.request.get(`${origin}/api/patches/${forkId}`)).json();
        expect(fork.visibility).toBe('private'); expect(fork.provenance.parentId).toBe(original.id);
        expect(fork.provenance.originalCreatorName).toBe('Alice'); expect(fork.authorName).toBe('Bob');
        expect(fork.savedAfterCopyAt).toBeNull(); expect(fork.likeCount).toBe(0);
        expect((await anonymous.request.get(`${origin}/api/patches/${forkId}`)).status()).toBe(404);
        await forkCard.getByRole('button', { name: 'Make public', exact: true }).click();
        dialog = bob.page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Save and publish' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Save and publish', exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 30000 });
        const publishedFork = await (await anonymous.request.get(`${origin}/api/patches/${forkId}`)).json();
        expect(publishedFork.visibility).toBe('public'); expect(publishedFork.savedAfterCopyAt).toBeTruthy();

        await bob.page.goto(`${origin}/patches/${forkId}`);
        await expect(bob.page.getByRole('heading', { name: `${name} fork` })).toBeVisible();
        await expect(bob.page.getByText('Original by Alice', { exact: true })).toBeVisible();
        await expect(bob.page.getByRole('link', { name: 'Share on Bluesky' })).toBeVisible();
        await bob.page.screenshot({ path: testInfo.outputPath('saved-patch.png') });

        await alice.page.locator('[data-patch-view="mine"]').click();
        await entry(alice.page, name).getByRole('button', { name: 'Make private', exact: true }).click();
        await expect(entry(alice.page, name).getByRole('button', { name: 'Make public', exact: true })).toBeVisible();
        expect((await anonymous.request.get(`${origin}${publicRecord.images.social}`)).status()).toBe(404);
        expect((await anonymous.request.get(`${origin}/api/patches/${original.id}`)).status()).toBe(404);
        const privatePage = await anonymous.request.get(`${origin}/patches/${original.id}`);
        expect(privatePage.status()).toBe(404); expect(await privatePage.text()).not.toContain(name);
        expect((await anonymous.request.get(`${origin}${publishedFork.images.social}`)).status()).toBe(200);
        expect((await anonymous.request.get(`${origin}/api/patches/${forkId}`)).status()).toBe(200);
        expect(errors).toEqual([]);
    } finally { await Promise.allSettled([alice.context.close(), bob.context.close(), anonymous.close()]); }
});
