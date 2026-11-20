import { CloudClient } from './cloud-client.js';
import { emailReturnUrl } from '../ui/sign-in-dialog.js';

const token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(history.state, '', location.pathname);
const confirm = document.getElementById('confirm');
const status = document.getElementById('status');
const back = document.getElementById('return');
if (token && token.length <= 512) {
    confirm.disabled = false;
    confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        status.textContent = 'Signing in…';
        try {
            await new CloudClient().confirmEmailLink(token);
            location.replace(emailReturnUrl(window));
        } catch (error) {
            status.textContent = error.message;
            confirm.disabled = false; back.hidden = false;
        }
    });
} else {
    status.textContent = 'Open the link from your sign-in email, or return to the rack to request a new one.';
    confirm.hidden = true; back.hidden = false;
}
