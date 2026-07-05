#!/usr/bin/env python3
"""Generate the full Nron Editor icon set from scratch (no network)."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
os.makedirs(OUT, exist_ok=True)

SIZE = 1024
ACCENT_TOP = (0, 211, 199)     # teal
ACCENT_BOT = (0, 120, 190)     # blue


def rounded_gradient(size, radius):
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGB", (size, size), ACCENT_TOP)
    top, bot = ACCENT_TOP, ACCENT_BOT
    px = grad.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    base.paste(grad, (0, 0), mask)
    return base


def draw_glyph(img):
    d = ImageDraw.Draw(img)
    size = img.size[0]
    # Draw a stylized "N" using thick strokes so we don't depend on a font.
    m = int(size * 0.30)          # margin
    w = int(size * 0.115)         # stroke width
    top, bot = m, size - m
    left, right = m, size - m
    col = (255, 255, 255, 255)
    # left vertical
    d.rounded_rectangle([left, top, left + w, bot], radius=w // 2, fill=col)
    # right vertical
    d.rounded_rectangle([right - w, top, right, bot], radius=w // 2, fill=col)
    # diagonal
    d.line([(left + w // 2, top + w // 2), (right - w // 2, bot - w // 2)],
           fill=col, width=w, joint="curve")
    return img


master = rounded_gradient(SIZE, radius=int(SIZE * 0.22))
master = draw_glyph(master)

# PNG sizes required by tauri.conf.json
targets = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}
for name, s in targets.items():
    master.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, name))

# Windows .ico (multi-size)
master.save(os.path.join(OUT, "icon.ico"),
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# Android mipmap launcher icons
ANDROID = {
    "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192,
}
for dpi, s in ANDROID.items():
    d = os.path.join(OUT, "android", f"mipmap-{dpi}")
    os.makedirs(d, exist_ok=True)
    master.resize((s, s), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    master.resize((s, s), Image.LANCZOS).save(os.path.join(d, "ic_launcher_round.png"))

print("icons written to", os.path.abspath(OUT))
