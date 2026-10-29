"""``ImageRef`` builder (BE-006, TS-004 point 5): root-relative ``/media/...`` URLs, ``srcset`` from the stored
``variants`` (ascending width, empty for SVG) and the alt text of the usage (cover, gallery image, thumbnail,
portrait), never the media row's default alt."""

from __future__ import annotations

from typing import Any, Final

from app.models import MediaAsset
from app.schemas.images import ImageRef, ImageSource

MEDIA_URL_PREFIX: Final = "/media/"


def media_url(relative_path: str) -> str:
    return MEDIA_URL_PREFIX + relative_path.lstrip("/")


def _sources(variants: list[dict[str, Any]]) -> list[ImageSource]:
    sources = [
        ImageSource(width=int(variant["width"]), url=media_url(str(variant["path"])))
        for variant in variants
        if isinstance(variant, dict) and "width" in variant and "path" in variant
    ]
    return sorted(sources, key=lambda source: source.width)


def image_ref(media: MediaAsset | None, alt: str | None) -> ImageRef | None:
    if media is None:
        return None
    return ImageRef(
        url=media_url(media.path),
        alt=alt or "",
        width=media.width,
        height=media.height,
        mime="image/svg+xml" if media.mime == "image/svg+xml" else "image/webp",
        srcset=[] if media.mime == "image/svg+xml" else _sources(media.variants or []),
    )
