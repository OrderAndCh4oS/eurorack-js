# Four-channel mixer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Clock+Divisions)

1. Start the patch. The clock divider supplies two rhythms, the kick enters mixer input 1 and the closed hat enters input 2. One output feeds both speakers.
2. Bring channel 1 down to hear the hats alone. Raise it until the kick anchors the rhythm, then use channel 2 to set how strongly the subdivisions speak.

## In a composition

For a drum submix, reserve the other inputs for snare and percussion. Sending the combined output into one compressor or reverb gives the kit a shared treatment.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| 1 (`lvl1`), 2 (`lvl2`), 3 (`lvl3`), 4 (`lvl4`) | Sets how much of this numbered input reaches the common output. Turn it down to isolate other parts. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1 (`in1`), 2 (`in2`), 3 (`in3`), 4 (`in4`) | Any signal · ±10 V | One of the four signals to add. Its level is set by the knob with the same number. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Any signal · ±10 V | Carries the sum of the four adjusted inputs. |

## Design background

A mixer adds weighted signals. Keeping individual level controls before the sum lets the same design balance audio voices or combine control movements.

[Research and implementation notes](../../research/modules/mix.md)
