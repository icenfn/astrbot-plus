#!/usr/bin/env python3
"""Regenerate the complete AstrBot+ icon set from ``public/logo.svg``.

Do **not** use a naive ``npx tauri icon`` for this project: it renders the
artwork full-bleed, which makes the launcher icon look enlarged/cropped on both
desktop and Android. ``tauri icon`` also emits an Android adaptive foreground
whose content fills the whole 108dp canvas, so the OS scales it up by ~1.5x
before applying the mask.

This script instead produces:
  * desktop PNG / ICO / ICNS: the logo scaled to ~84% and centred, leaving a
    transparent margin so it matches the optical size of neighbouring icons;
  * Android adaptive icons: a full-bleed gradient *background* layer plus a
    transparent *foreground* whose mark is centred inside the safe zone (the OS
    mask then crops empty space instead of zooming the logo);
  * Android legacy (<= 7.1) square + round launcher icons.

Requires: ``inkscape`` (SVG -> PNG) and Pillow (ICO/ICNS assembly).

Usage: ``python3 scripts/gen_icons.py``
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "src-tauri", "icons")
ANDROID_DIR = os.path.join(ICON_DIR, "android")

# The logo drawn inside its own rounded square (as authored in logo.svg).
LOGO_SVG = os.path.join(ROOT, "public", "logo.svg")

# A transparent-background mark-only SVG (sparkle + "+" badge), used as the
# Android adaptive foreground.
MARK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#dcefff"/>
    </linearGradient>
  </defs>
  <path d="M256 96 C266 176 336 246 416 256 C336 266 266 336 256 416 C246 336 176 266 96 256 C176 246 246 176 256 96 Z" fill="url(#mark)"/>
  <circle cx="382" cy="382" r="70" fill="#1a5c92" opacity="0.35"/>
  <circle cx="382" cy="382" r="62" fill="#ffffff"/>
  <path d="M382 350v64M350 382h64" stroke="#2f86bd" stroke-width="16" stroke-linecap="round"/>
</svg>
"""

# A full-bleed gradient square, used as the Android adaptive background.
BG_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#42a9e2"/>
      <stop offset="0.5" stop-color="#2f86bd"/>
      <stop offset="1" stop-color="#1a5c92"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
</svg>
"""

# Desktop: logo occupies 84% of the canvas => an 8% transparent margin per side.
DESKTOP_RATIO = 0.84
# Android legacy launcher icons: slightly tighter margin.
LEGACY_RATIO = 0.86
# Android adaptive foreground: keep the mark inside the 66dp/108dp safe zone.
ADAPTIVE_RATIO = 0.58

DESKTOP_FILES = {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "StoreLogo.png": 50,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
}

# density -> (legacy size, adaptive layer size)
ANDROID_DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

ADAPTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <background android:drawable="@mipmap/ic_launcher_background"/>
</adaptive-icon>
"""


def log(msg: str) -> None:
    print(f"[gen_icons] {msg}")


def render(svg_source: str, size: int) -> Image.Image:
    """Rasterise an SVG string (from a file path or literal) to an RGBA image."""
    with tempfile.TemporaryDirectory() as td:
        svg_path = os.path.join(td, "in.svg")
        png_path = os.path.join(td, "out.png")
        if svg_source.strip().startswith("<"):
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(svg_source)
        else:  # treat as a path
            svg_path = svg_source
        subprocess.run(
            [
                "inkscape",
                svg_path,
                "--export-type=png",
                f"--export-filename={png_path}",
                "-w",
                str(size),
                "-h",
                str(size),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return Image.open(png_path).convert("RGBA")


def logo_padded(size: int, ratio: float) -> Image.Image:
    """The rounded-square logo centred on a transparent canvas."""
    inner = max(1, round(size * ratio))
    art = render(LOGO_SVG, inner)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    off = (size - inner) // 2
    canvas.paste(art, (off, off), art)
    return canvas


def legacy_round(size: int, ratio: float) -> Image.Image:
    """A circular legacy launcher icon with the logo centred inside."""
    base = logo_padded(size, ratio)
    mask = Image.new("L", (size, size), 0)
    d = max(1, round(size * ratio))
    off = (size - d) // 2
    ImageDraw.Draw(mask).ellipse((off, off, off + d - 1, off + d - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def adaptive_foreground(size: int, ratio: float) -> Image.Image:
    """Transparent foreground whose mark fits the adaptive-icon safe zone."""
    art = render(MARK_SVG, size)
    bbox = art.getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    content = art.crop(bbox)
    cw, ch = content.size
    scale = (size * ratio) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    content = content.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(content, ((size - nw) // 2, (size - nh) // 2), content)
    return canvas


def write_desktop() -> None:
    for name, size in DESKTOP_FILES.items():
        logo_padded(size, DESKTOP_RATIO).save(os.path.join(ICON_DIR, name))
    # Multi-resolution Windows icon.
    ico_src = logo_padded(256, DESKTOP_RATIO)
    ico_src.save(
        os.path.join(ICON_DIR, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    # macOS icon set.
    logo_padded(512, DESKTOP_RATIO).save(os.path.join(ICON_DIR, "icon.icns"), format="ICNS")
    log(f"desktop icons written ({len(DESKTOP_FILES)} png + ico + icns)")


def write_android() -> None:
    for density, (legacy, adaptive) in ANDROID_DENSITIES.items():
        d = os.path.join(ANDROID_DIR, f"mipmap-{density}")
        os.makedirs(d, exist_ok=True)
        logo_padded(legacy, LEGACY_RATIO).save(os.path.join(d, "ic_launcher.png"))
        legacy_round(legacy, LEGACY_RATIO).save(os.path.join(d, "ic_launcher_round.png"))
        render(BG_SVG, adaptive).save(os.path.join(d, "ic_launcher_background.png"))
        adaptive_foreground(adaptive, ADAPTIVE_RATIO).save(
            os.path.join(d, "ic_launcher_foreground.png")
        )

    # Point the adaptive-icon descriptors at the mipmap background (a colour
    # resource cannot express the brand gradient) and drop the old colour file.
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(ANDROID_DIR, "mipmap-anydpi-v26", name), "w", encoding="utf-8") as f:
            f.write(ADAPTIVE_XML)
    legacy_color = os.path.join(ANDROID_DIR, "values", "ic_launcher_background.xml")
    if os.path.exists(legacy_color):
        os.remove(legacy_color)
    log(f"android icons written ({len(ANDROID_DENSITIES)} densities + adaptive xml)")


def main() -> None:
    if not os.path.exists(LOGO_SVG):
        sys.exit(f"logo not found: {LOGO_SVG}")
    write_desktop()
    write_android()
    log("done")


if __name__ == "__main__":
    main()
