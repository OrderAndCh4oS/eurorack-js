import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import definition from '../../src/js/modules/gate-seq/index.js';
import { renderModule, cleanupRenderedModule } from '../../src/js/ui/renderer.js';
import { PluginRegistry } from '../../src/js/rack/registry.js';
import { RackHost } from '../../src/js/app/rack-host.js';

let frame;
beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frame = cb; return 1; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function panelFor(dsp = definition.createDSP(), onParamChange = vi.fn()) {
    const panel = renderModule(definition, 'gate_seq_1', { dsp, onParamChange });
    document.body.appendChild(panel);
    const named = name => panel.querySelector('[aria-label="' + name + '"]');
    const click = name => named(name).click();
    const choose = (name, value) => {
        const element = named(name);
        element.value = String(value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    return { dsp, panel, named, click, choose, onParamChange };
}
describe('Gate Seq editor', () => {
    it('edits page four and track settings before audio starts and distinguishes selection, playhead, and Length', () => {
        const { dsp, panel, named, click, choose, onParamChange } = panelFor();
        expect([...panel.querySelectorAll('.jack')].map(jack => jack.dataset.port)).toEqual(['clock', 'reset', 'a', 'b', 'c', 'd']);
        expect(panel.querySelectorAll('.led')).toHaveLength(6);
        const original = dsp.params.pattern;
        choose('Track', 'd'); choose('Page', 4);
        const step = named('Step 64');
        expect(step.classList.contains('outside')).toBe(true);
        click('Step 64');
        expect(step.getAttribute('aria-pressed')).toBe('true');
        choose('Edit mode', 'ratchets');
        click('Step 64');
        choose('Ratchet hits', 6);
        expect(dsp.params.pattern[3].cells[63]).toBe(6);
        choose('Edit mode', 'gates'); click('Step 64');
        expect(dsp.params.pattern[3].cells[63]).toBe(-6);
        click('Track settings');
        for (const [field, value] of [['Length', 64], ['Rate', -3], ['Gate length', 100], ['Swing', 78],
            ['Delay', 58], ['Probability', 0], ['Rotation', -63]]) choose(field, value);
        click('Mute D');
        expect(dsp.params.pattern[3]).toMatchObject({ length: 64, ratio: -3, gateLength: 100, swing: 78,
            delay: 58, probability: 0, rotation: -63, mute: 1 });
        expect(original[3].cells[63]).toBe(-1);
        click('Steps');
        step.focus();
        dsp.positions[3] = 63;
        frame();
        expect(document.activeElement).toBe(step);
        expect(step.classList.contains('playing')).toBe(true);
        expect(step.classList.contains('outside')).toBe(false);
        expect(onParamChange.mock.calls.every(([id, key]) => id === 'gate_seq_1' && key === 'pattern')).toBe(true);
        cleanupRenderedModule(panel);
    });
    it('saves eight independent snapshots, loads with one parameter change and restores all memories in a real rack patch', async () => {
        const registry = new PluginRegistry();
        await registry.registerPlugin({ id: 'core', name: 'Core', version: '1.0.0', apiVersion: 1, patchVersion: 1, modules: [{ definition }] });
        const host = await new RackHost({ registry }).init();
        const module = host.addModule('gate-seq', { id: 'gate_seq_1' });
        const { panel, dsp, named, click, choose, onParamChange } = panelFor(module.instance, vi.fn(host.setParam.bind(host)));
        click('Memory');
        expect(named('Load preset').disabled).toBe(true);
        for (let slot = 1; slot <= 8; slot++) {
            click('Steps'); click('Step ' + slot); click('Memory');
            choose('Preset slot', slot); click('Save preset');
        }
        for (let slot = 1; slot <= 8; slot++) {
            choose('Preset slot', slot);
            onParamChange.mockClear();
            click('Load preset');
            expect(onParamChange.mock.calls.map(call => call[1])).toEqual(['pattern']);
            expect(dsp.params.pattern[0].cells.slice(0, 9)).toEqual([...Array(slot).fill(1), ...Array(9 - slot).fill(-1)]);
            expect(dsp.params.pattern[0].cells).not.toBe(dsp.params.presets[slot - 1][0].cells);
        }
        click('Steps'); click('Step 8');
        choose('Fill first', 3); choose('Fill last', 19);
        named('Hold fill').dispatchEvent(new MouseEvent('pointerdown'));
        const patch = JSON.parse(JSON.stringify(host.serializePatch()));
        cleanupRenderedModule(panel);
        await host.loadPatch(patch);
        const restored = host.state.getModule('gate_seq_1').instance;
        expect(restored.params).toMatchObject({ fillFirst: 3, fillLast: 19, fill: 0, pattern: dsp.params.pattern, presets: dsp.params.presets });
        expect(restored.positions).toEqual([-1, -1, -1, -1]);
        expect(restored.params.pattern[0].cells[7]).toBe(-1);
        expect(restored.params.presets[7][0].cells[7]).toBe(1);
        host.unsubscribeRegistry?.(); host.unsubscribeUsage?.();
    });
    it('releases Fill on pointer cancellation, keyboard release, blur and module removal', () => {
        const { panel, named, dsp } = panelFor();
        const fill = named('Hold fill');
        function event(type, key) {
            fill.dispatchEvent(key ? new KeyboardEvent(type, { key }) : new Event(type));
        }
        for (const [down, up, key] of [['pointerdown', 'pointercancel'], ['keydown', 'keyup', ' '], ['keydown', 'blur', 'Enter']]) {
            event(down, key); expect(dsp.params.fill).toBe(1);
            event(up, key); expect(dsp.params.fill).toBe(0);
        }
        event('pointerdown');
        cleanupRenderedModule(panel);
        expect(dsp.params.fill).toBe(0);
    });
});
