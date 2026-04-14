# Claw Universe — Logo v5 Design Notes

## Concept: "Linked Rings Monogram"

C and U share the same geometric centre and stroke width (70 px), interlocking like two chain links — the U's outer arc IS the C's inner arc.

## Geometry

| Property | Value |
|---|---|
| Canvas | 512 × 512 px |
| Centre | (256, 255) |
| Stroke width | 70 px |
| Gap (opening) | 132° centred on the right |
| Gap right edge | 66° |
| Gap left edge | 294° |

### Radii

| Ring | Outer R | Inner R |
|---|---|---|
| C (blue #3B82F6) | 270 px | 200 px |
| U (dark #1F2937) | **200 px** | 130 px |

> **Key design:** U outer R = C inner R = 200 px. They are two concentric rings sharing the same arc.

### U Leg Geometry

- Leg height: 70 px (equals stroke — clean parallel legs)
- Leg width: 70 px (equals stroke)
- U bottom arc centre: (256, 325)
- U outer arc radius: 200 px (same as C inner R — interlocking)
- U inner arc radius: 130 px

## Arc Routing

### C (blue)
- **Outer arc:** CCW 294° → 66° = 228° (large arc, wraps through bottom-left)
- **Inner arc:** CW  246° → 114° = 132° (small arc, on the gap side)

### U (dark)
- **Outer arc:** CCW 66° → 294° = 180° (semicircle through bottom)
- **Inner arc:** CW  294° → 66° = 180° (semicircle through top)

## Colour

- **C:** `#3B82F6` (blue) — bold, energetic, modern
- **U:** `#1F2937` (dark) — solid, grounded, recessive

## Design Rationale

1. **Coherence:** Both C and U share the same stroke width (70 px), making them visually equal in weight
2. **Interlocking:** The U outer arc = C inner arc means there's no gap between them — they mesh perfectly
3. **No disconnect:** Unlike previous versions, there are no segmented strokes — every line is a continuous arc
4. **C reads as C:** The blue outer arc forms the C's distinctive curve with a 132° opening on the right
5. **U reads as U:** The dark U sits cleanly nested inside, its legs parallel and equal height (70 px)

## Files

- `logo-v5.png` — final logo output (512×512)
- `logo-v5.py` — generation script (PIL)
