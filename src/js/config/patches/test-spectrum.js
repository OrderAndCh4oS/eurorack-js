/**
 * Test - Spectrum Analyzer
 *
 * Demonstrates the FFT spectrum analyzer with a VCO.
 * Shows harmonic content of different waveforms.
 * Use the VCO wave selector to see how triangle, saw, and pulse
 * have different harmonic structures.
 */
export default {
    "name": "Test - Spectrum Analyzer",
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
                "id": "spectrum",
                "type": "spectrum",
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
                "coarse": 0.4,
                "fine": 0,
                "glide": 0
            },
            "spectrum": {
                "floor": 0.5,
                "decay": 0.5,
                "scale": 0
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "spectrum",
                "toPort": "audio"
            },
            {
                "fromModule": "spectrum",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "spectrum",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
