import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '../../src/js/rack/registry.js';
import { createRackHost } from '../../src/js/app/rack-host.js';
import {
    drawPreviewCables,
    extractRackStyles,
    fitPreviewRackWidth,
    renderPatchPreview
} from '../../src/js/patches/patch-preview-frame.js';

const indexHtml = readFileSync('src/index.html', 'utf8');
const styles = extractRackStyles(indexHtml);
let rendered;

beforeEach(() => { document.body.replaceChildren(); });
afterEach(() => { rendered?.dispose(); rendered = null; vi.unstubAllGlobals(); });

describe('rack-only preview renderer', () => {
    it('extracts real rack styles without importing bootstrap scripts or surrounding UI', () => {
        expect(styles).toContain('--hp-unit: 18px');
        expect(styles).toContain('body.theme-industrial.theme-light');
        expect(styles).toContain('.module::before');
        expect(styles).not.toContain('window.va');
        expect(styles).not.toContain('<script');
        expect(() => extractRackStyles('<html><head></head></html>')).toThrow('styles are unavailable');
    });

    it('uses the real custom panel renderer and draws a canvas once without audio', async () => {
        const process = vi.fn();
        const draw = vi.fn();
        const audioEngineFactory = vi.fn();
        const AudioContext = vi.fn();
        vi.stubGlobal('AudioContext', AudioContext);
        const registry = new PluginRegistry();
        await registry.registerPlugin({
            id: 'preview-test', name: 'Preview test', version: '1', apiVersion: 1, patchVersion: 1,
            workletUrl: 'test://preview.worklet.js',
            modules: [{
                id: 'preview-fixture',
                definition: {
                    id: 'preview-fixture', name: 'Preview Fixture', hp: 4,
                    category: 'utility', color: 'module-color-one',
                    telemetry: { fields: [], methods: [] },
                    createDSP({ bufferSize = 512 } = {}) {
                        return { params: { level: 0.5 }, inputs: {}, outputs: { out: new Float32Array(bufferSize) },
                            leds: {}, process, reset() {} };
                    },
                    ui: {
                        knobs: [{ id: 'level', param: 'level', label: 'Level', min: 0, max: 1, default: 0.5 }],
                        outputs: [{ id: 'out', port: 'out', label: 'Out', signal: 'cv' }]
                    },
                    render(container, { toolkit, instance }) {
                        const canvas = document.createElement('canvas');
                        canvas.width = 24;
                        canvas.height = 24;
                        container.appendChild(canvas);
                        toolkit.animate(() => { canvas.dataset.level = String(instance.dsp.params.level); draw(); });
                        container.appendChild(toolkit.createKnob({ id: 'level', param: 'level', min: 0, max: 1, value: instance.dsp.params.level }));
                        container.appendChild(toolkit.createJack({ id: 'out', port: 'out', direction: 'output', signal: 'cv' }));
                    }
                }
            }]
        });
        const state = {
            version: 3, plugins: { 'preview-test': 1 },
            modules: [{ id: 'panel', type: 'preview-fixture', row: 2, index: 0 }],
            params: { panel: { level: 0.75 } }, cables: [], midiMappings: {}
        };
        const before = structuredClone(state);
        rendered = await renderPatchPreview(state, {
            registry, styles, hostFactory: options => createRackHost({ ...options, audioEngineFactory })
        });
        expect(rendered.element.querySelectorAll('.rack-row')).toHaveLength(2);
        expect(rendered.element.querySelector('.module-4hp .module-label').textContent).toBe('Preview Fixture');
        expect(rendered.element.querySelector('canvas').dataset.level).toBe('0.75');
        expect(draw).toHaveBeenCalledTimes(1);
        expect(rendered.element.querySelectorAll('#toolbar, .sidebar, .app-footer, .remove-btn')).toHaveLength(0);
        expect(document.body.className).toBe('theme-industrial theme-light skin-factory');
        expect(process).not.toHaveBeenCalled();
        expect(audioEngineFactory).not.toHaveBeenCalled();
        expect(AudioContext).not.toHaveBeenCalled();
        expect(state).toEqual(before);
    });

    it('renders an empty rack without generating branding or placeholder copy', async () => {
        const registry = new PluginRegistry();
        rendered = await renderPatchPreview({ version: 3, plugins: {}, modules: [], params: {}, cables: [], midiMappings: {} }, { registry, styles });
        expect(rendered.element.querySelectorAll('.rack-row')).toHaveLength(1);
        expect(rendered.element.textContent).toBe('');
        expect(rendered.element.querySelectorAll('img, canvas, .module')).toHaveLength(0);
        expect(rendered.element.style.width).toBe('160px');
        expect(rendered.element.querySelector('.rack-row').style.width).toBe('144px');
    });

    it('crops every row to the widest occupied panel edge without resizing panels', () => {
        const root = document.createElement('div');
        root.style.setProperty('--hp-unit', '18px');
        root.innerHTML = '<div class="rack-row"><div class="module"></div></div><div class="rack-row"><div class="module"></div><div class="module"></div></div>';
        document.body.appendChild(root);
        const rows = [...root.querySelectorAll('.rack-row')];
        rows.forEach(row => { row.getBoundingClientRect = () => ({ left: 108, width: 1507 }); });
        const panels = [...root.querySelectorAll('.module')];
        panels[0].getBoundingClientRect = () => ({ left: 105, right: 213, width: 108 });
        panels[1].getBoundingClientRect = () => ({ left: 105, right: 249, width: 144 });
        panels[2].getBoundingClientRect = () => ({ left: 249, right: 465, width: 216 });
        expect(fitPreviewRackWidth(root)).toBe(373);
        expect(root.style.width).toBe('373px');
        expect(rows.map(row => row.style.width)).toEqual(['357px', '357px']);
        expect(panels.map(panel => panel.style.width)).toEqual(['', '', '']);
    });

    it('places cross-row cable geometry in rack-local coordinates, including sag', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div class="jack output" data-module="source" data-port="out"></div><div class="jack input" data-module="dest" data-port="in"></div>';
        root.getBoundingClientRect = () => ({ left: 100, top: 200, width: 600, height: 800 });
        const [source, dest] = root.querySelectorAll('.jack');
        source.getBoundingClientRect = () => ({ left: 140, top: 240, width: 24, height: 24 });
        dest.getBoundingClientRect = () => ({ left: 440, top: 940, width: 24, height: 24 });
        const svg = drawPreviewCables(root, { cables: [{ fromModule: 'source', fromPort: 'out', toModule: 'dest', toPort: 'in' }] });
        expect(svg.parentElement).toBe(root);
        expect(svg.querySelector('path').getAttribute('d')).toBe('M 52 52 C 52 152, 352 852, 352 752');
        expect(svg.querySelector('path').getAttribute('fill')).toBe('none');
        expect(svg.querySelector('path').getAttribute('stroke-width')).toBe('5');
        expect(svg.getAttribute('height')).toBe('860');
        expect(source.classList.contains('connected')).toBe(true);
        expect(dest.classList.contains('connected')).toBe(true);
    });

    it('retains stroke space when a cable endpoint reaches the cropped right edge', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div class="jack output" data-module="source" data-port="out"></div><div class="jack input" data-module="dest" data-port="in"></div>';
        root.getBoundingClientRect = () => ({ left: 100, top: 200, width: 220, height: 400 });
        // Browsers give a newly appended, unsized SVG a 300px intrinsic width.
        Object.defineProperty(root, 'scrollWidth', { get: () => root.querySelector('svg:not([width])') ? 300 : 220 });
        const [source, dest] = root.querySelectorAll('.jack');
        source.getBoundingClientRect = () => ({ left: 110, top: 240, width: 24, height: 24 });
        dest.getBoundingClientRect = () => ({ left: 310, top: 440, width: 24, height: 24 });
        const svg = drawPreviewCables(root, { cables: [{ fromModule: 'source', fromPort: 'out', toModule: 'dest', toPort: 'in' }] });
        expect(svg.getAttribute('width')).toBe('230');
        expect(root.style.width).toBe('230px');
    });
});
