"""Image metadata extraction and background-removal operations."""

from __future__ import annotations

import logging
import os
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[2] / "models"
_MODEL_FILENAME = "u2net.onnx"
_session: Any = None


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

        return remove(content, session=_get_rembg_session())
    except ValueError:
        raise
    except Exception as exc:
        logger.error("Background removal failed", exc_info=True)
        raise ValueError(f"Background removal failed: {exc}") from exc


def _get_rembg_session() -> Any:
    """Load a cached rembg session from the local onnx file (no network)."""

    global _session
    if _session is not None:
        return _session
    model_path = _resolve_model_path()
    os.environ.setdefault("U2NET_HOME", str(model_path.parent))
    os.environ.setdefault("MODEL_CHECKSUM_DISABLED", "1")
    _session = _build_local_u2net_session(model_path)
    return _session


def _build_local_u2net_session(model_path: Path) -> Any:
    """Build a u2net rembg session that never downloads from GitHub.

    Args:
        model_path: Absolute path to an existing u2net.onnx file.

    Returns:
        A rembg session ready for remove().
    """

    import onnxruntime as ort
    from rembg.sessions.u2net import U2netSession

    class LocalU2netSession(U2netSession):
        """u2net session bound to a pre-downloaded onnx file."""

        @classmethod
        def download_models(cls, *args: Any, **kwargs: Any) -> str:
            return str(model_path)

    return LocalU2netSession("u2net", ort.SessionOptions())


def _resolve_model_path() -> Path:
    """Return the on-disk u2net model path, or raise a clear setup error."""

    candidates = [
        Path(os.environ["U2NET_HOME"]) / _MODEL_FILENAME if os.environ.get("U2NET_HOME") else None,
        _DEFAULT_MODEL_DIR / _MODEL_FILENAME,
        Path.home() / ".u2net" / _MODEL_FILENAME,
    ]
    for candidate in candidates:
        if candidate and candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    raise ValueError(
        "Background removal model is missing. Place u2net.onnx in "
        f"{_DEFAULT_MODEL_DIR} before using Remove background."
    )
