import { createRackHost } from '../app/rack-host.js';
import { RackState } from '../app/rack-state.js';
import { pluginRegistry } from '../rack/registry.js';
import { LocalModuleStore } from '../local-modules/store.js';
import { LocalModuleRuntime } from '../local-modules/runtime.js';
import { renderModule, syncParamToModuleUI, cleanupRenderedModule } from '../ui/renderer.js';
import { createCablePath, getJackCenter } from '../cables/cable-manager.js';
import { CABLE_COLORS } from '../config/constants.js';
import { PATCH_PREVIEW_RENDERER_VERSION, getPreviewDimensions, snapshotPatchPreview } from './patch-preview.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_GUTTER = 8;
const MIN_PREVIEW_ROW_HP = 8;
// Copying computed styles and pseudo-elements for each node dominates capture
// time on dense racks. Their disposable frame already owns all the rack CSS.
const MAX_INLINE_STYLE_NODES = 2500;
const PREVIEW_STYLE = `
    html, body { margin: 0; padding: 0; width: max-content; height: auto; overflow: visible; }
    body.skin-factory { background: var(--factory-paper); }
    #patch-preview-rack {
        position: relative; display: flex; flex-direction: column; gap: 12px;
        width: calc(84 * var(--hp-unit) + 16px); padding: 8px;
        overflow: visible; background: var(--factory-paper); isolation: isolate;
    }
    #patch-preview-rack > .rack-row { flex-shrink: 0; }
    #patch-preview-rack *, #patch-preview-rack *::before, #patch-preview-rack *::after {
        animation: none !important; transition: none !important; caret-color: transparent !important;
    }
    #patch-preview-cables {
        position: absolute; left: 0; top: 0; z-index: 100; pointer-events: none; overflow: visible;
    }
`;

export function extractRackStyles(html, documentRef = document) {
    const Parser = documentRef.defaultView?.DOMParser || DOMParser;
    const parsed = new Parser().parseFromString(html, 'text/html');
    const css = [...parsed.querySelectorAll('head > style')].map(style => style.textContent).join('\n');
    if (!css.includes('--hp-unit') || !css.includes('.rack-row')) throw new Error('Rack preview styles are unavailable');
    return css;
}

export function fitPreviewRackWidth(root) {
    const styles = root.ownerDocument.defaultView.getComputedStyle(root);
    const hp = Number.parseFloat(styles.getPropertyValue('--hp-unit')) || 18;
    const rows = [...root.querySelectorAll('.rack-row')];
    // Measure actual rendered panels so native HP and factory panel overlaps
    // remain unchanged. Crop only the unused right rail, equally on every row.
    const occupiedWidth = Math.max(0, ...rows.flatMap(row => {
        const left = row.getBoundingClientRect().left;
        return [...row.querySelectorAll(':scope > .module')].map(panel => panel.getBoundingClientRect().right - left);
    }));
    const rowWidth = Math.ceil(Math.max(MIN_PREVIEW_ROW_HP * hp, occupiedWidth));
    rows.forEach(row => { row.style.width = `${rowWidth}px`; });
    root.style.width = `${rowWidth + PREVIEW_GUTTER * 2}px`;
    return rowWidth + PREVIEW_GUTTER * 2;
}

let stylePromise;
// A preview frame owns its registry and Blob URLs for its entire lifetime.
// Resolve only revisions already saved in this browser, never URLs in a patch.
let localModuleRuntime;
async function loadRackStyles(documentRef) {
    if (!stylePromise) {
        stylePromise = fetch(new URL('../../index.html', import.meta.url)).then(async response => {
            if (!response.ok) throw new Error('Unable to load rack preview styles');
            return extractRackStyles(await response.text(), documentRef);
        }).catch(error => {
            stylePromise = null;
            throw error;
        });
    }
    return stylePromise;
}

