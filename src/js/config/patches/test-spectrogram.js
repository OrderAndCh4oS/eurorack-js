/**
 * Test - Spectrogram
 *
 * Displays frequency content evolving over time.
 * VCO provides test signal - try different waveforms.
 * Use Freeze to capture and examine a snapshot.
 * Export as PNG or CSV for analysis.
 */
export default {
    "name": "Test - Spectrogram",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 0
            },
            {
                "id": "spec",
                "type": "spectrogram",
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
                "coarse": 0.3,
                "fine": 0
            },
            "spec": {
                "time": 0.3,
                "floor": 0.5,
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
                "toModule": "spec",
                "toPort": "audio"
            },
            {
                "fromModule": "spec",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "spec",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
