import io
import os
import sys
import shutil
from pathlib import Path

import pytest
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


def _remove_path(path: Path):
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


@pytest.fixture(autouse=True)
def isolated_runtime_state(monkeypatch):
    monkeypatch.setenv("INKY_SKIP_HARDWARE", "1")

    targets = [
        SRC_DIR / "config" / "device.json",
        SRC_DIR / "data",
        SRC_DIR / "static" / "images" / "current_image.png",
    ]
    for target in targets:
        if target.exists():
            _remove_path(target)

    yield

    for target in targets:
        if target.exists():
            _remove_path(target)


@pytest.fixture
def app():
    from app import create_app

    app = create_app()
    yield app
    app.extensions["playback_controller"].stop()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def sample_png_bytes():
    image = Image.new("RGB", (64, 48), color=(12, 34, 56))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()