export function drawPreviewCables(root, state, documentRef = document) {
    const svg = documentRef.createElementNS(SVG_NS, 'svg');
    svg.id = 'patch-preview-cables';
    svg.setAttribute('aria-hidden', 'true');
    // Measure before appending: an unsized SVG has a 300px default width,
    // which would otherwise widen small racks through scrollWidth.
    const origin = root.getBoundingClientRect();
    let bottom = root.scrollHeight || origin.height;
    let right = root.scrollWidth || origin.width;
    const inputs = new Map();
    const outputs = new Map();
    for (const jack of root.querySelectorAll('.jack')) {
        const ports = jack.classList.contains('output') ? outputs : inputs;
        ports.set(JSON.stringify([jack.dataset.module, jack.dataset.port]), jack);
    }
    const centers = new Map();
    const center = jack => {
        if (!jack) throw new Error('A patch cable could not be rendered');
        if (!centers.has(jack)) centers.set(jack, getJackCenter(jack));
        return centers.get(jack);
    };
    state.cables.forEach((cable, index) => {
        const source = center(outputs.get(JSON.stringify([cable.fromModule, cable.fromPort])));
        const destination = center(inputs.get(JSON.stringify([cable.toModule, cable.toPort])));
        const x1 = source.x - origin.left;
        const y1 = source.y - origin.top;
        const x2 = destination.x - origin.left;
        const y2 = destination.y - origin.top;
        const path = documentRef.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'cable');
        // Rasterizers can lose selector-derived SVG presentation properties.
        // Keep the cable open instead of relying on the SVG default black fill.
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke', CABLE_COLORS[index % CABLE_COLORS.length]);
        path.setAttribute('d', createCablePath(x1, y1, x2, y2));
        svg.appendChild(path);
        // Include the cable's control points so a hanging cable on the final
        // row cannot be clipped by a rack-only image crop.
        bottom = Math.max(bottom, Math.max(y1, y2) + Math.min(100, Math.abs(x2 - x1) * 0.3 + 30) + 8);
        // Cubic cable x control points equal their endpoints; horizontal
        // bounds therefore need only the endpoint and stroke/gutter space.
        right = Math.max(right, x1 + PREVIEW_GUTTER, x2 + PREVIEW_GUTTER);
    });
    const width = Math.ceil(right);
    const height = Math.ceil(bottom);
    if (width > 0) root.style.width = `${width}px`;
    if (height > 0) root.style.height = `${height}px`;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // Measure every endpoint before writing to the live DOM. Fan-out shares a
    // single layout read even when a clock drives hundreds of destinations.
    for (const jack of centers.keys()) jack.classList.add('connected');
    root.appendChild(svg);
    return svg;
}

