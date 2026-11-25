import { channels, ui } from './schema.js';
import { fromPcm, validateSlot } from './media.js';
import { createVoice } from './voice.js';
import { render, css } from './panel.js';

export default {
    id: 'slice-sampler',
    name: 'SLICE SAMPLER',
    hp: 16,
    color: 'module-color-six',
    category: 'voice',
    diagnostics: { terminalInputs: ['recA', 'recB'] },
    telemetry: { fields: ['samplerInfo'], methods: [], params: ['sourceA', 'sourceB'] },
    ui, render, css,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const buffers = ports => Object.fromEntries(ports.map(({port}) => [port,new Float32Array(bufferSize)]));
        const controls = [...ui.knobs, ...ui.buttons, ...ui.actions, ...ui.state];
        let remoteInfo;
        const dsp = {
            params: Object.fromEntries(controls.map(c => [c.param, Array.isArray(c.default) ? [] : c.default])),
            inputs: buffers(ui.inputs),
            outputs: buffers(ui.outputs),
            leds: Object.fromEntries(ui.leds.map(id => [id,0])),
            process() { voices.A.process(); voices.B.process(); },
            reset() {
                for (const input of Object.values(this.inputs)) input.fill(0);
                voices.A.reset(); voices.B.reset();
                remoteInfo = null;
            },
            // The stable UI mirror accepts live telemetry. A stopped mirror
            // derives its display from its restored media and current controls.
            get samplerInfo() { return remoteInfo ?? { A: voices.A.info(), B: voices.B.info() }; },
            set samplerInfo(value) { remoteInfo = value; },
            getSamplerInfo() { return this.samplerInfo; },
            replaceSlot(ch, slot) {
                voices[ch].load(slot ? fromPcm(slot) : null);
                remoteInfo = null;
            },
            snapshot() { return { A: voices.A.snapshot(), B: voices.B.snapshot() }; }
        };
        const voices = Object.fromEntries(channels.map(ch => [ch,createVoice(ch,dsp,sampleRate,bufferSize)]));
        return dsp;
    },

    applyRuntimeCommand(dsp, command) {
        if (command?.type !== 'load-sample' || !channels.includes(command.channel)) {
            throw new Error('Unknown sampler command or channel.');
        }
        validateSlot(command, true);
        dsp.replaceSlot(command.channel,command);
    },
    captureRuntimeState(dsp) { return dsp.snapshot(); },
    restoreRuntimeState(dsp, state) {
        for (const ch of channels) if (state?.[ch]) validateSlot(state[ch]);
        for (const ch of channels) dsp.replaceSlot(ch,state?.[ch]);
    }
};
