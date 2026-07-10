/**
 * Demo - Evolving Rhythmic Drone
 *
 * Complex patch using all module types with random melody generation.
 * Two voices: filtered lead + bass, with S&H random pitch through arpeggiator.
 *
 * Signal flow:
 * - CLK -> DIV (two divisions for rhythmic variation)
 * - NSE -> S&H (random voltages sampled on clock)
 * - S&H -> QUANT -> ARP (quantized random notes arpeggiated)
 * - ARP -> VCO1 (lead) and VCO2 (bass, -1 octave)
 * - LFO -> VCF (slow filter sweep on lead)
 * - DIV out1 -> ADSR1 -> VCA1 (lead envelope)
 * - DIV out2 -> ADSR2 -> VCA2 (bass envelope, slower)
 * - MIX combines both voices -> OUT
 */
export default {
    "name": "Demo - Evolving Drone",
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
                "id": "div",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "lfo",
                "type": "lfo",
                "row": 1,
                "index": 2
            },
            {
                "id": "nse",
                "type": "nse",
                "row": 1,
                "index": 3
            },
            {
                "id": "sh",
                "type": "sh",
                "row": 1,
                "index": 4
            },
            {
                "id": "quant",
                "type": "quant",
                "row": 1,
                "index": 5
            },
            {
                "id": "arp",
                "type": "arp",
                "row": 1,
                "index": 6
            },
            {
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 7
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 8
            },
            {
                "id": "adsr1",
                "type": "adsr",
                "row": 1,
                "index": 9
            },
            {
                "id": "vca1",
                "type": "vca",
                "row": 1,
                "index": 10
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 11
            },
            {
                "id": "adsr2",
                "type": "adsr",
                "row": 1,
                "index": 12
            },
            {
                "id": "vca2",
                "type": "vca",
                "row": 1,
                "index": 13
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 14
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 15
            }
        ],
        "params": {
            "clk": {
                "rate": 0.79,
                "pause": 0
            },
            "div": {
                "rate1": 0.7833333333333333,
                "rate2": 0.5516666666666666
            },
            "lfo": {
                "rateKnob": 0.27,
                "waveKnob": 0.2733333333333333,
                "range": 0
            },
            "nse": {
                "rate": 1,
                "vcaMode": 0
            },
            "sh": {
                "slew1": 0,
                "slew2": 0
            },
            "quant": {
                "scale": 4,
                "octave": 0,
                "semitone": 0
            },
            "arp": {
                "root": 0,
                "chord": 3,
                "mode": 0,
                "octaves": 1
            },
            "vco1": {
                "coarse": 0.45,
                "fine": 0,
                "glide": 15
            },
            "vcf": {
                "cutoff": 0.38333333333333336,
                "resonance": 0.35
            },
            "adsr1": {
                "attack": 0.11,
                "decay": 0.25,
                "sustain": 0.4,
                "release": 0.3933333333333333
            },
            "vca1": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "vco2": {
                "coarse": 0.32,
                "fine": 0,
                "glide": 25
            },
            "adsr2": {
                "attack": 0.09,
                "decay": 0.35,
                "sustain": 0.6,
                "release": 0.6833333333333333
            },
            "vca2": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "mix": {
                "lvl1": 0.7,
                "lvl2": 0.5,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.65
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div",
                "toPort": "clock"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "sh",
                "toPort": "trig1"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "arp",
                "toPort": "trigger"
            },
            {
                "fromModule": "nse",
                "fromPort": "noise",
                "toModule": "sh",
                "toPort": "in1"
            },
            {
                "fromModule": "sh",
                "fromPort": "out1",
                "toModule": "quant",
                "toPort": "cv"
            },
            {
                "fromModule": "quant",
                "fromPort": "cv",
                "toModule": "arp",
                "toPort": "rootCV"
            },
            {
                "fromModule": "arp",
                "fromPort": "cv",
                "toModule": "vco1",
                "toPort": "vOct"
            },
            {
                "fromModule": "arp",
                "fromPort": "cv",
                "toModule": "vco2",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco1",
                "fromPort": "ramp",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "vca1",
                "toPort": "ch2In"
            },
            {
                "fromModule": "div",
                "fromPort": "out1",
                "toModule": "adsr1",
                "toPort": "gate"
            },
            {
                "fromModule": "adsr1",
                "fromPort": "env",
                "toModule": "vca1",
                "toPort": "ch2CV"
            },
            {
                "fromModule": "vco2",
                "fromPort": "triangle",
                "toModule": "vca2",
                "toPort": "ch2In"
            },
            {
                "fromModule": "div",
                "fromPort": "out2",
                "toModule": "adsr2",
                "toPort": "gate"
            },
            {
                "fromModule": "adsr2",
                "fromPort": "env",
                "toModule": "vca2",
                "toPort": "ch2CV"
            },
            {
                "fromModule": "vca1",
                "fromPort": "ch2Out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vca2",
                "fromPort": "ch2Out",
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
