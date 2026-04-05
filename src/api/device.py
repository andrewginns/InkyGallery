from flask import Blueprint, jsonify, request, send_file


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

    @blueprint.get("/api/display/status")
    def display_status():
        return jsonify(playback_controller.get_display_status())

    @blueprint.get("/api/current-image")
    def get_current_image():
        if not media_store.current_image_path.exists():
            return jsonify({"error": "Current image not found"}), 404
        return send_file(media_store.current_image_path, mimetype="image/png")

    return blueprint