export async function renderPatchPreview(state, {
    mode = 'light',
    documentRef = document,
    registry = pluginRegistry,
    styles,
    hostFactory = createRackHost
} = {}) {
    state = snapshotPatchPreview(state);
    const host = hostFactory({ registry, state: new RackState({ rowCount: 1 }) });
    const panels = [];
    let root;
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        panels.forEach(cleanupRenderedModule);
        root?.remove();
        void host.destroy();
    };
    try {
        const css = styles ?? await loadRackStyles(documentRef);
        let style = documentRef.getElementById('patch-preview-styles');
        if (!style) {
            style = documentRef.createElement('style');
            style.id = 'patch-preview-styles';
            documentRef.head.appendChild(style);
        }
        style.textContent = `${css}\n${PREVIEW_STYLE}`;
        documentRef.body.className = `theme-industrial theme-${mode === 'dark' ? 'dark' : 'light'} skin-factory`;
        await host.init();
        if (registry === pluginRegistry) {
            localModuleRuntime ||= new LocalModuleRuntime({ store: new LocalModuleStore(), registry });
            await localModuleRuntime.preparePatch(state);
        }
        await host.loadPatch(structuredClone(state));
        root = documentRef.createElement('div');
        root.id = 'patch-preview-rack';
        root.setAttribute('role', 'img');
        root.setAttribute('aria-label', 'Saved patch rack');
        documentRef.body.appendChild(root);
        let displayError;
        const lastRow = Math.max(1, ...state.modules.map(module => module.row));
        for (let row = 1; row <= lastRow; row += 1) {
            const rackRow = documentRef.createElement('div');
            rackRow.className = 'rack rack-row';
            rackRow.dataset.row = String(row);
            root.appendChild(rackRow);
            host.state.getRow(row).forEach(id => {
                const module = host.state.getModule(id);
                const panel = renderModule(registry.get(module.type), id, {
                    dsp: module.instance,
                    getModule: () => module,
                    onParamChange: () => {},
                    preview: true,
                    onPreviewError: error => { displayError ||= error; }
                });
                panel.dataset.instanceId = id;
                panel.dataset.row = String(row);
                rackRow.appendChild(panel);
                panels.push(panel);
                Object.entries(module.params).forEach(([param, value]) => syncParamToModuleUI(panel, id, param, value));
            });
        }
        // The preview renderer draws animated module displays once through
        // the toolkit's preview context, without scheduling production loops.
        await Promise.resolve();
        if (displayError) throw displayError;
        await documentRef.fonts?.ready;
        fitPreviewRackWidth(root);
        drawPreviewCables(root, state, documentRef);
        return { element: root, host, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
}

let activePreview;
let generation = 0;
let capturing = false;

async function rasterizeLargeRack(node, width, height, output) {
    const doc = node.ownerDocument;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(output.width));
    svg.setAttribute('height', String(output.height));
    const styles = doc.createElementNS(SVG_NS, 'style');
    styles.textContent = [...doc.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
    const foreign = doc.createElementNS(SVG_NS, 'foreignObject');
    foreign.setAttribute('width', String(output.width));
    foreign.setAttribute('height', String(output.height));
    svg.append(styles, foreign);

    const body = doc.body.cloneNode(false);
    // :root is the SVG now. Preserve the cascade at the body, including the
    // dark palette inherited from html and the skin's own module height.
    const bodyStyle = getComputedStyle(doc.body);
    for (const name of bodyStyle) {
        if (name.startsWith('--')) body.style.setProperty(name, bodyStyle.getPropertyValue(name));
    }
    body.style.colorScheme = bodyStyle.colorScheme;
    const rack = node.cloneNode(true);
    // Scale the HTML itself. WebKit can clip foreignObject content to the
    // SVG viewport before applying a viewBox scale, dropping entire rack rows.
    rack.style.transformOrigin = 'top left';
    rack.style.transform = `scale(${output.width / width}, ${output.height / height})`;
    const originals = node.querySelectorAll('canvas, select');
    rack.querySelectorAll('canvas, select').forEach((copy, i) => {
        const original = originals[i];
        if (copy.tagName === 'SELECT') {
            [...copy.options].forEach((option, j) => option.toggleAttribute('selected', original.options[j].selected));
        } else if (original.width && original.height) {
            // A cloned canvas has an empty bitmap. Keep the actual element so
            // panel CSS, dimensions and borders still apply to its display.
            copy.style.backgroundImage = `url("${original.toDataURL()}")`;
            copy.style.backgroundSize = '100% 100%';
        }
    });
    body.append(rack);
    foreign.append(body);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await image.decode();
    const canvas = doc.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(node).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function capture(state, options = {}) {
    if (capturing) throw new Error('A patch preview is already being rendered');
    capturing = true;
    const startedAt = generation;
    try {
        activePreview = await renderPatchPreview(state, { mode: options.mode });
        if (startedAt !== generation) throw new Error('Patch preview cancelled');
        const node = activePreview.element;
        const width = Math.ceil(node.getBoundingClientRect().width);
        const height = Math.ceil(node.getBoundingClientRect().height);
        const output = getPreviewDimensions(width, height, options);
        let blob;
        const builtIn = Object.keys((state.state || state).plugins || {}).every(id => id === 'core');
        if (builtIn && node.getElementsByTagName('*').length > MAX_INLINE_STYLE_NODES) {
            blob = await rasterizeLargeRack(node, width, height, output);
        } else {
            const vendorUrl = new URL('../../vendor/cloud.js', import.meta.url).href;
            const { toBlob } = await import(/* @vite-ignore */ vendorUrl);
            if (startedAt !== generation) throw new Error('Patch preview cancelled');
            blob = await toBlob(node, {
                width, height, canvasWidth: output.width, canvasHeight: output.height,
                pixelRatio: 1, skipFonts: true, backgroundColor: getComputedStyle(node).backgroundColor
            });
        }
        if (!blob) throw new Error('Unable to rasterize the patch preview');
        return blob;
    } finally {
        activePreview?.dispose();
        activePreview = null;
        capturing = false;
    }
}

function dispose() {
    generation += 1;
    activePreview?.dispose();
    activePreview = null;
}

if (typeof window !== 'undefined' && document.body?.dataset.patchPreview === 'true') {
    window.eurorackPatchPreview = Object.freeze({
        version: PATCH_PREVIEW_RENDERER_VERSION,
        capture,
        dispose
    });
}
