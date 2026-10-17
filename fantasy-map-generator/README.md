# Sunflower for ASCII Fantasy Map Builder

The commit-walk sunflower as maps and a palette for
[fantasy-map-generator](https://github.com/mahdava/fantasy-map-generator).

| File | What it is |
| --- | --- |
| `sunflower-medium.txt` | The 45 × 22 sunflower over the commit line, 49 × 28 cells with the margin |
| `sunflower-large.txt` | The 71 × 36 sunflower over the commit line, 75 × 42 cells with the margin |
| `sunflower-palette.json` | The colours for both maps |

## Load them

1. In the builder, choose **Load palette** and pick `sunflower-palette.json`.
2. Choose **Load map** and pick one of the two `.txt` files.

Load the palette first. A symbol missing from the palette draws in black.

## Symbols

The builder gives every symbol one colour, so each material of the drawing
has its own symbol:

| Material | Symbol | Colour |
| --- | --- | --- |
| Background | `,` | `#0c0c0c`, the builder's background |
| Petal fill | `.` | `#F5B800` yellow |
| Petal edge | `#` | `#E08A00` orange |
| Face fill | `~` | `#B5651D` brown |
| Face edge | `=` | `#7A3E12` dark brown |
| Eyes and mouth | `@` | `#f4f4f4` light |
| Leaf fill | `+` | `#2EA043` green |
| Leaf edge | `%` | `#1F7A30` dark green |
| Sneaker fill | `o` | `#2EA043` green |
| Sneaker edge | `&` | `#1F7A30` dark green |
| Motion marks | `'` | `#8a8a8a` grey |
| Commit line | `-` | `#6b6b6b` grey |
| Commits | `O` `Q` `0` `Ø` | blue, green, yellow, red |

Empty cells hold `,` instead of a space, because the builder trims the
spaces at the start of each line when it loads a map.

The drawings are Lucia's. Their regions come from the colour masks in
`hooks/welcome.ts`, the same ones the plugin's welcome screen uses.
