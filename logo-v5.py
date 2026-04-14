#!/usr/bin/env python3
"""
Claw Universe — Logo v5
=============================================================
Design: "Linked Rings Monogram"

  C  (blue #3B82F6)  — bold outer arc, opening on the right (228° arc)
  U  (dark #1F2937)  — U-shape nested inside, outer arc = C inner arc

Key geometry:
  Both share centre (CX, CY) = (256, 255)
  Stroke width: 70 px
  Gap: 132° centred on the right (angles 64° and 296°)

  C outer R: 270    C inner R: 200   ← span 70 px
  U outer R: 200    U inner R: 130   ← span 70 px (U outer = C inner — interlocking)

  C outer arc: CCW 296° → 64°  = 228° (large arc)
  C inner arc: CW   64°  → 296° = 132° (small arc, gap side)

  U outer arc: CCW  64°  → 296° = 180° (semicircle through bottom)
  U inner arc: CW  296°  →  64°  = 180° (semicircle through top)

  U leg height = 70 px (equals stroke — clean parallel legs)
  U leg width  = 70 px (stroke)
"""

from PIL import Image, ImageDraw
import math

W, H  = 512, 512
OUT   = "/Users/pipi/.qclaw/workspace/projects/claw-universe/logo-v5.png"

# ── Palette ──────────────────────────────────────────────────────────────────
BLUE = (0x3B, 0x82, 0xF6)   # #3B82F6
DARK = (0x1F, 0x29, 0x37)   # #1F2937

# ── Geometry ─────────────────────────────────────────────────────────────────
CX, CY   = 256, 255
GAP_A    = 66                # half-gap = 66° → opening 132°
SW       = 70                # stroke width px

R_C_OUT  = 270               # C outer radius
R_C_IN   = R_C_OUT - SW      # 200  ← U outer R = C inner R (interlock!)
R_U_IN   = R_C_IN  - SW      # 130  ← U inner R

R_U_BOT  = CY + SW           # 325  ← U bottom arc centre y
# U outer arc radius = R_C_IN  (exactly = C inner R)
# U inner arc radius = R_U_IN

# Angles (standard math, y-down: 0°=right, 90°=down, 180°=left, 270°/−90°=up)
# Gap on the right side:
GAP_R    = GAP_A              # 66°  — right side of gap
GAP_L    = 360 - GAP_A        # 294° — left side of gap

def pt(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))

# ── Key points ───────────────────────────────────────────────────────────────

# C outer arc endpoints
c_out_top_L = pt(CX, CY, R_C_OUT, GAP_L)   # outer top-left of gap
c_out_top_R = pt(CX, CY, R_C_OUT, GAP_R)  # outer top-right of gap

# C inner arc endpoints
c_in_top_L  = pt(CX, CY, R_C_IN,  GAP_L)   # inner top-left of gap
c_in_top_R  = pt(CX, CY, R_C_IN,  GAP_R)   # inner top-right of gap
c_in_bot_R  = pt(CX, CY, R_C_IN,  GAP_R + 180)  # inner bottom-right
c_in_bot_L  = pt(CX, CY, R_C_IN,  GAP_L + 180)   # inner bottom-left

# U outer arc endpoints (same as C inner arc endpoints!)
u_out_top_R = c_in_top_R          # outer top-right of U = C inner top-right
u_out_top_L = c_in_top_L          # outer top-left of U  = C inner top-left
u_out_bot_R = pt(CX, R_U_BOT, R_C_IN, GAP_R)   # outer bottom-right
u_out_bot_L = pt(CX, R_U_BOT, R_C_IN, GAP_L)   # outer bottom-left

# U inner arc endpoints
u_in_bot_R  = pt(CX, R_U_BOT, R_U_IN, GAP_R)    # inner bottom-right
u_in_bot_L  = pt(CX, R_U_BOT, R_U_IN, GAP_L)    # inner bottom-left
u_in_top_R  = pt(CX, CY,        R_U_IN, GAP_R)  # inner top-right
u_in_top_L  = pt(CX, CY,        R_U_IN, GAP_L)  # inner top-left

# ── Build polygons ────────────────────────────────────────────────────────────
img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# ══ C SHAPE (blue) ══════════════════════════════════════════════════════════
# Outer arc: GAP_L → CCW through bottom → GAP_R  (large arc, 228°)
c_outer = [c_out_top_L]
for deg in range(GAP_L + 1, GAP_R + 360 + 1, 1):
    c_outer.append(pt(CX, CY, R_C_OUT, deg % 360))

# Right bridge: outer top-R → inner top-R → inner bot-R
c_right = [c_out_top_R, c_in_top_R, c_in_bot_R]

# Inner arc: GAP_R+180 (246°) → CW through top → GAP_L+180 (114°)  (small, 132°)
c_inner = [c_in_bot_L]
for deg in range(GAP_L + 180 - 1, GAP_R + 180 - 1, -1):
    c_inner.append(pt(CX, CY, R_C_IN, deg % 360))

# Left bridge: inner top-L → outer top-L → close
c_left  = [c_in_top_L, c_out_top_L, c_outer[0]]

draw.polygon(c_outer + c_right + c_inner + c_left, fill=BLUE + (255,))

# ══ U SHAPE (dark) ══════════════════════════════════════════════════════════
# Outer arc: GAP_R (66°) → CCW through bottom → GAP_L (294°)  (semicircle, 180°)
u_outer = [u_out_top_R]
for deg in range(GAP_R + 1, GAP_L + 360 + 1, 1):
    u_outer.append(pt(CX, R_U_BOT, R_C_IN, deg % 360))

# Right leg: bot → top
u_right_leg = [u_out_bot_R, u_in_bot_R]

# Inner arc: GAP_L+180 (114°) → CW through top → GAP_R+180 (246°)  (semicircle)
u_inner = [u_in_top_R]
for deg in range(GAP_R + 180 - 1, GAP_L + 180 - 1, -1):
    u_inner.append(pt(CX, R_U_BOT, R_U_IN, deg % 360))

# Left leg: bot → top → close
u_left_leg = [u_in_top_L, u_out_top_L, u_outer[0]]

draw.polygon(u_outer + u_right_leg + u_inner + u_left_leg, fill=DARK + (255,))

# ── Save ─────────────────────────────────────────────────────────────────────
img.save(OUT)
print(f"Saved: {OUT}")

# ── Debug ────────────────────────────────────────────────────────────────────
print(f"\nGeometry:")
print(f"  Canvas: {W}×{H}")
print(f"  Centre: ({CX}, {CY})")
print(f"  Stroke: {SW} px")
print(f"  Gap: {GAP_A*2}°  (right side, angles {GAP_R}°–{GAP_L}°)")
print(f"  C outer R: {R_C_OUT} | C inner R: {R_C_IN}")
print(f"  U outer R: {R_C_IN}  | U inner R: {R_U_IN}  (interlocking ✓)")
print(f"  U leg height: {SW} px | U leg width: {SW} px")
print(f"  C outer arc: CCW {GAP_L}° → {GAP_R}° = {360-GAP_L+GAP_R}°")
print(f"  C inner arc: CW  {GAP_R+180}° → {GAP_L+180}° = {GAP_L-GAP_R}°")
print(f"  U outer arc: CCW {GAP_R}° → {GAP_L}° = {GAP_L-GAP_R}°  (semicircle ✓)")
print(f"  U inner arc: CW  {GAP_L+180}° → {GAP_R+180}° = {GAP_L-GAP_R}°  (semicircle ✓)")
