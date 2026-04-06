from flask import Blueprint, jsonify, request, send_file


def create_assets_blueprint(asset_service, playback_controller):
    blueprint = Blueprint("assets_api", __name__)

    @blueprint.get("/api/assets")
    def list_assets():
        q = request.args.get("q")
        sort = request.args.get("sort", "uploaded_newest")
        favorite = request.args.get("favorite")
        favorite = None if favorite is None else favorite.lower() == "true"
        try:
            limit = int(request.args.get("limit", "50"))
            cursor = int(request.args.get("cursor", "0"))
        except ValueError:
            return jsonify({"error": "limit and cursor must be integers"}), 400
        if limit <= 0 or limit > 200:
            return jsonify({"error": "limit must be between 1 and 200"}), 400
        if cursor < 0:
            return jsonify({"error": "cursor must be zero or greater"}), 400
        return jsonify(asset_service.list_assets(q=q, sort=sort, favorite=favorite, limit=limit, cursor=cursor))

    @blueprint.post("/api/assets")
    def upload_assets():
        files = request.files.getlist("files[]")
        if not files:
            return jsonify({"error": "files[] is required"}), 400
        duplicate_policy = request.form.get("duplicate_policy", "reject")
        if duplicate_policy not in {"reject", "reuse_existing", "keep_both"}:
            return jsonify({"error": "duplicate_policy must be one of: reject, reuse_existing, keep_both"}), 400
        auto_add_to_queue = request.form.get("auto_add_to_queue", "false").lower() == "true"
        try:
            result = asset_service.ingest_uploads(files, duplicate_policy=duplicate_policy, auto_add_to_queue=auto_add_to_queue)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify(result), 201

    @blueprint.get("/api/assets/<asset_id>")
    def get_asset(asset_id: str):
        asset = asset_service.serialize_asset(asset_id)
        if not asset:
            return jsonify({"error": "Asset not found"}), 404
        return jsonify(asset)

    @blueprint.patch("/api/assets/<asset_id>")
    def patch_asset(asset_id: str):
        asset = asset_service.update_asset(asset_id, request.get_json(force=True, silent=True) or {})
        if not asset:
            return jsonify({"error": "Asset not found"}), 404
        return jsonify(asset)

    @blueprint.delete("/api/assets/<asset_id>")
    def delete_asset(asset_id: str):
        if not asset_service.serialize_asset(asset_id):
            return jsonify({"error": "Asset not found"}), 404
        asset_service.delete_assets([asset_id])
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify({"success": True})

    @blueprint.post("/api/assets/bulk-delete")
    def bulk_delete_assets():
        data = request.get_json(force=True, silent=True) or {}
        asset_ids = data.get("asset_ids", [])
        if not isinstance(asset_ids, list) or not asset_ids:
            return jsonify({"error": "asset_ids must be a non-empty list"}), 400
        asset_service.delete_assets(asset_ids)
        playback_controller.reconcile_state()
        playback_controller.wake_event.set()
        return jsonify({"success": True, "deleted_asset_ids": asset_ids})

    @blueprint.get("/api/assets/<asset_id>/file")
    def get_asset_file(asset_id: str):
        path = asset_service.get_original_path(asset_id)
        if not path or not path.exists():
            return jsonify({"error": "Asset file not found"}), 404
        return send_file(path)

    @blueprint.get("/api/assets/<asset_id>/thumbnail")
    def get_asset_thumbnail(asset_id: str):
        size = request.args.get("size", "sm")
        path = asset_service.get_thumbnail_path(asset_id, size)
        if not path or not path.exists():
            return jsonify({"error": "Thumbnail not found"}), 404
        return send_file(path, mimetype="image/webp")

    return blueprint
