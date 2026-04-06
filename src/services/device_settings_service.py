import json
from copy import deepcopy
from pathlib import Path

from config.device_defaults import DEFAULT_DEVICE_SETTINGS


def _merge_defaults(current: dict, defaults: dict) -> dict:
    merged = deepcopy(defaults)
    for key, value in current.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_defaults(value, merged[key])
        else:
            merged[key] = value
    return merged


class DeviceSettingsService:
    MUTABLE_KEYS = {
        "name",
        "orientation",
        "inverted_image",
        "timezone",
        "time_format",
        "log_system_stats",
        "image_settings",
    }
    IMAGE_SETTING_KEYS = {"saturation", "contrast", "sharpness", "brightness", "inky_saturation"}

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.ensure_exists()

    def ensure_exists(self):
        if not self.path.exists():
            self.save_settings(DEFAULT_DEVICE_SETTINGS)
        else:
            current = self.load_settings()
            merged = _merge_defaults(current, DEFAULT_DEVICE_SETTINGS)
            if merged != current:
                self.save_settings(merged)

    def load_settings(self) -> dict:
        with self.path.open() as fh:
            return json.load(fh)

    def save_settings(self, settings: dict):
        with self.path.open("w") as fh:
            json.dump(settings, fh, indent=4)

    def get_settings(self) -> dict:
        return self.load_settings()

    def get_config(self, key=None, default=None):
        settings = self.get_settings()
        if key is None:
            return settings
        return settings.get(key, default)

    def get_setting(self, key: str, default=None):
        return self.load_settings().get(key, default)

    def get_resolution(self) -> tuple[int, int]:
        settings = self.get_settings()
        width, height = settings["resolution"]
        return int(width), int(height)

    def update_settings(self, updates: dict) -> dict:
        unknown_keys = set(updates.keys()) - self.MUTABLE_KEYS
        if unknown_keys:
            unknown = ", ".join(sorted(unknown_keys))
            raise ValueError(f"Unsupported device setting fields: {unknown}")

        settings = self.get_settings()
        has_image_updates = "image_settings" in updates
        image_updates = updates.get("image_settings")
        top_level_updates = {key: value for key, value in updates.items() if key != "image_settings"}
        settings.update(top_level_updates)
        if has_image_updates:
            if not isinstance(image_updates, dict):
                raise ValueError("image_settings must be an object")
            unknown_image_keys = set(image_updates.keys()) - self.IMAGE_SETTING_KEYS
            if unknown_image_keys:
                unknown = ", ".join(sorted(unknown_image_keys))
                raise ValueError(f"Unsupported image_settings fields: {unknown}")
            settings["image_settings"] = _merge_defaults(image_updates, settings.get("image_settings", {}))
        self.validate_settings(settings)
        self.save_settings(settings)
        return settings

    def update_value(self, key: str, value, write=True):
        settings = self.get_settings()
        settings[key] = value
        if write:
            self.save_settings(settings)
        return settings

    def validate_settings(self, settings: dict):
        if not isinstance(settings.get("name"), str) or not settings["name"].strip():
            raise ValueError("name must be a non-empty string")
        if settings.get("orientation") not in {"horizontal", "vertical"}:
            raise ValueError("orientation must be one of: horizontal, vertical")
        if settings.get("time_format") not in {"12h", "24h"}:
            raise ValueError("time_format must be one of: 12h, 24h")
        if not isinstance(settings.get("inverted_image"), bool):
            raise ValueError("inverted_image must be a boolean")
        if not isinstance(settings.get("log_system_stats"), bool):
            raise ValueError("log_system_stats must be a boolean")
        resolution = settings.get("resolution")
        if (
            not isinstance(resolution, (list, tuple))
            or len(resolution) != 2
            or any(not isinstance(value, (int, float)) for value in resolution)
        ):
            raise ValueError("resolution must contain exactly two numeric values")
        width, height = (int(resolution[0]), int(resolution[1]))
        if width <= 0 or height <= 0 or width > 4096 or height > 4096:
            raise ValueError("resolution values must be between 1 and 4096")
        image_settings = settings.get("image_settings", {})
        for key in ("saturation", "contrast", "sharpness", "brightness"):
            value = float(image_settings.get(key, 1.0))
            if value < 0 or value > 2:
                raise ValueError(f"{key} must be between 0.0 and 2.0")
        inky_saturation = float(image_settings.get("inky_saturation", 0.5))
        if inky_saturation < 0 or inky_saturation > 1:
            raise ValueError("inky_saturation must be between 0.0 and 1.0")
