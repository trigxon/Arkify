#!/usr/bin/env python3
"""
Generate every Audia logo/favicon asset from one source image.

Dev tool (not part of the app runtime). Requires Pillow:  pip3 install pillow

Usage: python3 scripts/generate-icons.py <source-image>

Outputs (into assets/):
  logo-source.png                 original, untouched (master copy)
  icon.png                        1024x1024 app icon
  splash-icon.png                 1024x1024 splash logo
  favicon.png                       48x48 web favicon
  android-icon-foreground.png     1024x1024 adaptive foreground (content in 66% safe zone)
  android-icon-background.png     1024x1024 adaptive background (sampled bg color)
  android-icon-monochrome.png     1024x1024 white-alpha silhouette (Android 13+ themed icon)
"""
import os
import sys

from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")


def load_square(path: str) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    if w != h:
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def sample_bg(img: Image.Image) -> tuple:
    """Average color of the artwork's border (its background)."""
    w, h = img.size
    band = max(8, w // 40)
    boxes = [(0, 0, w, band), (0, h - band, w, h), (0, 0, band, h), (w - band, 0, w, h)]
    means = [ImageStat.Stat(img.crop(box)).mean for box in boxes]
    return tuple(int(sum(m[c] for m in means) / len(means)) for c in range(3)) + (255,)


def make_monochrome(img: Image.Image, size: int = 1024, threshold: int = 60) -> Image.Image:
    """White silhouette with luminance-derived alpha; Android tints themed icons."""
    gray = img.convert("L").resize((size, size), Image.LANCZOS)
    gray = gray.point(
        lambda v: 0 if v < threshold else min(255, int((v - threshold) * 255 / (220 - threshold)))
    )
    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mono.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)), (0, 0), gray)
    return mono


def make_foreground(img: Image.Image, size: int = 1024, safe: float = 0.66) -> Image.Image:
    """Adaptive-icon foreground: artwork centered inside the 66% safe zone."""
    canvas = Image.new("RGBA", (size, size), sample_bg(img))
    inner = int(size * safe)
    content = img.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(content, (offset, offset), content)
    return canvas


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: generate-icons.py <source-image>")
    img = load_square(sys.argv[1])
    os.makedirs(ASSETS, exist_ok=True)

    img.save(os.path.join(ASSETS, "logo-source.png"))
    img.resize((1024, 1024), Image.LANCZOS).save(os.path.join(ASSETS, "icon.png"))
    img.resize((1024, 1024), Image.LANCZOS).save(os.path.join(ASSETS, "splash-icon.png"))
    img.resize((48, 48), Image.LANCZOS).save(os.path.join(ASSETS, "favicon.png"))
    make_foreground(img).save(os.path.join(ASSETS, "android-icon-foreground.png"))
    Image.new("RGBA", (1024, 1024), sample_bg(img)).save(
        os.path.join(ASSETS, "android-icon-background.png")
    )
    make_monochrome(img).save(os.path.join(ASSETS, "android-icon-monochrome.png"))

    for name in sorted(os.listdir(ASSETS)):
        path = os.path.join(ASSETS, name)
        if os.path.isfile(path):
            print(f"{name:36} {os.path.getsize(path):>9} bytes")
    print("done.")


if __name__ == "__main__":
    main()
