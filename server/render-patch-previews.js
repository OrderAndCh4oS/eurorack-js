import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = 'https://rack-preview.invalid';
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const rendererFiles = new Set(['/patch-preview.html', '/index.html', '/industrial-theme.css']);
let executable;

// Serve the shipped renderer in isolation. The browser has no account cookies,
// external network access, or user-supplied module URLs.
async function serveRendererFile(route) {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!rendererFiles.has(path) && !/^\/js\/(?:[\w-]+\/)*[\w-]+\.js$/.test(path)) return route.abort();
    const body = await readFile(new URL(`../src${path}`, import.meta.url));
    return route.fulfill({ contentType: types[path.split('.').at(-1)], body });
}

export async function renderPatchPreviews(state, modes) {
    const options = { headless: true, timeout: 20000 };
    if (process.env.VERCEL === '1') {
        const { default: binary } = await import('@sparticuz/chromium');
        // Concurrent cold requests share the extraction of the browser under /tmp.
        executable ||= binary.executablePath().catch(error => { executable = undefined; throw error; });
        options.executablePath = await executable;
        options.args = binary.args;
    }
    const runtimeKeys = ['PATH', 'HOME', 'TMPDIR', 'LD_LIBRARY_PATH', 'FONTCONFIG_PATH', 'LANG', 'TZ'];
    options.env = Object.fromEntries(runtimeKeys.filter(key => process.env[key]).map(key => [key, process.env[key]]));
    const browser = await chromium.launch(options);
    const deadline = setTimeout(() => { void browser.close().catch(() => {}); }, 75000);
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, serviceWorkers: 'block' });
        await page.route('**/*', route => serveRendererFile(route).catch(() => route.abort().catch(() => {})));
        const images = {};
        for (const mode of modes) {
            await page.goto(`${origin}/patch-preview.html`);
            const clip = await page.evaluate(async ({ state, mode }) => {
                const { renderPatchPreview } = await import('/js/patches/patch-preview-frame.js');
                const { getPreviewDimensions } = await import('/js/patches/patch-preview.js');
                const { element } = await renderPatchPreview(state, { mode });
                const bounds = element.getBoundingClientRect();
                const size = getPreviewDimensions(Math.ceil(bounds.width), Math.ceil(bounds.height));
                element.style.transformOrigin = 'top left';
                element.style.transform = `scale(${size.width / bounds.width}, ${size.height / bounds.height})`;
                return { x: bounds.x, y: bounds.y, ...size };
            }, { state, mode });
            images[mode] = await page.screenshot({ clip, type: 'png', animations: 'disabled', scale: 'css' });
        }
        return images;
    } finally {
        clearTimeout(deadline);
        await browser.close();
    }
}
