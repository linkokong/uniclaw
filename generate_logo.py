#!/usr/bin/env python3
"""
Claw Universe 极简 Logo 生成器
设计：C 和 U 的融合图形
"""

from PIL import Image, ImageDraw

# 画布尺寸
WIDTH, HEIGHT = 512, 512

# 颜色定义
BLUE = "#3B82F6"      # C 的颜色
DARK_GRAY = "#1F2937" # U 的颜色
BG_COLOR = "#FFFFFF"  # 背景白色

# 创建画布
img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

# 中心点
cx, cy = WIDTH // 2, HEIGHT // 2

# 参数
stroke_width = 60       # 线条粗细
arc_radius = 140        # C 的半径
u_height = 100          # U 的高度
u_width = 200           # U 的宽度
gap = 10                # C 和 U 之间的间隙

# ===== 绘制 C（上半部分弧形） =====
# C 是一个开口向下的半圆弧
# 使用椭圆弧来绘制

# C 的外圆和内圆
outer_r = arc_radius + stroke_width // 2
inner_r = arc_radius - stroke_width // 2

# 绘制 C 的上半圆弧（开口向下）
# 使用椭圆的四分之一来构建
# 左上弧
bbox_outer = [cx - outer_r, cy - outer_r - gap, cx + outer_r, cy + outer_r - gap]
bbox_inner = [cx - inner_r, cy - inner_r - gap, cx + inner_r, cy + inner_r - gap]

# 绘制 C 的弧形 - 使用饼图切片方式
# 我们绘制一个 180度的弧（上半圆）
# 从 180度到 360度（左到右的上半圆）

# 方法：绘制两个圆弧并使用多边形填充
import math

def draw_arc_band(draw, cx, cy, r_outer, r_inner, start_angle, end_angle, color, y_offset=0):
    """绘制弧形带"""
    points = []
    # 外弧点
    for angle in range(start_angle, end_angle + 1, 2):
        rad = math.radians(angle)
        x = cx + r_outer * math.cos(rad)
        y = cy + y_offset + r_outer * math.sin(rad)
        points.append((x, y))
    # 内弧点（反向）
    for angle in range(end_angle, start_angle - 1, -2):
        rad = math.radians(angle)
        x = cx + r_inner * math.cos(rad)
        y = cy + y_offset + r_inner * math.sin(rad)
        points.append((x, y))
    
    if len(points) >= 3:
        draw.polygon(points, fill=color)

# 绘制 C - 上半圆弧 (180° 到 360°，即左到右的上半圆)
cy_c = cy - 50  # C 的位置偏上
draw_arc_band(draw, cx, cy_c, outer_r, inner_r, 200, 340, BLUE)

# 添加 C 的两端小圆角帽
cap_radius = stroke_width // 2
# 左端点
left_x = cx + arc_radius * math.cos(math.radians(200))
left_y = cy_c + arc_radius * math.sin(math.radians(200))
draw.ellipse([left_x - cap_radius, left_y - cap_radius, 
              left_x + cap_radius, left_y + cap_radius], fill=BLUE)
# 右端点
right_x = cx + arc_radius * math.cos(math.radians(340))
right_y = cy_c + arc_radius * math.sin(math.radians(340))
draw.ellipse([right_x - cap_radius, right_y - cap_radius, 
              right_x + cap_radius, right_y + cap_radius], fill=BLUE)

# ===== 绘制 U（下半部分） =====
cy_u = cy + 30  # U 的位置偏下
u_half_width = u_width // 2
u_left = cx - u_half_width
u_right = cx + u_half_width
u_top = cy_u - u_height
u_bottom = cy_u

# U 的两条竖线
line_width = stroke_width
# 左竖线
draw.rounded_rectangle([u_left - line_width//2, u_top, 
                        u_left + line_width//2, u_bottom], 
                       radius=line_width//2, fill=DARK_GRAY)
# 右竖线
draw.rounded_rectangle([u_right - line_width//2, u_top, 
                        u_right + line_width//2, u_bottom], 
                       radius=line_width//2, fill=DARK_GRAY)

# U 的底部弧线连接
# 使用半圆连接两条竖线
arc_y = u_bottom - line_width//2
# 底部半圆（开口向上）
arc_bbox = [u_left, arc_y - u_half_width, u_right, arc_y + u_half_width]
# 绘制底部半圆
def draw_bottom_u(draw, left, right, y, thickness, color):
    """绘制 U 的底部半圆"""
    width = right - left
    radius = width // 2
    center_x = (left + right) // 2
    
    # 绘制半圆环
    outer_r = radius + thickness // 2
    inner_r = radius - thickness // 2
    
    points = []
    # 外弧（下半圆）
    for angle in range(0, 181, 2):
        rad = math.radians(angle)
        x = center_x + outer_r * math.cos(rad)
        y_pt = y + outer_r * math.sin(rad)
        points.append((x, y_pt))
    # 内弧（反向，上半圆）
    for angle in range(180, -1, -2):
        rad = math.radians(angle)
        x = center_x + inner_r * math.cos(rad)
        y_pt = y + inner_r * math.sin(rad)
        points.append((x, y_pt))
    
    if len(points) >= 3:
        draw.polygon(points, fill=color)

draw_bottom_u(draw, u_left, u_right, arc_y, line_width, DARK_GRAY)

# 保存图片
img.save("/Users/pipi/.qclaw/workspace/projects/claw-universe/logo-v3.png", "PNG")
print("Logo saved to: /Users/pipi/.qclaw/workspace/projects/claw-universe/logo-v3.png")
