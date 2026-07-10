/**
 * Test - Plot Waveform
 *
 * Plots VCO waveform over time for quality analysis.
 * Set Time knob to minimum (1s) to see individual cycles.
 * Use Freeze to pause and examine waveform shape.
 * Try different VCO outputs: triangle, ramp, pulse.
 */
export default {
    "name": "Test - Plot Waveform",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 0
            },
            {
                "id": "plot",
                "type": "plot",
                "row": 1,
                "index": 1
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 2
            }
        ],
        "params": {
            "vco": {
                "coarse": 0.08,
                "fine": 0
            },
            "plot": {
                "time": 0,
                "freeze": 0
            },
            "out": {
                "volume": 0.4
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "plot",
                "toPort": "audio"
            },
            {
                "fromModule": "plot",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "plot",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
