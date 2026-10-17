#!/usr/bin/env python3
"""Rebuild docs/preview.jpg from current rendered-screen QA evidence.

4-up collage (Home, Search, Mood Radios, Queue) on an Abyss-dark canvas
matching the app's liquid-glass identity. Screens get rounded corners,
a hairline glass border, and a soft ambient shadow.
"""
from PIL import Image, ImageDraw, ImageFilter

SRC = [
    "qa/run2-03-home-fresh.png",
    "qa/run2-12-search-results.png",
    "qa/run2-16-moodradios.png",
    "qa/run2-08-queue.png",
]
OUT = "docs/preview.jpg"

W, H = 1920, 1080
BG = (7, 11, 10)          # abyss near-black
BORDER = (255, 255, 255)  # used at low alpha
RADIUS = 34

def rounded(im: Image.Image, radius: int) -> Image.Image:
    """Apply rounded corners via antialiased mask."""
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

def main():
    canvas = Image.new("RGB", (W, H), BG)

    # subtle ambient gradient: aqua tint bottom-left, warm tint top-right
    grad = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        t = y / H
        r = int(7 + 10 * (1 - t))
        g = int(11 + 14 * (1 - t))
        b = int(10 + 12 * (1 - t))
        gd.line([(0, y), (W, y)], fill=(r, g, b))
    canvas = grad

    shots = []
    TARGET_H = 800
    for p in SRC:
        im = Image.open(p).convert("RGB")
        s = TARGET_H / im.size[1]
        im = im.resize((int(im.size[0] * s), TARGET_H), Image.LANCZOS)
        shots.append(im)

    gap = 42
    total_w = sum(im.size[0] for im in shots) + gap * (len(shots) - 1)
    x0 = (W - total_w) // 2
    y0 = (H - TARGET_H) // 2

    # soft ambient shadow layer under the row
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [x0 - 8, y0 + 10, x0 + total_w + 8, y0 + TARGET_H + 26],
        radius=RADIUS + 10, fill=(0, 0, 0, 160),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB")

    x = x0
    for im in shots:
        shot = rounded(im.convert("RGBA"), RADIUS)
        # hairline glass border
        frame = Image.new("RGBA", shot.size, (0, 0, 0, 0))
        fd = ImageDraw.Draw(frame)
        fd.rounded_rectangle(
            [0, 0, shot.size[0] - 1, shot.size[1] - 1],
            radius=RADIUS, outline=(255, 255, 255, 26), width=2,
        )
        shot = Image.alpha_composite(shot, frame)
        canvas.paste(shot, (x, y0), shot)
        x += im.size[0] + gap

    canvas.save(OUT, quality=92)
    print(f"wrote {OUT} {canvas.size}")

if __name__ == "__main__":
    main()
