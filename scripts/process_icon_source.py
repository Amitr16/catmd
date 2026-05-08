"""Process a user-provided master icon into all Expo asset variants.

Input:  assets/images/icon-source.png  (square PNG, any resolution >= 1024px)
Output:
    icon.png                     1024x1024  iOS + legacy Android launcher
    splash-icon.png               512x512   splash screen foreground
    android-icon-foreground.png  1024x1024  adaptive icon foreground (full art)
    android-icon-background.png  1024x1024  adaptive icon background (solid sage)
    android-icon-monochrome.png  1024x1024  themed-icon silhouette (white on transparent)
    favicon.png                    48x48    web

Re-runnable: `python scripts/process_icon_source.py` from the repo root.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "assets" / "images" / "icon-source.png"
OUT = ROOT / "assets" / "images"

# Palette
SAGE_DEEP = (63, 100, 86, 255)    # #3F6456 — Android adaptive background

# Android adaptive icon safe zone: the full foreground canvas is 108dp but
# only the inner 66dp (~61% of the area) is guaranteed visible after the
# launcher crops. We pad the art so it lands comfortably inside that zone.
SAFE_ZONE_SCALE = 0.70


def load_square(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def save(img: Image.Image, name: str) -> None:
    img.save(OUT / name, "PNG")
    print(f"wrote {name:32s} {img.size[0]}x{img.size[1]}")


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def centered_on_transparent(art: Image.Image, canvas: int, art_fraction: float) -> Image.Image:
    """Return an RGBA canvas of side `canvas` with `art` scaled to
    `canvas * art_fraction` centered on it, rest transparent."""
    target = int(round(canvas * art_fraction))
    scaled = art.resize((target, target), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    offset = (canvas - target) // 2
    out.paste(scaled, (offset, offset), scaled)
    return out


def centered_on_solid(art: Image.Image, canvas: int, art_fraction: float, bg: tuple) -> Image.Image:
    """Same as centered_on_transparent but over a solid background colour."""
    out = Image.new("RGBA", (canvas, canvas), bg)
    target = int(round(canvas * art_fraction))
    scaled = art.resize((target, target), Image.LANCZOS)
    offset = (canvas - target) // 2
    out.paste(scaled, (offset, offset), scaled)
    return out


def alpha_key_cream(master: Image.Image) -> Image.Image:
    """Strip the green gradient background out of a cream-on-green master,
    leaving just the cream cat silhouette with a clean transparent bg.

    How: every pixel's alpha is a function of its distance from the cream
    brand colour. Cream-ish pixels stay opaque, green pixels go
    transparent, edge pixels feather in between. Works because the
    source image only has two palette zones (cream cat + green bg)
    with clean high-contrast boundaries."""
    CREAM = np.array([250, 247, 242], dtype=np.float32)
    arr = np.array(master.convert("RGBA"), dtype=np.float32)
    rgb = arr[:, :, :3]
    # Euclidean distance in RGB space. Cream → 0, sage centre ~216.
    dist = np.linalg.norm(rgb - CREAM, axis=2)
    # Soft threshold: 0-50 fully opaque, 50-160 fade, >160 transparent.
    # The 50 floor absorbs the mild tonal variation inside the cat body.
    alpha = np.clip(1.0 - (dist - 50.0) / 110.0, 0.0, 1.0)
    alpha *= arr[:, :, 3] / 255.0

    out = np.zeros_like(arr)
    # Unmask: where alpha is meaningfully opaque, keep the original cream
    # tones (they include the slight shadow/line details). Where alpha is
    # low, the RGB value doesn't matter visually but we set it to cream
    # to avoid any green fringing when composited over a different bg.
    hi = alpha > 0.5
    out[:, :, 0] = np.where(hi, arr[:, :, 0], CREAM[0])
    out[:, :, 1] = np.where(hi, arr[:, :, 1], CREAM[1])
    out[:, :, 2] = np.where(hi, arr[:, :, 2], CREAM[2])
    out[:, :, 3] = alpha * 255.0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def to_monochrome_silhouette(art: Image.Image) -> Image.Image:
    """Android 13+ themed icons use a monochrome layer. Take any non-
    transparent pixel in the source and output it as white with the same
    alpha; transparent stays transparent."""
    r, g, b, a = art.split()
    white = Image.new("L", art.size, 255)
    return Image.merge("RGBA", (white, white, white, a))


def main() -> int:
    if not IN.exists():
        print(f"ERROR: source not found at {IN}")
        print("Save the master icon to that path first, then re-run.")
        return 1

    master = load_square(IN)
    print(f"loaded source {master.size[0]}x{master.size[1]}")

    # The cat-only silhouette (green bg keyed out). This is what goes into
    # every foreground / splash / monochrome variant — the sage background
    # comes from a separate layer so we don't double-stack backgrounds.
    cat_only = alpha_key_cream(master)

    # Main icon (iOS + Android legacy launcher). Use the master art as-is
    # at 1024 — includes the gradient, looks good on launchers that don't
    # do adaptive compositing.
    save(resize(master, 1024), "icon.png")

    # Splash foreground. The splash bg is sage (defined in app.json), so
    # use the keyed cat-only version — no double background.
    save(resize(cat_only, 512), "splash-icon.png")

    # Adaptive foreground: cream cat on transparent, padded into the
    # safe zone so Android's circle/squircle crops don't eat the ears.
    fg = centered_on_transparent(cat_only, 1024, SAFE_ZONE_SCALE)
    save(fg, "android-icon-foreground.png")

    # Adaptive background: solid sage. Launcher parallax looks intentional.
    bg = Image.new("RGBA", (1024, 1024), SAGE_DEEP)
    save(bg, "android-icon-background.png")

    # Monochrome (Android 13+ themed icons): white-on-transparent
    # silhouette of the keyed cat.
    mono_fg = centered_on_transparent(to_monochrome_silhouette(cat_only), 1024, SAFE_ZONE_SCALE)
    save(mono_fg, "android-icon-monochrome.png")

    # Web favicon — tiny.
    save(resize(master, 48), "favicon.png")

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
