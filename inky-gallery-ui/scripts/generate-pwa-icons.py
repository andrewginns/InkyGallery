from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
SOURCE_ICON = PROJECT_ROOT / "src" / "static" / "images" / "InkyGallery_icon.png"
OUTPUT_DIR = ROOT / "public" / "icons"


def load_source_icon() -> Image.Image:
    if not SOURCE_ICON.exists():
        raise FileNotFoundError(f"Source icon not found: {SOURCE_ICON}")
    image = Image.open(SOURCE_ICON).convert("RGBA")
    if image.width != image.height:
        raise ValueError(f"Source icon must be square, got {image.width}x{image.height}")
    return image


def write_icon_variants(image: Image.Image):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sizes = {
        "icon-32.png": 32,
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
    }

    for filename, size in sizes.items():
        resized = image.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(OUTPUT_DIR / filename)

    image.resize((64, 64), Image.Resampling.LANCZOS).save(
        OUTPUT_DIR / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )


if __name__ == "__main__":
    write_icon_variants(load_source_icon())
