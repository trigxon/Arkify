#!/usr/bin/env python3
"""
Derive Arkify's transparent brand mark from the logo artwork.

Dev tool (not part of the app runtime). Requires Pillow:  pip3 install pillow

Usage: python3 scripts/make-brand-mark.py

The supplied logo art is a metallic "A" on an opaque black square. On a dark
screen that square reads as a visible box behind the mark, so this extracts the
mark by using the artwork's own luminance as alpha and re-inks it in Arkify's
accent ramp (deep teal -> electric cyan), matching the brand reference's flat
cyan mark.

Output: assets/brand-mark.png  (1024x1024, transparent, trimmed to the mark)
"""
import os

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
SOURCE = os.path.join(ASSETS, "icon.png")
OUT = os.path.join(ASSETS, "brand-mark.png")

# Accent ramp: the darkest art becomes deep teal, the brightest becomes the
# signature cyan. Matches COLORS.accent.primary in src/constants/theme.ts.
DEEP = (6, 74, 78)
MID = (23, 190, 178)
BRIGHT = (104, 248, 230)

# The art's black plate is keyed out here; EDGE is where the mark reaches
# full opacity, which keeps the cut-out edge clean without eroding the art's
# own dark folds (those stay solid and get the deep end of the ramp).
FLOOR = 10
EDGE = 42
# Mark box inside the 1024 canvas, leaving the reference's breathing room.
MARK_BOX = 820


def main() -> None:
    art = Image.open(SOURCE).convert("RGB")

    lum = art.convert("L")

    # Key the plate out. The alpha is a single soft step at the plate edge, so
    # the mark stays solid while its silhouette stays clean.
    alpha = lum.point(
        lambda v: 0 if v <= FLOOR else min(255, int((v - FLOOR) * 255 / (EDGE - FLOOR)))
    )

    tinted = ImageOps.colorize(lum, black=DEEP, mid=MID, white=BRIGHT)
    tinted.putalpha(alpha)

    # Trim to the mark. The artwork also carries a soft ground reflection just
    # beneath the "A"; it is cut away so the mark is the glyph alone, then
    # recentred in a square canvas at a fixed size so every surface (launch,
    # splash, adaptive icon) frames it identically.
    bbox = tinted.getchannel("A").getbbox()
    if bbox:
        cut = bbox[1] + int((bbox[3] - bbox[1]) * 0.88)
        tinted = tinted.crop((bbox[0], bbox[1], bbox[2], cut))
        inner = tinted.getchannel("A").getbbox()
        if inner:
            tinted = tinted.crop(inner)

    square = Image.new("RGBA", (MARK_BOX, MARK_BOX), (0, 0, 0, 0))
    fitted = tinted.copy()
    fitted.thumbnail((MARK_BOX, MARK_BOX), Image.LANCZOS)
    square.paste(
        fitted,
        ((MARK_BOX - fitted.width) // 2, (MARK_BOX - fitted.height) // 2),
        fitted,
    )

    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.paste(square, ((1024 - MARK_BOX) // 2, (1024 - MARK_BOX) // 2), square)

    canvas.save(OUT)
    print(f"wrote {OUT} ({canvas.width}x{canvas.height})")


if __name__ == "__main__":
    main()
