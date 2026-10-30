"""Raster processing (TS-011 step 3, SEC-BE-010): decode, verify, pixel cap, EXIF transpose, WebP variants.

``Image.open`` + ``verify()``, then reopen; more than 40 megapixels (``Image.MAX_IMAGE_PIXELS``, with
``DecompressionBombWarning`` turned into an error) or anything Pillow cannot decode → 422 ``invalid_image``. Only the
first frame is used (animated input becomes a still), ``ImageOps.exif_transpose`` applies the orientation, and the
pixels are copied into a fresh image so no EXIF/ICC/XMP metadata reaches the WebP output. Variants are produced at
480, 960 and 1600 px wide, never upscaled (the original width replaces larger targets). The original is not kept.
Pure blocking work: callers run it in the threadpool.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import InvalidImageError

MAX_PIXELS: Final = 40_000_000
VARIANT_WIDTHS: Final = (480, 960, 1600)
WEBP_QUALITY: Final = 80
INVALID_IMAGE_MESSAGE: Final = "The image could not be read. Upload a different file."
TOO_MANY_PIXELS_MESSAGE: Final = "The image is larger than 40 megapixels."

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@dataclass(frozen=True, slots=True)
class Variant:
    width: int
    height: int
    path: Path
    bytes: int


def variant_widths(original_width: int) -> list[int]:
    """Target widths without upscaling: ``[480, 960, 1600]`` capped at the original width, de-duplicated."""
    widths: list[int] = []
    for target in VARIANT_WIDTHS:
        width = min(target, original_width)
        if width not in widths:
            widths.append(width)
    return widths


def _decode(source: Path) -> Image.Image:
    with Image.open(source) as probe:
        probe.verify()
    image = Image.open(source)
    try:
        if image.width * image.height > MAX_PIXELS:
            raise InvalidImageError(TOO_MANY_PIXELS_MESSAGE)
        image.seek(0)  # first frame of an animated image
        image.load()
        transposed = ImageOps.exif_transpose(image)
        mode = "RGBA" if _has_alpha(transposed) else "RGB"
        converted = transposed.convert(mode)
    finally:
        image.close()
    clean = Image.new(mode, converted.size)
    clean.paste(converted)
    return clean


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in {"RGBA", "LA", "PA"} or (image.mode == "P" and "transparency" in image.info)


def decode_image(source: Path) -> Image.Image:
    """Decoded, oriented, metadata-free first frame; ``InvalidImageError`` for anything unreadable or too large."""
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            return _decode(source)
        except InvalidImageError:
            raise
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            ValueError,
            EOFError,
        ):
            raise InvalidImageError(INVALID_IMAGE_MESSAGE) from None


def write_variants(image: Image.Image, target_dir: Path, stem: str) -> list[Variant]:
    """Write ``<stem>-<width>.webp`` files; on failure the files written so far are removed before re-raising."""
    written: list[Variant] = []
    try:
        for width in variant_widths(image.width):
            height = max(1, round(image.height * width / image.width))
            resized = image if width == image.width else image.resize((width, height), Image.Resampling.LANCZOS)
            path = target_dir / f"{stem}-{width}.webp"
            resized.save(path, format="WEBP", quality=WEBP_QUALITY, method=4)
            written.append(Variant(width=width, height=height, path=path, bytes=path.stat().st_size))
    except BaseException:
        for variant in written:
            variant.path.unlink(missing_ok=True)
        raise
    return written
