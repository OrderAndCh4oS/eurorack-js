const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
    id: 'midi-out',
    name: 'MIDI OUT',
    hp: 4,
    color: 'module-color-eleven',
    category: 'midi',
    diagnostics: { terminalInputs: ['gate'] },

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const pitch = new Float32Array(bufferSize);
        const gate = new Float32Array(bufferSize);
        const velocity = new Float32Array(bufferSize).fill(10);
        let high = false;
        let note = -1;
        let channel = 0;
        let messages = null;

        function emit(time, status, key, value) {
            messages ??= [];
            messages.push([time, status | channel, key, value]);
        }
        function release(time) {
            if (note >= 0) emit(time, 0x80, note, 0);
            note = -1;
        }

        return {
            params: { channel: 1 },
            inputs: { pitch, gate, velocity },
            outputs: {},
            leds: { gate: 0 },
            process({ time = 0 } = {}) {
                messages = null;
                for (let i = 0; i < bufferSize; i++) {
                    const next = Number.isFinite(gate[i]) && gate[i] >= 1;
                    if (high === next) continue;
                    high = next;
                    const at = time + i / sampleRate;
                    if (!high) {
                        release(at);
                        continue;
                    }
                    // Latch both key and channel at the attack so edits during a gate cannot strand its note.
                    channel = Number.isFinite(this.params.channel) ? clamp(Math.round(this.params.channel), 1, 16) - 1 : 0;
                    const strength = Number.isFinite(velocity[i]) ? clamp(Math.round(velocity[i] * 12.7), 0, 127) : 0;
                    if (!strength) continue;
                    note = Number.isFinite(pitch[i]) ? clamp(60 + Math.round(12 * pitch[i]), 0, 127) : 60;
                    emit(at, 0x90, note, strength);
                }
                this.leds.gate = Number(note >= 0);
            },
            drainEvents() {
                if (!messages) return [];
                const event = { type: 'midi-notes', messages };
                messages = null;
                return [event];
            },
            dispose() { release(0); },
            reset() {
                messages = null;
                release(0);
                high = false;
                pitch.fill(0);
                gate.fill(0);
                velocity.fill(10);
                this.leds.gate = 0;
            }
        };
    },

    handleWorkletEvent(event, { moduleId, services, audioCtx }) {
        if (event.type === 'midi-notes') services.midiManager?.sendNotes(moduleId, event.messages, audioCtx);
    },

    ui: {
        leds: ['gate'],
        knobs: [{ id: 'channel', label: 'Chan', param: 'channel', min: 1, max: 16, step: 1, default: 1 }],
        inputs: [
            { id: 'pitch', label: 'Pitch', port: 'pitch', signal: 'cv', voltage: { min: -5, max: 67 / 12, normal: 0 } },
            { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'velocity', label: 'Vel', port: 'velocity', signal: 'cv', voltage: { min: 0, max: 10, normal: 10 } }
        ]
    }
};
