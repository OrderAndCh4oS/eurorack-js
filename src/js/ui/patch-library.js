import { TEST_PATCHES } from '../config/test-patches.js';
import { CloudClient, newRequestId, parsePatchLocation, savedPatchUrl, rackPatchUrl } from '../patches/cloud-client.js';
import { LocalPatchStore } from '../patches/local-patch-store.js';

export const DRAFT_KEY = 'eurorack-login-draft-v1';
const snapshot = state => JSON.stringify(state);
const clone = value => JSON.parse(JSON.stringify(value));
const sourceLabel = record => ({ test: 'Test patch', local: 'This browser', cloud: record.visibility === 'public' ? 'Public' : 'Private' }[record.source] || 'Unsaved rack');

function element(document, tag, text, className) {
    const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}

export class PatchLibrary {
    constructor({ app, cloud = new CloudClient(), local = new LocalPatchStore(), createId = newRequestId, previewLoader = () => import('../patches/patch-preview.js') }) {
        this.app = app; this.document = app.document; this.window = this.document.defaultView;
        this.cloud = cloud; this.local = local; this.createId = createId; this.previewLoader = previewLoader;
        this.active = null; this.baseline = snapshot(app.host.serializePatch()); this.view = 'rack';
        this.config = { enabled: false }; this.user = null; this.accountGeneration = 0; this.loadGeneration = 0; this.renderGeneration = 0;
        this.accountPatches = []; this.publicPatches = []; this.query = ''; this.replacing = false; this.listRequests = { public: 0, account: 0 };
    }
    init() {
        this.surface = this.document.getElementById('patchLibrary');
        if (!this.surface) return this;
        this.document.querySelectorAll('[data-patch-view]').forEach(button => button.addEventListener('click', () => this.show(button.dataset.patchView)));
        this.document.getElementById('savePatch')?.addEventListener('click', () => { void this.openSave(); });
        this.document.getElementById('savePatchCopy')?.addEventListener('click', () => { void this.openSave({ copy: true }); });
        this.document.getElementById('savedPatchLink')?.addEventListener('click', () => this.run(() => this.share(this.active)));
        this.document.getElementById('savedPatchDetails')?.addEventListener('click', () => {
            if (this.active?.source !== 'cloud') return;
            const url = new URL(savedPatchUrl(this.active.id, this.window.location.origin));
            url.searchParams.set('view', 'details');
            this.window.location.assign(url.href);
        });
        this.document.getElementById('patchAccount')?.addEventListener('click', () => this.run(() => this.user ? this.signOut() : this.signIn()));
        for (const event of ['input', 'change', 'pointerup', 'keyup']) this.document.addEventListener(event, () => queueMicrotask(() => this.updateActiveLabel()));
        this.window.addEventListener('hashchange', () => this.run(() => this.loadLocation()));
        this.window.addEventListener('popstate', () => this.run(() => this.loadLocation()));
        this.window.addEventListener('beforeunload', event => { if (!this.redirecting && this.isDirty()) { event.preventDefault(); event.returnValue = ''; } });
        this.window.addEventListener('focus', () => { if (this.config.enabled) void this.refreshSession(); });
        this.updateActiveLabel();
        this.ready = this.initializeCloud();
        if (this.window.location.pathname.replace(/\/$/, '') === '/patches') this.show('public');
        return this;
    }
    async initializeCloud() {
        this.config = await this.cloud.configuration();
        if (this.config.enabled) await this.refreshSession();
        this.updateAccount();
        if (this.view !== 'rack') this.show(this.view);
    }
    async refreshSession() {
        try {
            const { user } = await this.cloud.me();
            const changed = (this.user?.id || null) !== (user?.id || null);
            if (changed) {
                this.accountGeneration++; this.cloud.cancel(); this.accountPatches = []; this.publicPatches = [];
                void this.previewLoader().then(module => module.clearPatchPreviewCache?.()).catch(() => {});
                if (this.active?.source === 'cloud' && this.user) this.setActive(null, this.baseline);
            }
            this.user = user; this.updateAccount();
            if (changed && this.surface && this.view !== 'rack') this.show(this.view);
        } catch (error) { if (error.name !== 'AbortError') this.notice(error.message); }
    }
    updateAccount() {
        const button = this.document.getElementById('patchAccount');
        if (button) { button.textContent = this.user ? 'Sign out' : 'Sign in'; button.title = this.user ? `Signed in as ${this.user.name}` : 'Sign in with Google'; }
    }
    isDirty() { return snapshot(this.app.host.serializePatch()) !== this.baseline; }
    setActive(record, baseline = snapshot(this.app.host.serializePatch())) {
        this.active = record; this.baseline = baseline; this.updateActiveLabel();
        const input = this.document.getElementById('patchName'); if (input && record?.name) input.value = record.name;
    }
    updateActiveLabel() {
        const label = this.document.getElementById('activePatchLabel');
        if (label) label.textContent = `${this.active?.name || 'Untitled'} · ${this.active ? sourceLabel(this.active) : 'Unsaved rack'}${this.isDirty() ? ' · Edited' : ''}`;
        const share = this.document.getElementById('savedPatchLink'); if (share) share.hidden = this.active?.source !== 'cloud';
        const details = this.document.getElementById('savedPatchDetails'); if (details) details.hidden = this.active?.source !== 'cloud';
    }
    notice(message, actions = []) {
        const node = this.document.getElementById('patchNotice'); if (!node) return;
        node.replaceChildren(element(this.document, 'p', message)); node.hidden = false;
        for (const [label, action] of actions) node.append(this.button(label, () => this.run(action)));
        node.append(this.button('Dismiss', () => { node.hidden = true; }));
    }
    async run(action) {
        try { return await action(); } catch (error) { if (error.name !== 'AbortError') this.notice(error.message, [['Export rack', () => this.app.exportCurrentPatchToFile()]]); return false; }
    }
    button(label, handler, className) {
        const button = element(this.document, 'button', label, className); button.type = 'button';
        button.addEventListener('click', handler); return button;
    }
    show(view) {
        this.view = view; this.renderGeneration++; this.observer?.disconnect(); this.previewAbort?.abort();
        this.document.body.classList.toggle('patch-library-open', view !== 'rack');
        const rack = this.document.getElementById('rackView') || this.document.querySelector('.app-container');
        if (rack) rack.hidden = view !== 'rack';
        if (this.app.cableSvg) this.app.cableSvg.style.visibility = view === 'rack' ? '' : 'hidden';
        this.surface.hidden = view === 'rack';
        this.document.querySelectorAll('[data-patch-view]').forEach(button => {
            if (button.dataset.patchView === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
        if (view === 'rack') { requestAnimationFrame(() => this.app.renderAllCables()); return; }
        this.render();
        if (view === 'public' && this.config.enabled) void this.fetchList(true);
        if (view === 'mine' && this.user) void this.fetchList(false);
    }
    render() {
        if (!this.surface || this.view === 'rack') return;
        this.observer?.disconnect(); this.previewAbort?.abort(); this.previewAbort = new AbortController(); this.surface.replaceChildren();
        const titles = { mine: ['My patches', 'Saved in this browser or your account.'], public: ['Public patches', 'Shared patches to play and copy.'], tests: ['Test patches', 'Patches for trying each module.'] };
        const [title, intro] = titles[this.view];
        const header = element(this.document, 'header', undefined, 'patch-library-header');
        const heading = element(this.document, 'div'); heading.append(element(this.document, 'h1', title), element(this.document, 'p', intro, 'patch-library-intro')); header.append(heading);
        if (this.view !== 'mine') {
            const form = element(this.document, 'form', undefined, 'patch-library-search'); const input = element(this.document, 'input'); input.type = 'search'; input.placeholder = `Search ${title.toLowerCase()}`; input.setAttribute('aria-label', input.placeholder); input.value = this.query;
            const button = element(this.document, 'button', 'Search'); button.type = 'submit'; form.append(input, button);
            form.addEventListener('submit', event => { event.preventDefault(); this.query = input.value.trim().slice(0, 100); if (this.view === 'public') void this.fetchList(true); else this.render(); }); header.append(form);
        }
        this.surface.append(header);
        if (this.view === 'tests') this.section('Module tests', Object.entries(TEST_PATCHES).filter(([name]) => name.toLowerCase().includes(this.query.toLowerCase())).map(([name, patch]) => ({ ...patch, source: 'test', key: name })), 'No matching patches.');
        if (this.view === 'mine') {
            try { this.section('This browser', this.local.list(), 'No patches saved in this browser.'); }
            catch (error) { this.section('This browser', [], error.message); }
            this.section('My account', this.accountPatches, this.user ? 'No patches saved to your account.' : this.config.enabled ? 'Sign in to save patches across devices.' : 'Account saving is unavailable. Try again later.');
        }
        if (this.view === 'public') this.section('Shared racks', this.publicPatches, this.config.enabled ? this.query ? 'No matching patches.' : 'No public patches yet.' : 'Public patches are unavailable. Try again later.');
        const next = this.view === 'public' ? this.publicCursor : this.accountCursor;
        if (next) this.surface.append(this.button('Load more', () => this.run(() => this.fetchList(this.view === 'public', next)), 'patch-load-more'));
        const footer = element(this.document, 'footer', undefined, 'patch-library-footer');
        const legal = element(this.document, 'nav'); legal.setAttribute('aria-label', 'Legal');
        legal.append(element(this.document, 'span', 'Eurorack · A modular synthesizer in your browser', 'footer-about'));
        for (const [path, label] of [['/privacy-policy', 'Privacy'], ['/terms-of-service', 'Terms']]) {
            const link = element(this.document, 'a', label); link.href = path; link.target = '_blank'; link.rel = 'noopener noreferrer'; legal.append(link);
        }
        footer.append(legal); this.surface.append(footer);
    }
    section(title, records, empty) {
        const section = element(this.document, 'section', undefined, 'patch-library-section'); section.append(element(this.document, 'h2', `${title}${records.length ? ` · ${records.length}` : ''}`));
        if (!records.length) section.append(element(this.document, 'p', empty, 'patch-empty'));
        else { const grid = element(this.document, 'div', undefined, 'patch-grid'); records.forEach(record => grid.append(this.entry(record))); section.append(grid); }
        this.surface.append(section);
    }
    entry(record) {
        const card = element(this.document, 'article', undefined, 'patch-entry'); card.dataset.patchName = record.name; card.dataset.patchSource = record.source; if (record.id) card.dataset.patchId = record.id;
        const frame = element(this.document, 'div', undefined, 'patch-preview-frame');
        frame.append(element(this.document, 'span', 'Rack preview', 'patch-preview-placeholder'));
        if (record.images?.thumbnail) {
            const img = element(this.document, 'img'); img.src = record.images.thumbnail; img.alt = `Rack for ${record.name}`; img.loading = 'lazy'; img.decoding = 'async'; frame.replaceChildren(img);
        } else if (record.state) this.observePreview(frame, record);
        card.append(frame);
        const caption = element(this.document, 'div', undefined, 'patch-entry-caption'); const meta = element(this.document, 'div', undefined, 'patch-entry-meta');
        meta.append(element(this.document, 'span', record.source === 'cloud' ? record.visibility : record.source === 'test' ? 'Test patch' : 'This browser'), element(this.document, 'span', `${record.moduleCount ?? record.state?.modules?.length ?? 0} modules`));
        caption.append(meta, element(this.document, 'h3', record.name));
        if (record.authorName) caption.append(element(this.document, 'p', `${record.canEdit ? 'By you' : `By ${record.authorName}`}`));
        if (record.description) caption.append(element(this.document, 'p', record.description));
        if (record.provenance?.parentId) {
            caption.append(element(this.document, 'p', `Original by ${record.provenance.originalCreatorName}${record.source === 'local' ? ' (imported credit)' : ''}`));
            if (record.provenance.parentAvailable && record.source === 'cloud') { const link = element(this.document, 'a', 'Source patch'); link.href = `/patches/${record.provenance.parentId}`; caption.append(link); }
        }
        card.append(caption);
        const actions = element(this.document, 'div', undefined, 'patch-entry-actions');
        actions.append(this.button('Open in rack', () => this.run(() => this.open(record)), 'primary'), this.button('Save a copy', () => this.run(() => this.openSave({ copy: true, record, fromEditor: false }))));
        if (record.source === 'cloud') {
            actions.append(this.button('Copy URL', () => this.run(() => this.share(record))));
            if (record.visibility === 'public') {
                const like = this.button(`Thumbs up · ${record.likeCount || 0}`, () => this.run(async () => {
                    if (!this.user) return this.signIn({ action: 'like', id: record.id });
                    like.disabled = true;
                    try { Object.assign(record, await this.cloud.like(record.id, !record.likedByMe)); like.textContent = `Thumbs up · ${record.likeCount}`; like.setAttribute('aria-pressed', String(record.likedByMe)); }
                    finally { like.disabled = false; }
                })); like.setAttribute('aria-pressed', String(!!record.likedByMe)); like.disabled = !!record.canEdit; actions.append(like);
            }
            if (record.canEdit) actions.append(this.button(record.visibility === 'public' ? 'Make private' : 'Make public', () => this.run(() => this.toggleVisibility(record))));
        }
        if (record.source === 'local') actions.append(this.button('Export JSON', () => this.exportRecord(record)));
        if (record.source === 'local' && this.user) actions.append(this.button('Save to account', () => this.run(() => this.openSave({ record, fromEditor: false, destination: 'cloud' }))));
        if (record.source === 'local' || record.canEdit) actions.append(this.button('Delete', () => this.run(() => this.remove(record))));
        card.append(actions); return card;
    }
    observePreview(frame, record) {
        const signal = this.previewAbort.signal;
        const render = async () => {
            try {
                const preview = await this.previewLoader();
                if (!frame.isConnected || signal.aborted) return;
                const unavailable = () => { if (frame.isConnected && !signal.aborted) frame.replaceChildren(element(this.document, 'span', 'Preview unavailable', 'patch-preview-placeholder')); };
                const show = (url, dimensions, retry) => {
                    if (!frame.isConnected || signal.aborted) return;
                    const img = element(this.document, 'img'); img.alt = `Rack for ${record.name}`; img.loading = 'lazy'; img.decoding = 'async';
                    if (dimensions) { img.width = dimensions.width; img.height = dimensions.height; }
                    img.onerror = retry || unavailable; img.src = url; frame.replaceChildren(img);
                };
                const capture = async () => {
                    const url = await preview.getPatchPreviewObjectUrl(record.state, { ...preview.PATCH_THUMBNAIL_OPTIONS, maxWidth: 640, maxHeight: 480, signal, persistent: record.source === 'local' || record.source === 'test' });
                    show(url);
                };
                const staticPreview = record.source === 'test' && await preview.getTestPatchPreview?.(record.state, record.key || record.name);
                if (staticPreview) show(staticPreview.url, staticPreview, () => { void capture().catch(unavailable); });
                else await capture();
            } catch { if (frame.isConnected && !signal.aborted) frame.replaceChildren(element(this.document, 'span', 'Preview unavailable', 'patch-preview-placeholder')); }
        };
        if (this.window.IntersectionObserver) {
            if (!this.observer) this.observer = new this.window.IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { this.observer.unobserve(entry.target); entry.target.renderPreview(); } }, { root: this.surface, rootMargin: '180px' });
            frame.renderPreview = render; this.observer.observe(frame);
        } else { frame.firstChild.textContent = 'Preview unavailable'; }
    }
    async fetchList(publicOnly, cursor) {
        if (!this.config.enabled || (!publicOnly && !this.user)) return;
        const generation = this.renderGeneration, account = this.accountGeneration;
        const list = publicOnly ? 'public' : 'account'; const request = ++this.listRequests[list];
        try {
            const result = await this.cloud.list({ publicOnly, cursor, query: publicOnly ? this.query : '' });
            if (generation !== this.renderGeneration || account !== this.accountGeneration || request !== this.listRequests[list]) return;
            const key = publicOnly ? 'publicPatches' : 'accountPatches'; const records = result.patches.map(record => ({ ...record, source: 'cloud' }));
            this[key] = cursor ? [...this[key], ...records] : records; this[publicOnly ? 'publicCursor' : 'accountCursor'] = result.nextCursor; this.render();
        } catch (error) { if (error.name !== 'AbortError' && generation === this.renderGeneration && account === this.accountGeneration && request === this.listRequests[list]) this.notice(error.message, [['Retry', () => this.fetchList(publicOnly, cursor)]]); }
    }
    async confirmReplace() {
        if (!this.isDirty()) return true;
        const answer = await this.choose('Unsaved rack changes', 'Save this rack before opening another patch?', [['cancel', 'Cancel'], ['discard', 'Discard changes'], ['save', 'Save']]);
        if (answer === 'discard') return true;
        if (answer === 'save') { const saved = await this.openSave(); return saved && !this.isDirty(); }
        return false;
    }
    async replaceState(state, record = null, { skipPrompt = false } = {}) {
        if (this.replacing) throw new Error('A patch is still opening.');
        this.replacing = true; this.loadGeneration++; const account = this.accountGeneration;
        try {
            if (!skipPrompt && !await this.confirmReplace()) return false;
            if (record?.source === 'cloud' && account !== this.accountGeneration) return false;
            await this.app.loadPatchState(state, { managed: true });
            this.setActive(record?.source === 'cloud' && account !== this.accountGeneration ? null : record); this.show('rack'); return true;
        } finally { this.replacing = false; }
    }
    async open(record, { updateLocation = true } = {}) {
        if (this.replacing) throw new Error('A patch is still opening.');
        const request = ++this.loadGeneration, account = this.accountGeneration;
        const loaded = record.source === 'cloud' ? { ...await this.cloud.get(record.id), source: 'cloud' } : record;
        if (request !== this.loadGeneration || account !== this.accountGeneration) return false;
        const success = await this.replaceState(loaded.state, loaded);
        if (success && updateLocation) this.setLocation(loaded.source === 'cloud' ? loaded.id : null);
        return success;
    }
    setLocation(id) {
        const url = new URL(id ? savedPatchUrl(id, this.window.location.origin) : '/', this.window.location.origin);
        this.window.history.replaceState(null, '', url);
    }
    async loadLocation() {
        const location = parsePatchLocation(this.window.location.hash, this.window.location.pathname);
        if (location?.source === 'cloud') {
            await this.ready;
            if (!this.config.enabled) throw new Error('Could not open this patch. Try again.');
            return this.open(location);
        }
        if (location?.source === 'local') {
            const record = this.local.list().find(patch => patch.id === location.id);
            if (!record) throw new Error('This patch is not saved in this browser.');
            return this.open(record, { updateLocation: false });
        }
        if (location?.source === 'snapshot') return this.app.loadPatchFromUrlHash();
        return false;
    }
    choose(title, message, choices) {
        return new Promise(resolve => {
            const dialog = element(this.document, 'dialog', undefined, 'patch-dialog'); const heading = element(this.document, 'h2', title); heading.id = 'patch-choice-title'; dialog.setAttribute('aria-labelledby', heading.id);
            const finish = value => { dialog.close?.(); dialog.remove(); resolve(value); };
            const actions = element(this.document, 'div', undefined, 'patch-dialog-actions'); choices.forEach(([value, label]) => actions.append(this.button(label, () => finish(value), value === 'save' ? 'primary' : '')));
            dialog.append(heading, element(this.document, 'p', message), actions); dialog.addEventListener('cancel', event => { event.preventDefault(); finish('cancel'); }); this.document.body.append(dialog); dialog.showModal();
        });
    }
    async openSave({ copy = false, record = this.active, fromEditor = true, destination, publish = false, stateOverride } = {}) {
        const generation = this.accountGeneration; const loadGeneration = this.loadGeneration; const accountId = this.user?.id;
        const assertAccount = () => { if (generation !== this.accountGeneration || accountId !== this.user?.id) throw new Error('Your account changed. Close this window and save again.'); };
        if (!fromEditor && record?.source === 'cloud' && !record.state) record = { ...await this.cloud.get(record.id), source: 'cloud' };
        if (generation !== this.accountGeneration) return false;
        const state = clone(stateOverride || (fromEditor ? this.app.host.serializePatch() : record.state));
        copy = copy || record?.source === 'test' || (record?.source === 'cloud' && !record.canEdit) || (destination === 'cloud' && record?.source === 'local' && !!record.provenance?.parentId);
        const originalName = fromEditor ? this.app.getCurrentPatchName() : record?.name;
        const suggested = `${originalName || 'Untitled'}${copy ? ' (copy)' : ''}`;
        return new Promise(resolve => {
            const dialog = element(this.document, 'dialog', undefined, 'patch-dialog'); const form = element(this.document, 'form');
            const title = element(this.document, 'h2', publish ? 'Save and publish' : copy ? 'Save a copy' : 'Save patch'); title.id = 'patch-save-title'; dialog.setAttribute('aria-labelledby', title.id);
            const field = (labelText, node) => { node.setAttribute('aria-label', labelText); const label = element(this.document, 'label', labelText); label.append(node); form.append(label); return node; };
            form.append(title);
            const name = field('Patch name', element(this.document, 'input')); name.name = 'name'; name.required = true; name.maxLength = 128; name.value = suggested;
            const target = field('Save to', element(this.document, 'select')); target.name = 'destination';
            for (const [value, text] of [['local', 'This browser'], ['cloud', 'My account']]) { const option = element(this.document, 'option', text); option.value = value; option.disabled = value === 'cloud' && !this.user; target.append(option); }
            target.value = destination || (this.user && record?.source === 'cloud' ? 'cloud' : 'local');
            const visibility = field('Visibility', element(this.document, 'select')); visibility.name = 'visibility';
            for (const value of ['private', 'public']) { const option = element(this.document, 'option', value === 'private' ? 'Private — only you' : 'Public — anyone can view'); option.value = value; visibility.append(option); }
            visibility.value = copy ? 'private' : publish ? 'public' : record?.visibility || 'private'; visibility.disabled = copy;
            const description = field('Description (optional)', element(this.document, 'textarea')); description.name = 'description'; description.maxLength = 1000; description.value = record?.description || '';
            const author = field('Public name', element(this.document, 'input')); author.name = 'authorName'; author.maxLength = 80; author.value = copy ? this.user?.name || '' : record?.authorName || this.user?.name || ''; author.placeholder = 'Shown on public patches';
            const help = element(this.document, 'p', '', 'patch-save-help'); help.dataset.saveHelp = ''; form.append(help);
            const updateFields = () => { const cloud = target.value === 'cloud'; visibility.parentElement.hidden = !cloud; description.parentElement.hidden = !cloud; author.parentElement.hidden = !cloud; author.required = cloud;
                help.textContent = cloud ? copy ? 'Copies start private. Save again before publishing. The original creator stays credited.' : visibility.value === 'public' ? 'Anyone can open and copy this patch.' : 'Only you can open this patch.' : 'Saved in this browser only.'; };
            target.addEventListener('change', updateFields); visibility.addEventListener('change', updateFields); updateFields();
            if (!this.user && this.config.enabled) form.append(this.button('Sign in with Google', () => this.run(() => this.signIn({ action: 'save', copy }))));
            const error = element(this.document, 'p', '', 'patch-dialog-error'); error.hidden = true; error.setAttribute('role', 'alert'); form.append(error);
            const actions = element(this.document, 'div', undefined, 'patch-dialog-actions'); let saving = false;
            const finish = result => { if (saving) return; dialog.close?.(); dialog.remove(); resolve(result); };
            const cancel = this.button('Cancel', () => finish(false)); const submit = element(this.document, 'button', publish ? 'Save and publish' : copy ? 'Save copy' : 'Save', 'primary'); submit.type = 'submit'; actions.append(cancel, submit); form.append(actions); dialog.append(form);
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
            let attempt;
            form.addEventListener('submit', async event => {
                event.preventDefault(); if (saving) return; saving = true; submit.disabled = true; cancel.disabled = true; error.hidden = true;
                const fields = { name: name.value.trim(), description: description.value.trim(), authorName: author.value.trim(), visibility: copy ? 'private' : visibility.value };
                try {
                    let saved;
                    if (target.value === 'local') {
                        saved = this.local.save({ ...fields, state, id: !copy && record?.source === 'local' && record.id ? record.id : await this.createId(), provenance: record?.source === 'cloud' ? { ...record.provenance, parentId: record.id, parentRevision: record.revision, parentCreatorName: record.authorName, rootId: record.provenance?.rootId || record.id, originalCreatorName: record.provenance?.originalCreatorName || record.authorName } : record?.provenance }, { key: !copy && record?.source === 'local' ? record.key : undefined, copy: copy || record?.source !== 'local' });
                    } else {
                        assertAccount();
                        if (!this.user) throw new Error('Sign in to save to your account.');
                        const fingerprint = snapshot(fields);
                        if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, requestId: await this.createId() };
                        let forkSource = copy && record?.source === 'cloud' ? record : null;
                        if (record?.source === 'local' && record.provenance?.parentId) {
                            forkSource = attempt.forkSource || await this.cloud.get(record.provenance.parentId); assertAccount(); attempt.forkSource = forkSource;
                        }
                        const isFork = !!forkSource;
                        const body = { ...fields, state, requestId: attempt.requestId, copy };
                        if (this.config.imagesEnabled && !(attempt.skipPreview && fields.visibility === 'private') && !attempt.previewId && (!isFork || snapshot(forkSource.state) !== snapshot(state))) {
                            submit.textContent = 'Creating preview…';
                            try {
                            assertAccount();
                            const preview = await this.previewLoader(); assertAccount();
                            const blob = await preview.capturePatchPreview(state, { theme: this.app.theme, mode: this.app.themeMode });
                            assertAccount();
                            attempt.previewId = (await this.cloud.uploadPreview(state, blob, { theme: 'industrial-light', rendererVersion: preview.PATCH_PREVIEW_RENDERER_VERSION })).id;
                            assertAccount();
                            } catch (previewError) { attempt.previewFailed = true; throw previewError; }
                        }
                        if (attempt.previewId) body.previewId = attempt.previewId;
                        submit.textContent = 'Saving…';
                        assertAccount();
                        if (isFork) saved = await this.cloud.copy(forkSource.id, { ...body, visibility: 'private', expectedRevision: forkSource.revision });
                        else if (!copy && record?.source === 'cloud' && record.canEdit) saved = await this.cloud.update(record.id, { ...body, expectedRevision: record.revision });
                        else saved = await this.cloud.create(body);
                        assertAccount();
                        saved = { ...saved, source: 'cloud' };
                    }
                    if (fromEditor && loadGeneration === this.loadGeneration) { this.setActive(saved, snapshot(state)); this.setLocation(saved.source === 'cloud' ? saved.id : null); }
                    if (this.view !== 'rack') this.show(this.view);
                    this.notice(saved.source === 'cloud' ? saved.visibility === 'public' ? 'Published.' : 'Saved privately.' : 'Saved in this browser.', fromEditor ? [] : [['Open copy', () => this.open(saved)]]);
                    saving = false; finish(true);
                } catch (failure) {
                    error.textContent = failure.message; error.hidden = false;
                    if (attempt?.previewFailed && fields.visibility === 'private' && !form.querySelector('[data-preview-fallback]')) {
                        const fallback = this.button('Save privately without preview', () => { attempt.skipPreview = true; form.requestSubmit(); }); fallback.dataset.previewFallback = ''; form.append(fallback);
                    }
                    if (failure.status === 409 && !form.querySelector('[data-conflict]')) {
                        const conflict = element(this.document, 'div'); conflict.dataset.conflict = '';
                        conflict.append(this.button('Save a copy', () => this.run(async () => {
                            const latest = record?.source === 'cloud' ? { ...await this.cloud.get(record.id), source: 'cloud' } : record; assertAccount();
                            saving = false; finish(false); void this.openSave({ copy: true, record: latest, fromEditor, stateOverride: state });
                        })), this.button('Load saved version', () => { saving = false; finish(false); void this.run(() => this.open(record)); })); form.append(conflict);
                    }
                } finally { saving = false; submit.disabled = false; cancel.disabled = false; submit.textContent = publish ? 'Save and publish' : copy ? 'Save copy' : 'Save'; }
            });
            this.document.body.append(dialog); dialog.showModal(); name.focus(); name.select();
        });
    }
    async toggleVisibility(record) {
        if (record.visibility === 'private' && (!record.previewId || record.requiresSaveBeforePublish || (record.provenance?.parentId && !record.savedAfterCopyAt))) return this.openSave({ record, fromEditor: false, destination: 'cloud', publish: true });
        const next = record.visibility === 'public' ? 'private' : 'public';
        if (next === 'public' && await this.choose('Make public?', 'Anyone can open and copy this patch.', [['cancel', 'Cancel'], ['publish', 'Make public']]) !== 'publish') return false;
        const saved = { ...await this.cloud.visibility(record.id, { expectedRevision: record.revision, visibility: next }), source: 'cloud' };
        if (this.active?.id === record.id) this.setActive(saved, this.baseline);
        this.notice(next === 'public' ? 'Made public.' : 'Made private.'); this.show(this.view); return true;
    }
    async remove(record) {
        if (await this.choose('Delete patch?', `Delete “${record.name}”? This cannot be undone.`, [['cancel', 'Cancel'], ['delete', 'Delete']]) !== 'delete') return false;
        if (record.source === 'cloud') await this.cloud.remove(record.id, record.revision); else this.local.remove(record.key);
        if (this.active?.source === record.source && (record.source === 'cloud' ? this.active.id === record.id : this.active.key === record.key)) this.setActive(null, snapshot({}));
        this.show(this.view); return true;
    }
    exportRecord(record) {
        const blob = new Blob([JSON.stringify({ schema: 'eurorack-js/patch-export', version: 1, patchVersion: 3, patch: record }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const link = element(this.document, 'a'); link.href = url; link.download = `${record.name.replace(/[^a-z0-9_-]/gi, '-') || 'patch'}.json`; this.document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    }
    async share(record) {
        await this.app.writeClipboardText(savedPatchUrl(record.id, this.window.location.origin));
        this.notice('Link copied.');
    }
    async signIn(intent = null) {
        if (!this.config.enabled) { this.notice('Sign-in is unavailable. Try again later.'); return; }
        this.window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: this.app.host.serializePatch(), name: this.app.getCurrentPatchName(), active: this.active, baseline: this.baseline, intent, createdAt: Date.now() }));
        this.redirecting = true;
        const callbackUrl = this.active?.source === 'cloud'
            ? rackPatchUrl(this.active.id, this.window.location.origin)
            : this.window.location.href;
        try { await this.cloud.signIn(callbackUrl); }
        catch (error) { this.redirecting = false; throw error; }
    }
    async restoreDraft() {
        const raw = this.window.sessionStorage.getItem(DRAFT_KEY); if (!raw) return false;
        let draft; try { draft = JSON.parse(raw); } catch { return false; }
        if (Date.now() - draft.createdAt > 86400000) return false;
        let target;
        try { target = parsePatchLocation(this.window.location.hash, this.window.location.pathname); } catch { /* Normal route loading reports invalid links. */ }
        // Signing in from a private saved URL must resume loading that patch,
        // rather than restore the untouched empty rack shown before sign-in.
        if (target?.source === 'cloud' && !draft.active && !draft.intent &&
            draft.state?.modules?.length === 0 && snapshot(draft.state) === draft.baseline) {
            this.window.sessionStorage.removeItem(DRAFT_KEY);
            return false;
        }
        await this.app.loadPatchState(draft.state, { managed: true });
        this.setActive(draft.active?.source === 'cloud' ? null : draft.active, draft.baseline);
        const name = this.document.getElementById('patchName'); if (name) name.value = draft.name;
        this.window.sessionStorage.removeItem(DRAFT_KEY);
        this.notice('Rack restored.');
        const restoredGeneration = this.loadGeneration; const restoredActive = this.active;
        void this.ready.then(async () => {
            if (restoredGeneration !== this.loadGeneration || restoredActive !== this.active) return;
            const account = this.accountGeneration;
            if (draft.active?.source === 'cloud') {
                try {
                    const saved = await this.cloud.get(draft.active.id);
                    if (restoredGeneration !== this.loadGeneration || account !== this.accountGeneration || restoredActive !== this.active) return;
                    this.setActive({ ...saved, source: 'cloud' }, draft.baseline);
                    this.setLocation(saved.id);
                } catch { /* The recovered rack remains usable if access changed. */ }
            }
            if (!this.user || restoredGeneration !== this.loadGeneration || account !== this.accountGeneration) return;
            if (draft.intent?.action === 'save') void this.openSave({ copy: draft.intent.copy, destination: 'cloud' });
            if (draft.intent?.action === 'like') await this.run(async () => { await this.cloud.like(draft.intent.id, true); this.notice('Liked.'); });
        });
        return true;
    }
    async signOut() {
        await this.cloud.signOut();
        void this.previewLoader().then(module => module.clearPatchPreviewCache?.()).catch(() => {});
        this.accountGeneration++; this.user = null; this.accountPatches = []; this.publicPatches = [];
        if (this.active?.source === 'cloud') this.setActive(null, snapshot({}));
        this.updateAccount(); this.show(this.view); this.notice('Signed out.');
    }
}
