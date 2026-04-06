import hashlib
import io
import math
import mimetypes
import os
import uuid
import warnings
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from utils.timestamps import utcnow_iso


class AssetService:
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "avif", "heif", "heic"}
    MAX_UPLOAD_BYTES = 20 * 1024 * 1024
    MAX_IMAGE_PIXELS = 32_000_000

    def __init__(self, assets_repo, queue_repo, media_store, device_settings_service):
        self.assets_repo = assets_repo
        self.queue_repo = queue_repo
        self.media_store = media_store
        self.device_settings_service = device_settings_service

    def ingest_uploads(self, files, duplicate_policy="reject", auto_add_to_queue=False):
        created = []
        duplicates = []

        for file in files:
            filename = file.filename or ""
            extension = os.path.splitext(filename)[1].replace(".", "").lower()
            if not filename or extension not in self.ALLOWED_EXTENSIONS:
                raise ValueError(f"Unsupported file type for '{filename or 'upload'}'")

            payload = self._read_limited_upload(file)
            if not payload:
                raise ValueError(f"Uploaded file '{filename}' is empty")

            checksum = hashlib.sha256(payload).hexdigest()
            existing = self.assets_repo.get_asset_by_checksum(checksum)
            if existing:
                if duplicate_policy == "reject":
                    raise ValueError(f"Duplicate asset detected for '{filename}'")
                duplicates.append(
                    {
                        "filename_original": filename,
                        "existing_asset_id": existing["id"],
                        "action": "reuse_existing" if duplicate_policy == "reuse_existing" else "keep_both",
                    }
                )
                if duplicate_policy == "reuse_existing":
                    if auto_add_to_queue:
                        now = utcnow_iso()
                        self.queue_repo.append_item(
                            {
                                "id": uuid.uuid4().hex,
                                "asset_id": existing["id"],
                                "enabled": True,
                                "timeout_seconds_override": None,
                                "fit_mode": "cover",
                                "background_mode": "blur",
                                "background_color": None,
                                "created_at": now,
                                "updated_at": now,
                            }
                        )
                    created.append(existing)
                    continue

            asset_id = uuid.uuid4().hex
            image = self._load_image(filename, payload)
            stored_name = f"original.{extension}"
            buffer = io.BytesIO()
            save_format = image.format or extension.upper()
            if save_format == "JPG":
                save_format = "JPEG"
            if save_format in {"HEIC", "HEIF"}:
                save_format = "PNG"
                stored_name = "original.png"
            image.save(buffer, format=save_format)
            normalized_payload = buffer.getvalue()
            now = utcnow_iso()
            try:
                stored_name, _ = self.media_store.save_original_bytes(asset_id, stored_name, normalized_payload)
                asset = self.assets_repo.create_asset(
                    {
                        "id": asset_id,
                        "filename_original": filename,
                        "filename_stored": stored_name,
                        "mime_type": mimetypes.guess_type(filename)[0] or "application/octet-stream",
                        "extension": extension,
                        "checksum_sha256": checksum,
                        "width": image.size[0],
                        "height": image.size[1],
                        "file_size_bytes": len(normalized_payload),
                        "favorite": False,
                        "caption": None,
                        "source_type": "upload",
                        "created_at": now,
                        "updated_at": now,
                        "deleted_at": None,
                    }
                )
                self._create_thumbnail(asset_id, image.copy(), "thumbnail_sm", "sm.webp", 256)
                self._create_thumbnail(asset_id, image.copy(), "thumbnail_md", "md.webp", 768)

                if auto_add_to_queue:
                    self.queue_repo.append_item(
                        {
                            "id": uuid.uuid4().hex,
                            "asset_id": asset_id,
                            "enabled": True,
                            "timeout_seconds_override": None,
                            "fit_mode": "cover",
                            "background_mode": "blur",
                            "background_color": None,
                            "created_at": now,
                            "updated_at": now,
                        }
                    )
            except Exception:
                self.assets_repo.delete_asset(asset_id)
                self.media_store.delete_asset_files(asset_id)
                raise
            created.append(asset)

        return {"created": [self.serialize_asset(asset["id"]) for asset in created], "duplicates": duplicates}

    def _create_thumbnail(self, asset_id: str, image: Image.Image, kind: str, filename: str, max_dim: int):
        image.thumbnail((max_dim, max_dim))
        payload_buffer = io.BytesIO()
        image.save(payload_buffer, format="WEBP")
        path = self.media_store.save_variant_bytes(asset_id, filename, payload_buffer.getvalue())
        self.assets_repo.create_variant(
            {
                "id": uuid.uuid4().hex,
                "asset_id": asset_id,
                "kind": kind,
                "path": str(path),
                "width": image.size[0],
                "height": image.size[1],
                "created_at": utcnow_iso(),
            }
        )

    def list_assets(self, q=None, sort="uploaded_newest", favorite=None, limit=50, cursor=0):
        items, next_cursor = self.assets_repo.list_assets(q=q, sort=sort, favorite=favorite, limit=limit, cursor=cursor)
        return {"items": [self.serialize_asset(item["id"]) for item in items], "next_cursor": next_cursor}

    def serialize_asset(self, asset_id: str):
        asset = self.assets_repo.get_asset(asset_id)
        if not asset:
            return None
        variants = self.assets_repo.list_variants(asset_id)
        thumbnails = {variant["kind"]: variant for variant in variants}
        crop_profile = self.assets_repo.get_crop_profile(asset_id)
        return {
            "id": asset["id"],
            "filename_original": asset["filename_original"],
            "mime_type": asset["mime_type"],
            "extension": asset["extension"],
            "width": asset["width"],
            "height": asset["height"],
            "file_size_bytes": asset["file_size_bytes"],
            "favorite": bool(asset["favorite"]),
            "caption": asset["caption"],
            "created_at": asset["created_at"],
            "updated_at": asset["updated_at"],
            "thumbnail_url": f"/api/assets/{asset_id}/thumbnail?size=sm" if "thumbnail_sm" in thumbnails else None,
            "thumbnail_url_md": f"/api/assets/{asset_id}/thumbnail?size=md" if "thumbnail_md" in thumbnails else None,
            "original_url": f"/api/assets/{asset_id}/file",
            "thumbnail_urls": {
                "sm": f"/api/assets/{asset_id}/thumbnail?size=sm" if "thumbnail_sm" in thumbnails else None,
                "md": f"/api/assets/{asset_id}/thumbnail?size=md" if "thumbnail_md" in thumbnails else None,
            },
            "file_url": f"/api/assets/{asset_id}/file",
            "crop_profile": self._serialize_crop_profile(crop_profile),
        }

    def update_asset(self, asset_id: str, updates: dict):
        safe_updates = {}
        if "caption" in updates:
            safe_updates["caption"] = updates["caption"]
        if "favorite" in updates:
            safe_updates["favorite"] = int(bool(updates["favorite"]))
        safe_updates["updated_at"] = utcnow_iso()
        asset = self.assets_repo.update_asset(asset_id, safe_updates)
        if not asset:
            return None
        return self.serialize_asset(asset_id)

    def delete_assets(self, asset_ids: list[str]):
        for asset_id in asset_ids:
            self.queue_repo.clear_asset_references(asset_id)
            self.assets_repo.delete_asset(asset_id)
            self.media_store.delete_asset_files(asset_id)

    def get_original_path(self, asset_id: str) -> Path | None:
        asset = self.assets_repo.get_asset(asset_id)
        if not asset:
            return None
        return self.media_store.original_path(asset_id, asset["filename_stored"])

    def get_thumbnail_path(self, asset_id: str, size: str) -> Path | None:
        kind = {"sm": "thumbnail_sm", "md": "thumbnail_md"}.get(size)
        if not kind:
            return None
        variant = self.assets_repo.get_variant(asset_id, kind)
        if not variant:
            return None
        return Path(variant["path"])

    def get_crop_profile(self, asset_id: str):
        if not self.assets_repo.get_asset(asset_id):
            return None
        return self._serialize_crop_profile(self.assets_repo.get_crop_profile(asset_id))

    def update_crop_profile(self, asset_id: str, crop_profile: dict):
        asset = self.assets_repo.get_asset(asset_id)
        if not asset:
            return None

        normalized = self._normalize_crop_profile(asset, crop_profile)
        saved = self.assets_repo.upsert_crop_profile(
            {
                "asset_id": asset_id,
                "crop_x": normalized["x"],
                "crop_y": normalized["y"],
                "crop_width": normalized["width"],
                "crop_height": normalized["height"],
                "updated_at": utcnow_iso(),
            }
        )
        self.assets_repo.update_asset(asset_id, {"updated_at": utcnow_iso()})
        return self._serialize_crop_profile(saved)

    def delete_crop_profile(self, asset_id: str):
        asset = self.assets_repo.get_asset(asset_id)
        if not asset:
            return None
        deleted = self.assets_repo.delete_crop_profile(asset_id)
        if deleted:
            self.assets_repo.update_asset(asset_id, {"updated_at": utcnow_iso()})
        return deleted

    def _read_limited_upload(self, file) -> bytes:
        max_bytes = self.MAX_UPLOAD_BYTES
        chunks = []
        total = 0

        while True:
            chunk = file.stream.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise ValueError(f"Uploaded file '{file.filename or 'upload'}' exceeds the {max_bytes // (1024 * 1024)} MB limit")
            chunks.append(chunk)

        return b"".join(chunks)

    def _load_image(self, filename: str, payload: bytes) -> Image.Image:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(io.BytesIO(payload))
                width, height = image.size
                if width * height > self.MAX_IMAGE_PIXELS:
                    raise ValueError(
                        f"Uploaded image '{filename}' exceeds the {self.MAX_IMAGE_PIXELS // 1_000_000} megapixel limit"
                    )
                image.load()
                image = ImageOps.exif_transpose(image)
                return image
        except ValueError:
            raise
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError(f"Uploaded file '{filename}' is not a supported image") from exc

    def _serialize_crop_profile(self, crop_profile: dict | None):
        if not crop_profile:
            return None
        return {
            "x": float(crop_profile["crop_x"]),
            "y": float(crop_profile["crop_y"]),
            "width": float(crop_profile["crop_width"]),
            "height": float(crop_profile["crop_height"]),
            "updated_at": crop_profile["updated_at"],
        }

    def _normalize_crop_profile(self, asset: dict, crop_profile: dict):
        required = {"x", "y", "width", "height"}
        missing = required - set(crop_profile.keys())
        if missing:
            missing_fields = ", ".join(sorted(missing))
            raise ValueError(f"Crop profile is missing fields: {missing_fields}")

        try:
            x = float(crop_profile["x"])
            y = float(crop_profile["y"])
            width = float(crop_profile["width"])
            height = float(crop_profile["height"])
        except (TypeError, ValueError) as exc:
            raise ValueError("Crop profile values must be numeric") from exc

        if width <= 0 or height <= 0:
            raise ValueError("Crop width and height must be positive")
        if x < 0 or y < 0:
            raise ValueError("Crop origin must be within the image bounds")
        if x + width > 1.0 + 1e-6 or y + height > 1.0 + 1e-6:
            raise ValueError("Crop profile must stay within the image bounds")

        min_crop_size = 0.05
        if width < min_crop_size or height < min_crop_size:
            raise ValueError("Crop area is too small")

        target_width, target_height = self.device_settings_service.get_resolution()
        orientation = self.device_settings_service.get_setting("orientation", "horizontal")
        if orientation == "vertical":
            target_width, target_height = target_height, target_width
        target_aspect = target_width / target_height
        image_width = float(asset["width"])
        image_height = float(asset["height"])
        crop_aspect = (width * image_width) / (height * image_height)
        if not math.isclose(crop_aspect, target_aspect, rel_tol=0.02, abs_tol=0.02):
            raise ValueError("Crop profile must match the device aspect ratio")

        return {
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        }
