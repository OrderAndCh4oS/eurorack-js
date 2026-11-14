import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatchLibrary, DRAFT_KEY } from '../../src/js/ui/patch-library.js';
import { LocalPatchStore } from '../../src/js/patches/local-patch-store.js';
import { CloudClient, parsePatchLocation, savedPatchUrl, rackPatchUrl } from '../../src/js/patches/cloud-client.js';

const id = '01K00000000000000000000000';
const state = () => ({ version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup() {
    let current = state();
    document.body.innerHTML = '<input id="patchName" value="My rack"><div id="patchLibrary" hidden></div><div id="rackView"></div><span id="activePatchLabel"></span><div id="patchNotice"></div><button id="savedPatchLink"></button><button id="savedPatchDetails" hidden></button><div class="patch-account-actions"><button id="patchProfile" hidden>My profile</button><button id="patchAccount"></button></div>';
    const app = { document, host: { serializePatch: () => structuredClone(current) }, theme: 'industrial', themeMode: 'light', renderAllCables: vi.fn(),
        getCurrentPatchName: () => document.getElementById('patchName').value, loadPatchState: vi.fn(async value => { current = structuredClone(value); }), writeClipboardText: vi.fn(async () => {}) };
    const cloud = { get: vi.fn(), create: vi.fn(), copy: vi.fn(), update: vi.fn(), uploadPreview: vi.fn(), cancel: vi.fn(),
        updateProfile: vi.fn(), me: vi.fn(async () => ({ user: null })), signOut: vi.fn(async () => {}),
        configuration: vi.fn(async () => ({ enabled: false })), list: vi.fn(async () => ({ patches: [], nextCursor: null, previousCursor: null })) };
    const library = new PatchLibrary({ app, cloud, createId: async () => id }); library.surface = document.getElementById('patchLibrary');
    return { app, cloud, library, edit: value => { current = value; } };
}
beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/');
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('patch library coordination', () => {
    it('fetches the initial signed-in catalogue only once', async () => {
        const { cloud, library } = setup(); library.view = 'public';
        cloud.configuration.mockResolvedValue({ enabled: true });
        cloud.me.mockResolvedValue({ user: { id: 'alice', name: 'Alice' } });
        await library.initializeCloud();
        expect(cloud.list).toHaveBeenCalledOnce();
    });
    it('does not recreate stale thumbnail cards while loading another filter', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; library.view = 'public';
        library.publicPatches = [{ id, source: 'cloud', name: 'Old filter', images: { thumbnail: '/old.png' } }];
        const pending = deferred(); cloud.list.mockReturnValue(pending.promise);
        const entry = vi.spyOn(library, 'entry');
        library.show('public');
        expect(entry).not.toHaveBeenCalled();
        expect(document.querySelector('.patch-entry')).toBeNull();
        pending.resolve({ patches: [{ id, name: 'New filter', images: { thumbnail: '/new.png' } }] });
        await vi.waitFor(() => expect(document.querySelector('.patch-entry h3').textContent).toBe('New filter'));
        expect(document.querySelector('.patch-entry img').getAttribute('src')).toBe('/new.png');
    });
    it('reuses a loaded thumbnail after a fresh attribution result confirms the same image and visibility', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; library.view = 'public';
        const record = { id, source: 'cloud', name: 'Existing rack', authorName: 'Before', visibility: 'public', images: { thumbnail: '/rack.png' } };
        library.publicPatches = [record]; library.render();
        const image = document.querySelector('.patch-entry img');
        Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 100 } });
        cloud.list.mockResolvedValue({ patches: [{ ...record, authorName: 'After' }] });
        await library.refreshAttribution();
        expect(document.querySelector('.patch-entry img')).toBe(image);
        expect(document.querySelector('.patch-entry').textContent).toContain('By After');
    });
    it.each(['removed', 'replaced', 'private'])('does not reuse a thumbnail when the refreshed patch is %s', async change => {
        const { cloud, library } = setup(); library.config.enabled = true; library.view = 'public';
        const record = { id, source: 'cloud', name: 'Existing rack', visibility: 'public', images: { thumbnail: '/rack.png' } };
        library.publicPatches = [record]; library.render();
        const image = document.querySelector('.patch-entry img');
        Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 100 } });
        const patches = change === 'removed' ? [] : [{ ...record, ...(change === 'private' ? { visibility: 'private' } : { images: { thumbnail: '/replacement.png' } }) }];
        cloud.list.mockResolvedValue({ patches });
        await library.refreshAttribution();
        expect(document.querySelector('.patch-entry img')).not.toBe(image);
        expect(image.isConnected).toBe(false);
    });
    it('does not restore a thumbnail when an attribution request outlives its account', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; library.view = 'public';
        const record = { id, source: 'cloud', name: 'Existing rack', visibility: 'public', images: { thumbnail: '/rack.png' } };
        library.publicPatches = [record]; library.render();
        const image = document.querySelector('.patch-entry img');
        Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 100 } });
        const pending = deferred(); cloud.list.mockReturnValue(pending.promise);
        const refresh = library.refreshAttribution(); library.accountGeneration++;
        pending.resolve({ patches: [record] }); await refresh;
        expect(image.isConnected).toBe(false);
        expect(document.querySelector('.patch-entry img')).toBeNull();
    });
    it.each([`/patches/${id}`, `/#saved=${id}`, `/patches/${id}?view=rack`])('opens %s and keeps the canonical saved URL', async location => {
        const { cloud, library } = setup(); library.config.enabled = true;
        window.history.replaceState(null, '', location);
        cloud.get.mockResolvedValue({ id, name: 'Saved rack', state: state(), visibility: 'public' });
        expect(await library.loadLocation()).toBe(true);
        expect(cloud.get).toHaveBeenCalledWith(id);
        expect(library.active.id).toBe(id);
        expect(document.title).toBe('Saved rack · Eurorack');
        expect(window.location.pathname).toBe(`/patches/${id}`);
        expect(window.location.search).toBe(''); expect(window.location.hash).toBe('');
    });
    it('offers saved patch details only for account patches', () => {
        const { library } = setup();
        library.setActive({ source: 'cloud', id, name: 'Saved rack' });
        expect(document.getElementById('savedPatchDetails').hidden).toBe(false);
        library.setActive({ source: 'snapshot', name: 'Snapshot' });
        expect(document.getElementById('savedPatchDetails').hidden).toBe(true);
    });
    it('clears the saved path when opening a local patch', async () => {
        const { library } = setup();
        window.history.replaceState(null, '', `/patches/${id}`);
        expect(await library.open({ source: 'local', id, name: 'Local rack', state: state() })).toBe(true);
        expect(window.location.pathname).toBe('/'); expect(window.location.hash).toBe('');
    });
    it('keeps the active identity and rack when a transactional load fails', async () => {
        const { app, library } = setup(); library.setActive({ source: 'local', key: 'original', name: 'Original' });
        app.loadPatchState.mockRejectedValue(new Error('worklet rejected'));
        await expect(library.replaceState(state(), { source: 'test', name: 'Next' })).rejects.toThrow('worklet rejected');
        expect(library.active.name).toBe('Original'); expect(library.replacing).toBe(false);
        expect(document.title).toBe('Original · Eurorack');
    });
    it('does not apply an old account fetch after the account changes', async () => {
        const { app, cloud, library } = setup(); const pending = deferred(); cloud.get.mockReturnValue(pending.promise);
        const open = library.open({ source: 'cloud', id }); library.accountGeneration++;
        pending.resolve({ id, name: 'Private patch', state: state() });
        expect(await open).toBe(false); expect(app.loadPatchState).not.toHaveBeenCalled();
    });
    it('rechecks edits made during a fetch and honours Cancel', async () => {
        const { app, cloud, library, edit } = setup(); const pending = deferred(); cloud.get.mockReturnValue(pending.promise); library.choose = vi.fn(async () => 'cancel');
        const open = library.open({ source: 'cloud', id }); edit({ ...state(), midiMappings: { note: { moduleId: 'changed' } } });
        pending.resolve({ id, name: 'Fetched', state: state() });
        expect(await open).toBe(false); expect(library.choose).toHaveBeenCalled(); expect(app.loadPatchState).not.toHaveBeenCalled(); expect(library.isDirty()).toBe(true);
    });
    it('ignores an earlier fetch when a newer rack replacement succeeds', async () => {
        const { app, cloud, library } = setup(); const pending = deferred(); cloud.get.mockReturnValue(pending.promise);
        const open = library.open({ source: 'cloud', id }); await library.replaceState(state(), { source: 'test', name: 'Latest' });
        pending.resolve({ id, name: 'Stale', state: state() });
        expect(await open).toBe(false); expect(library.active.name).toBe('Latest'); expect(app.loadPatchState).toHaveBeenCalledTimes(1);
    });
    it('keeps catalogue navigation when an in-flight rack load finishes', async () => {
        const { app, cloud, library } = setup(); const pending = deferred();
        cloud.get.mockResolvedValue({ id, name: 'Loaded rack', state: state() });
        app.loadPatchState.mockReturnValue(pending.promise);
        const open = library.open({ source: 'cloud', id });
        await vi.waitFor(() => expect(app.loadPatchState).toHaveBeenCalled());
        library.navigate('public'); pending.resolve();
        expect(await open).toBe(true);
        expect(library.view).toBe('public'); expect(window.location.pathname).toBe('/patches');
        expect(document.title).toBe('Public patches · Eurorack');
        library.navigate('rack');
        expect(window.location.pathname).toBe(`/patches/${id}`);
        expect(document.title).toBe('Loaded rack · Eurorack');
    });
    it('saves an edited cloud fork privately and keeps newer rack edits dirty', async () => {
        const { cloud, library, edit } = setup(); library.config = { enabled: true, imagesEnabled: false }; library.user = { id: 'me', name: 'Maker' };
        const source = { source: 'cloud', id, name: 'Original', state: state(), visibility: 'public', revision: 3, canEdit: false };
        library.setActive(source); const pending = deferred(); cloud.copy.mockReturnValue(pending.promise);
        const saved = library.openSave({ copy: true }); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        const form = document.querySelector('dialog form'); expect(form.elements.visibility.value).toBe('private'); expect(form.elements.visibility.disabled).toBe(true);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await vi.waitFor(() => expect(cloud.copy).toHaveBeenCalled());
        edit({ ...state(), midiMappings: { changed: {} } });
        pending.resolve({ id: '01K00000000000000000000001', name: 'Original (copy)', state: state(), visibility: 'private', revision: 1, canEdit: true });
        expect(await saved).toBe(true); expect(cloud.copy.mock.calls[0][1]).toMatchObject({ visibility: 'private', expectedRevision: 3, requestId: id });
        expect(library.active.id).not.toBe(id); expect(library.isDirty()).toBe(true);
        expect(document.title).toBe('Original (copy) · Eurorack');
        expect(window.location.pathname).toBe(`/patches/${library.active.id}`); expect(window.location.hash).toBe('');
    });
    it('reuses the same request ID and payload on a failed create retry', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Maker' }; library.config = { enabled: true };
        cloud.create.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue({ id, name: 'My rack', state: state(), visibility: 'private', canEdit: true });
        const saved = library.openSave({ destination: 'cloud' }); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        const form = document.querySelector('dialog form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(document.querySelector('[role="alert"]').textContent).toBe('Network interrupted'));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); expect(await saved).toBe(true);
        expect(cloud.create.mock.calls[0][0]).toEqual(cloud.create.mock.calls[1][0]);
        expect(window.location.pathname).toBe(`/patches/${id}`); expect(window.location.hash).toBe('');
    });
    it('marks a copied test patch and requires a later content Save before publication', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; library.user = { id: 'me', name: 'Maker' };
        library.setActive({ source: 'test', name: 'Test rack', state: state() });
        cloud.create.mockResolvedValue({ id, name: 'Test rack (copy)', state: state(), visibility: 'private', canEdit: true, previewId: id, requiresSaveBeforePublish: true });
        const saved = library.openSave({ copy: true, destination: 'cloud' }); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(await saved).toBe(true); expect(cloud.create.mock.calls[0][0]).toMatchObject({ copy: true, visibility: 'private' });
        const openSave = vi.spyOn(library, 'openSave').mockResolvedValue(true);
        await library.toggleVisibility(library.active);
        expect(openSave).toHaveBeenCalledWith({ record: library.active, fromEditor: false, destination: 'cloud', publish: true });
    });
    it('restores unsaved rack content from an OAuth draft without cloud access', async () => {
        const { app, library } = setup(); const draft = { ...state(), midiMappings: { retained: {} } }; library.ready = Promise.resolve();
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: draft, name: 'Draft', baseline: JSON.stringify(state()), createdAt: Date.now() }));
        expect(await library.restoreDraft()).toBe(true); expect(app.loadPatchState).toHaveBeenCalledWith(draft, { managed: true }); expect(library.isDirty()).toBe(true); expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
        expect(document.title).toBe('Draft · Eurorack');
    });
    it('loads the private saved target after signing in from an untouched empty rack', async () => {
        const { app, cloud, library } = setup(); library.config.enabled = true;
        window.history.replaceState(null, '', `/patches/${id}`);
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: state(), name: 'Untitled', active: null, baseline: JSON.stringify(state()), createdAt: Date.now() }));
        expect(await library.restoreDraft()).toBe(false);
        expect(app.loadPatchState).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
        cloud.get.mockResolvedValue({ id, name: 'Private saved rack', state: state(), visibility: 'private', canEdit: true });
        expect(await library.loadLocation()).toBe(true);
        expect(library.active.id).toBe(id);
    });
    it('does not reattach a recovered cloud identity after another patch opens', async () => {
        const { cloud, library } = setup(); library.ready = Promise.resolve(); const pending = deferred(); cloud.get.mockReturnValue(pending.promise);
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: state(), name: 'Recovered', active: { source: 'cloud', id, name: 'Recovered' }, baseline: JSON.stringify(state()), createdAt: Date.now() }));
        await library.restoreDraft(); await vi.waitFor(() => expect(cloud.get).toHaveBeenCalled());
        await library.replaceState(state(), { source: 'test', name: 'New rack' });
        pending.resolve({ id, name: 'Recovered', state: state() }); await Promise.resolve(); await Promise.resolve();
        expect(library.active.name).toBe('New rack');
    });
    it('keeps the latest public search when responses arrive out of order', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; const old = deferred(), latest = deferred();
        cloud.list = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
        library.query = 'old'; const first = library.fetchList(true); library.query = 'new'; const second = library.fetchList(true);
        latest.resolve({ patches: [{ id, name: 'New' }], nextCursor: null }); await second;
        old.resolve({ patches: [{ id, name: 'Old' }], nextCursor: null }); await first;
        expect(library.publicPatches[0].name).toBe('New');
    });
    it('reads catalogue filters from the URL and clears page cursors when filters change', () => {
        const { library } = setup();
        window.history.replaceState(null, '', '/patches?q=drum&sort=popular&period=week&cursor=next-page');
        library.applyCatalogueLocation();
        expect(library.catalogueState()).toMatchObject({ view: 'public', query: 'drum', sort: 'popular', period: 'week', cursor: 'next-page' });
        expect(document.querySelector('[name="q"]').value).toBe('drum');
        expect(document.querySelector('[name="period"]').value).toBe('week');
        library.navigateCatalogue({ period: 'month' });
        expect(new URLSearchParams(window.location.search).get('period')).toBe('month');
        expect(new URLSearchParams(window.location.search).has('cursor')).toBe(false);
        library.navigateCatalogue({ sort: 'newest' });
        expect(window.location.search).toBe('?q=drum');
        expect(document.querySelector('[name="period"]')).toBeNull();
    });
    it('replaces a result page and sends its search, sort, period and cursor to the server', async () => {
        const { cloud, library } = setup(); library.config.enabled = true;
        library.query = 'drum'; library.sort = 'popular'; library.period = 'day'; library.cursor = 'next-page';
        library.publicPatches = [{ id, name: 'Old page' }];
        cloud.list = vi.fn().mockResolvedValue({ patches: [{ id, name: 'New page' }], nextCursor: 'page-three', previousCursor: 'page-one' });
        await library.fetchList(true);
        expect(cloud.list).toHaveBeenCalledWith({ publicOnly: true, query: 'drum', sort: 'popular', period: 'day', cursor: 'next-page' });
        expect(library.publicPatches.map(patch => patch.name)).toEqual(['New page']);
        expect(library.listPages.public).toEqual({ nextCursor: 'page-three', previousCursor: 'page-one' });
    });
    it('keeps later results when an obsolete page request fails', async () => {
        const { cloud, library } = setup(); library.config.enabled = true;
        let fail; const old = new Promise((resolve, reject) => { fail = reject; });
        cloud.list = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce({ patches: [{ id, name: 'Latest page' }], nextCursor: null, previousCursor: null });
        const first = library.fetchList(true, 'old-page');
        await library.fetchList(true, 'new-page'); fail(new Error('Old request failed')); await first;
        expect(library.publicPatches[0].name).toBe('Latest page');
        expect(library.listErrors.public).toBeNull(); expect(library.listLoading.public).toBe(false);
    });
    it('searches account pages without sending public ranking filters', async () => {
        const { cloud, library } = setup(); library.config.enabled = true; library.user = { id: 'me' };
        library.query = 'bass'; library.cursor = 'account-page';
        cloud.list = vi.fn().mockResolvedValue({ patches: [], nextCursor: null, previousCursor: null });
        await library.fetchList(false);
        expect(cloud.list).toHaveBeenCalledWith({ publicOnly: false, query: 'bass', cursor: 'account-page' });
    });
    it('never uploads a private snapshot to an account that changed during capture', async () => {
        const { cloud, library } = setup(); library.config = { enabled: true, imagesEnabled: true }; library.user = { id: 'account-a', name: 'A' };
        const pending = deferred(); const capture = vi.fn(() => pending.promise); library.previewLoader = async () => ({ capturePatchPreview: capture });
        void library.openSave({ destination: 'cloud' }); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        const form = document.querySelector('dialog form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(capture).toHaveBeenCalled()); library.accountGeneration++; library.user = { id: 'account-b', name: 'B' };
        pending.resolve(new Blob(['image'], { type: 'image/png' }));
        await vi.waitFor(() => expect(document.querySelector('[role="alert"]').textContent).toContain('account changed'));
        expect(cloud.uploadPreview).not.toHaveBeenCalled(); expect(cloud.create).not.toHaveBeenCalled();
    });
    it('offers an explicit private save when preview capture fails', async () => {
        const { cloud, library } = setup(); library.config = { enabled: true, imagesEnabled: true }; library.user = { id: 'me', name: 'Maker' };
        library.previewLoader = async () => ({ capturePatchPreview: async () => { throw new Error('Preview failed'); } });
        cloud.create.mockResolvedValue({ id, name: 'My rack', state: state(), visibility: 'private', canEdit: true });
        const saved = library.openSave({ destination: 'cloud' }); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(document.querySelector('[data-preview-fallback]')).not.toBeNull());
        expect(cloud.create).not.toHaveBeenCalled(); document.querySelector('[data-preview-fallback]').click();
        expect(await saved).toBe(true); expect(cloud.create.mock.calls[0][0]).toMatchObject({ visibility: 'private' }); expect(cloud.create.mock.calls[0][0]).not.toHaveProperty('previewId');
    });
    it('refreshes the source revision for conflict copies without replacing captured edits', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Maker' }; library.config.enabled = true;
        const source = { source: 'cloud', id, revision: 2, canEdit: true, name: 'Source', visibility: 'private', state: state() }; library.setActive(source);
        cloud.update.mockRejectedValue(Object.assign(new Error('Newer revision'), { status: 409 })); cloud.get.mockResolvedValue({ ...source, revision: 5 });
        cloud.copy.mockResolvedValue({ ...source, id: '01K00000000000000000000001', revision: 1, visibility: 'private' });
        const original = library.openSave(); await vi.waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(document.querySelector('[data-conflict]')).not.toBeNull());
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Save a copy').click(); await original;
        await vi.waitFor(() => expect(document.querySelector('dialog h2').textContent).toBe('Save a copy'));
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(cloud.copy).toHaveBeenCalled());
        expect(cloud.copy.mock.calls[0][1]).toMatchObject({ expectedRevision: 5, state: state(), visibility: 'private' });
    });
});

