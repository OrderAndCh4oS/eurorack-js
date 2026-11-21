import { syncPatchImageSources } from '../ui/patch-image-sources.js';

const MODE_KEY = 'eurorack-theme-mode';

export function initThemeMode(doc) {
    const win = doc.defaultView;
    const buttons = doc.querySelectorAll('button[data-theme-mode-toggle]');

    function apply(mode) {
        const dark = mode === 'dark';
        const changed = doc.body.classList.contains('theme-dark') !== dark;
        doc.body.classList.toggle('theme-dark', dark);
        doc.body.classList.toggle('theme-light', !dark);
        for (const button of buttons) button.setAttribute('aria-pressed', String(dark));
        syncPatchImageSources(doc);
        if (changed) doc.dispatchEvent(new win.Event('theme-mode-change'));
    }

    function restore() {
        let mode = 'light';
        try {
            mode = win.localStorage.getItem(MODE_KEY);
            win.localStorage.removeItem('eurorack-theme');
        } catch {
            // Storage can be unavailable in a private or embedded window.
        }
        apply(mode);
    }

    restore();
    for (const button of buttons) {
        button.hidden = false;
        button.addEventListener('click', () => {
            const mode = doc.body.classList.contains('theme-dark') ? 'light' : 'dark';
            apply(mode);
            try {
                win.localStorage.setItem(MODE_KEY, mode);
            } catch {
                // The current page can still switch modes.
            }
        });
    }
    win.addEventListener('storage', event => {
        if (event.key === MODE_KEY || event.key === null) restore();
    });
}

if (typeof document !== 'undefined') initThemeMode(document);
