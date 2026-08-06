"""Image metadata extraction and background-removal operations."""

from __future__ import annotations

from io import BytesIO

from PIL import Image, UnidentifiedImageError


def extract_dimensions(content: bytes) -> tuple[int, int]:
    """Return validated image width and height.

    Raises:
        ValueError: If the supplied content is not a valid image.
    """

    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
        with Image.open(BytesIO(content)) as image:
            return image.width, image.height
    except UnidentifiedImageError as exc:
        raise ValueError("Uploaded file is not a valid image") from exc


def remove_background(content: bytes) -> bytes:
    """Remove an image background and return a PNG derivative.

    Raises:
        ValueError: If the removal model cannot process the source.
    """

    try:
        from rembg import remove

        return remove(content)
    except Exception as exc:
        raise ValueError("Background removal failed") from exc
