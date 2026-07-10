/**
 * Test - ADSR Envelope
 * Demonstrates ADSR envelope shaping with clear attack, decay, sustain, release phases
 *
 * Clock triggers the ADSR gate directly
 * VCO audio is shaped by the envelope through VCA
 * Slow clock rate allows hearing each envelope stage clearly
 */
export default {
    "name": "Test - ADSR Envelope",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "clk",
                "type": "clk",
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
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 2
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 3
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 4
            }
        ],
        "params": {
            "clk": {
                "rate": 0.2,
                "pause": 0
            },
            "vco": {
                "coarse": 0.4,
                "fine": 0,
                "glide": 5
            },
            "adsr": {
                "attack": 0.073,
                "decay": 0.41,
                "sustain": 0,
                "release": 0.753
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "adsr",
                "toPort": "gate"
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
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "vca",
                "toPort": "ch1In"
            }
        ],
        "midiMappings": {}
    }
};
