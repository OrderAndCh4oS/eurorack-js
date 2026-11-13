import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatchLibrary, DRAFT_KEY } from '../../src/js/ui/patch-library.js';
import { LocalPatchStore } from '../../src/js/patches/local-patch-store.js';
import { CloudClient, parsePatchLocation, savedPatchUrl, rackPatchUrl } from '../../src/js/patches/cloud-client.js';

const id = '01K00000000000000000000000';
const state = () => ({ version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup() {
    let current = state();
    document.body.innerHTML = '<input id="patchName" value="My rack"><div id="patchLibrary" hidden></div><div id="rackView"></div><span id="activePatchLabel"></span><div id="patchNotice"></div><button id="savedPatchLink"></button>';
    const app = { document, host: { serializePatch: () => structuredClone(current) }, theme: 'industrial', themeMode: 'light', renderAllCables: vi.fn(),
        getCurrentPatchName: () => document.getElementById('patchName').value, loadPatchState: vi.fn(async value => { current = structuredClone(value); }), writeClipboardText: vi.fn(async () => {}) };
    const cloud = { get: vi.fn(), create: vi.fn(), copy: vi.fn(), update: vi.fn(), uploadPreview: vi.fn(), cancel: vi.fn() };
    const library = new PatchLibrary({ app, cloud, createId: async () => id }); library.surface = document.getElementById('patchLibrary');
    return { app, cloud, library, edit: value => { current = value; } };
}
beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/');
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('patch library coordination', () => {
    it.each([`/#saved=${id}`, `/patches/${id}?view=rack`])('opens %s and keeps the canonical saved URL', async location => {
        const { cloud, library } = setup(); library.config.enabled = true;
        window.history.replaceState(null, '', location);
        cloud.get.mockResolvedValue({ id, name: 'Saved rack', state: state(), visibility: 'public' });
        expect(await library.loadLocation()).toBe(true);
        expect(cloud.get).toHaveBeenCalledWith(id);
        expect(library.active.id).toBe(id);
        expect(window.location.pathname).toBe(`/patches/${id}`);
        expect(window.location.search).toBe(''); expect(window.location.hash).toBe('');
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

describe('local and network boundaries', () => {
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
        expect(rackPatchUrl(id, 'https://rack.example')).toBe(`https://rack.example/patches/${id}?view=rack`);
    });
    it('uses same-origin cookie credentials and exposes typed revision errors', async () => {
        const fetch = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'revision_conflict', message: 'Newer revision' } }) }));
        const client = new CloudClient({ fetch }); await expect(client.update(id, { expectedRevision: 1, state: state() })).rejects.toMatchObject({ status: 409, code: 'revision_conflict' });
        expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', method: 'PUT', headers: { 'Content-Type': 'application/json' } });
    });
});
