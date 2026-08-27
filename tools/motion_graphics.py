# Explanatory motion graphics for FTN-PILOT-02 (transparent PNG sequences, 30fps)
# Style: translucent dark panel, thin white strokes, optic-yellow accent, red for negation.
import math, os
from PIL import Image, ImageDraw, ImageFont

FPS = 30
S = 2  # supersample
W, H = 1080, 1920
FONT = "C:/Windows/Fonts/arialbd.ttf"
YEL = (223, 255, 79, 255)
WHT = (255, 255, 255, 255)
RED = (255, 90, 90, 255)
BLK = (20, 26, 22, 255)
PANEL = (10, 14, 12, 185)
STROKE = 3 * S

def font(size): return ImageFont.truetype(FONT, size * S)

def ease(t):  # smoothstep
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def fade_alpha(f, total, fin=9, fout=9):
    a = 1.0
    if f < fin: a = f / fin
    if f > total - fout: a = max(0.0, (total - f) / fout)
    return a

def new_frame():
    return Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))

def panel(d, x0, y0, x1, y1):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=28 * S, fill=PANEL, outline=(255, 255, 255, 90), width=2 * S)

def ball(d, cx, cy, r, color, outline=WHT, seam=True, alpha=255):
    c = tuple(list(color[:3]) + [min(alpha, color[3])])
    o = tuple(list(outline[:3]) + [min(alpha, outline[3])])
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=c, outline=o, width=STROKE)
    if seam:
        d.arc([(cx - r * 0.9) * S, (cy - r * 1.5) * S, (cx + r * 0.9) * S, (cy + r * 0.5) * S], 30, 150, fill=o, width=2 * S)

def label(d, cx, cy, text, color=WHT, size=44, alpha=255):
    c = tuple(list(color[:3]) + [alpha])
    d.text((cx * S, cy * S), text, font=font(size), fill=c, anchor="mm",
           stroke_width=3 * S, stroke_fill=(0, 0, 0, min(200, alpha)))

def save(img, folder, f):
    img = img.resize((W, H), Image.LANCZOS)
    img.save(os.path.join(folder, f"f_{f:03d}.png"))

def apply_fade(img, a):
    if a >= 0.999: return img
    alpha = img.getchannel("A").point(lambda v: int(v * a))
    img.putalpha(alpha)
    return img

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gfx")

# ---------- G03: background contrast principle (cut 3) 4.0s ----------
def g03():
    folder = os.path.join(OUT, "g03"); os.makedirs(folder, exist_ok=True)
    total = int(4.0 * FPS)
    px0, py0, px1, py1 = 90, 470, 990, 1060
    for f in range(total):
        img = new_frame(); d = ImageDraw.Draw(img)
        panel(d, px0, py0, px1, py1)
        # two mini courts
        lx0, lx1 = 140, 520; rx0, rx1 = 560, 940; cy0, cy1 = 540, 900
        d.rounded_rectangle([lx0*S, cy0*S, lx1*S, cy1*S], radius=16*S, fill=(200, 216, 176, 255))
        d.rounded_rectangle([rx0*S, cy0*S, rx1*S, cy1*S], radius=16*S, fill=(52, 66, 60, 255))
        # balls drop in with bounce
        t1 = ease((f - 8) / 22); t2 = ease((f - 20) / 22)
        if f > 8:
            y = 620 + 100 * t1 - 26 * math.sin(math.pi * t1)
            ball(d, (lx0 + lx1) / 2, y, 52, BLK, outline=WHT)
        if f > 20:
            y = 620 + 100 * t2 - 26 * math.sin(math.pi * t2)
            ball(d, (rx0 + rx1) / 2, y, 52, WHT, outline=(120, 130, 125, 255))
        # contrast pulse rings
        if f > 52:
            pr = 62 + 14 * abs(math.sin((f - 52) / 12))
            for cx, col in [((lx0+lx1)/2, YEL), ((rx0+rx1)/2, YEL)]:
                d.ellipse([(cx-pr)*S, (746-pr)*S, (cx+pr)*S, (746+pr)*S], outline=col, width=2*S)
        label(d, (lx0+lx1)/2, 960, "BLACK ON LIGHT", size=34)
        label(d, (rx0+rx1)/2, 960, "WHITE ON DARK", size=34)
        label(d, 540, 1016, "PICK BY BACKGROUND", YEL, 30)
        save(apply_fade(img, fade_alpha(f, total)), folder, f)
    print("g03", total)

# ---------- G05: white ball vanishes on the line (cut 5) 4.6s ----------
def g05():
    folder = os.path.join(OUT, "g05"); os.makedirs(folder, exist_ok=True)
    total = int(4.6 * FPS)
    px0, py0, px1, py1 = 90, 470, 990, 1040
    court = (91, 122, 140, 255)
    for f in range(total):
        img = new_frame(); d = ImageDraw.Draw(img)
        panel(d, px0, py0, px1, py1)
        # court field + thick white line
        d.rounded_rectangle([130*S, 540*S, 950*S, 900*S], radius=16*S, fill=court)
        line_x0, line_x1 = 480, 600
        d.rectangle([line_x0*S, 540*S, line_x1*S, 900*S], fill=(240, 240, 238, 255))
        # ball crosses; invisible while over the line
        t = ease(f / (total - 18))
        cx = 180 + (900 - 180) * t
        cy = 720
        over = line_x0 - 30 < cx < line_x1 + 30
        if over:
            # dashed ghost outline + question mark
            for a0 in range(0, 360, 40):
                d.arc([(cx-52)*S, (cy-52)*S, (cx+52)*S, (cy+52)*S], a0, a0+22, fill=RED, width=3*S)
            label(d, cx, 620, "?", RED, 64)
        else:
            ball(d, cx, cy, 52, WHT, outline=(120, 130, 125, 255))
        label(d, 540, 984, "WHITE ON WHITE", RED if over else WHT, 38)
        save(apply_fade(img, fade_alpha(f, total)), folder, f)
    print("g05", total)