describe('public profile editing', () => {
    it('opens profile settings beside the separate sign-out navigation action', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Maker' };
        library.init(); await library.ready;
        const account = document.getElementById('patchAccount');
        const profile = document.getElementById('patchProfile');
        expect(account.textContent).toBe('Sign out'); expect(profile.hidden).toBe(false);
        expect(profile.nextElementSibling).toBe(account); profile.click();
        expect(document.querySelector('dialog h2').textContent).toBe('My profile');
        expect(document.querySelector('dialog input').value).toBe('Maker');
        expect([...document.querySelectorAll('dialog button')].some(button => button.textContent === 'Sign out')).toBe(false);
        [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Cancel').click(); account.click();
        await vi.waitFor(() => expect(cloud.signOut).toHaveBeenCalledOnce());
        await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
        expect(library.user).toBeNull(); expect(account.textContent).toBe('Sign in'); expect(profile.hidden).toBe(true);
    });
    it('hides the profile action when signed out', () => {
        const { library } = setup(); library.updateAccount();
        expect(document.getElementById('patchProfile').hidden).toBe(true);
        expect(document.getElementById('patchAccount').textContent).toBe('Sign in');
    });
    it('renames globally without replacing dirty editor state, revision or catalogue URL', async () => {
        const { app, cloud, library, edit } = setup(); library.user = { id: 'me', name: 'Old name' }; library.config.enabled = true;
        const active = { id, source: 'cloud', name: 'Saved rack', authorName: 'Old name', revision: 2, state: state(), provenance: { originalCreatorName: 'Old name' } };
        library.setActive(active); edit({ ...state(), midiMappings: { unsaved: {} } });
        window.history.replaceState(null, '', '/patches?q=New&sort=popular&period=month&cursor=page-two');
        library.view = 'public'; library.query = 'New'; library.sort = 'popular'; library.period = 'month'; library.cursor = 'page-two';
        const url = window.location.href, baseline = library.baseline, dirtyState = app.host.serializePatch();
        cloud.updateProfile.mockResolvedValue({ user: { id: 'me', name: 'New name' } });
        cloud.get.mockResolvedValue({ ...active, authorName: 'New name', revision: 3, provenance: { originalCreatorName: 'New name' } });
        cloud.list.mockResolvedValue({ patches: [{ ...active, authorName: 'New name' }], previousCursor: 'page-one', nextCursor: null });
        const opened = library.openProfile(); document.querySelector('dialog input').value = '  New name  ';
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { cancelable: true }));
        expect(await opened).toBe(true);
        expect(cloud.updateProfile).toHaveBeenCalledWith('New name');
        expect(library.user.name).toBe('New name'); expect(library.active.authorName).toBe('New name');
        expect(library.active.provenance.originalCreatorName).toBe('New name'); expect(library.active.revision).toBe(2);
        expect(library.publicPatches[0].authorName).toBe('New name');
        expect(cloud.list).toHaveBeenCalledWith({ publicOnly: true, query: 'New', sort: 'popular', period: 'month', cursor: 'page-two' });
        expect(app.host.serializePatch()).toEqual(dirtyState); expect(library.baseline).toBe(baseline); expect(library.isDirty()).toBe(true);
        expect(app.loadPatchState).not.toHaveBeenCalled(); expect(window.location.href).toBe(url);
        expect(document.getElementById('patchNotice').textContent).toContain('Profile updated.');
    });
    it.each(['   ', 'person@example.com', 'Name\nOther', 'Name\u2028Other', 'Name\u2029Other', 'x'.repeat(81)])('rejects invalid public name %j before saving', async value => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Maker' };
        const opened = library.openProfile(); const input = document.querySelector('dialog input');
        // Text inputs strip newlines; control characters that remain are also rejected.
        input.value = value.replace('\n', '\u0001');
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { cancelable: true }));
        expect(cloud.updateProfile).not.toHaveBeenCalled(); expect(document.querySelector('dialog [role="alert"]').hidden).toBe(false);
        [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Cancel').click(); expect(await opened).toBe(false);
    });
    it('keeps failed edits available for retry and prevents concurrent submits', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Maker' };
        const pending = deferred(); cloud.updateProfile.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ user: { id: 'me', name: 'Changed' } });
        const opened = library.openProfile(); const form = document.querySelector('dialog form'); form.elements.name.value = 'Changed';
        form.dispatchEvent(new Event('submit', { cancelable: true })); form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(cloud.updateProfile).toHaveBeenCalledOnce(); expect(form.elements.name.disabled).toBe(true);
        pending.resolve(Promise.reject(new Error('Try again later.')));
        await vi.waitFor(() => expect(document.querySelector('dialog [role="alert"]').textContent).toBe('Try again later.'));
        expect(form.elements.name.value).toBe('Changed'); expect(form.elements.name.disabled).toBe(false);
        form.dispatchEvent(new Event('submit', { cancelable: true })); expect(await opened).toBe(true);
        expect(cloud.updateProfile).toHaveBeenCalledTimes(2);
    });
    it('does not apply a profile save after the account changes', async () => {
        const { cloud, library } = setup(); library.user = { id: 'alice', name: 'Alice' };
        const pending = deferred(); cloud.updateProfile.mockReturnValue(pending.promise);
        const opened = library.openProfile(); document.querySelector('dialog input').value = 'Alice renamed';
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { cancelable: true }));
        library.accountGeneration++; library.user = { id: 'bob', name: 'Bob' };
        pending.resolve({ user: { id: 'alice', name: 'Alice renamed' } });
        expect(await opened).toBe(false); expect(library.user).toEqual({ id: 'bob', name: 'Bob' }); expect(cloud.get).not.toHaveBeenCalled();
        expect(document.querySelector('dialog')).toBeNull();
    });
    it('ignores an older session response after a successful profile save', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Old name' };
        const pending = deferred(); cloud.me.mockReturnValue(pending.promise);
        const refreshing = library.refreshSession();
        cloud.updateProfile.mockResolvedValue({ user: { id: 'me', name: 'New name' } });
        const opened = library.openProfile(); document.querySelector('dialog input').value = 'New name';
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { cancelable: true })); await opened;
        pending.resolve({ user: { id: 'me', name: 'Old name' } }); await refreshing;
        expect(library.user.name).toBe('New name'); expect(document.getElementById('patchAccount').title).toBe('Signed in as New name');
    });
    it('refreshes attribution when the same account was renamed in another tab', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Before' };
        library.setActive({ id, source: 'cloud', name: 'Existing patch', authorName: 'Before', revision: 2 });
        cloud.me.mockResolvedValue({ user: { id: 'me', name: 'After' } });
        cloud.get.mockResolvedValue({ id, authorName: 'After', provenance: { originalCreatorName: 'After' } });
        await library.refreshSession();
        expect(library.user.name).toBe('After'); expect(library.active.authorName).toBe('After'); expect(library.active.revision).toBe(2);
        expect(library.accountGeneration).toBe(0);
    });
    it('uses the account name in save dialogs and sends no per-patch name override', async () => {
        const { cloud, library } = setup(); library.user = { id: 'me', name: 'Public maker' }; library.config.enabled = true;
        cloud.create.mockResolvedValue({ id, name: 'My rack', state: state(), visibility: 'private', canEdit: true, authorName: 'Public maker' });
        const saved = library.openSave({ destination: 'cloud' });
        expect(document.querySelector('dialog [aria-label="Public name"]')).toBeNull();
        expect(document.querySelector('dialog [data-profile-name]').textContent).toBe('By Public maker');
        document.querySelector('dialog form').dispatchEvent(new Event('submit', { cancelable: true }));
        expect(await saved).toBe(true); expect(cloud.create.mock.calls[0][0]).not.toHaveProperty('authorName');
    });
});

