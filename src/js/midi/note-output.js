// One physical route per rack tab. A MIDI key is shared when two rack voices overlap on it.
export class MidiNoteOutput {
    port = null;
    held = new Map();

    setPort(port) {
        if (port === this.port) return;
        this.releaseAll();
        this.port = port;
    }

    ownerOfKey(status, note) {
        for (const voice of this.held.values()) {
            if (voice.status === status && voice.note === note) return voice;
        }
    }

    send(data, timestamp) {
        if (!this.port || this.port.state === 'disconnected') return;
        try {
            this.port.send(data, timestamp);
        } catch (error) {
            // A device can disappear before its statechange reaches the page.
            if (error.name !== 'InvalidStateError') throw error;
        }
    }

    release(owner, timestamp = 0) {
        const voice = this.held.get(owner);
        if (!voice) return;
        this.held.delete(owner);
        if (!this.ownerOfKey(voice.status, voice.note)) {
            this.send([voice.status - 0x10, voice.note, 0], Math.max(timestamp, voice.timestamp));
        }
    }

    releaseAll() {
        for (const owner of this.held.keys()) this.release(owner);
    }

    sendNotes(owner, messages, context) {
        if (!this.port || context.state !== 'running') return;
        const clock = context.getOutputTimestamp?.();
        const offset = clock?.performanceTime > 0
            ? clock.performanceTime - clock.contextTime * 1000
            : performance.now() - context.currentTime * 1000;
        for (const [time, status, note, velocity] of messages) {
            const at = time > 0 ? Math.max(0, offset + time * 1000) : 0;
            if ((status & 0xf0) === 0x80) {
                const held = this.held.get(owner);
                if (held?.note === note && held.status === status + 0x10) this.release(owner, at);
                continue;
            }
            if ((status & 0xf0) !== 0x90) continue;
            this.release(owner, at);
            const sounding = this.ownerOfKey(status, note);
            if (!sounding) this.send([status, note, velocity], at);
            this.held.set(owner, { status, note, timestamp: sounding?.timestamp ?? at });
        }
    }
}
