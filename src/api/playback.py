from flask import Blueprint, jsonify, request


def create_playback_blueprint(playback_controller):
    blueprint = Blueprint("playback_api", __name__)

    @blueprint.get("/api/playback")
    def get_playback():
        return jsonify(playback_controller.get_payload())

    @blueprint.patch("/api/playback")
    def patch_playback():
        try:
            settings = playback_controller.update_settings(request.get_json(force=True, silent=True) or {})
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify(settings)

    @blueprint.post("/api/playback/preview")
    def preview_playback():
        data = request.get_json(force=True, silent=True) or {}
        try:
            state = playback_controller.preview(
                queue_item_id=data.get("queue_item_id"),
                asset_id=data.get("asset_id"),
                direction=data.get("direction"),
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify(state)

    @blueprint.post("/api/playback/apply")
    def apply_preview():
        try:
            state = playback_controller.apply_preview()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 503
        return jsonify(state)

    @blueprint.post("/api/playback/rerender-active")
    def rerender_active():
        try:
            state = playback_controller.rerender_active()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 503
        return jsonify(state)

    @blueprint.post("/api/playback/next")
    def next_item():
        try:
            state = playback_controller.next()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 503
        return jsonify(state)

    @blueprint.post("/api/playback/previous")
    def previous_item():
        try:
            state = playback_controller.previous()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 503
        return jsonify(state)

    @blueprint.post("/api/playback/pause")
    def pause():
        return jsonify(playback_controller.pause())

    @blueprint.post("/api/playback/resume")
    def resume():
        try:
            state = playback_controller.resume()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify(state)

    return blueprint
