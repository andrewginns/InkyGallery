import uuid

from PIL import ImageColor

from utils.timestamps import utcnow_iso


class QueueService:
    VALID_FIT_MODES = {"cover", "contain"}
    VALID_BACKGROUND_MODES = {"blur", "solid", "none"}

    def __init__(self, queue_repo, assets_repo):
        self.queue_repo = queue_repo
        self.assets_repo = assets_repo

    def list_queue(self):
        items = self.queue_repo.list_items()
        return {"items": [self._serialize_queue_item(item) for item in items]}

    def add_assets(self, asset_ids: list[str], initial_settings: dict | None = None):
        normalized_settings = self._normalize_queue_updates(initial_settings or {}, partial=False)
        created = []
        now = utcnow_iso()
        for asset_id in asset_ids:
            if not self.assets_repo.get_asset(asset_id):
                raise ValueError(f"Asset '{asset_id}' does not exist")
            created_item = self.queue_repo.append_item(
                {
                    "id": uuid.uuid4().hex,
                    "asset_id": asset_id,
                    **normalized_settings,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            created.append(self._serialize_queue_item(created_item))
        return {"items": created}

    def insert_asset(self, asset_id: str, position: int, initial_settings: dict | None = None):
        if not self.assets_repo.get_asset(asset_id):
            raise ValueError(f"Asset '{asset_id}' does not exist")

        normalized_settings = self._normalize_queue_updates(initial_settings or {}, partial=False)
        now = utcnow_iso()
        created_item = self.queue_repo.insert_item_at(
            position,
            {
                "id": uuid.uuid4().hex,
                "asset_id": asset_id,
                **normalized_settings,
                "created_at": now,
                "updated_at": now,
            },
        )
        return self._serialize_queue_item(created_item)

    def update_item(self, queue_item_id: str, updates: dict):
        normalized = self._normalize_queue_updates(updates, partial=True)
        normalized["updated_at"] = utcnow_iso()
        item = self.queue_repo.update_item(queue_item_id, normalized)
        if not item:
            return None
        return self._serialize_queue_item(item)

    def delete_item(self, queue_item_id: str):
        return self.queue_repo.delete_item(queue_item_id)

    def reorder(self, ordered_ids: list[str]):
        self.queue_repo.reorder(ordered_ids)
        return self.list_queue()

    def sort(self, sort_mode: str):
        current_items = self.queue_repo.list_items()
        if sort_mode == "manual":
            return self.list_queue()
        if sort_mode == "name_asc":
            ordered = sorted(current_items, key=lambda item: item["filename_original"].lower())
        elif sort_mode == "name_desc":
            ordered = sorted(current_items, key=lambda item: item["filename_original"].lower(), reverse=True)
        elif sort_mode == "uploaded_oldest":
            ordered = sorted(current_items, key=lambda item: item["asset_created_at"])
        elif sort_mode == "uploaded_newest":
            ordered = sorted(current_items, key=lambda item: item["asset_created_at"], reverse=True)
        else:
            raise ValueError("Unsupported sort mode")
        self.queue_repo.reorder([item["id"] for item in ordered])
        return self.list_queue()

    def _serialize_queue_item(self, item: dict):
        return {
            "id": item["id"],
            "asset_id": item["asset_id"],
            "position": item["position"],
            "enabled": bool(item["enabled"]),
            "timeout_seconds_override": item["timeout_seconds_override"],
            "fit_mode": item["fit_mode"],
            "background_mode": item["background_mode"],
            "background_color": item["background_color"],
            "asset": {
                "id": item["asset_id"],
                "filename_original": item["filename_original"],
                "thumbnail_url": f"/api/assets/{item['asset_id']}/thumbnail?size=sm",
                "original_url": f"/api/assets/{item['asset_id']}/file",
            },
        }

    def _normalize_queue_updates(self, updates: dict, partial: bool) -> dict:
        normalized = {}

        if not partial:
            normalized.update(
                {
                    "enabled": True,
                    "timeout_seconds_override": None,
                    "fit_mode": "cover",
                    "background_mode": "blur",
                    "background_color": None,
                }
            )

        allowed_keys = {
            "enabled",
            "timeout_seconds_override",
            "fit_mode",
            "background_mode",
            "background_color",
        }
        unknown_keys = set(updates.keys()) - allowed_keys
        if unknown_keys:
            unknown = ", ".join(sorted(unknown_keys))
            raise ValueError(f"Unsupported queue item fields: {unknown}")

        if "enabled" in updates:
            normalized["enabled"] = int(bool(updates["enabled"]))

        if "timeout_seconds_override" in updates:
            timeout_value = updates["timeout_seconds_override"]
            if timeout_value is not None and int(timeout_value) <= 0:
                raise ValueError("timeout_seconds_override must be null or a positive integer")
            normalized["timeout_seconds_override"] = None if timeout_value is None else int(timeout_value)

        if "fit_mode" in updates:
            if updates["fit_mode"] not in self.VALID_FIT_MODES:
                raise ValueError("fit_mode must be one of: cover, contain")
            normalized["fit_mode"] = updates["fit_mode"]

        if "background_mode" in updates:
            if updates["background_mode"] not in self.VALID_BACKGROUND_MODES:
                raise ValueError("background_mode must be one of: blur, solid, none")
            normalized["background_mode"] = updates["background_mode"]

        if "background_color" in updates:
            background_color = updates["background_color"]
            if background_color is not None:
                try:
                    ImageColor.getcolor(background_color, "RGB")
                except ValueError as exc:
                    raise ValueError("background_color must be a valid CSS-style color value") from exc
            normalized["background_color"] = background_color

        background_mode = normalized.get("background_mode")
        if background_mode == "solid" and normalized.get("background_color") is None:
            normalized["background_color"] = "#ffffff"

        return normalized
