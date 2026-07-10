/**
 * Test - Kick Only
 * Isolated kick drum test with plot for waveform consistency verification
 * (Plot shows actual waveforms triggered on transients, better than spectrogram
 * for verifying identical hits since spectrogram has FFT windowing artifacts)
 */
export default {
    "name": "Test - Kick Only",
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
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 1
            },
            {
                "id": "plot",
                "type": "plot",
                "row": 1,
                "index": 2
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 3
            }
        ],
        "params": {
            "clk": {
                "rate": 0.25
            },
            "kick": {
                "pitch": 0.3,
                "decay": 0.5,
                "tone": 0.3,
                "click": 0.5
            },
            "out": {
                "volume": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "plot",
                "toPort": "trig"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "plot",
                "toPort": "audio"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
