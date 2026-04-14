from PIL import Image, ImageDraw
import math

# Canvas settings
WIDTH, HEIGHT = 600, 800
BG_COLOR = "#FFFFFF"
BLUE = "#3B82F6"
DARK_GRAY = "#1F2937"

# Create image
img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

# Logo dimensions
CENTER_X = WIDTH // 2
MARGIN = 80
LETTER_HEIGHT = 280
GAP = 40
TOTAL_HEIGHT = LETTER_HEIGHT * 2 + GAP
START_Y = (HEIGHT - TOTAL_HEIGHT) // 2

# Stroke width - bolder for v4
STROKE_WIDTH = 70

# Helper function to draw thick rounded line with gradient effect
def draw_thick_segment(draw, x1, y1, x2, y2, width, color, cap_round=True):
    """Draw a thick line segment with rounded caps"""
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    if cap_round:
        r = width // 2
        draw.ellipse([x1-r, y1-r, x1+r, y1+r], fill=color)
        draw.ellipse([x2-r, y2-r, x2+r, y2+r], fill=color)

# ========== Draw Letter C (Top) ==========
c_y = START_Y + LETTER_HEIGHT // 2
c_width = 200
c_height = LETTER_HEIGHT - 40

# C is composed of 3 segments: left vertical, top horizontal, bottom horizontal
left_x = CENTER_X - c_width // 2
right_x = CENTER_X + c_width // 2 - 30
top_y = c_y - c_height // 2 + 35
bottom_y = c_y + c_height // 2 - 35

# Left vertical stroke
draw_thick_segment(draw, left_x, top_y, left_x, bottom_y, STROKE_WIDTH, BLUE)

# Top horizontal stroke (curved at corner)
draw_thick_segment(draw, left_x, top_y, right_x, top_y, STROKE_WIDTH, BLUE)

# Bottom horizontal stroke
draw_thick_segment(draw, left_x, bottom_y, right_x, bottom_y, STROKE_WIDTH, BLUE)

# ========== Draw Letter U (Bottom) ==========
u_y = START_Y + LETTER_HEIGHT + GAP + LETTER_HEIGHT // 2
u_width = 200
u_height = LETTER_HEIGHT - 40

# U dimensions
u_left_x = CENTER_X - u_width // 2
u_right_x = CENTER_X + u_width // 2
u_top_y = u_y - u_height // 2 + 35
u_bottom_y = u_y + u_height // 2 - 35

# Left vertical stroke
draw_thick_segment(draw, u_left_x, u_top_y, u_left_x, u_bottom_y, STROKE_WIDTH, DARK_GRAY)

# Right vertical stroke
draw_thick_segment(draw, u_right_x, u_top_y, u_right_x, u_bottom_y, STROKE_WIDTH, DARK_GRAY)

# Bottom curved connector - using multiple segments for smooth curve
# Draw as a thick arc-like connection
curve_y = u_bottom_y
segments = 15
for i in range(segments + 1):
    t = i / segments
    x = u_left_x + (u_right_x - u_left_x) * t
    # Slight curve downward in middle
    curve_offset = int(15 * math.sin(math.pi * t))
    y = curve_y + curve_offset
    r = STROKE_WIDTH // 2
    draw.ellipse([x-r, y-r, x+r, y+r], fill=DARK_GRAY)

# Draw the bottom connecting line
draw_thick_segment(draw, u_left_x, u_bottom_y, u_right_x, u_bottom_y, STROKE_WIDTH, DARK_GRAY)

# ========== Add subtle gradient overlay for texture ==========
# Create a subtle highlight effect
overlay = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 0))
overlay_draw = ImageDraw.Draw(overlay)

# Top highlight for C
for i in range(20):
    alpha = int(30 * (1 - i/20))
    overlay_draw.line([(left_x - 35, top_y - 35 + i), (right_x + 35, top_y - 35 + i)], 
                      fill=(255, 255, 255, alpha), width=1)

# Bottom highlight for U  
for i in range(15):
    alpha = int(25 * (1 - i/15))
    y = u_bottom_y + 35 - i
    overlay_draw.line([(u_left_x - 35, y), (u_right_x + 35, y)], 
                      fill=(255, 255, 255, alpha), width=1)

# Composite overlay
img = img.convert("RGBA")
img = Image.alpha_composite(img, overlay)
img = img.convert("RGB")

# Save the logo
img.save("/Users/pipi/.qclaw/workspace/projects/claw-universe/logo-v4.png", "PNG")
print("Logo v4 saved successfully!")
