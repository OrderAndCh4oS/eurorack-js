/**
 * MIDI Manager - Handle Web MIDI API and MIDI Learn functionality
 *
 * Manages MIDI device connections, CC message parsing, and knob mappings.
 * Also provides MIDI event queues for MIDI-CV modules.
 *
 * Mappings are stored as: { "channel:cc": { moduleId, paramId, min, max } }
 */

import { MidiNoteOutput } from './note-output.js';

export function createMidiManager({ bufferEvents = true } = {}) {
    // State
    let midiAccess = null;
    let accessState = 'idle';
    let isConnected = false;
    let inputId = '';
    const listeners = new Map();
    const noteOutput = new MidiNoteOutput();
    let mappings = {};  // { "0:74": { moduleId: "vco1", paramId: "coarse", min: 0, max: 1 } }
    let learnMode = false;
    let learningKnob = null;  // { element, moduleId, paramId, min, max }
    let onMidiLearnComplete = null;  // Callback when CC is captured
    let onMidiMessage = null;  // Callback for CC value changes
    let onRawMidiMessage = null;
    let onConnectionChange = null;  // Callback for device connect/disconnect

    // Event queues for MIDI modules (per channel)
    const noteEvents = [];      // { type: 'noteOn'|'noteOff', channel, note, velocity }
    const ccValues = {};        // { "channel:cc": value 0-127 }
    const pitchBend = {};       // { channel: value -8192 to 8191 }
    const modWheel = {};        // { channel: value 0-127 }
    const clockEvents = [];     // { type: 'clock'|'start'|'stop'|'continue' }

    /**
     * Initialize MIDI access
     * @returns {Promise<boolean>} Success status
     */
    async function init() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported in this browser');
            accessState = 'unsupported';
            return false;
        }

        try {
            accessState = 'requesting';
            midiAccess = await navigator.requestMIDIAccess();
            accessState = 'ready';

            // Set up device listeners
            midiAccess.onstatechange = connectToDevices;

            // Connect to existing devices
            connectToDevices();

            return true;
        } catch (err) {
            console.error('MIDI access denied:', err);
            accessState = 'unavailable';
            return false;
        }
    }

    /**
     * Reconcile routes on permission, selection and hot-plug changes.
     */
    function connectToDevices() {
        if (!midiAccess) return;

        const output = noteOutput.port;
        if (output && (output.state === 'disconnected' || midiAccess.outputs?.get(output.id) !== output)) {
            noteOutput.setPort(null);
        }
        const inputs = new Set();
        for (const [id, input] of midiAccess.inputs) {
            if (input.state === 'disconnected' || (inputId && id !== inputId)) continue;
            // Virtual bus input and output IDs can differ. All-input mode excludes the selected return bus.
            const dest = noteOutput.port;
            if (!inputId && dest && (id === dest.id || (input.name && input.name === dest.name && input.manufacturer === dest.manufacturer))) continue;
            inputs.add(input);
        }
        for (const [input, state] of listeners) {
            if (inputs.has(input)) continue;
            input.onmidimessage = null;
            listeners.delete(input);
            for (const [key, count] of state.notes) {
                const data = [0x80 | (key >> 7), key & 127, 0];
                for (let i = 0; i < count; i++) handleMidiMessage({ data });
            }
            if (state.running) handleMidiMessage({ data: [0xfc] });
        }
        for (const input of inputs) {
            if (listeners.has(input)) continue;
            const state = { notes: new Map(), running: false };
            listeners.set(input, state);
            input.onmidimessage = event => handleMidiMessage(event, state, input.name);
        }
        isConnected = listeners.size > 0;
        onConnectionChange?.(isConnected, getDeviceNames());
    }

    function ports(collection) {
        return Array.from(collection || []).filter(([, port]) => port.state !== 'disconnected')
            .map(([id, port]) => ({ id, name: port.name || id }));
    }

    /**
     * Get names of connected MIDI devices
     * @returns {string[]} Device names
     */
    function getDeviceNames() {
        return Array.from(listeners.keys(), input => input.name || input.id || 'Unnamed input');
    }

    /**
     * Handle incoming MIDI messages
     * @param {MIDIMessageEvent} event
     */
    function handleMidiMessage(event, inputState, inputName) {
        onRawMidiMessage?.(event.data, event.timeStamp ?? event.receivedTime, inputName);
        const [status, data1, data2] = event.data;
        const messageType = status & 0xF0;
        const channel = status & 0x0F;

        // Note Off (0x80) or Note On with velocity 0
        if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) {
            if (inputState) {
                const key = channel * 128 + data1;
                const count = inputState.notes.get(key) || 0;
                if (count > 1) inputState.notes.set(key, count - 1);
                else inputState.notes.delete(key);
            }
            if (bufferEvents) noteEvents.push({
                type: 'noteOff',
                channel,
                note: data1,
                velocity: 0
            });
        }
        // Note On (0x90)
        else if (messageType === 0x90) {
            if (inputState) {
                const key = channel * 128 + data1;
                inputState.notes.set(key, (inputState.notes.get(key) || 0) + 1);
            }
            if (bufferEvents) noteEvents.push({
                type: 'noteOn',
                channel,
                note: data1,
                velocity: data2
            });
        }
        // Control Change (0xB0)
        else if (messageType === 0xB0) {
            const cc = data1;
            const value = data2;
            const normalizedValue = value / 127;

            // Store CC value for modules
            ccValues[`${channel}:${cc}`] = value;

            // Special CC: Mod wheel (CC 1)
            if (cc === 1) {
                modWheel[channel] = value;
            }

            // If in learn mode and waiting for CC
            if (learnMode && learningKnob) {
                captureMapping(channel, cc);
                return;
            }

            // Apply to mapped knobs
            applyMidiValue(channel, cc, normalizedValue);
        }
        // Pitch Bend (0xE0)
        else if (messageType === 0xE0) {
            // 14-bit value: LSB (data1) + MSB (data2)
            const bendValue = (data2 << 7) | data1;
            pitchBend[channel] = bendValue - 8192;  // Center at 0
        }
        // System Real-Time messages (no channel)
        else if (status === 0xF8) {
            // MIDI Clock tick (24 per quarter note)
            if (bufferEvents) clockEvents.push({ type: 'clock' });
        }
        else if (status === 0xFA) {
            // Start
            if (inputState) inputState.running = true;
            if (bufferEvents) clockEvents.push({ type: 'start' });
        }
        else if (status === 0xFB) {
            // Continue
            if (inputState) inputState.running = true;
            if (bufferEvents) clockEvents.push({ type: 'continue' });
        }
        else if (status === 0xFC) {
            // Stop
            if (inputState) inputState.running = false;
            if (bufferEvents) clockEvents.push({ type: 'stop' });
        }
    }

    /**
     * Capture a CC mapping during learn mode
     */
    function captureMapping(channel, cc) {
        const key = `${channel}:${cc}`;

        // Remove any existing mapping for this CC
        // (one CC can only control one knob)

        // Also remove any existing mapping for this knob
        // (one knob can only be controlled by one CC)
        const existingKey = Object.entries(mappings).find(
            ([k, m]) => m.moduleId === learningKnob.moduleId && m.paramId === learningKnob.paramId
        )?.[0];
        if (existingKey) {
            delete mappings[existingKey];
        }

        mappings[key] = {
            moduleId: learningKnob.moduleId,
            paramId: learningKnob.paramId,
            min: learningKnob.min,
            max: learningKnob.max
        };

        const capturedKnob = learningKnob;
        learningKnob = null;

        onMidiLearnComplete?.(key, capturedKnob);
    }

    /**
     * Apply MIDI CC value to mapped knob
     */
    function applyMidiValue(channel, cc, normalizedValue) {
        const key = `${channel}:${cc}`;
        const mapping = mappings[key];

        if (mapping) {
            const { moduleId, paramId, min, max } = mapping;
            const scaledValue = min + normalizedValue * (max - min);

            onMidiMessage?.({
                moduleId,
                paramId,
                value: scaledValue,
                rawValue: normalizedValue
            });
        }
    }

    return {
        // Initialization
        init,

        // State getters
        get isSupported() { return accessState === 'ready'; },
        get accessState() { return accessState; },
        get inputId() { return inputId; },
        get outputId() { return noteOutput.port?.id || ''; },
        getInputs: () => ports(midiAccess?.inputs),
        getOutputs: () => ports(midiAccess?.outputs),
        setInput(id) {
            inputId = id;
            connectToDevices();
        },
        setOutput(id) {
            noteOutput.setPort(midiAccess?.outputs?.get(id) || null);
            connectToDevices();
        },
        sendNotes: (owner, messages, context) => noteOutput.sendNotes(owner, messages, context),
        releaseNotes: owner => owner === undefined ? noteOutput.releaseAll() : noteOutput.release(owner),
        get isConnected() { return isConnected; },
        get isLearnMode() { return learnMode; },
        get isLearning() { return learningKnob !== null; },
        getDeviceNames,

        // Learn mode
        setLearnMode(enabled) {
            learnMode = enabled;
            if (!enabled) learningKnob = null;
        },

        startLearning(knobInfo) {
            // knobInfo: { element, moduleId, paramId, min, max }
            learningKnob = knobInfo;
        },

        cancelLearning() {
            learningKnob = null;
        },

        // Mapping management
        getMappings() {
            return { ...mappings };
        },

        setMappings(newMappings) {
            mappings = { ...newMappings };
        },

        clearMappings() {
            mappings = {};
        },

        removeMapping(key) {
            delete mappings[key];
        },

        getMappingForKnob(moduleId, paramId) {
            return Object.entries(mappings).find(
                ([key, m]) => m.moduleId === moduleId && m.paramId === paramId
            );
        },

        // Callbacks
        setOnMidiLearnComplete(callback) { onMidiLearnComplete = callback; },
        setOnMidiMessage(callback) { onMidiMessage = callback; },
        setOnRawMidiMessage(callback) { onRawMidiMessage = callback; },
        setOnConnectionChange(callback) { onConnectionChange = callback; },

        // === MIDI Module API ===

        /**
         * Get and clear all note events (for MIDI-CV modules)
         * @param {number} [channel] - Optional channel filter (0-15)
         * @returns {Array} Note events
         */
        consumeNoteEvents(channel = null) {
            if (channel === null) {
                const events = [...noteEvents];
                noteEvents.length = 0;
                return events;
            }
            const filtered = noteEvents.filter(e => e.channel === channel);
            for (let i = noteEvents.length - 1; i >= 0; i--) {
                if (noteEvents[i].channel === channel) {
                    noteEvents.splice(i, 1);
                }
            }
            return filtered;
        },

        /**
         * Get current CC value
         * @param {number} channel - MIDI channel (0-15)
         * @param {number} cc - CC number (0-127)
         * @returns {number} CC value (0-127), or 0 if not set
         */
        getCCValue(channel, cc) {
            return ccValues[`${channel}:${cc}`] || 0;
        },

        /**
         * Get current pitch bend value
         * @param {number} channel - MIDI channel (0-15)
         * @returns {number} Pitch bend (-8192 to 8191), 0 = center
         */
        getPitchBend(channel) {
            return pitchBend[channel] || 0;
        },

        /**
         * Get current mod wheel value
         * @param {number} channel - MIDI channel (0-15)
         * @returns {number} Mod wheel value (0-127)
         */
        getModWheel(channel) {
            return modWheel[channel] || 0;
        },

        /**
         * Get and clear clock events (for MIDI-CLK module)
         * @returns {Array} Clock events
         */
        consumeClockEvents() {
            const events = [...clockEvents];
            clockEvents.length = 0;
            return events;
        },

        /**
         * Peek at note events without consuming (for debugging)
         * @returns {Array} Note events
         */
        peekNoteEvents() {
            return [...noteEvents];
        }
    };
}
