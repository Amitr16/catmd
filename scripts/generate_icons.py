"""Generate CatMD app icons + splash mark — v3 "Dark Clinical".

Design direction: full-bleed dark-sage background with a subtle radial
gradient (lighter in the centre, darker at the corners) and a bold
cream cat silhouette centred on it. No decorative frame, no medallion
ring. High contrast, immediate recognition, reads at 48 px.

Reference points: Oura (deep navy + single mark), Linear (flat mark +
generous negative space), One Medical (clinical green, type-first),
DogMD (solid colour plate + animal silhouette).

Outputs (Expo SDK 54 convention):
    assets/images/icon.png                   1024×1024  launcher + store
    assets/images/splash-icon.png             512×512   centered on splash bg
    assets/images/android-icon-foreground.png 1024×1024 transparent, safe zone
    assets/images/android-icon-background.png 1024×1024 deep sage gradient
    assets/images/android-icon-monochrome.png 1024×1024 white silhouette
    assets/images/favicon.png                  48×48    web
    assets/images/catmd-wordmark.png         1600×480   header composition

Re-runnable: `python scripts/generate_icons.py` from the repo root.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"
OUT.mkdir(parents=True, exist_ok=True)

# ── Palette (design-system tokens) ─────────────────────────────────────────
CREAM         = (250, 247, 242, 255)  # #FAF7F2 — silhouette
SAGE          = (91, 138, 122, 255)   # #5B8A7A
SAGE_DEEP     = (63, 100, 86, 255)    # #3F6456 — gradient centre
SAGE_DARKEST  = (37, 64, 58, 255)     # #25403A — gradient corners
CHARCOAL      = (31, 32, 36, 255)     # #1F2024
WHITE         = (255, 255, 255, 255)
TRANSPARENT   = (0, 0, 0, 0)


def draw_cat(
    img: Image.Image,
    cx: float,
    cy: float,
    size_scale: float,
    fill: tuple,
) -> None:
    """Ellipse head + 2 pointed ears silhouette.

    Hand-tuned proportions: slightly taller than wide head, outer ear
    edge near-vertical, inner edge angled inward, tip leaning just
    outside the outer base line. Reads as a cat at 24 px.
    """
    d = ImageDraw.Draw(img, "RGBA")
    s = size_scale

    # Head
    head_w = s * 0.70
    head_h = s * 0.72
    head_cy = cy + s * 0.05
    d.ellipse(
        [cx - head_w / 2, head_cy - head_h / 2,
         cx + head_w / 2, head_cy + head_h / 2],
        fill=fill,
    )

    # Ears
    ear_tip_y  = head_cy - head_h / 2 - s * 0.18
    ear_base_y = head_cy - head_h / 2 + s * 0.05   # overlaps head top

    left_outer_x = cx - s * 0.28
    left_tip_x   = cx - s * 0.33
    left_inner_x = cx - s * 0.10

    d.polygon(
        [(left_outer_x, ear_base_y),
         (left_tip_x,   ear_tip_y),
         (left_inner_x, ear_base_y)],
        fill=fill,
    )
    d.polygon(
        [(2 * cx - left_outer_x, ear_base_y),
         (2 * cx - left_tip_x,   ear_tip_y),
         (2 * cx - left_inner_x, ear_base_y)],
        fill=fill,
    )


def radial_gradient(
    size: int,
    center_color: tuple,
    edge_color: tuple,
    exponent: float = 1.4,
) -> Image.Image:
    """Smooth radial falloff using numpy for speed."""
    x, y = np.meshgrid(np.arange(size), np.arange(size))
    cx = cy = size / 2
    max_dist = np.sqrt(cx * cx + cy * cy)
    t = np.clip(np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max_dist, 0, 1)
    t = t ** exponent
    r = (center_color[0] * (1 - t) + edge_color[0] * t).astype(np.uint8)
    g = (center_color[1] * (1 - t) + edge_color[1] * t).astype(np.uint8)
    b = (center_color[2] * (1 - t) + edge_color[2] * t).astype(np.uint8)
    a = np.full_like(r, 255, dtype=np.uint8)
    return Image.fromarray(np.stack([r, g, b, a], axis=-1), "RGBA")


def silhouette_glow(img: Image.Image, radius: int) -> Image.Image:
    """Faint cream glow under the silhouette — depth on dark backgrounds
    without looking haloed."""
    alpha = img.split()[-1]
    glow = Image.new("RGBA", img.size, TRANSPARENT)
    glow.paste((250, 247, 242, 28), mask=alpha)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=radius))
    out = Image.new("RGBA", img.size, TRANSPARENT)
    out.alpha_composite(glow, (0, 0))
    out.alpha_composite(img, (0, 0))
    return out


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  -> {path.relative_to(ROOT)}  ({img.size[0]}x{img.size[1]})")


def generate() -> None:
    print("Generating CatMD 'Dark Clinical' icon set...")

    # 1. Launcher / store icon
    size = 1024
    bg = radial_gradient(size, SAGE_DEEP, SAGE_DARKEST, exponent=1.4)
    silhouette = Image.new("RGBA", (size, size), TRANSPARENT)
    draw_cat(silhouette, size / 2, size / 2, size * 0.62, CREAM)
    silhouette = silhouette_glow(silhouette, radius=18)
    icon = bg.copy()
    icon.alpha_composite(silhouette, (0, 0))
    save(icon, OUT / "icon.png")

    # 2. Splash icon — transparent background; Expo renders it on the
    # splash color configured in app.json (dark sage to match icon).
    splash = Image.new("RGBA", (512, 512), TRANSPARENT)
    draw_cat(splash, 256, 256, 512 * 0.68, CREAM)
    save(splash, OUT / "splash-icon.png")

    # 3. Android adaptive foreground (transparent, inside safe zone)
    fg = Image.new("RGBA", (1024, 1024), TRANSPARENT)
    draw_cat(fg, 512, 512, 1024 * 0.44, CREAM)
    save(fg, OUT / "android-icon-foreground.png")

    # 4. Android adaptive background — same gradient as the square icon
    adaptive_bg = radial_gradient(1024, SAGE_DEEP, SAGE_DARKEST, exponent=1.4)
    save(adaptive_bg, OUT / "android-icon-background.png")

    # 5. Monochrome — white on transparent, Android 13+ tints it
    mono = Image.new("RGBA", (1024, 1024), TRANSPARENT)
    draw_cat(mono, 512, 512, 1024 * 0.44, WHITE)
    save(mono, OUT / "android-icon-monochrome.png")

    # 6. Favicon — solid bg (gradient illegible at 48px)
    fav = Image.new("RGBA", (48, 48), SAGE_DEEP)
    draw_cat(fav, 24, 24, 48 * 0.72, CREAM)
    save(fav, OUT / "favicon.png")

    # 7. Wordmark composition for landing / header use
    wm_w, wm_h = 1600, 480
    wm = Image.new("RGBA", (wm_w, wm_h), CREAM)
    mark_size = 380
    mark = radial_gradient(mark_size, SAGE_DEEP, SAGE_DARKEST, exponent=1.4)
    mark_cat = Image.new("RGBA", (mark_size, mark_size), TRANSPARENT)
    draw_cat(mark_cat, mark_size / 2, mark_size / 2, mark_size * 0.62, CREAM)
    mark_cat = silhouette_glow(mark_cat, radius=8)
    mark.alpha_composite(mark_cat, (0, 0))
    mask = Image.new("L", (mark_size, mark_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, mark_size, mark_size], radius=int(mark_size * 0.22), fill=255
    )
    mark.putalpha(mask)
    wm.paste(mark, (180, (wm_h - mark_size) // 2), mark)
    save(wm, OUT / "catmd-wordmark.png")

    # Clean up demo leftovers
    for fn in (
        "partial-react-logo.png",
        "react-logo.png",
        "react-logo@2x.png",
        "react-logo@3x.png",
    ):
        p = OUT / fn
        if p.exists():
            p.unlink()
            print(f"  removed legacy {fn}")

    print("Done.")


if __name__ == "__main__":
    generate()
