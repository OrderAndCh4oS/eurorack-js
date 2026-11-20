export const emailSentNotice = 'Check your inbox for the sign-in link. After signing in, return to this tab to continue.';
const returnKey = 'eurorack-email-sign-in-return';

export function rememberEmailReturn(window) {
    try { window.sessionStorage.setItem(returnKey, window.location.href); } catch { /* Storage is optional for sign-in. */ }
}
export function emailReturnUrl(window) {
    try {
        const saved = window.sessionStorage.getItem(returnKey);
        window.sessionStorage.removeItem(returnKey);
        if (saved) {
            const url = new URL(saved);
            if (url.origin === window.location.origin) return url.href;
        }
    } catch { /* Open the rack in a fresh tab. */ }
    return '/';
}

export async function chooseSignIn({ document, methods, google, email }) {
    if (!methods?.magicLink) { await google(); return 'google'; }
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'patch-dialog'; dialog.setAttribute('aria-label', 'Sign in');
        dialog.innerHTML = `<h2>Sign in</h2>
            <button type="button" data-google>Continue with Google</button>
            <form><label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
            <p role="alert" class="patch-dialog-error" hidden></p>
            <div class="patch-dialog-actions"><button type="button" data-cancel>Cancel</button>
            <button type="submit" class="primary">Email me a sign-in link</button></div></form>`;
        const form = dialog.querySelector('form'), input = form.elements.email;
        const error = dialog.querySelector('[role="alert"]'), googleButton = dialog.querySelector('[data-google]');
        googleButton.hidden = !methods.google;
        let pending = false;
        function finish(result) { dialog.close(); dialog.remove(); resolve(result); }
        async function submit(method) {
            if (pending) return;
            pending = true; error.hidden = true;
            for (const node of dialog.querySelectorAll('input,button')) node.disabled = true;
            form.setAttribute('aria-busy', 'true');
            try {
                if (method === 'google') await google();
                else { await email(input.value.trim()); rememberEmailReturn(document.defaultView); }
                finish(method);
            } catch (failure) {
                pending = false; form.removeAttribute('aria-busy');
                for (const node of dialog.querySelectorAll('input,button')) node.disabled = false;
                error.textContent = failure.message || 'Could not sign in. Try again.'; error.hidden = false;
            }
        }
        googleButton.addEventListener('click', () => void submit('google'));
        form.addEventListener('submit', event => { event.preventDefault(); void submit('email'); });
        dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (!pending) finish(null); });
        document.body.append(dialog); dialog.showModal(); input.focus();
    });
}
