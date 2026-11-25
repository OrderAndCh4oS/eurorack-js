import { afterEach, describe, expect, it, vi } from 'vitest';
import sampler from '../../src/js/modules/slice-sampler/index.js';
import { renderModule, cleanupRenderedModule } from '../../src/js/ui/renderer.js';

afterEach(() => vi.restoreAllMocks());

function mount(command) {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {} });
    const dsp = sampler.createDSP();
    const change = vi.fn();
    // Inject at the custom renderer boundary, as the host does for this instance.
    const def = { ...sampler, render: (node, context) => sampler.render(node, { ...context, onRuntimeCommand: command }) };
    const panel = renderModule(def,'sample',{ dsp, onParamChange: change });
    return { dsp, panel, change };
}

function pickFile(panel, arrayBuffer) {
    const picker = panel.querySelector('[data-channel="A"] input[type=file]');
    Object.defineProperty(picker, 'files', { configurable: true, value: [{ name: 'hit.wav', size: 46, arrayBuffer }] });
    picker.dispatchEvent(new Event('change'));
    return picker;
}

function tinyWave() {
    const bytes = new Uint8Array(46);
    for (const [at, s] of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']]) bytes.set([...s].map(c=>c.charCodeAt(0)),at);
    const v = new DataView(bytes.buffer);
    for (const [at,n] of [[4,38],[16,16],[24,8000],[28,16000],[40,2]]) v.setUint32(at,n,true);
    for (const [at,n] of [[20,1],[22,1],[32,2],[34,16],[44,3000]]) v.setUint16(at,n,true);
    return bytes.buffer;
}

describe('slice sampler panel', () => {
    it('copies grid boundaries on the first edit and publishes sorted, independent manual marker edits', () => {
        const { panel, dsp } = mount();
        const editor = panel.querySelector('[data-channel="A"]');
        const cursor = editor.querySelector('[aria-label="Cursor percent"]');
        const position = value => { cursor.value = String(value); cursor.dispatchEvent(new Event('input')); };
        position(40); editor.querySelector('[data-edit=add]').click();
        expect(dsp.params.methodA).toBe(2);
        expect(dsp.params.markersA).toEqual([0.25,0.4,0.5,0.75]);
        expect(dsp.params.markersB).toEqual([]);
        position(80); editor.querySelector('[data-edit=move]').click();
        expect(dsp.params.markersA).toEqual([0.25,0.5,0.75,0.8]);
        editor.querySelector('[data-edit=remove]').click();
        expect(dsp.params.markersA).toEqual([0.25,0.5,0.75]);
        cleanupRenderedModule(panel);
    });
    it('imports only once while busy, selects Local after acknowledgement, and reports rejected media', async () => {
        let ack;
        const command = vi.fn(() => new Promise(resolve => { ack = resolve; }));
        const { panel, change } = mount(command);
        const picker = pickFile(panel, async () => tinyWave());
        picker.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1));
        expect(command.mock.calls[0][0]).toEqual({ type:'load-sample',channel:'A',name:'hit.wav',sampleRate:8000,pcm:Int16Array.of(3000) });
        expect(change).not.toHaveBeenCalled();
        ack(); await vi.waitFor(() => expect(change).toHaveBeenCalledWith('sample','sourceA',1));
        command.mockRejectedValueOnce(new Error('Removed sampler'));
        pickFile(panel,async () => tinyWave());
        await vi.waitFor(() => expect(panel.textContent).toContain('Removed sampler'));
        expect(change).toHaveBeenCalledTimes(1);
        cleanupRenderedModule(panel);
    });
});
