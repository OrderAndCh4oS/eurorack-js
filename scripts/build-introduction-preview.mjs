import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import demo from '../src/js/config/patches/demo-introduction.js';
import { PATCH_PREVIEW_MODES, PATCH_PREVIEW_RENDERER_VERSION } from '../src/js/patches/patch-preview.js';

// Start npm run dev:previews, then in another terminal run:
// npm run build:introduction-preview -- http://127.0.0.1:4176
// Finally run npm run build to validate and include the updated artwork.
// These committed static assets are regenerated deliberately, not on a page
// request or during Vercel image processing. The gallery thumbnail builder does
// not clean this subdirectory.
const origin = process.argv[2] || 'http://127.0.0.1:4176';
const target = new URL('../src/patch-previews/introduction/', import.meta.url);
const widths = [640, 960, 1280, 1600, 1920];
const deviceScaleFactor = 3;
const capturePadding = 8;
const sha256 = data => createHash('sha256').update(data).digest('hex');
if (!demo?.name || !demo.state) throw new Error('Introduction demo must export { name, state }');

let previousManifest;
try { previousManifest = JSON.parse(await readFile(new URL('manifest.json', target), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

async function captureRack(browser, mode) {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor });
    await page.goto(new URL('/patch-preview.html', origin).href);
    await page.waitForFunction(() => window.eurorackPatchPreview);
    const rackSize = await page.evaluate(async ({ state, rendererVersion, padding, mode }) => {
        if (window.eurorackPatchPreview.version !== rendererVersion) {
            throw new Error('Preview renderer is stale. Rebuild the app and restart the local server.');
        }
        const { renderPatchPreview } = await import('/js/patches/patch-preview-frame.js');
        const preview = await renderPatchPreview(state, { mode });
        if (preview.host.engine) throw new Error('Hero rendering must not start audio');
        const rackBounds = preview.element.getBoundingClientRect();
        // The gallery renderer reserves space for cable control points, which
        // can extend well below the visible curves. Crop this static hero to
        // actual panel/rail and SVG curve bounds, retaining the cable stroke.
        const content = [
            ...preview.element.querySelectorAll(':scope > .rack-row'),
            ...preview.element.querySelectorAll('#patch-preview-cables path')
        ].map(element => {
            const bounds = element.getBoundingClientRect();
            const stroke = element instanceof SVGGeometryElement
                ? (Number.parseFloat(getComputedStyle(element).strokeWidth) || 0) / 2 : 0;
            return { left: bounds.left - stroke, top: bounds.top - stroke,
                right: bounds.right + stroke, bottom: bounds.bottom + stroke };
        });
        if (!content.length) throw new Error('The Introduction rack has no visible content');
        const x = Math.floor(Math.min(...content.map(bounds => bounds.left)) - padding);
        const y = Math.floor(Math.min(...content.map(bounds => bounds.top)) - padding);
        const right = Math.ceil(Math.max(...content.map(bounds => bounds.right)) + padding);
        const bottom = Math.ceil(Math.max(...content.map(bounds => bounds.bottom)) + padding);
        if (x < 0 || y < 0) throw new Error('The Introduction preview extends outside the capture page');
        return { width: right - x, height: bottom - y, clip: { x, y, width: right - x, height: bottom - y },
            uncroppedWidth: rackBounds.width, uncroppedHeight: rackBounds.height };
    }, { state: demo.state, rendererVersion: PATCH_PREVIEW_RENDERER_VERSION, padding: capturePadding, mode });
    // Capture real DOM/SVG outlines at DPR3. The normal gallery capture is capped
    // at native CSS size and cannot supply a sharp retina hero by resizing it.
    const master = await page.screenshot({ type: 'png', clip: rackSize.clip, scale: 'device', animations: 'disabled' });
    await page.close();
    return { master, rackSize };
}

async function writeVariants(master) {
    const { width: masterWidth, height: masterHeight } = await sharp(master).metadata();
    if (masterWidth < widths.at(-1)) {
        throw new Error(`The rack renders at ${masterWidth}px at DPR3. Widen the demo to at least 640 CSS px; the generator will not upscale it.`);
    }

    const variants = [];
    for (const width of widths) {
        const resized = sharp(master).resize({ width, withoutEnlargement: true, kernel: 'lanczos3' });
        const [lossless, highQuality, quality88] = await Promise.all([
            resized.clone().webp({ lossless: true, effort: 6 }).toBuffer(),
            resized.clone().webp({ quality: 90, effort: 6, smartSubsample: true }).toBuffer(),
            resized.clone().webp({ quality: 88, effort: 6, smartSubsample: true }).toBuffer()
        ]);
        // Prefer perfectly preserved panel lettering when its cost is close; retain
        // quality 90 when lossless would add more than 15% to the transfer size.
        const useLossless = lossless.length <= highQuality.length * 1.15;
        const image = useLossless ? lossless : highQuality;
        const file = `${sha256(image)}.webp`;
        const { height } = await sharp(image).metadata();
        await writeFile(new URL(file, target), image);
        variants.push({ width, height, bytes: image.length, file, encoding: useLossless ? 'lossless' : 'quality-90',
            comparedBytes: { lossless: lossless.length, quality90: highQuality.length, quality88: quality88.length } });
    }
    return { variants, width: masterWidth, height: masterHeight };
}

await mkdir(target, { recursive: true });
const browser = await chromium.launch({ headless: true });
const images = {};
try {
    for (const mode of PATCH_PREVIEW_MODES) {
        const { master, rackSize } = await captureRack(browser, mode);
        images[mode] = { rackSize, ...await writeVariants(master) };
    }
} finally { await browser.close(); }
const { rackSize, variants, width: masterWidth, height: masterHeight } = images.light;
const darkVariants = images.dark.variants;

const manifest = {
    sourceName: demo.name,
    sourceFile: 'src/js/config/patches/demo-introduction.js',
    stateHash: sha256(JSON.stringify(demo.state)),
    rendererVersion: PATCH_PREVIEW_RENDERER_VERSION,
    capture: { deviceScaleFactor, padding: capturePadding, rackWidth: rackSize.width, rackHeight: rackSize.height,
        uncroppedWidth: rackSize.uncroppedWidth, uncroppedHeight: rackSize.uncroppedHeight, width: masterWidth, height: masterHeight },
    variants, darkVariants
};
await writeFile(new URL('manifest.json.tmp', target), `${JSON.stringify(manifest, null, 2)}\n`);
await rename(new URL('manifest.json.tmp', target), new URL('manifest.json', target));
const retained = new Set([...variants, ...darkVariants].map(variant => variant.file));
for (const variant of [...previousManifest?.variants || [], ...previousManifest?.darkVariants || []]) {
    if (/^[a-f0-9]{64}\.webp$/.test(variant.file) && !retained.has(variant.file)) {
        await unlink(new URL(variant.file, target)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
}
console.log(`Rendered ${demo.name}: ${masterWidth}×${masterHeight} master at DPR${deviceScaleFactor}`);
for (const variant of [...variants, ...darkVariants]) console.log(`${variant.width}×${variant.height}: ${variant.bytes.toLocaleString('en-GB')} bytes (${variant.encoding}; lossless ${variant.comparedBytes.lossless}, quality90 ${variant.comparedBytes.quality90}, quality88 ${variant.comparedBytes.quality88})`);
console.log(`Saved ${fileURLToPath(new URL('manifest.json', target))}`);
