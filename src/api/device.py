from flask import Blueprint, current_app, jsonify, request, send_file


def create_device_blueprint(device_settings_service, playback_controller, media_store):
    blueprint = Blueprint("device_api", __name__)

    @blueprint.get("/api/device/settings")
    def get_device_settings():
        return jsonify(device_settings_service.get_settings())

    @blueprint.patch("/api/device/settings")
    def patch_device_settings():
        data = request.get_json(force=True, silent=True) or {}
        try:
            settings = device_settings_service.update_settings(data)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        playback_controller.wake_event.set()
        return jsonify(settings)

    @blueprint.patch("/api/settings")
    def patch_app_settings():
        data = request.get_json(force=True, silent=True) or {}
        device_updates = data.get("device_settings") or {}
        playback_updates = data.get("playback_settings") or {}
        if not isinstance(device_updates, dict) or not isinstance(playback_updates, dict):
            return jsonify({"error": "device_settings and playback_settings must be objects"}), 400

        try:
            prepared_device_updates = device_settings_service.prepare_updates_from_snapshot(device_updates)
            prepared_device_settings = device_settings_service.prepare_updated_settings(prepared_device_updates)
            prepared_playback_settings = playback_controller.prepare_settings_update(playback_updates)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        previous_device_settings = device_settings_service.get_settings()
        try:
            device_settings_service.save_settings(prepared_device_settings)
            saved_playback_settings = playback_controller.commit_prepared_settings(prepared_playback_settings)
        except Exception:
            try:
                device_settings_service.save_settings(previous_device_settings)
            except Exception:  # pragma: no cover - rollback failure is logged and surfaced by the outer error
                current_app.logger.exception("Failed to roll back device settings after combined settings save failure")
            current_app.logger.exception("Combined settings save failed")
            return jsonify({"error": "Failed to save settings"}), 500

        playback_controller.wake_event.set()
        return jsonify(
            {
                "device_settings": prepared_device_settings,
                "playback_settings": saved_playback_settings,
                "display_status": playback_controller.get_display_status(),
            }
        )

    @blueprint.get("/api/display/status")
    def display_status():
        return jsonify(playback_controller.get_display_status())

    @blueprint.get("/api/current-image")
    def get_current_image():
        if not media_store.current_image_path.exists():
            return jsonify({"error": "Current image not found"}), 404
        return send_file(media_store.current_image_path, mimetype="image/png")

    return blueprint
