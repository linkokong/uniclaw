#!/usr/bin/env python3
"""
Claw Universe Logo v6
=====================
- C: Standard letter C shape (stroke arc) in blue #3B82F6
- U: Standard letter U shape (two legs + bottom arc) in dark gray #1F2937
- C above, U below, center-aligned
- Line width: 72px (within 65-80px range), round caps
- Transparent background, 512×512
- Rendering: PIL ImageDraw with custom polygon primitives
  (pycairo not available in this environment)

Geometry
--------
C: center (256, 182), radius 125, stroke 72px
   Arc from 45° to 315° (clockwise through top → left → bottom → bottom-right)
   → opens on the right side ✓

U: arc center (256, 354), radius 83, stroke 72px
   Left leg centered at x=173, right leg at x=339
   (Leg inner edges align with arc outer edges at bottom → no gaps)
   Legs drawn as rounded rectangles, arc drawn as bottom semicircle band

PIL polygon fill note
--------------------
PIL's ImageDraw.polygon uses the scanline fill algorithm and skips
horizontal edges (including the closing segment between arc endpoints).
The arc band polygon uses the 0°–180° semicircle (0=right, 90=bottom,
180=left in screen coordinates), which gives a smooth bottom arc without
requiring the closing segment to be horizontal.
"""

from PIL import Image, ImageDraw
import math
import sys
import numpy as np

# ─── Parameters ────────────────────────────────────────────────────────────────
W, H = 512, 512
LINE_W = 72  # stroke width in pixels (within 65-80px range)

# C
C_CX = 256
C_CY = 182
C_R  = 125
C_COLOR = (59, 130, 246, 255)   # #3B82F6

# U
U_CX       = 256
U_CY       = 354
U_R        = 83
# Leg center x values chosen so leg inner edges align with arc outer edges
# Arc outer left at bottom  = U_CX - (U_R + LINE_W/2) = 256 - 119 = 137
# Leg left center           = 137 + LINE_W/2           = 173
# Arc outer right at bottom = U_CX + (U_R + LINE_W/2)   = 256 + 119 = 375
# Leg right center          = 375 - LINE_W/2            = 339
U_LEG_CX_L = 173
U_LEG_CX_R = 339
# Arc outer top = U_CY - (U_R + LINE_W/2) = 235
# Arc outer bottom = U_CY + (U_R + LINE_W/2) = 473
U_TOP = U_CY - (U_R + LINE_W / 2)   # = 235
U_BOT = U_CY + (U_R + LINE_W / 2)   # = 473
U_COLOR = (31, 41, 55, 255)         # #1F2937

OUTPUT_PATH = "/Users/pipi/.qclaw/workspace/projects/claw-universe/logo-v6.png"


# ─── Primitive Draw Functions ──────────────────────────────────────────────────

def arc_band(draw, cx, cy, r, w, color, arc_start, arc_end, steps=180):
    """
    Draw a thick arc (arc band) using a polygon.

    Outer arc: arc_start → arc_end (increasing angle)
    Inner arc: arc_end → arc_start (decreasing angle)
    Both traverse the band boundary in the same orientation.
    """
    outer = []
    for i in range(steps + 1):
        a = math.radians(arc_start + (arc_end - arc_start) * i / steps)
        outer.append((cx + (r + w / 2) * math.cos(a),
                      cy + (r + w / 2) * math.sin(a)))
    inner = []
    for i in range(steps + 1):
        a = math.radians(arc_end - (arc_end - arc_start) * i / steps)
        inner.append((cx + max(0.1, r - w / 2) * math.cos(a),
                      cy + max(0.1, r - w / 2) * math.sin(a)))
    draw.polygon(outer + inner, fill=color)


