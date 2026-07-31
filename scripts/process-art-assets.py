#!/usr/bin/env python3
"""Build browser-ready Ze Tour assets from the generated source artwork."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source"
ALPHA_SOURCE = SOURCE / "alpha"
OUTPUT = ROOT / "public" / "assets" / "art"
RESAMPLE = Image.Resampling.LANCZOS


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Asset is fully transparent")
    return bbox


def fit_transparent(
    image: Image.Image,
    size: tuple[int, int],
    padding: int,
    bottom_padding: int | None = None,
) -> Image.Image:
    cropped = image.crop(alpha_bbox(image))
    available_width = size[0] - padding * 2
    available_height = size[1] - padding - (bottom_padding or padding)
    scale = min(
        available_width / cropped.width,
        available_height / cropped.height,
    )
    resized = cropped.resize(
        (
            max(1, round(cropped.width * scale)),
            max(1, round(cropped.height * scale)),
        ),
        RESAMPLE,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = size[1] - (bottom_padding or padding) - resized.height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def fit_transparent_frames(
    images: list[Image.Image],
    size: tuple[int, int],
    padding: int,
    bottom_padding: int,
) -> list[Image.Image]:
    """Fit animation frames with one shared scale and ground baseline."""
    cropped_frames = [image.crop(alpha_bbox(image)) for image in images]
    available_width = size[0] - padding * 2
    available_height = size[1] - padding - bottom_padding
    scale = min(
        min(
            available_width / frame.width,
            available_height / frame.height,
        )
        for frame in cropped_frames
    )

    processed: list[Image.Image] = []
    for frame in cropped_frames:
        resized = frame.resize(
            (
                max(1, round(frame.width * scale)),
                max(1, round(frame.height * scale)),
            ),
            RESAMPLE,
        )
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        x = (size[0] - resized.width) // 2
        y = size[1] - bottom_padding - resized.height
        canvas.alpha_composite(resized, (x, y))
        processed.append(canvas)
    return processed


def build_two_frame_sheet(
    name: str,
    frame_prefix: str,
    frame_size: tuple[int, int],
    padding: int,
    bottom_padding: int,
) -> None:
    source = Image.open(ALPHA_SOURCE / f"{name}-alpha.png").convert("RGBA")
    midpoint = source.width // 2
    frames = [
        source.crop((0, 0, midpoint, source.height)),
        source.crop((midpoint, 0, source.width, source.height)),
    ]
    processed = fit_transparent_frames(
        frames,
        frame_size,
        padding,
        bottom_padding,
    )
    sheet = Image.new(
        "RGBA",
        (frame_size[0] * len(processed), frame_size[1]),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(processed):
        sheet.alpha_composite(frame, (index * frame_size[0], 0))
        frame.save(
            OUTPUT / f"{frame_prefix}-{'a' if index == 0 else 'b'}.png",
            optimize=True,
        )
    sheet.save(OUTPUT / f"{name}.png", optimize=True)


def build_single(
    name: str,
    size: tuple[int, int],
    padding: int,
    bottom_padding: int | None = None,
) -> None:
    source = Image.open(ALPHA_SOURCE / f"{name}-alpha.png").convert("RGBA")
    processed = fit_transparent(source, size, padding, bottom_padding)
    processed.save(OUTPUT / f"{name}.png", optimize=True)


def build_panorama(stage: int) -> None:
    source = Image.open(SOURCE / f"stage-{stage}.png").convert("RGB")
    half = ImageOps.fit(
        source,
        (1024, 512),
        method=RESAMPLE,
        centering=(0.5, 0.5),
    )
    panorama = Image.new("RGB", (2048, 512))
    panorama.paste(half, (0, 0))
    panorama.paste(ImageOps.mirror(half), (1024, 0))
    panorama.save(OUTPUT / f"stage-{stage}.jpg", quality=88, optimize=True)

    verge_half = ImageOps.fit(
        source,
        (1024, 192),
        method=RESAMPLE,
        centering=(0.5, 0.88),
    )
    verge = Image.new("RGB", (2048, 192))
    verge.paste(verge_half, (0, 0))
    verge.paste(ImageOps.mirror(verge_half), (1024, 0))
    verge.save(OUTPUT / f"verge-{stage}.jpg", quality=88, optimize=True)


def build_texture(name: str) -> None:
    source = Image.open(SOURCE / f"{name}.png").convert("RGB")
    texture = ImageOps.fit(source, (512, 512), method=RESAMPLE)
    texture.save(OUTPUT / f"{name}.jpg", quality=86, optimize=True)


def build_horizontal_strip(
    name: str,
    height: int,
    crop_white_border: bool = False,
    trim_top_fraction: float = 0,
) -> None:
    source = Image.open(SOURCE / f"{name}.png").convert("RGB")
    if crop_white_border:
        grayscale = ImageOps.grayscale(source)
        content_mask = grayscale.point(lambda value: 255 if value < 245 else 0)
        content_bbox = content_mask.getbbox()
        if content_bbox is None:
            raise ValueError(f"{name} contains no non-white artwork")
        source = source.crop(content_bbox)
    if trim_top_fraction > 0:
        top = round(source.height * trim_top_fraction)
        source = source.crop((0, top, source.width, source.height))

    half = ImageOps.fit(
        source,
        (1024, height),
        method=RESAMPLE,
        centering=(0.5, 0.5),
    )
    strip = Image.new("RGB", (2048, height))
    strip.paste(half, (0, 0))
    strip.paste(ImageOps.mirror(half), (1024, 0))
    strip.save(OUTPUT / f"{name}.jpg", quality=90, optimize=True)


def build_alpha_horizontal_strip(
    source_name: str,
    output_name: str,
    size: tuple[int, int],
) -> None:
    source = Image.open(SOURCE / f"{source_name}.png").convert("RGBA")
    cropped = source.crop(alpha_bbox(source))
    strip = ImageOps.fit(cropped, size, method=RESAMPLE, centering=(0.5, 1))
    strip.save(OUTPUT / f"{output_name}.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    rider_sheets = {
        "player-sheet": "rider",
        "draft-rider-sheet": "draft-rider",
        "domestique-sheet": "domestique-rider",
    }
    for sheet_name, frame_prefix in rider_sheets.items():
        build_two_frame_sheet(sheet_name, frame_prefix, (256, 192), 8, 6)
    fan_sheets = {
        "fan-sheet": "fan-1",
        "fan-woman-sheet": "fan-2",
        "fan-older-sheet": "fan-3",
        "fan-young-sheet": "fan-4",
    }
    for sheet_name, frame_prefix in fan_sheets.items():
        build_two_frame_sheet(sheet_name, frame_prefix, (160, 208), 8, 6)

    bike_fan_sheets = {
        "fan-cyclist-woman-sheet": "fan-5",
        "fan-cyclist-older-sheet": "fan-6",
    }
    for sheet_name, frame_prefix in bike_fan_sheets.items():
        build_two_frame_sheet(sheet_name, frame_prefix, (256, 208), 8, 6)

    extra_fan_sheets = {
        "fan-rocker-sheet": "fan-7",
        "fan-photographer-sheet": "fan-8",
    }
    for sheet_name, frame_prefix in extra_fan_sheets.items():
        build_two_frame_sheet(sheet_name, frame_prefix, (160, 208), 8, 6)

    # Keep the original keys while the runtime and tests transition to variants.
    build_two_frame_sheet("fan-sheet", "fan", (160, 208), 8, 6)

    for pickup in (
        "bag-sweat",
        "bag-cash",
        "power-super-draft",
        "power-lucky-bidon",
        "power-jump",
    ):
        build_single(pickup, (128, 128), 6)
    build_single("pothole", (192, 80), 4, 4)
    for vehicle in (
        "oncoming-car-red-profile",
        "oncoming-van-cream-profile",
    ):
        build_single(vehicle, (512, 256), 8, 5)

    for stage in range(1, 6):
        build_panorama(stage)
    build_alpha_horizontal_strip(
        "roadside-upper-low",
        "roadside-upper",
        (2048, 68),
    )
    build_horizontal_strip("roadside-lower", 256)
    build_texture("road-texture")
    build_texture("paper-texture")


if __name__ == "__main__":
    main()