# ---------- G08: yellow stays visible on any background (cut 8) 4.2s ----------
def g08():
    folder = os.path.join(OUT, "g08"); os.makedirs(folder, exist_ok=True)
    total = int(4.2 * FPS)
    px0, py0, px1, py1 = 90, 470, 990, 1040
    swatches = [(120, 150, 90, 255), (168, 106, 76, 255), (91, 122, 140, 255)]  # grass, clay, screen
    for f in range(total):
        img = new_frame(); d = ImageDraw.Draw(img)
        panel(d, px0, py0, px1, py1)
        x0, x1 = 130, 950
        wseg = (x1 - x0) / 3
        for i, col in enumerate(swatches):
            d.rectangle([(x0 + i*wseg)*S, 540*S, (x0 + (i+1)*wseg)*S, 900*S], fill=col)
            if i: d.line([(x0 + i*wseg)*S, 540*S, (x0 + i*wseg)*S, 900*S], fill=(255,255,255,120), width=2*S)
        # yellow ball sweeps across all three, glow ring follows
        t = ease(f / (total - 14))
        cx = x0 + 60 + (x1 - x0 - 120) * t
        ball(d, cx, 720, 52, (223, 255, 79, 255), outline=(90, 100, 40, 255))
        gr = 66 + 8 * abs(math.sin(f / 6))
        d.ellipse([(cx-gr)*S, (720-gr)*S, (cx+gr)*S, (720+gr)*S], outline=YEL, width=2*S)
        label(d, 540, 984, "ALWAYS VISIBLE", YEL, 38)
        save(apply_fade(img, fade_alpha(f, total)), folder, f)
    print("g08", total)

# ---------- G12: two-year trial timeline (cut 12) 4.0s ----------
def g12():
    folder = os.path.join(OUT, "g12"); os.makedirs(folder, exist_ok=True)
    total = int(4.0 * FPS)
    px0, py0, px1, py1 = 90, 560, 990, 1000
    bx0, bx1, by = 180, 900, 800
    for f in range(total):
        img = new_frame(); d = ImageDraw.Draw(img)
        panel(d, px0, py0, px1, py1)
        d.line([bx0*S, by*S, bx1*S, by*S], fill=(255,255,255,140), width=4*S)
        for i in range(3):
            tx = bx0 + (bx1 - bx0) * i / 2
            d.line([tx*S, (by-16)*S, tx*S, (by+16)*S], fill=WHT, width=3*S)
        label(d, bx0, by+58, "1970", WHT, 34)
        label(d, bx1, by+58, "1972", YEL, 34)
        # progress fill + rolling ball
        t = ease((f - 10) / (total - 26)) if f > 10 else 0
        fx = bx0 + (bx1 - bx0) * t
        d.line([bx0*S, by*S, fx*S, by*S], fill=YEL, width=6*S)
        ball(d, fx, by - 44, 34, (223, 255, 79, 255), outline=(90, 100, 40, 255))
        label(d, 540, 664, "2-YEAR TRIAL", YEL, 44)
        save(apply_fade(img, fade_alpha(f, total)), folder, f)
    print("g12", total)

# ---------- G16: Wimbledon 108 years timeline (cut 16) 4.6s ----------
def g16():
    folder = os.path.join(OUT, "g16"); os.makedirs(folder, exist_ok=True)
    total = int(4.6 * FPS)
    px0, py0, px1, py1 = 90, 560, 990, 1000
    bx0, bx1, by = 180, 900, 800
    for f in range(total):
        img = new_frame(); d = ImageDraw.Draw(img)
        panel(d, px0, py0, px1, py1)
        d.line([bx0*S, by*S, bx1*S, by*S], fill=(255,255,255,110), width=4*S)
        label(d, bx0, by+58, "1877", WHT, 34)
        label(d, bx1, by+58, "1986", YEL, 34)
        # white era sweeps across
        t = ease((f - 8) / (total - 40)) if f > 8 else 0
        fx = bx0 + (bx1 - bx0) * t
        d.line([bx0*S, by*S, fx*S, by*S], fill=(240, 240, 238, 230), width=6*S)
        if t > 0.03:
            ball(d, min(fx, bx1 - 6), by - 44, 30, WHT, outline=(120, 130, 125, 255))
        # yellow ball pops at the end
        if t >= 0.999:
            k = ease((f - (total - 32)) / 14)
            r = 30 + 14 * math.sin(math.pi * min(1, k))
            ball(d, bx1, by - 44, max(30, r), (223, 255, 79, 255), outline=(90, 100, 40, 255))
        label(d, 540, 664, "108 YEARS OF WHITE", WHT, 42)
        save(apply_fade(img, fade_alpha(f, total)), folder, f)
    print("g16", total)

g03(); g05(); g08(); g12(); g16()
print("done")
