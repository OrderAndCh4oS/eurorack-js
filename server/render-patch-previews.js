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
    if (path === '/vendor/cloud.js') {
        const library = await readFile(new URL(import.meta.resolve('html-to-image/dist/html-to-image.js')), 'utf8');
        return route.fulfill({ contentType: types.js, body: `${library}\nexport const toBlob = globalThis.htmlToImage.toBlob;` });
    }
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
        await page.goto(`${origin}/patch-preview.html`);
        await page.waitForFunction(() => window.eurorackPatchPreview);
        const images = {};
        for (const mode of modes) {
            const data = await page.evaluate(async ({ state, mode }) => {
                const blob = await window.eurorackPatchPreview.capture(state, { mode });
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
            }, { state, mode });
            images[mode] = Buffer.from(data, 'base64');
        }
        return images;
    } finally {
        clearTimeout(deadline);
        await browser.close();
    }
}
