import midiStarter from '../config/patches/test-midi-in-out.js';

export function initMidiSetup(app) {
    const doc = app.document;
    const dialog = doc.getElementById('midiSetup');
    if (!dialog) return;
    const midi = app.midiManager;
    const input = doc.getElementById('midiInputPort');
    const output = doc.getElementById('midiOutputPort');
    const retry = doc.getElementById('midiAccessRetry');
    const status = doc.getElementById('midiConnectionStatus');
    const activity = doc.getElementById('midiInputActivity');
    const note = activity.querySelector('[data-note]');
    const clock = activity.querySelector('[data-clock]');

    function fill(select, ports, selected, placeholder) {
        const entries = [{ id: '', name: placeholder }, ...ports];
        if (selected && !ports.some(port => port.id === selected)) {
            entries.push({ id: selected, name: 'Disconnected input' });
        }
        select.replaceChildren(...entries.map(({ id, name }) => new Option(name, id)));
        select.value = selected;
        select.disabled = midi.accessState !== 'ready';
    }

    function refresh() {
        if (!dialog.open) return;
        fill(input, midi.getInputs(), midi.inputId, 'All inputs');
        fill(output, midi.getOutputs(), midi.outputId, 'Off');
        retry.hidden = midi.accessState !== 'unavailable';
        activity.hidden = !midi.isConnected;
        if (midi.accessState === 'unsupported') {
            status.textContent = 'Open the rack in desktop Chrome or Edge over HTTPS or localhost to use Web MIDI.';
        } else if (midi.accessState === 'unavailable') {
            status.textContent = 'MIDI access is unavailable. Allow MIDI in the browser’s site permissions, then retry.';
        } else if (midi.accessState !== 'ready') {
            status.textContent = 'Waiting for MIDI permission from the browser…';
        } else {
            status.textContent = midi.isConnected
                ? `Listening on ${midi.getDeviceNames().join(', ')}.`
                : 'No active MIDI input. Connect a MIDI device or enable a virtual bus to receive notes.';
        }
    }

    function resetActivity() {
        note.textContent = 'Waiting for notes';
        clock.textContent = 'Waiting for clock';
    }
    function observe(data, portName) {
        if (!dialog.open) return;
        const [status, key, velocity] = data;
        if ((status & 0xf0) === 0x90 && velocity > 0) {
            note.textContent = `Note ${key} on channel ${(status & 15) + 1}${portName ? ` from ${portName}` : ''}`;
        } else if (status === 0xf8 && clock.textContent === 'Waiting for clock') {
            clock.textContent = `Clock received${portName ? ` from ${portName}` : ''}`;
        }
    }
    input.addEventListener('change', () => { resetActivity(); midi.setInput(input.value); });
    output.addEventListener('change', () => { resetActivity(); midi.setOutput(output.value); });
    retry.addEventListener('click', () => app.connectMidiIfNeeded({ retry: true }));
    doc.getElementById('midiSetupBtn').addEventListener('click', () => {
        resetActivity();
        if (!midi.getInputs().length && !midi.getOutputs().length) doc.getElementById('midiConnectionHelp').open = true;
        dialog.showModal();
        refresh();
    });
    doc.getElementById('midiStarter').addEventListener('click', () => {
        dialog.close();
        void app.patchLibrary.run(() => app.patchLibrary.open({ ...midiStarter, key: midiStarter.name, source: 'test' }));
    });
    return { refresh, observe };
}
