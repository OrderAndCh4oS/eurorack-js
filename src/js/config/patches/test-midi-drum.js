/**
 * Test patch for MIDI-DRUM module
 * Trigger drums from a MIDI controller or the drum pad controller.
 *
 * 1. Open midi-drum-controller.html in another browser tab
 * 2. Connect IAC Driver or a MIDI controller
 * 3. Click pads or hit keys to trigger drums
 *
 * Default GM mapping:
 * - Pad 1 (C1/36): Kick
 * - Pad 2 (D1/38): Snare
 * - Pad 3 (F#1/42): Closed Hat
 * - Pad 4 (A#1/46): Open Hat
 */
export default {
    "name": "Test: MIDI-DRUM",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "drum",
                "type": "midi-drum",
                "row": 1,
                "index": 0
            },
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 1
            },
            {
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 2
            },
            {
                "id": "hat",
                "type": "hat",
                "row": 1,
                "index": 3
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 2,
                "index": 4
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 5
            }
        ],
        "params": {
            "drum": {
                "channel": 0
            },
            "kick": {
                "pitch": 0.3,
                "decay": 0.5,
                "tone": 0.3,
                "click": 0.5
            },
            "snare": {
                "snap": 0.5,
                "decay": 0.4,
                "pitch": 0.5
            },
            "hat": {
                "decay": 0.4,
                "sizzle": 0.5,
                "blend": 0.5
            },
            "mix": {
                "level1": 0.9,
                "level2": 0.7,
                "level3": 0.6,
                "level4": 0
            },
            "out": {
                "levelL": 0.7,
                "levelR": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "drum",
                "fromPort": "trig1",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "drum",
                "fromPort": "trig2",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "drum",
                "fromPort": "trig3",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "drum",
                "fromPort": "trig4",
                "toModule": "hat",
                "toPort": "trigOpen"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "snare",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in3"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
