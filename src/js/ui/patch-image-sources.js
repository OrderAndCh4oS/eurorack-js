// Keep the light source in the HTML for readers and crawlers without JavaScript.
// Remember it when a responsive image first adopts the current rack palette.
export function syncPatchImageSources(root) {
    const doc = root.ownerDocument || root;
    const dark = doc.body.classList.contains('theme-dark');
    for (const img of root.querySelectorAll('img[data-dark-srcset]')) {
        img.dataset.lightSrcset ??= img.getAttribute('srcset') || img.getAttribute('src');
        const srcset = dark ? img.dataset.darkSrcset : img.dataset.lightSrcset;
        if (img.getAttribute('srcset') !== srcset) img.setAttribute('srcset', srcset);
    }
}
