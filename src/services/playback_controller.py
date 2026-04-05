import random
import threading
from datetime import datetime, timezone

from utils.timestamps import utcnow_iso


class PlaybackController:
    def __init__(self, playback_repo, queue_repo, display_service):
        self.playback_repo = playback_repo
        self.queue_repo = queue_repo
        self.display_service = display_service
        self.lock = threading.RLock()
        self.wake_event = threading.Event()
        self.stop_event = threading.Event()
        self.thread = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.wake_event.set()
        if self.thread:
            self.thread.join(timeout=2)

    def get_payload(self):
        state = self.playback_repo.get_state()
        state = {
            **state,
            "current_image_url": "/api/current-image",
            "last_rendered_url": "/api/current-image" if state.get("last_rendered_at") else None,
            "time_remaining_seconds": self._time_remaining_seconds(state.get("display_expires_at")),
        }
        return {
            "settings": self.playback_repo.get_settings(),
            "state": state,
            "active_item": self.queue_repo.get_item(state["active_queue_item_id"]) if state.get("active_queue_item_id") else None,
            "preview_item": self.queue_repo.get_item(state["preview_queue_item_id"]) if state.get("preview_queue_item_id") else None,
        }

    def update_settings(self, updates: dict):
        normalized = {}
        for key in ("default_timeout_seconds", "loop_enabled", "shuffle_enabled", "auto_advance_enabled", "queue_sort_mode"):
            if key in updates:
                normalized[key] = updates[key]
        if "default_timeout_seconds" in normalized and int(normalized["default_timeout_seconds"]) <= 0:
            raise ValueError("default_timeout_seconds must be positive")
        for key in ("loop_enabled", "shuffle_enabled", "auto_advance_enabled"):
            if key in normalized:
                normalized[key] = int(bool(normalized[key]))
        normalized["updated_at"] = utcnow_iso()
        settings = self.playback_repo.update_settings(normalized)
        self.wake_event.set()
        return settings

    def preview(self, queue_item_id=None, asset_id=None, direction=None):
        with self.lock:
            target = self._resolve_preview_target(queue_item_id=queue_item_id, asset_id=asset_id, direction=direction)
            current_state = self.playback_repo.get_state()
            if self._matches_active_target(current_state, target):
                state_updates = {
                    "preview_queue_item_id": None,
                    "preview_asset_id": None,
                    "mode": self._active_mode(current_state),
                    "updated_at": utcnow_iso(),
                }
                state = self.playback_repo.update_state(state_updates)
                self.wake_event.set()
                return state
            state_updates = {
                "preview_queue_item_id": target.get("queue_item_id"),
                "preview_asset_id": target["asset_id"],
                "mode": "preview",
                "updated_at": utcnow_iso(),
            }
            state = self.playback_repo.update_state(state_updates)
            self.wake_event.set()
            return state

    def apply_preview(self):
        with self.lock:
            state = self.playback_repo.get_state()
            preview_asset_id = state.get("preview_asset_id")
            if not preview_asset_id:
                raise ValueError("No preview asset is active")
            preview_queue_item_id = state.get("preview_queue_item_id")
            render_target = self._resolve_render_target(
                preview_asset_id=preview_asset_id,
                preview_queue_item_id=preview_queue_item_id,
            )
            render_result = self.display_service.render_asset(
                render_target["asset_id"],
                fit_mode=render_target.get("fit_mode", "cover"),
                background_mode=render_target.get("background_mode", "blur"),
                background_color=render_target.get("background_color"),
            )
            timeout_seconds = self._resolve_timeout(preview_queue_item_id)
            now = datetime.now(timezone.utc)
            applied = self.playback_repo.update_state(
                {
                    "active_queue_item_id": preview_queue_item_id,
                    "active_asset_id": preview_asset_id,
                    "preview_queue_item_id": None,
                    "preview_asset_id": None,
                    "mode": "displaying",
                    "display_started_at": now.isoformat(),
                    "display_expires_at": self._future_iso(now, timeout_seconds),
                    "last_image_hash": render_result["image_hash"],
                    "last_rendered_at": utcnow_iso(),
                    "updated_at": utcnow_iso(),
                }
            )
            self.wake_event.set()
            return applied

    def next(self):
        return self._commit_direction("next")

    def previous(self):
        return self._commit_direction("previous")

    def pause(self):
        state = self.playback_repo.update_state(
            {
                "mode": "paused",
                "display_expires_at": None,
                "updated_at": utcnow_iso(),
            }
        )
        self.wake_event.set()
        return state

    def resume(self):
        with self.lock:
            state = self.playback_repo.get_state()
            if not state.get("active_asset_id"):
                raise ValueError("No active asset to resume")
            timeout_seconds = self._resolve_timeout(state.get("active_queue_item_id"))
            now = datetime.now(timezone.utc)
            state = self.playback_repo.update_state(
                {
                    "mode": "displaying",
                    "display_started_at": now.isoformat(),
                    "display_expires_at": self._future_iso(now, timeout_seconds),
                    "updated_at": utcnow_iso(),
                }
            )
            self.wake_event.set()
            return state

    def get_display_status(self):
        settings = self.playback_repo.get_settings()
        state = self.playback_repo.get_state()
        return {
            "resolution": list(self.display_service.device_settings_service.get_resolution()),
            "orientation": self.display_service.device_settings_service.get_setting("orientation"),
            "active_asset_id": state.get("active_asset_id"),
            "preview_asset_id": state.get("preview_asset_id"),
            "mode": state.get("mode"),
            "current_image_url": "/api/current-image",
            "current_image_hash": state.get("last_image_hash"),
            "last_rendered_at": state.get("last_rendered_at"),
            "default_timeout_seconds": settings.get("default_timeout_seconds"),
            "time_remaining_seconds": self._time_remaining_seconds(state.get("display_expires_at")),
            "hardware": self.display_service.display_manager.get_status(),
        }

    def reconcile_state(self):
        with self.lock:
            state = self.playback_repo.get_state()
            updates = {}

            active_queue_item_id = state.get("active_queue_item_id")
            if active_queue_item_id and not self.queue_repo.get_item(active_queue_item_id):
                updates["active_queue_item_id"] = None

            preview_queue_item_id = state.get("preview_queue_item_id")
            if preview_queue_item_id and not self.queue_repo.get_item(preview_queue_item_id):
                updates["preview_queue_item_id"] = None

            active_asset_id = state.get("active_asset_id")
            if active_asset_id and not self.display_service.assets_repo.get_asset(active_asset_id):
                updates["active_asset_id"] = None
                updates["active_queue_item_id"] = None
                updates["display_started_at"] = None
                updates["display_expires_at"] = None

            preview_asset_id = state.get("preview_asset_id")
            if preview_asset_id and not self.display_service.assets_repo.get_asset(preview_asset_id):
                updates["preview_asset_id"] = None
                updates["preview_queue_item_id"] = None

            resolved_preview_asset_id = updates.get("preview_asset_id", preview_asset_id)
            resolved_active_asset_id = updates.get("active_asset_id", active_asset_id)
            resolved_mode = state.get("mode")

            if resolved_preview_asset_id:
                resolved_mode = "preview"
            elif resolved_active_asset_id:
                resolved_mode = "paused" if state.get("mode") == "paused" else "displaying"
            else:
                resolved_mode = "idle"
                updates["display_started_at"] = None
                updates["display_expires_at"] = None

            if resolved_mode != state.get("mode"):
                updates["mode"] = resolved_mode

            if updates:
                updates["updated_at"] = utcnow_iso()
                return self.playback_repo.update_state(updates)
            return state

    def _commit_direction(self, direction: str, preserve_preview: bool = False):
        with self.lock:
            existing_state = self.playback_repo.get_state()
            target = self._resolve_navigation_target(direction)
            render_result = self.display_service.render_asset(
                target["asset_id"],
                fit_mode=target.get("fit_mode", "cover"),
                background_mode=target.get("background_mode", "blur"),
                background_color=target.get("background_color"),
            )
            now = datetime.now(timezone.utc)
            timeout_seconds = self._resolve_timeout(target.get("queue_item_id"))
            state = self.playback_repo.update_state(
                {
                    "active_queue_item_id": target.get("queue_item_id"),
                    "active_asset_id": target["asset_id"],
                    "preview_queue_item_id": (
                        existing_state.get("preview_queue_item_id") if preserve_preview else None
                    ),
                    "preview_asset_id": (
                        existing_state.get("preview_asset_id") if preserve_preview else None
                    ),
                    "mode": "preview" if preserve_preview and existing_state.get("preview_asset_id") else "displaying",
                    "display_started_at": now.isoformat(),
                    "display_expires_at": self._future_iso(now, timeout_seconds),
                    "last_image_hash": render_result["image_hash"],
                    "last_rendered_at": utcnow_iso(),
                    "updated_at": utcnow_iso(),
                }
            )
            self.wake_event.set()
            return state

    def _resolve_preview_target(self, queue_item_id=None, asset_id=None, direction=None):
        if asset_id:
            return {"asset_id": asset_id}
        if queue_item_id:
            item = self.queue_repo.get_item(queue_item_id)
            if not item:
                raise ValueError(f"Queue item '{queue_item_id}' does not exist")
            item["queue_item_id"] = item["id"]
            return item
        if direction:
            return self._resolve_navigation_target(direction, preview=True)
        raise ValueError("One of queue_item_id, asset_id, or direction is required")

    def _resolve_navigation_target(self, direction: str, preview: bool = False):
        items = self.queue_repo.list_items(enabled_only=True)
        if not items:
            raise ValueError("Queue is empty")

        settings = self.playback_repo.get_settings()
        state = self.playback_repo.get_state()
        if settings["shuffle_enabled"] and direction == "next":
            item = random.choice(items)
            item["queue_item_id"] = item["id"]
            return item

        state_key = "preview_queue_item_id" if preview and state.get("preview_queue_item_id") else "active_queue_item_id"
        current_id = state.get(state_key) or state.get("active_queue_item_id")
        ordered_ids = [item["id"] for item in items]
        if current_id in ordered_ids:
            index = ordered_ids.index(current_id)
            if direction == "next":
                index += 1
            else:
                index -= 1
            if index >= len(items):
                if not settings["loop_enabled"]:
                    index = len(items) - 1
                else:
                    index = 0
            if index < 0:
                if not settings["loop_enabled"]:
                    index = 0
                else:
                    index = len(items) - 1
            item = items[index]
        else:
            item = items[0] if direction == "next" else items[-1]
        item["queue_item_id"] = item["id"]
        return item

    def _resolve_timeout(self, queue_item_id: str | None) -> int:
        if queue_item_id:
            item = self.queue_repo.get_item(queue_item_id)
            if item and item.get("timeout_seconds_override"):
                return int(item["timeout_seconds_override"])
        settings = self.playback_repo.get_settings()
        return int(settings["default_timeout_seconds"])

    def _future_iso(self, now: datetime, timeout_seconds: int) -> str:
        return datetime.fromtimestamp(now.timestamp() + timeout_seconds, tz=timezone.utc).isoformat()

    def _time_remaining_seconds(self, expires_at_iso: str | None):
        if not expires_at_iso:
            return None
        expires_at = datetime.fromisoformat(expires_at_iso)
        remaining = int((expires_at - datetime.now(timezone.utc)).total_seconds())
        return max(0, remaining)

    def _run_loop(self):
        while not self.stop_event.is_set():
            self.wake_event.wait(timeout=1)
            self.wake_event.clear()
            if self.stop_event.is_set():
                break
            with self.lock:
                settings = self.playback_repo.get_settings()
                state = self.playback_repo.get_state()
                if not settings["auto_advance_enabled"]:
                    continue
                if state.get("mode") == "paused" or not state.get("display_expires_at"):
                    continue
                expires_at = datetime.fromisoformat(state["display_expires_at"])
                if datetime.now(timezone.utc) >= expires_at:
                    try:
                        self._commit_direction("next", preserve_preview=bool(state.get("preview_asset_id")))
                    except ValueError:
                        self.playback_repo.update_state(
                            {
                                "mode": "idle",
                                "display_expires_at": None,
                                "updated_at": utcnow_iso(),
                            }
                        )

    def _resolve_render_target(self, preview_asset_id: str, preview_queue_item_id: str | None):
        if preview_queue_item_id:
            item = self.queue_repo.get_item(preview_queue_item_id)
            if not item:
                raise ValueError(f"Queue item '{preview_queue_item_id}' does not exist")
            item["queue_item_id"] = item["id"]
            return item
        return {"asset_id": preview_asset_id}

    def _matches_active_target(self, state: dict, target: dict) -> bool:
        active_asset_id = state.get("active_asset_id")
        active_queue_item_id = state.get("active_queue_item_id")
        target_queue_item_id = target.get("queue_item_id")
        if target_queue_item_id:
            return target_queue_item_id == active_queue_item_id
        return bool(active_asset_id) and target["asset_id"] == active_asset_id

    def _active_mode(self, state: dict) -> str:
        if not state.get("active_asset_id"):
            return "idle"
        return "paused" if state.get("mode") == "paused" or not state.get("display_expires_at") else "displaying"
