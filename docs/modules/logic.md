# Gate logic (AND / OR)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Logic)

1. Start the patch. Two Euclidean patterns feed both halves of Logic. AND triggers the kick at shared hits and OR triggers the snare on the combined pattern.
2. Rotate one Euclidean pattern by one position. Count the new kick accents against the denser snare line. Longer overlapping gates will hold a logic output high until the condition ends.

## In a composition

For polyrhythmic percussion, use AND to pick out strong accents and OR to collect quieter intermediate strokes. A second envelope can give each output a different weight.

## Panel reference

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| AND A (`andA`), AND B (`andB`) | Gate · 0 to 10 V | Supplies one of the two gates that must overlap for AND to go high. |
| OR A (`orA`), OR B (`orB`) | Gate · 0 to 10 V | Supplies one of the two gates that can make OR go high. An unpatched OR input follows the corresponding AND input. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| AND (`and`) | Gate · 0 to 5 V | High only during the overlap of the two AND inputs. |
| OR (`or`) | Gate · 0 to 5 V | High whenever at least one of the OR inputs is high. |

## Design background

These are the same truth functions used in digital electronics. With gates as the two states, a logical coincidence becomes a musical event. [2hp Logic](https://www.twohp.com/modules/p/logic)

[Research and implementation notes](../../research/modules/logic.md)
