#!/usr/bin/env python3
"""Regenerate every app icon from the canonical artwork.

``app-icon.png`` in the repo root is the single source of truth for how the
app icon should look. This script renders the Android launcher icons (adaptive
foreground/background/round-legacy + legacy square) plus the desktop / window
icons (32/128/128@2x/256/512/icon.png/icon.icns/icon.ico) so they all match
``app-icon.png`` exactly.

Outputs land in src-tauri/icons/:

* ``android/mipmap-*dpi/ic_launcher.png``            – square legacy icon
* ``android/mipmap-*dpi/ic_launcher_round.png``      – round legacy icon
* ``android/mipmap-*dpi/ic_launcher_foreground.png`` – adaptive foreground
* ``android/mipmap-*dpi/ic_launcher_background.png`` – adaptive background
* ``32x32.png`` / ``128x128.png`` / ``128x128@2x.png`` / ``256x256.png`` /
  ``512x512.png`` / ``icon.png`` – square icons
* ``icon.icns`` (macOS bundle) and ``icon.ico`` (Windows)

Design rules
------------
* Square / legacy icons are a **full-bleed** resize of ``app-icon.png`` — no
  transparent margin — so the packaged app icon looks exactly like the source
  artwork (previously the artwork was shrunk to ~84 %, leaving a transparent
  border that made the installed icon look different from app-icon.png).
* The Android **adaptive icon** is split per the platform spec:
  - background  = the full-bleed gradient square (no transparency);
  - foreground  = the sparkle mark + "+" badge, centred inside the adaptive
    safe zone (~66 dp circle of a 108 dp canvas). The launcher applies its own
    mask (circle / squircle / …), so the result still matches app-icon.png.
* Round legacy icon = ``app-icon.png`` cropped to a circle.

Usage: ``python3 scripts/gen_icons.py`` (idempotent). Requires ``Pillow`` and
``cairosvg``.
"""
from __future__ import annotations

import io
import math
import os
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APP_ICON = ROOT / "app-icon.png"
SVG = ROOT / "public" / "logo.svg"
OUT = ROOT / "src-tauri" / "icons"

# Adaptive-icon density buckets (launcher px).
ADAPTIVE_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}
# Legacy launcher icon density buckets (px).
LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
DESKTOP_SIZES = [32, 128, 256, 512]

# Foreground mark scale: share of the 108 dp adaptive canvas occupied by the
# artwork content (sparkle + badge). app-icon.png's sparkle spans ~62.5 % of the
# artwork (the badge pokes a little beyond); 62 % mirrors that proportion and
# stays within the 66 dp safe zone.
ADAPTIVE_FOREGROUND_SCALE = 0.62


def _render_svg(size: int) -> Image.Image:
    """Rasterise ``public/logo.svg`` at ``size`` × ``size``."""
    png = cairosvg.svg2png(url=str(SVG), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def _resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def _circle_crop(img: Image.Image) -> Image.Image:
    """Crop the image to an inscribed circle (transparent corners)."""
    w, h = img.size
    scale = 4  # supersample for smooth edges
    mask = Image.new("L", (w * scale, h * scale), 0)
    from PIL import ImageDraw

    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, w * scale, h * scale), fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    out = img.copy()
    out.putalpha(mask)
    return out


def _render_adaptive_foreground(size: int) -> Image.Image:
    """Sparkle mark + "+" badge centred on a transparent adaptive canvas."""
    src = Image.open(APP_ICON).convert("RGBA")
    bbox = src.getbbox()  # opaque bounds of the artwork
    if bbox is None:
        raise RuntimeError("app-icon.png appears to be fully transparent")
    content = src.crop(bbox)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    content_size = max(1, round(size * ADAPTIVE_FOREGROUND_SCALE))
    scaled = content.resize((content_size, content_size), Image.LANCZOS)
    off = (size - content_size) // 2
    canvas.alpha_composite(scaled, (off, off))
    return canvas


def _render_adaptive_background(size: int) -> Image.Image:
    """Full-bleed gradient square (rounded corners removed for adaptive use)."""
    svg = SVG.read_text(encoding="utf-8")
    # The adaptive background must bleed to the edge: drop the rounded corner.
    svg = svg.replace(' rx="116"', "")
    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"), output_width=size, output_height=size
    )
    return Image.open(io.BytesIO(png)).convert("RGBA")


def _write(img: Image.Image, rel: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print(f"  wrote {path.relative_to(ROOT)}")


def gen_android() -> None:
    src = Image.open(APP_ICON).convert("RGBA")
    for dpi, size in ADAPTIVE_SIZES.items():
        _write(_render_adaptive_foreground(size), f"android/mipmap-{dpi}/ic_launcher_foreground.png")
        _write(_render_adaptive_background(size), f"android/mipmap-{dpi}/ic_launcher_background.png")
    for dpi, size in LEGACY_SIZES.items():
        square = _resize(src, size)  # full-bleed, matches app-icon.png exactly
        _write(square, f"android/mipmap-{dpi}/ic_launcher.png")
        _write(_circle_crop(square), f"android/mipmap-{dpi}/ic_launcher_round.png")


def gen_desktop() -> None:
    src = Image.open(APP_ICON).convert("RGBA")
    for size in DESKTOP_SIZES:
        name = f"{size}x{size}.png"
        if size == 256:
            name = "128x128@2x.png"
        _write(_resize(src, size), name)
    # Largest square icon used by tauri for window/tray + android Prepare fallback.
    _write(_resize(src, 512), "icon.png")

    # Windows .ico (multi-size).
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = [src.resize((s, s), Image.LANCZOS) for s in ico_sizes]
    (OUT / "icon.ico").parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT / "icon.ico", format="ICO", sizes=[(f.width, f.height) for f in frames],
        append_images=frames[1:],
    )
    print("  wrote src-tauri/icons/icon.ico")

    # macOS .icns via Pillow's ICNS plugin (multi-resolution).
    icns_sizes = [16, 32, 64, 128, 256, 512, 1024]
    icns_frames = [src.resize((s, s), Image.LANCZOS) for s in icns_sizes]
    icns_frames[0].save(
        OUT / "icon.icns", format="ICNS",
        sizes=[(f.width, f.height) for f in icns_frames],
        append_images=icns_frames[1:],
    )
    print("  wrote src-tauri/icons/icon.icns")


def main() -> None:
    if not APP_ICON.exists():
        raise SystemExit(f"missing source artwork: {APP_ICON}")
    print("Generating Android icons …")
    gen_android()
    print("Generating desktop icons …")
    gen_desktop()
    print("Done.")


if __name__ == "__main__":
    main()
