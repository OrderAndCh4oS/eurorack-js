/**
 * Test - Envelope Follower Sidechain
 *
 * Demonstrates sidechain ducking effect:
 * - Kick drum triggers envelope follower
 * - Attenuverter scales inverted envelope to VCA range
 * - Creates classic sidechain pumping effect
 *
 * Try adjusting slope for different ducking response.
 */
export default {
    "name": "Test - Envf Sidechain",
    "factory": true,
    "state": {
        "version": 2,
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
                "id": "envf",
                "type": "envf",
                "row": 1,
                "index": 2
            },
            {
                "id": "atten",
                "type": "atten",
                "row": 1,
                "index": 3
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 5
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 6
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 7
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 8
            }
        ],
        "params": {
            "clk": {
                "rate": 0.3033,
                "pause": 0
            },
            "kick": {
                "pitch": 0.3133,
                "decay": 0.5,
                "tone": 0.5,
                "click": 0.5
            },
            "envf": {
                "threshold": 0.5733,
                "gain": 0.9667,
                "slope": 1
            },
            "atten": {
                "atten1": 1,
                "offset1": 0,
                "atten2": 1,
                "offset2": 0.5
            },
            "vco": {
                "coarse": 0.32,
                "fine": 0,
                "glide": 5
            },
            "vcf": {
                "cutoff": 0.5533,
                "resonance": 0.5267
            },
            "vca": {
                "ch1Gain": 1,
                "ch2Gain": 0.8
            },
            "mix": {
                "lvl1": 0.5867,
                "lvl2": 0.34,
                "lvl3": 0.8,
                "lvl4": 0.8
            },
            "out": {
                "volume": 0.6
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
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "envf",
                "toPort": "audio"
            },
            {
                "fromModule": "envf",
                "fromPort": "inv",
                "toModule": "atten",
                "toPort": "in1"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
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
                "fromModule": "atten",
                "fromPort": "out1",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "mix",
                "toPort": "in2"
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
