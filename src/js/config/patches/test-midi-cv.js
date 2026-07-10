/**
 * Test patch for MIDI-CV module
 * Monophonic MIDI keyboard → VCO → VCF → VCA → Output
 *
 * Play a MIDI keyboard to hear notes. Velocity controls VCA.
 * Mod wheel controls filter cutoff.
 */
export default {
    "name": "Test: MIDI-CV",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "midi",
                "type": "midi-cv",
                "row": 1,
                "index": 0
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 2
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 3
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 4
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 5
            }
        ],
        "params": {
            "midi": {
                "channel": 0,
                "transpose": 0,
                "bendRange": 2,
                "legato": 0
            },
            "vco": {
                "coarse": 0.5,
                "fine": 0,
                "pw": 0.5
            },
            "vcf": {
                "cutoff": 0.6,
                "resonance": 0.3,
                "env": 0.4
            },
            "adsr": {
                "attack": 0.05,
                "decay": 0.3,
                "sustain": 0.6,
                "release": 0.3
            },
            "vca": {
                "ch1Level": 0.8,
                "ch2Level": 0
            },
            "out": {
                "levelL": 0.7,
                "levelR": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "midi",
                "fromPort": "pitch",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "midi",
                "fromPort": "mod",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vco",
                "fromPort": "pulse",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
