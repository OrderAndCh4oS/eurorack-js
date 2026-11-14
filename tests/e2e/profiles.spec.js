import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { ulid } from 'ulid';

const origin = 'http://127.0.0.1:4176';
const headers = { origin };
const state = {
    version: 3, plugins: { core: 1 },
    modules: [{ id: 'osc', type: 'vco', row: 1, index: 0 }, { id: 'output', type: 'out', row: 1, index: 1 }],
    params: { osc: { coarse: 0.25 }, output: { volume: 0.4 } },
    cables: ['L', 'R'].map(toPort => ({ fromModule: 'osc', fromPort: 'triangle', toModule: 'output', toPort })),
    midiMappings: {}
};

async function result(response, status = 200) {
    expect(response.status(), await response.text()).toBe(status);
    return response.json();
}
async function signedIn(browser, identity) {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'eurorack-test-user', value: identity, url: origin }]);
    const user = (await result(await context.request.get(`${origin}/api/me`))).user;
    return { context, user, page: await context.newPage() };
}
async function restoreName(context, name) {
    await context.request.patch(`${origin}/api/me`, { headers, data: { name } });
}
async function remove(context, id) {
    const response = await context.request.get(`${origin}/api/patches/${id}`);
    if (!response.ok()) return;
    const patch = await response.json();
    await context.request.delete(`${origin}/api/patches/${id}`, { headers, data: { expectedRevision: patch.revision } });
}

