from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "icons"
SIZE = 1024


def hex_color(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    if len(value) == 6:
        value += "ff"
    return tuple(int(value[index:index + 2], 16) for index in range(0, 8, 2))


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def blend(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    return tuple(lerp(a[index], b[index], t) for index in range(4))


def vertical_gradient(size: int, top: str, bottom: str) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    start = hex_color(top)
    end = hex_color(bottom)
    for y in range(size):
        color = blend(start, end, y / max(size - 1, 1))
        for x in range(size):
            pixels[x, y] = color
    return image


def draw_landscape_scene(size: int) -> Image.Image:
    scene = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(scene)

    sky_top = hex_color("#67B3FF")
    sky_bottom = hex_color("#E3F2FF")
    for y in range(size):
        color = blend(sky_top, sky_bottom, y / max(size - 1, 1))
        draw.line((0, y, size, y), fill=color)

    clouds = [
        (int(size * 0.10), int(size * 0.13), int(size * 0.34), int(size * 0.22)),
        (int(size * 0.58), int(size * 0.10), int(size * 0.87), int(size * 0.20)),
    ]
    for left, top, right, bottom in clouds:
        draw.rounded_rectangle((left, top, right, bottom), radius=int(size * 0.05), fill=hex_color("#F8FCFF"))
        draw.rounded_rectangle(
            (left + int(size * 0.03), top - int(size * 0.02), right - int(size * 0.04), bottom - int(size * 0.01)),
            radius=int(size * 0.04),
            fill=hex_color("#FFFFFF"),
        )

    draw.polygon(
        [
            (int(size * 0.10), int(size * 0.52)),
            (int(size * 0.48), int(size * 0.14)),
            (int(size * 0.72), int(size * 0.52)),
        ],
        fill=hex_color("#7E8EAF"),
    )
    draw.polygon(
        [
            (int(size * 0.34), int(size * 0.52)),
            (int(size * 0.57), int(size * 0.14)),
            (int(size * 0.90), int(size * 0.52)),
        ],
        fill=hex_color("#98A6C3"),
    )
    draw.polygon(
        [
            (int(size * 0.41), int(size * 0.19)),
            (int(size * 0.50), int(size * 0.12)),
            (int(size * 0.60), int(size * 0.28)),
            (int(size * 0.53), int(size * 0.31)),
            (int(size * 0.47), int(size * 0.27)),
        ],
        fill=hex_color("#FFFFFF"),
    )

    tree_color = hex_color("#152C11")
    mid_tree_color = hex_color("#244719")
    for x in range(0, size, max(18, size // 24)):
        height = int(size * (0.10 + (x % 7) * 0.015))
        base_y = int(size * 0.56)
        draw.polygon(
            [
                (x, base_y),
                (x + int(size * 0.04), base_y - height),
                (x + int(size * 0.08), base_y),
            ],
            fill=tree_color if x % 2 == 0 else mid_tree_color,
        )

    lake_top = int(size * 0.58)
    lake_bottom = size
    lake_start = hex_color("#2B4A54")
    lake_end = hex_color("#121923")
    for y in range(lake_top, lake_bottom):
        t = (y - lake_top) / max(lake_bottom - lake_top, 1)
        draw.line((0, y, size, y), fill=blend(lake_start, lake_end, t))

    for offset in range(0, size, max(14, size // 28)):
        y = lake_top + int((offset / size) * (lake_bottom - lake_top))
        draw.line(
            (
                int(size * 0.04),
                y,
                int(size * 0.92),
                y + int(size * 0.01),
            ),
            fill=hex_color("#E9F5FF80"),
            width=max(2, size // 160),
        )

    rock_fill = hex_color("#D1BE8D")
    rock_shadow = hex_color("#5C4D38")
    rocks = [
        (int(size * 0.02), int(size * 0.80), int(size * 0.17), int(size * 0.93)),
        (int(size * 0.14), int(size * 0.87), int(size * 0.28), size + int(size * 0.02)),
        (int(size * 0.58), int(size * 0.78), int(size * 0.76), int(size * 0.90)),
        (int(size * 0.72), int(size * 0.82), size + int(size * 0.03), int(size * 0.96)),
    ]
    for rock in rocks:
        draw.ellipse(rock, fill=rock_fill)
        draw.arc(rock, 210, 335, fill=rock_shadow, width=max(3, size // 180))

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rectangle((0, int(size * 0.54), size, size), fill=(0, 0, 0, 26))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size // 50))
    scene.alpha_composite(shadow)
    return scene


def create_icon() -> Image.Image:
    canvas = vertical_gradient(SIZE, "#7D7D7E", "#232B33")
    vignette = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.ellipse(
        (int(SIZE * 0.05), int(SIZE * 0.04), int(SIZE * 0.95), int(SIZE * 0.94)),
        fill=(32, 46, 65, 120),
    )
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=SIZE // 7))
    canvas.alpha_composite(vignette)

    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    outer_bounds = (int(SIZE * 0.14), int(SIZE * 0.16), int(SIZE * 0.86), int(SIZE * 0.82))
    shadow_draw.rounded_rectangle(outer_bounds, radius=int(SIZE * 0.11), fill=(11, 18, 30, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=SIZE // 18))
    canvas.alpha_composite(shadow)

    panel = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(outer_bounds, radius=int(SIZE * 0.10), fill=hex_color("#1B2837"))

    inner_bounds = (
        outer_bounds[0] + int(SIZE * 0.015),
        outer_bounds[1] + int(SIZE * 0.02),
        outer_bounds[2] - int(SIZE * 0.015),
        outer_bounds[3] - int(SIZE * 0.02),
    )
    inner_radius = int(SIZE * 0.09)

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(inner_bounds, radius=inner_radius, fill=255)

    scene = draw_landscape_scene(inner_bounds[2] - inner_bounds[0])
    mirrored = scene.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    gutter = max(8, SIZE // 85)
    split_scene = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    split_scene.alpha_composite(scene.crop((0, 0, scene.width // 2 - gutter, scene.height)), (0, 0))
    split_scene.alpha_composite(
        mirrored.crop((mirrored.width // 2 + gutter, 0, mirrored.width, mirrored.height)),
        (scene.width // 2 + gutter, 0),
    )
    guide = Image.new("RGBA", split_scene.size, (0, 0, 0, 0))
    guide_draw = ImageDraw.Draw(guide)
    center = split_scene.width // 2
    guide_draw.rectangle((center - gutter, 0, center + gutter, split_scene.height), fill=hex_color("#F4F7FB"))
    split_scene.alpha_composite(guide)

    scene_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    scene_layer.alpha_composite(split_scene, inner_bounds[:2])
    clipped_scene = Image.composite(scene_layer, Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), mask)

    panel.alpha_composite(clipped_scene)

    border = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        outer_bounds,
        radius=int(SIZE * 0.10),
        outline=hex_color("#0D1522"),
        width=max(6, SIZE // 150),
    )
    canvas.alpha_composite(panel)
    canvas.alpha_composite(border)
    return canvas


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
    write_icon_variants(create_icon())
