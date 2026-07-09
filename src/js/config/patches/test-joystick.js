/**
 * Test - Joystick Controller
 *
 * X sweeps filter cutoff, Y opens the VCA, and the scope shows X/Y CV motion.
 */
export default {
    "name": "Test - Joystick Controller",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "joy",
                "type": "joystick",
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
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 3
            },
            {
                "id": "scope",
                "type": "scope",
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
            "joy": {
                "x": 0,
                "y": 0,
                "range": 1,
                "cvMode": 0,
                "cv1Amt": 0.5,
                "cv2Amt": 0.5,
                "sense": 1,
                "gateButton": 0,
                "record": 0,
                "play": 0,
                "loopMode": 1
            },
            "vco": {
                "coarse": 0.34,
                "fine": 0,
                "glide": 5
            },
            "vcf": {
                "cutoff": 0.18,
                "resonance": 0.32
            },
            "vca": {
                "ch1Gain": 0.9,
                "ch2Gain": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
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
                "fromModule": "joy",
                "fromPort": "x",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "joy",
                "fromPort": "y",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "joy",
                "fromPort": "x",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "joy",
                "fromPort": "y",
                "toModule": "scope",
                "toPort": "in2"
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
