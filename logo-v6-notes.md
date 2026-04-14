# Claw Universe Logo — v6 Notes

## Overview
Redesigned logo for **Claw Universe**, featuring two independent letters **C** (blue) and **U** (dark gray) stacked vertically, center-aligned on a transparent 512×512 canvas.

---

## Design Specifications

| Property | Value |
|---|---|
| **Canvas size** | 512 × 512 px |
| **Background** | Transparent (alpha = 0) |
| **Stroke width** | 72 px (within 65–80 px spec) |
| **Line caps** | Round (ellipse caps on leg ends) |

### Letter C
| Property | Value |
|---|---|
| **Color** | `#3B82F6` → RGB(59, 130, 246) |
| **Center** | (256, 182) |
| **Arc radius** | 125 px |
| **Arc span** | 45° → 315° (clockwise through top → left → bottom → bottom-right) |
| **Opening** | Right side of the circle (standard letter C) |
| **Rendering** | PIL arc-band polygon (outer arc 45°→315°, inner arc 315°→45°) |

### Letter U
| Property | Value |
|---|---|
| **Color** | `#1F2937` → RGB(31, 41, 55) |
| **Arc center** | (256, 354) |
| **Arc radius** | 83 px |
| **Left leg center x** | 173 px |
| **Right leg center x** | 339 px |
| **Leg top y** | 235 px (arc outer top edge) |
| **Leg bottom y** | 473 px (arc outer bottom edge) |
| **Rendering** | 3-part union: two rounded rectangles (legs) + bottom semicircle arc band |
| **Seamless joints** | Leg inner edges (x=137 / x=375) align exactly with arc outer edges at bottom |

### Vertical Composition
| Property | Value |
|---|---|
| **C top** | y = 55 px (stroke outer top) |
| **C bottom** | y = 307 px (stroke outer bottom) |
| **C–U gap** | y = 307 – 235 = **72 px** (one stroke width of whitespace) |
| **U bottom** | y = 473 px |
| **Total occupied** | y = 55 – 473 = 418 px on 512 px canvas |

---

## Rendering Engine

**Renderer**: PIL (Pillow) `ImageDraw`  
**pycairo** was attempted but unavailable in this environment (build failed). PIL with custom polygon primitives produces equivalent quality.

### Key Technical Challenges & Solutions

#### Challenge 1: Thick Arc Rendering
PIL's `ImageDraw.arc()` draws only a 1-pixel outline. A thick arc band is constructed as a polygon: outer arc + inner arc (traversed in the same angular direction to avoid self-intersecting spokes), filled with `draw.polygon()`.

#### Challenge 2: PIL Scanline Fill Horizontal-Edge Skip
PIL's polygon fill algorithm skips horizontal edges. The closing segment between arc endpoints becomes horizontal when the arc spans exactly 180° with endpoints at the same y-coordinate. The fix: use the **0°–180° semicircle** (right → bottom → left) for the U arc, which has no horizontal closing edge (outer[0] = right side, outer[180] = left side, different y-values in screen space).

#### Challenge 3: C Arc Band
The C arc uses arc_start=45°, arc_end=315°. This 270° span traces: top-right → top → left → bottom → bottom-right. PIL correctly fills this arc band because neither the outer nor inner arc closing segments are purely horizontal.

#### Challenge 4: U Leg–Arc Seamless Joint
Computed leg center x positions so that leg inner edges align exactly with the arc band outer edge at the connection points:
- Arc outer left at bottom: x = 256 − (83 + 36) = **137**
- Left leg inner edge: x = 173 − 36 = **137** ✓
- Arc outer right at bottom: x = 256 + (83 + 36) = **375**
- Right leg inner edge: x = 339 + 36 = **375** ✓

---

## Color Palette

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `C_BLUE` | `#3B82F6` | (59, 130, 246) | Letter C |
| `U_DARK` | `#1F2937` | (31, 41, 55) | Letter U |
| `BG` | — | (0, 0, 0, 0) | Transparent background |

---

## File Deliverables

| File | Description |
|---|---|
| `logo-v6.png` | Final logo image, 512×512, transparent background |
| `logo-v6.py` | Python generation script |
| `logo-v6-notes.md` | This documentation file |

---

## Validation Checklist

- [x] C is a standard letter C (opening on right side)
- [x] U is a standard letter U (two parallel legs + bottom arc)
- [x] C and U are separate, not concentric rings
- [x] C is positioned above U, both center-aligned at x=256
- [x] Stroke width 72 px (within 65–80 px spec)
- [x] Round line caps (rounded leg tops and bottoms)
- [x] C color: `#3B82F6`
- [x] U color: `#1F2937`
- [x] Background transparent
- [x] Canvas size 512×512
- [x] C is solid (no cracks or holes)
- [x] U is solid (no cracks, no gaps between legs and arc)
- [x] Lines have consistent thickness throughout
- [x] No jagged edges or aliasing artifacts visible at normal scale
