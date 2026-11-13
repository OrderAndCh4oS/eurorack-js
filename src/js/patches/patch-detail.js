import { CloudClient, newRequestId, savedPatchUrl, rackPatchUrl } from './cloud-client.js';
import { LocalPatchStore } from './local-patch-store.js';

const cloud = new CloudClient();
const document = globalThis.document;
const id = document?.body?.dataset.patchId;
const node = (tag, text) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; return value; };
let record, user, config, copyAttempt;
const status = message => { const target = document.getElementById('patch-status'); if (target) target.textContent = message; };
const button = (label, action) => { const value = node('button', label); value.type = 'button'; value.dataset.action = action; return value; };

function render() {
    const main = document.getElementById('patch-detail'); main.replaceChildren();
    main.append(node('p', record.visibility === 'public' ? 'PUBLIC PATCH' : 'PRIVATE PATCH'), node('h1', record.name), node('p', `${record.canEdit ? 'By you' : `By ${record.authorName}`} · ${record.moduleCount} modules`));
    if (record.provenance?.parentId) {
        const { originalCreatorName, parentCreatorName } = record.provenance;
        main.append(node('p', `Original by ${originalCreatorName}${parentCreatorName && parentCreatorName !== originalCreatorName ? ` · Copied from ${parentCreatorName}` : ''}`));
        if (record.provenance.parentAvailable) { const link = node('a', 'Source patch'); link.href = `/patches/${record.provenance.parentId}`; main.append(link); }
    }
    if (record.description) main.append(node('p', record.description));
    if (record.images?.full) { const img = node('img'); img.src = record.images.full; img.alt = `Rack for ${record.name}`; img.className = 'rack-preview'; main.append(img); }
    const actions = node('div'); actions.className = 'patch-actions';
    const open = node('a', 'Open in rack'); open.href = rackPatchUrl(id); actions.append(open);
    if (!user) actions.append(button('Sign in', 'sign-in'));
    if (record.visibility === 'public') {
        const like = button(`Thumbs up · ${record.likeCount}`, 'like'); like.setAttribute('aria-pressed', String(record.likedByMe)); like.disabled = !!record.canEdit; actions.append(like);
    }
    actions.append(button('Save a copy', 'copy'), button('Copy URL', 'share'));
    if (record.visibility === 'public') {
        const share = node('a', 'Share on X'); share.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(savedPatchUrl(id))}&text=${encodeURIComponent(record.name)}`; share.target = '_blank'; share.rel = 'noopener noreferrer'; actions.append(share);
        const bluesky = node('a', 'Share on Bluesky'); bluesky.href = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${record.name} ${savedPatchUrl(id)}`)}`; bluesky.target = '_blank'; bluesky.rel = 'noopener noreferrer'; actions.append(bluesky);
    }
    main.append(actions); const output = node('p'); output.id = 'patch-status'; output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite'); main.append(output);
}

async function signIn(intent) {
    if (!config?.enabled) throw new Error('Sign-in is unavailable. Try again later.');
    sessionStorage.setItem('eurorack-detail-intent', JSON.stringify({ id, action: intent }));
    await cloud.signIn(location.href);
}

function copyDialog() {
    const dialog = node('dialog'); dialog.style.cssText = 'margin:auto;padding:24px;max-width:calc(100vw - 32px);width:500px;background:#f0eee2;color:#0b0b09;border:3px solid #0b0b09;font:inherit';
    const form = node('form'); const title = node('h2', 'Save a copy');
    const label = node('label', 'Patch name '); const input = node('input'); input.name = 'name'; input.value = `${record.name} (copy)`.slice(0, 128); input.required = true; input.maxLength = 128; label.append(input);
    const targetLabel = node('label', 'Save to '); const target = node('select'); target.name = 'destination';
    for (const [value, text] of [['local', 'This browser'], ['cloud', 'My account']]) { const option = node('option', text); option.value = value; option.disabled = value === 'cloud' && !user; target.append(option); }
    target.value = user ? 'cloud' : 'local'; targetLabel.append(target);
    const help = node('p', 'Copies start private. Save again before publishing. The original creator stays credited.');
    const output = node('p'); output.setAttribute('role', 'alert');
    const actions = node('div'); actions.className = 'patch-actions'; const cancel = button('Cancel', 'cancel-copy'); cancel.addEventListener('click', () => { dialog.close(); dialog.remove(); });
    const submit = node('button', 'Save copy'); submit.type = 'submit'; actions.append(cancel, submit);
    if (!user) { const login = button('Sign in with Google', 'dialog-login'); login.addEventListener('click', () => signIn('copy').catch(error => { output.textContent = error.message; })); actions.append(login); }
    form.append(title, label, node('p'), targetLabel, help, output, actions); dialog.append(form); document.body.append(dialog); dialog.showModal();
    form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true; cancel.disabled = true;
        try {
            let saved;
            if (target.value === 'cloud') {
                if (!copyAttempt || copyAttempt.name !== input.value.trim()) copyAttempt = { name: input.value.trim(), requestId: await newRequestId(), expectedRevision: record.revision };
                saved = await cloud.copy(id, copyAttempt);
            } else saved = new LocalPatchStore().save({ name: input.value.trim(), state: record.state, id: await newRequestId(), provenance: { ...record.provenance, parentId: record.id, parentRevision: record.revision, parentCreatorName: record.authorName } }, { copy: true });
            dialog.close(); dialog.remove();
            status('Copy saved.');
            const open = node('a', 'Open copy'); open.href = target.value === 'cloud' ? rackPatchUrl(saved.id) : `/#local=${saved.id}`; document.getElementById('patch-status').append(' ', open);
        } catch (error) { output.textContent = error.message; }
        finally { submit.disabled = false; cancel.disabled = false; }
    });
}

async function action(name, trigger) {
    if (name === 'sign-in') return signIn();
    if (!record) return;
    if (name === 'share') { await navigator.clipboard.writeText(savedPatchUrl(id)); status('Link copied.'); }
    if (name === 'copy') copyDialog();
    if (name === 'like') {
        if (!user) return signIn('like');
        trigger.disabled = true;
        try { Object.assign(record, await cloud.like(id, !record.likedByMe)); render(); }
        finally { trigger.disabled = false; }
    }
}

if (id) {
    document.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target && ['sign-in', 'share', 'copy', 'like'].includes(target.dataset.action)) void action(target.dataset.action, target).catch(error => status(error.message)); });
    void (async () => {
        config = await cloud.configuration();
        if (!config.enabled) { status('Could not open this patch. Try again.'); return; }
        [{ user }, record] = await Promise.all([cloud.me(), cloud.get(id)]); render();
        let intent; try { intent = JSON.parse(sessionStorage.getItem('eurorack-detail-intent')); } catch { /* No pending action. */ }
        if (intent?.id === id && user) {
            sessionStorage.removeItem('eurorack-detail-intent');
            if (intent.action === 'copy') copyDialog();
            if (intent.action === 'like') { Object.assign(record, await cloud.like(id, true)); render(); status('Liked.'); }
        }
    })().catch(error => status(error.message));
}