test('a profile rename updates existing patches, fork credits, search and future saves without disturbing the rack', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const alice = await signedIn(browser, 'alice');
    const bob = await signedIn(browser, 'bob');
    const visitor = await browser.newContext();
    const cleanup = [];
    const unique = ulid();
    const maker = `Signal Maker ${unique}`;
    const copier = `Studio ${unique}`;
    const title = `Profile study ${unique}`;
    try {
        const png = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#eeeade' } }).png().toBuffer();
        const image = await result(await alice.context.request.post(`${origin}/api/patch-previews`, { headers, multipart: {
            state: JSON.stringify(state), image: { name: 'rack.png', mimeType: 'image/png', buffer: png }
        } }), 201);
        const owned = [];
        for (const visibility of ['public', 'public', 'private']) {
            const patch = await result(await alice.context.request.post(`${origin}/api/patches`, { headers, data: {
                requestId: ulid(), name: `${title} ${owned.length + 1}`, state, visibility, previewId: image.id
            } }), 201);
            owned.push(patch); cleanup.push([alice.context, patch.id]);
        }
        let fork = await result(await bob.context.request.post(`${origin}/api/patches/${owned[0].id}/copies`, { headers, data: {
            requestId: ulid(), name: `${title} fork`, expectedRevision: owned[0].revision
        } }), 201);
        cleanup.push([bob.context, fork.id]);
        fork = await result(await bob.context.request.put(`${origin}/api/patches/${fork.id}`, { headers, data: {
            expectedRevision: fork.revision, state: fork.state, visibility: 'public'
        } }));

        await alice.page.goto(`${origin}/patches/${owned[0].id}`);
        await alice.page.waitForFunction(id => window.eurorackApp?.patchLibrary.active?.id === id, owned[0].id);
        const navigation = alice.page.getByRole('navigation', { name: 'Patch views', exact: true });
        await expect(navigation.getByRole('button', { name: 'My profile', exact: true })).toBeVisible();
        await expect(navigation.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
        expect(await navigation.evaluate(node => {
            const buttons = [...node.querySelectorAll('button')];
            const profile = buttons.find(button => button.textContent === 'My profile');
            const signOut = buttons.find(button => button.textContent === 'Sign out');
            return profile.nextElementSibling === signOut || profile.previousElementSibling === signOut;
        })).toBe(true);
        await alice.page.locator('#startButton').click();
        await alice.page.waitForFunction(() => {
            const app = window.eurorackApp;
            return app.audioCtx?.state === 'running' && app.host.engine && app.state.getModule('output')?.instance?.leds?.L > 0.005;
        });
        await alice.page.evaluate(() => {
            window.eurorackApp.setParam('osc', 'coarse', 0.31);
            window.profileTestEngine = window.eurorackApp.host.engine;
        });
        const edited = await alice.page.evaluate(() => window.eurorackApp.host.serializePatch());
        expect(await alice.page.evaluate(() => window.eurorackApp.patchLibrary.isDirty())).toBe(true);
        await alice.page.locator('[data-patch-view="public"]').click();
        await alice.page.getByRole('searchbox').fill(title);
        await alice.page.getByRole('button', { name: 'Search', exact: true }).click();
        await alice.page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('popular');
        await alice.page.getByRole('combobox', { name: 'Time period', exact: true }).selectOption('week');
        await expect(alice.page.locator('.patch-entry')).toHaveCount(3);
        const catalogueUrl = alice.page.url();
        await alice.page.getByRole('button', { name: 'My profile', exact: true }).click();
        const dialog = alice.page.getByRole('dialog');
        await expect(dialog.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
        await expect(dialog.getByLabel('Public name', { exact: true })).toHaveValue(alice.user.name);
        await dialog.getByLabel('Public name', { exact: true }).fill(maker);
        await dialog.screenshot({ path: testInfo.outputPath('profile-desktop.png') });
        await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(alice.page.getByText('Profile updated.', { exact: true })).toBeVisible();
        await expect(alice.page).toHaveURL(catalogueUrl);
        await expect(alice.page.getByRole('searchbox')).toHaveValue(title);
        await expect(alice.page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue('popular');
        await expect(alice.page.getByRole('combobox', { name: 'Time period', exact: true })).toHaveValue('week');
        await expect(alice.page.getByText(`Original by ${maker}`, { exact: true })).toBeVisible();
        expect(await alice.page.evaluate(() => ({
            state: window.eurorackApp.host.serializePatch(), dirty: window.eurorackApp.patchLibrary.isDirty(),
            audio: window.eurorackApp.audioCtx.state, sameEngine: window.profileTestEngine === window.eurorackApp.host.engine,
            author: window.eurorackApp.patchLibrary.active.authorName
        }))).toEqual({ state: edited, dirty: true, audio: 'running', sameEngine: true, author: maker });

        for (const patch of owned) {
            const current = await result(await alice.context.request.get(`${origin}/api/patches/${patch.id}`));
            expect(current.authorName).toBe(maker);
            expect(current.provenance.originalCreatorName).toBe(maker);
            expect(current.revision).toBe(patch.revision);
            expect(current.state).toEqual(patch.state);
        }
        const updatedFork = await result(await visitor.request.get(`${origin}/api/patches/${fork.id}`));
        expect(updatedFork.authorName).toBe(bob.user.name);
        expect(updatedFork.provenance).toMatchObject({ originalCreatorName: maker, parentCreatorName: maker });
        const social = await visitor.request.get(`${origin}/patches/${fork.id}`);
        const html = await social.text();
        expect(html).toContain(`Original by ${maker}`);
        expect(html).not.toContain(alice.user.id);
        expect(html).not.toContain(bob.user.id);
        const first = await result(await visitor.request.get(`${origin}/api/public-patches?q=${encodeURIComponent(maker)}&limit=1`));
        expect(first.patches).toHaveLength(1);
        expect(first.nextCursor).toBeTruthy();
        const second = await result(await visitor.request.get(`${origin}/api/public-patches?q=${encodeURIComponent(maker)}&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`));
        expect(second.patches).toHaveLength(1);
        expect(new Set([...first.patches, ...second.patches].map(patch => patch.id))).toEqual(new Set(owned.slice(0, 2).map(patch => patch.id)));
        for (const patch of [...first.patches, ...second.patches]) expect(patch.authorName).toBe(maker);

        await bob.page.goto(`${origin}/patches/${fork.id}?view=details`);
        await expect(bob.page.getByText(`Original by ${maker}`, { exact: true })).toBeVisible();
        const denied = await bob.context.request.patch(`${origin}/api/me`, { headers, data: { id: alice.user.id, name: 'Stolen name' } });
        expect(denied.status()).toBe(400);
        expect((await result(await alice.context.request.get(`${origin}/api/me`))).user.name).toBe(maker);
        expect((await visitor.request.patch(`${origin}/api/me`, { headers, data: { name: 'Anonymous' } })).status()).toBe(401);

        // A second account can edit its own name; the original creator remains Alice.
        await result(await bob.context.request.patch(`${origin}/api/me`, { headers, data: { name: copier } }));
        const renamedFork = await result(await visitor.request.get(`${origin}/api/patches/${fork.id}`));
        expect(renamedFork.authorName).toBe(copier);
        expect(renamedFork.provenance.originalCreatorName).toBe(maker);
        const newCopy = await result(await bob.context.request.post(`${origin}/api/patches/${owned[0].id}/copies`, { headers, data: {
            requestId: ulid(), expectedRevision: owned[0].revision, authorName: bob.user.name
        } }), 201);
        cleanup.push([bob.context, newCopy.id]);
        expect(newCopy.authorName).toBe(copier);
        expect(newCopy.provenance.originalCreatorName).toBe(maker);
        const newPatch = await result(await alice.context.request.post(`${origin}/api/patches`, { headers, data: {
            requestId: ulid(), name: `${title} later`, state, authorName: alice.user.name
        } }), 201);
        cleanup.push([alice.context, newPatch.id]);
        expect(newPatch.authorName).toBe(maker);

        await alice.page.locator('[data-patch-view="rack"]').click();
        await alice.page.locator('#startButton').click();
        // Avoid beforeunload's unsaved-edit prompt while checking a fresh session read.
        const reloaded = await alice.context.newPage();
        await reloaded.goto(`${origin}/patches?view=mine`);
        await reloaded.getByRole('button', { name: 'My profile', exact: true }).click();
        await expect(reloaded.getByRole('dialog').getByLabel('Public name', { exact: true })).toHaveValue(maker);
        await reloaded.getByRole('button', { name: 'Cancel', exact: true }).click();
        await reloaded.reload();
        await reloaded.getByRole('button', { name: 'My profile', exact: true }).click();
        await expect(reloaded.getByRole('dialog').getByLabel('Public name', { exact: true })).toHaveValue(maker);
    } finally {
        for (const [context, id] of cleanup.reverse()) await remove(context, id);
        await Promise.allSettled([restoreName(alice.context, alice.user.name), restoreName(bob.context, bob.user.name)]);
        await Promise.allSettled([alice.context.close(), bob.context.close(), visitor.close()]);
    }
});

test('profile editing and sign out remain separate top navigation actions', async ({ browser }) => {
    const alice = await signedIn(browser, 'alice');
    try {
        await alice.page.goto(`${origin}/patches?view=mine`);
        const navigation = alice.page.getByRole('navigation', { name: 'Patch views', exact: true });
        await navigation.getByRole('button', { name: 'My profile', exact: true }).click();
        await alice.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
        // The isolated backend has no OAuth handler; emulate its successful
        // sign-out response and clear only this test context's identity cookie.
        await alice.page.route('**/api/auth/sign-out', route => route.fulfill({
            json: { success: true }, headers: { 'set-cookie': 'eurorack-test-user=; Path=/; Max-Age=0; SameSite=Lax' }
        }));
        await navigation.getByRole('button', { name: 'Sign out', exact: true }).click();
        await expect(navigation.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await expect(navigation.getByRole('button', { name: 'My profile', exact: true })).toBeHidden();
        expect((await result(await alice.context.request.get(`${origin}/api/me`))).user).toBeNull();
    } finally { await alice.context.close(); }
});

test('profile errors keep the entered name available for retry on a narrow screen', async ({ browser }, testInfo) => {
    const alice = await signedIn(browser, 'alice');
    try {
        await alice.page.setViewportSize({ width: 390, height: 844 });
        await alice.page.goto(`${origin}/patches?view=mine`);
        await alice.page.getByRole('button', { name: 'My profile', exact: true }).click();
        const dialog = alice.page.getByRole('dialog');
        const name = `Ocean Instruments ${ulid()}`;
        const field = dialog.getByLabel('Public name', { exact: true });
        await expect(field).toBeFocused();
        await field.fill(name);
        const failure = async route => {
            if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, json: { error: { message: 'Could not update your profile. Try again.' } } });
            else await route.continue();
        };
        await alice.page.route('**/api/me', failure);
        await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
        await expect(dialog.getByRole('alert')).toHaveText('Could not update your profile. Try again.');
        await expect(field).toHaveValue(name);
        await expect(dialog.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
        expect((await result(await alice.context.request.get(`${origin}/api/me`))).user.name).toBe(alice.user.name);
        const width = await dialog.evaluate(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, screen: innerWidth, scroll: node.scrollWidth, client: node.clientWidth }));
        expect(width.left).toBeGreaterThanOrEqual(0);
        expect(width.right).toBeLessThanOrEqual(width.screen);
        expect(width.scroll).toBe(width.client);
        await dialog.screenshot({ path: testInfo.outputPath('profile-mobile.png') });
        await alice.page.unroute('**/api/me', failure);
        await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect((await result(await alice.context.request.get(`${origin}/api/me`))).user.name).toBe(name);
    } finally {
        await restoreName(alice.context, alice.user.name);
        await alice.context.close();
    }
});
