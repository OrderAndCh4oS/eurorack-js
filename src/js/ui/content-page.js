import { initSiteAccount } from './site-account.js';
import { syncPatchImageSources } from './patch-image-sources.js';

// Shared by the static documentation pages and the same pages inside the rack.
export function enhanceContentPage(root) {
    if (!root || root.dataset.enhanced) return;
    root.dataset.enhanced = 'true';
    syncPatchImageSources(root);
    const win = root.ownerDocument.defaultView;
    if (win.matchMedia?.('(max-width: 900px)').matches) {
        root.querySelectorAll('.docs-menu').forEach(menu => { menu.open = false; });
    }
    if (win.matchMedia?.('(max-width: 1200px)').matches) {
        root.querySelectorAll('.docs-toc details').forEach(menu => { menu.open = false; });
    }
    root.addEventListener('click', async event => {
        const button = event.target.closest('[data-copy-code]');
        if (!button || !root.contains(button)) return;
        const code = button.closest('.docs-code')?.querySelector('pre code');
        if (!code) return;
        try {
            await win.navigator.clipboard.writeText(code.textContent);
            button.textContent = 'Copied';
        } catch { button.textContent = 'Select code to copy'; }
        win.setTimeout(() => { button.textContent = 'Copy'; }, 2200);
    });
}

if (typeof document !== 'undefined' && document.body?.classList.contains('site-page')) {
    enhanceContentPage(document.querySelector('[data-content-page]'));
    initSiteAccount({ document });
}