describe('local and network boundaries', () => {
    it('updates only the current public profile through the authenticated API', async () => {
        const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ user: { id: 'me', name: 'New name' } }) }));
        const client = new CloudClient({ fetch });
        await expect(client.updateProfile('New name')).resolves.toEqual({ user: { id: 'me', name: 'New name' } });
        expect(fetch.mock.calls[0]).toEqual(['/api/me', expect.objectContaining({ method: 'PATCH', credentials: 'same-origin', cache: 'no-store', body: '{"name":"New name"}' })]);
    });
    it('encodes catalogue filters and opaque cursors in API URLs', async () => {
        const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ patches: [] }) }));
        const client = new CloudClient({ fetch });
        await client.list({ publicOnly: true, query: 'kick & snare', sort: 'popular', period: 'month', cursor: 'opaque+/=' });
        const url = new URL(fetch.mock.calls[0][0], window.location.origin);
        expect(url.pathname).toBe('/api/public-patches');
        expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'kick & snare', sort: 'popular', period: 'month', cursor: 'opaque+/=' });
        await client.list({ query: 'bass', cursor: 'account-cursor' });
        const account = new URL(fetch.mock.calls[1][0], window.location.origin);
        expect(account.pathname).toBe('/api/patches');
        expect(Object.fromEntries(account.searchParams)).toEqual({ q: 'bass', cursor: 'account-cursor' });
    });
    it('preserves unsupported local entries and prevents copying over an existing name', () => {
        const store = new LocalPatchStore(); store.write({ Legacy: { state: { version: 1 } } });
        store.save({ name: 'Fresh', state: state(), id }); expect(store.read().Legacy.state.version).toBe(1);
        expect(() => store.save({ name: 'Fresh', state: state() }, { copy: true })).toThrow('already exists');
    });
    it('does not overwrite a malformed browser bank on save', () => {
        localStorage.setItem('eurorack-patches', '{broken'); const store = new LocalPatchStore();
        expect(() => store.save({ name: 'Fresh', state: state() })).toThrow();
        expect(localStorage.getItem('eurorack-patches')).toBe('{broken');
    });
    it('keeps snapshot and saved locations distinct and rejects ambiguous links', () => {
        expect(parsePatchLocation('', `/patches/${id}`)).toEqual({ source: 'cloud', id });
        expect(parsePatchLocation(`#saved=${id}`)).toEqual({ source: 'cloud', id });
        expect(parsePatchLocation('#patch=gz1.abc')).toEqual({ source: 'snapshot' });
        expect(() => parsePatchLocation(`#saved=${id}&patch=gz1.abc`)).toThrow('more than one patch');
        expect(() => parsePatchLocation('#patch=gz1.abc', `/patches/${id}`)).toThrow('more than one patch');
        expect(() => parsePatchLocation('', '/patches/invalid')).toThrow('invalid');
        expect(parsePatchLocation('', '/patches')).toBeNull();
        expect(savedPatchUrl(id, 'https://rack.example')).toBe(`https://rack.example/patches/${id}`);
        expect(rackPatchUrl(id, 'https://rack.example')).toBe(`https://rack.example/patches/${id}`);
    });
    it('uses same-origin cookie credentials and exposes typed revision errors', async () => {
        const fetch = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'revision_conflict', message: 'Newer revision' } }) }));
        const client = new CloudClient({ fetch }); await expect(client.update(id, { expectedRevision: 1, state: state() })).rejects.toMatchObject({ status: 409, code: 'revision_conflict' });
        expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', method: 'PUT', headers: { 'Content-Type': 'application/json' } });
    });
});
