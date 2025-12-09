/**
 * MIDI Manager - Handle Web MIDI API and MIDI Learn functionality
 *
 * Manages MIDI device connections, CC message parsing, and knob mappings.
 * Also provides MIDI event queues for MIDI-CV modules.
 *
 * Mappings are stored as: { "channel:cc": { moduleId, paramId, min, max } }
 */

export function createMidiManager() {
    // State
    let midiAccess = null;
    let isSupported = false;
    let isConnected = false;
    let mappings = {};  // { "0:74": { moduleId: "vco1", paramId: "coarse", min: 0, max: 1 } }
    let learnMode = false;
    let learningKnob = null;  // { element, moduleId, paramId, min, max }
    let onMidiLearnComplete = null;  // Callback when CC is captured
    let onMidiMessage = null;  // Callback for CC value changes
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
            isSupported = false;
            return false;
        }

        try {
            midiAccess = await navigator.requestMIDIAccess();
            isSupported = true;

            // Set up device listeners
            midiAccess.onstatechange = handleStateChange;

            // Connect to existing devices
            connectToDevices();

            return true;
        } catch (err) {
            console.error('MIDI access denied:', err);
            isSupported = false;
            return false;
        }
    }

    /**
     * Connect input listeners to all MIDI devices
     */
    function connectToDevices() {
        if (!midiAccess) return;

        midiAccess.inputs.forEach(input => {
            input.onmidimessage = handleMidiMessage;
        });

        isConnected = midiAccess.inputs.size > 0;
        onConnectionChange?.(isConnected, getDeviceNames());
    }

    /**
     * Handle MIDI device state changes
     */
    function handleStateChange(event) {
        connectToDevices();
    }

    /**
     * Get names of connected MIDI devices
     * @returns {string[]} Device names
     */
    function getDeviceNames() {
        if (!midiAccess) return [];
        return Array.from(midiAccess.inputs.values()).map(input => input.name);
    }

    /**
     * Handle incoming MIDI messages
     * @param {MIDIMessageEvent} event
     */
    function handleMidiMessage(event) {
        const [status, data1, data2] = event.data;
        const messageType = status & 0xF0;
        const channel = status & 0x0F;

        // Note Off (0x80) or Note On with velocity 0
        if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) {
            noteEvents.push({
                type: 'noteOff',
                channel,
                note: data1,
                velocity: 0
            });
        }
        // Note On (0x90)
        else if (messageType === 0x90) {
            noteEvents.push({
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
            clockEvents.push({ type: 'clock' });
        }
        else if (status === 0xFA) {
            // Start
            clockEvents.push({ type: 'start' });
        }
        else if (status === 0xFB) {
            // Continue
            clockEvents.push({ type: 'continue' });
        }
        else if (status === 0xFC) {
            // Stop
            clockEvents.push({ type: 'stop' });
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
        get isSupported() { return isSupported; },
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
