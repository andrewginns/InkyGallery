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
        settings = self.get_settings()
        image_updates = updates.pop("image_settings", None)
        settings.update(updates)
        if image_updates:
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
        if settings.get("orientation") not in {"horizontal", "vertical"}:
            raise ValueError("orientation must be one of: horizontal, vertical")
        if settings.get("time_format") not in {"12h", "24h"}:
            raise ValueError("time_format must be one of: 12h, 24h")
        image_settings = settings.get("image_settings", {})
        for key in ("saturation", "contrast", "sharpness", "brightness"):
            value = float(image_settings.get(key, 1.0))
            if value < 0 or value > 2:
                raise ValueError(f"{key} must be between 0.0 and 2.0")
        inky_saturation = float(image_settings.get("inky_saturation", 0.5))
        if inky_saturation < 0 or inky_saturation > 1:
            raise ValueError("inky_saturation must be between 0.0 and 1.0")
