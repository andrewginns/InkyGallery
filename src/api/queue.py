from flask import Blueprint, jsonify, request


def create_queue_blueprint(queue_service, playback_controller):
    blueprint = Blueprint("queue_api", __name__)

    @blueprint.get("/api/queue")
    def get_queue():
        return jsonify(queue_service.list_queue())

    @blueprint.post("/api/queue/items")
    def add_queue_items():
        data = request.get_json(force=True, silent=True) or {}
        asset_ids = data.get("asset_ids", [])
        if not isinstance(asset_ids, list) or not asset_ids:
            return jsonify({"error": "asset_ids must be a non-empty list"}), 400
        try:
            result = queue_service.add_assets(asset_ids, data.get("initial_settings"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify(result), 201

    @blueprint.patch("/api/queue/items/<queue_item_id>")
    def patch_queue_item(queue_item_id: str):
        try:
            item = queue_service.update_item(queue_item_id, request.get_json(force=True, silent=True) or {})
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if not item:
            return jsonify({"error": "Queue item not found"}), 404
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify(item)

    @blueprint.delete("/api/queue/items/<queue_item_id>")
    def delete_queue_item(queue_item_id: str):
        deleted = queue_service.delete_item(queue_item_id)
        if not deleted:
            return jsonify({"error": "Queue item not found"}), 404
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify({"success": True})

    @blueprint.post("/api/queue/reorder")
    def reorder_queue():
        data = request.get_json(force=True, silent=True) or {}
        ordered_ids = data.get("ordered_queue_item_ids", [])
        if not isinstance(ordered_ids, list) or not ordered_ids:
            return jsonify({"error": "ordered_queue_item_ids must be a non-empty list"}), 400
        try:
            result = queue_service.reorder(ordered_ids)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify(result)

    @blueprint.post("/api/queue/sort")
    def sort_queue():
        data = request.get_json(force=True, silent=True) or {}
        try:
            result = queue_service.sort(data.get("sort_mode", "manual"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify(result)

    return blueprint
