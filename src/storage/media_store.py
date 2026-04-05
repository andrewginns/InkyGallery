import shutil
from pathlib import Path
from werkzeug.utils import secure_filename


class MediaStore:
    def __init__(self, data_dir: Path, current_image_path: Path):
        self.data_dir = Path(data_dir)
        self.media_dir = self.data_dir / "media"
        self.originals_dir = self.media_dir / "originals"
        self.thumbnails_dir = self.media_dir / "thumbnails"
        self.current_image_path = Path(current_image_path)
        self.ensure_directories()

    def ensure_directories(self):
        for path in (
            self.originals_dir,
            self.thumbnails_dir,
            self.current_image_path.parent,
        ):
            path.mkdir(parents=True, exist_ok=True)

    def original_dir(self, asset_id: str) -> Path:
        return self.originals_dir / asset_id

    def thumbnails_dir_for_asset(self, asset_id: str) -> Path:
        return self.thumbnails_dir / asset_id

    def original_path(self, asset_id: str, stored_name: str) -> Path:
        return self.original_dir(asset_id) / stored_name

    def variant_path(self, asset_id: str, filename: str) -> Path:
        return self.thumbnails_dir_for_asset(asset_id) / filename

    def save_original_bytes(self, asset_id: str, filename: str, payload: bytes) -> tuple[str, Path]:
        safe_name = secure_filename(filename) or "upload"
        directory = self.original_dir(asset_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / safe_name
        path.write_bytes(payload)
        return safe_name, path

    def save_variant_bytes(self, asset_id: str, filename: str, payload: bytes) -> Path:
        directory = self.thumbnails_dir_for_asset(asset_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / filename
        path.write_bytes(payload)
        return path

    def delete_asset_files(self, asset_id: str):
        shutil.rmtree(self.original_dir(asset_id), ignore_errors=True)
        shutil.rmtree(self.thumbnails_dir_for_asset(asset_id), ignore_errors=True)
