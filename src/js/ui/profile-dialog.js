function element(document, tag, text, className) {
    const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}

// Shared by the rack and static content pages. Account generations and request
// counters prevent stale saves or session responses from replacing another user.
export function openProfileDialog(controller) {
    if (!controller.user) return controller.signIn();
    if (controller.profileDialog?.isConnected) { controller.profileDialog.querySelector('input')?.focus(); return Promise.resolve(false); }
    const generation = controller.accountGeneration, accountId = controller.user.id;
    const currentAccount = () => generation === controller.accountGeneration && accountId === controller.user?.id;
    return new Promise(resolve => {
        const dialog = element(controller.document, 'dialog', undefined, 'patch-dialog patch-profile-dialog');
        const form = element(controller.document, 'form');
        const title = element(controller.document, 'h2', 'My profile'); title.id = 'patch-profile-title'; dialog.setAttribute('aria-labelledby', title.id);
        const label = element(controller.document, 'label', 'Public name');
        const name = element(controller.document, 'input'); name.name = 'name'; name.required = true; name.maxLength = 80; name.value = controller.user.name;
        name.autocomplete = 'nickname'; name.setAttribute('aria-label', 'Public name'); name.setAttribute('aria-describedby', 'patch-profile-help'); label.append(name);
        const help = element(controller.document, 'p', 'Shown on all your public patches.'); help.id = 'patch-profile-help';
        const error = element(controller.document, 'p', '', 'patch-dialog-error'); error.hidden = true; error.setAttribute('role', 'alert');
        const actions = element(controller.document, 'div', undefined, 'patch-dialog-actions');
        let saving = false, closed = false;
        const finish = result => {
            if (closed) return; closed = true; dialog.close?.(); dialog.remove();
            if (controller.profileDialog === dialog) { controller.profileDialog = null; controller.closeProfile = null; }
            resolve(result);
        };
        const cancel = controller.button('Cancel', () => { if (!saving) finish(false); });
        const submit = element(controller.document, 'button', 'Save profile', 'primary'); submit.type = 'submit';
        const setSaving = value => {
            saving = value; name.disabled = value; submit.disabled = value; cancel.disabled = value;
            form.setAttribute('aria-busy', String(value));
        };
        actions.append(cancel, submit); form.append(title, label, help, error, actions); dialog.append(form);
        controller.profileDialog = dialog; controller.closeProfile = () => finish(false);
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (!saving) finish(false); });
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (saving || closed) return;
            if (!currentAccount()) { finish(false); return; }
            const publicName = name.value.trim(); error.hidden = true;
            if (!publicName || publicName.length > 80 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029@]/u.test(publicName)) {
                error.textContent = !publicName ? 'Enter a public name.' : publicName.length > 80 ? 'Use 80 characters or fewer.' : publicName.includes('@') ? 'Use a public name without an email address.' : 'Enter a valid public name.';
                error.hidden = false; name.focus(); return;
            }
            setSaving(true); submit.textContent = 'Saving…';
            try {
                const { user } = await controller.cloud.updateProfile(publicName);
                if (!currentAccount() || closed) { finish(false); return; }
                if (user?.id !== accountId) throw new Error('Your account changed. Close this window and try again.');
                controller.sessionRequest++; controller.user = user; controller.updateAccount();
                await controller.refreshAttribution?.();
                if (!currentAccount() || closed) { finish(false); return; }
                finish(true); controller.notice('Profile updated.');
            } catch (failure) {
                if (!currentAccount() || closed) { finish(false); return; }
                error.textContent = failure.message; error.hidden = false;
            } finally {
                if (!closed) { setSaving(false); submit.textContent = 'Save profile'; }
            }
        });
        controller.document.body.append(dialog); dialog.showModal(); name.focus(); name.select();
    });
}