def arc_band_bottom(draw, cx, cy, r, w, color, steps=90):
    """
    Bottom semicircle arc band (for U letter).
    Uses the 0°–180° semicircle: right → bottom → left.
    In screen coords: 0°=right, 90°=bottom, 180°=left.
    This avoids a horizontal closing edge that PIL skips.
    """
    outer = [(cx + (r + w / 2) * math.cos(math.radians(a)),
              cy + (r + w / 2) * math.sin(math.radians(a)))
             for a in (0.0 + (180.0 - 0.0) * i / steps for i in range(steps + 1))]
    inner = [(cx + max(0.1, r - w / 2) * math.cos(math.radians(a)),
              cy + max(0.1, r - w / 2) * math.sin(math.radians(a)))
             for a in (180.0 - (180.0 - 0.0) * i / steps for i in range(steps + 1))]
    draw.polygon(outer + inner, fill=color)


def rounded_rect_vert(draw, cx, y_top, y_bot, w, color):
    """
    Rounded vertical stroke (two end caps + rectangular body).
    Used for U letter legs.
    """
    draw.ellipse([cx - w / 2, y_top,       cx + w / 2, y_top + w],     fill=color)
    draw.rectangle([cx - w / 2, y_top + w / 2, cx + w / 2, y_bot - w / 2], fill=color)
    draw.ellipse([cx - w / 2, y_bot - w,   cx + w / 2, y_bot],         fill=color)


# ─── Main Logo Draw ────────────────────────────────────────────────────────────

def make_logo(output_path: str):
    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    lw   = LINE_W

    # ── Letter C ──────────────────────────────────────────────────────────────
    # Arc from 45° (top-right) clockwise to 315° (bottom-right).
    # 45° → 90° → 180° → 270° → 315° goes through top → left → bottom → bottom-right.
    # Opening is on the right side of the circle. ✓
    arc_band(draw,
             C_CX, C_CY, C_R, lw,
             C_COLOR,
             arc_start=45, arc_end=315,
             steps=180)

    # ── Letter U ──────────────────────────────────────────────────────────────
    # Three parts: left leg + bottom arc + right leg.
    # Legs: rounded rectangles, from arc outer top (y=U_TOP) to arc outer bottom (y=U_BOT).
    # Arc band: bottom semicircle, centered at (U_CX, U_CY) with radius U_R.
    rounded_rect_vert(draw, U_LEG_CX_L, U_TOP, U_BOT, lw, U_COLOR)
    rounded_rect_vert(draw, U_LEG_CX_R, U_TOP, U_BOT, lw, U_COLOR)
    arc_band_bottom(draw, U_CX, U_CY, U_R, lw, U_COLOR, steps=90)

    img.save(output_path)
    print(f"✓ Saved: {output_path}")

    # ─── Pixel-level validation ──────────────────────────────────────────────
    arr = np.array(img)
    ny, nx = np.where(arr[:, :, 3] > 0)

    print(f"\n── Validation ───────────────────────────────")
    print(f"  Image size     : {W}×{H}")
    print(f"  Background     : transparent (alpha=0)")
    print(f"  Non-transparent: {len(ny):,} px")
    print(f"  Y range        : {ny.min()} – {ny.max()}")
    print(f"  X range        : {nx.min()} – {nx.max()}")

    def sp(x, y, label):
        r, g, b, a = arr[y, x]
        tag = "C" if (r, g, b) == C_COLOR[:3] else \
              "U" if (r, g, b) == U_COLOR[:3] else "BG"
        print(f"  {label:22s}({x:3d},{y:3d})  rgba({r:3d},{g:3d},{b:3d},{a:3d})  [{tag}]")

    print("\n  Color spot-checks:")
    sp(131, 182, "C-left-outer")
    sp(256,  55, "C-top")
    sp(256, 182, "C-mid-left")
    sp( 95, 182, "C-leftmost")
    sp(381, 182, "C-right(empty)")
    sp(173, 260, "U-left-leg-top")
    sp(256, 437, "U-arc-bottom")
    sp(339, 260, "U-right-leg-top")
    sp(137, 354, "U-arc-left-edge")
    sp(375, 354, "U-arc-right-edge")
    sp( 10,  10, "BG-corner")
    print("\n  ✓ Done")


if __name__ == "__main__":
    make_logo(OUTPUT_PATH)
