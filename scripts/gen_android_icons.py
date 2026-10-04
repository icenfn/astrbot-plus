#!/usr/bin/env python3
"""Generate correct Android launcher icons for AstrBot+.

`tauri icon` derives `ic_launcher_foreground` from the desktop source, which
made the foreground include the full-bleed background at ~65% — composited over
a white adaptive background this looked *enlarged/zoomed*.

This script instead:
  * adaptive icon = solid brand background color + white sparkle foreground
    (foreground sized to ~58% so it sits inside the 66dp safe zone), and
  * legacy icons  = rounded-square / round brand tile + mark.

Requires `inkscape` and Pillow.
"""
from __future__ import annotations

import os
import subprocess
import sys

from PIL import Image, ImageDraw

OUT = "src-tauri/icons/android"
ASSETS = "assets/icon"
BRAND = "#2F86BD"
# density -> (legacy px, adaptive foreground px). Foreground = 108dp * scale.
DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}
FOREGROUND_FRAC = 0.62  # of the foreground canvas (=> sparkle ~58%)
LEGACY_FRAC = 0.58  # of the legacy canvas


def render(svg: str, png: str, size: int) -> None:
    subprocess.run(
        ["inkscape", svg, "--export-type=png", f"--export-filename={png}",
         f"--export-width={size}", f"--export-height={size}"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def fit(img: Image.Image, size: int, frac: float) -> Image.Image:
    side = max(1, int(round(size * frac)))
    return img.resize((side, side), Image.LANCZOS)


def center_paste(base: Image.Image, layer: Image.Image) -> None:
    w, h = base.size
    base.alpha_composite(layer, ((w - layer.size[0]) // 2, (h - layer.size[1]) // 2))


def main() -> None:
    render(f"{ASSETS}/tile.svg", "/tmp/tile.png", 1024)
    render(f"{ASSETS}/mark.svg", "/tmp/mark.png", 1024)
    tile = Image.open("/tmp/tile.png").convert("RGBA")
    mark = Image.open("/tmp/mark.png").convert("RGBA")

    for name, (legacy, fg) in DENSITIES.items():
        d = f"{OUT}/mipmap-{name}"
        os.makedirs(d, exist_ok=True)

        # Adaptive foreground: white mark only, transparent bg.
        fg_canvas = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
        center_paste(fg_canvas, fit(mark, fg, FOREGROUND_FRAC))
        fg_canvas.save(f"{d}/ic_launcher_foreground.png")

        # Legacy rounded square: tile + mark.
        square = tile.resize((legacy, legacy), Image.LANCZOS).copy()
        center_paste(square, fit(mark, legacy, LEGACY_FRAC))
        square.save(f"{d}/ic_launcher.png")

        # Legacy round: circular mask over the square.
        circle = Image.new("RGBA", (legacy, legacy), (0, 0, 0, 0))
        mask = Image.new("L", (legacy, legacy), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
        circle.paste(square, (0, 0), mask)
        circle.save(f"{d}/ic_launcher_round.png")
        print(f"{d}: legacy={legacy} fg={fg}")

    # Adaptive background color + adaptive-icon descriptors.
    os.makedirs(f"{OUT}/values", exist_ok=True)
    with open(f"{OUT}/values/ic_launcher_background.xml", "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
        f.write(f'  <color name="ic_launcher_background">{BRAND}</color>\n')
        f.write("</resources>\n")

    anydpi = f"{OUT}/mipmap-anydpi-v26"
    os.makedirs(anydpi, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '  <background android:drawable="@color/ic_launcher_background"/>\n'
        "</adaptive-icon>\n"
    )
    for fname in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(f"{anydpi}/{fname}", "w", encoding="utf-8") as f:
            f.write(xml)

    print("android icons generated OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
