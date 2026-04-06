import io
import time
from datetime import datetime, timedelta, timezone

from PIL import Image
from services.asset_service import AssetService


def make_png_bytes(color):
    image = Image.new("RGB", (64, 48), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


def make_split_png_bytes(left_color, right_color, size=(200, 100)):
    image = Image.new("RGB", size, color=left_color)
    split_x = size[0] // 2
    for x in range(split_x, size[0]):
        for y in range(size[1]):
            image.putpixel((x, y), right_color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


def test_health_and_defaults(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json == {"ok": True}

    verbose_health = client.get("/health?verbose=1")
    assert verbose_health.status_code == 200
    assert verbose_health.json["ok"] is True
    assert "project_root" in verbose_health.json

    proxied_verbose_health = client.get(
        "/health?verbose=1",
        headers={"X-Forwarded-For": "192.168.3.42", "X-Real-IP": "192.168.3.42"},
        environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
    )
    assert proxied_verbose_health.status_code == 200
    assert proxied_verbose_health.json == {"ok": True}

    settings = client.get("/api/device/settings")
    assert settings.status_code == 200
    assert settings.json["name"] == "InkyGallery"
    assert settings.json["image_settings"]["brightness"] == 1.0
    assert settings.json["image_settings"]["inky_saturation"] == 0.5

    current_image = client.get("/api/current-image")
    assert current_image.status_code == 200
    assert current_image.mimetype == "image/png"

    display_status = client.get("/api/display/status")
    assert display_status.status_code == 200
    assert display_status.json["hardware"]["display_type"] == "inky"
    assert display_status.json["hardware"]["hardware_enabled"] is False
    assert display_status.json["hardware"]["hardware_ready"] is False


def test_verbose_health_stays_minimal_for_proxied_clients(client):
    response = client.get(
        "/health?verbose=1",
        headers={
            "X-Forwarded-For": "192.168.3.50",
            "X-Real-IP": "192.168.3.50",
        },
    )
    assert response.status_code == 200
    assert response.json == {"ok": True}


def test_default_request_limit_supports_multi_file_batches(app):
    assert app.config["MAX_CONTENT_LENGTH"] >= AssetService.MAX_UPLOAD_BYTES * 2


def test_pwa_shell_assets_exist(client):
    manifest = client.get("/manifest.webmanifest")
    assert manifest.status_code == 200
    assert manifest.json["name"] == "InkyGallery"
    assert manifest.json["display"] == "standalone"

    sw = client.get("/sw.js")
    assert sw.status_code == 200
    sw_text = sw.get_data(as_text=True)
    assert "/icons/favicon.ico" in sw_text
    assert 'requestUrl.pathname === "/favicon.ico"' not in sw_text


def test_asset_upload_and_list(client, sample_png_bytes):
    response = client.post(
        "/api/assets",
        data={
            "files[]": (io.BytesIO(sample_png_bytes), "sample.png"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, response.json
    created = response.json["created"]
    assert len(created) == 1
    asset_id = created[0]["id"]

    asset = client.get(f"/api/assets/{asset_id}")
    assert asset.status_code == 200
    assert asset.json["filename_original"] == "sample.png"
    assert asset.json["thumbnail_url"] == f"/api/assets/{asset_id}/thumbnail?size=sm"
    assert asset.json["original_url"] == f"/api/assets/{asset_id}/file"

    listed = client.get("/api/assets")
    assert listed.status_code == 200
    assert len(listed.json["items"]) == 1

    original = client.get(f"/api/assets/{asset_id}/file")
    assert original.status_code == 200

    thumbnail = client.get(f"/api/assets/{asset_id}/thumbnail?size=sm")
    assert thumbnail.status_code == 200
    assert thumbnail.mimetype == "image/webp"


def test_asset_list_paginates_with_next_cursor(client):
    for index in range(51):
        payload = make_png_bytes((index % 255, (index * 3) % 255, (index * 7) % 255))
        response = client.post(
            "/api/assets",
            data={"files[]": (io.BytesIO(payload), f"sample-{index:02d}.png")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 201, response.json

    first_page = client.get("/api/assets?limit=50")
    assert first_page.status_code == 200
    assert len(first_page.json["items"]) == 50
    assert first_page.json["next_cursor"] == 50

    second_page = client.get("/api/assets?limit=50&cursor=50")
    assert second_page.status_code == 200
    assert len(second_page.json["items"]) == 1
    assert second_page.json["next_cursor"] is None


def test_upload_limit_returns_json_error(client, app):
    app.config["MAX_CONTENT_LENGTH"] = 32
    response = client.post(
        "/api/assets",
        data={
            "files[]": (io.BytesIO(make_png_bytes((255, 0, 0))), "too-large.png"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 413
    assert response.is_json
    assert "upload too large" in response.json["error"].lower()
    assert "per file" in response.json["error"].lower()
    assert "per request" in response.json["error"].lower()


def test_asset_crop_profile_round_trip(client, sample_png_bytes):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "crop.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    crop_put = client.put(
        f"/api/assets/{asset_id}/crop",
        json={"x": 0.275, "y": 0.0, "width": 0.45, "height": 1.0},
    )
    assert crop_put.status_code == 200, crop_put.json
    assert crop_put.json["crop_profile"]["x"] == 0.275

    crop_get = client.get(f"/api/assets/{asset_id}/crop")
    assert crop_get.status_code == 200
    assert crop_get.json["crop_profile"]["width"] == 0.45

    asset = client.get(f"/api/assets/{asset_id}")
    assert asset.status_code == 200
    assert asset.json["crop_profile"]["height"] == 1.0

    crop_delete = client.delete(f"/api/assets/{asset_id}/crop")
    assert crop_delete.status_code == 200
    assert crop_delete.json["success"] is True

    crop_get_after_delete = client.get(f"/api/assets/{asset_id}/crop")
    assert crop_get_after_delete.status_code == 200
    assert crop_get_after_delete.json["crop_profile"] is None


def test_asset_crop_profile_validation_rejects_wrong_aspect(client, sample_png_bytes):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "crop.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    invalid_crop = client.put(
        f"/api/assets/{asset_id}/crop",
        json={"x": 0.1, "y": 0.1, "width": 0.7, "height": 0.7},
    )
    assert invalid_crop.status_code == 400
    assert "aspect ratio" in invalid_crop.json["error"].lower()


def test_device_settings_orientation_is_fixed_vertical(client):
    response = client.patch("/api/device/settings", json={"orientation": "horizontal"})
    assert response.status_code == 400
    assert "unsupported device setting fields" in response.json["error"].lower()


def test_render_uses_saved_crop_profile(client, app):
    client.patch("/api/device/settings", json={"orientation": "vertical"})
    split_image = make_split_png_bytes((255, 0, 0), (0, 0, 255))
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(split_image), "split.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    crop_put = client.put(
        f"/api/assets/{asset_id}/crop",
        json={"x": 0.7, "y": 0.0, "width": 0.3, "height": 1.0},
    )
    assert crop_put.status_code == 200, crop_put.json

    rendered = {}

    def capture_display(image):
        rendered["image"] = image.copy()
        return image

    app.extensions["display_service"].display_manager.display_image = capture_display
    result = app.extensions["display_service"].render_asset(asset_id)
    assert result["image_hash"]

    sampled = rendered["image"].resize((1, 1))
    dominant = sampled.getpixel((0, 0))
    assert dominant[2] > 200
    assert dominant[0] < 80


def test_queue_and_playback_flow(client, sample_png_bytes):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "queue.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    queue_add = client.post("/api/queue/items", json={"asset_ids": [asset_id]})
    assert queue_add.status_code == 201, queue_add.json
    queue_item_id = queue_add.json["items"][0]["id"]

    queue = client.get("/api/queue")
    assert queue.status_code == 200
    assert queue.json["items"][0]["asset"]["id"] == asset_id

    preview = client.post("/api/playback/preview", json={"queue_item_id": queue_item_id})
    assert preview.status_code == 200, preview.json
    assert preview.json["mode"] == "preview"
    assert preview.json["preview_queue_item_id"] == queue_item_id
    assert preview.json["last_image_hash"] is None
    assert preview.json["last_rendered_at"] is None

    preview_status = client.get("/api/display/status")
    assert preview_status.status_code == 200
    assert preview_status.json["current_image_hash"] is None

    apply_response = client.post("/api/playback/apply")
    assert apply_response.status_code == 200, apply_response.json
    assert apply_response.json["mode"] == "displaying"
    assert apply_response.json["active_queue_item_id"] == queue_item_id
    assert apply_response.json["last_image_hash"] is not None
    assert apply_response.json["last_rendered_at"] is not None

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "displaying"
    assert playback.json["active_item"]["id"] == queue_item_id

    repreview = client.post("/api/playback/preview", json={"queue_item_id": queue_item_id})
    assert repreview.status_code == 200, repreview.json
    assert repreview.json["mode"] == "displaying"
    assert repreview.json["preview_queue_item_id"] is None
    assert repreview.json["preview_asset_id"] is None
    assert repreview.json["active_queue_item_id"] == queue_item_id

    display_status = client.get("/api/display/status")
    assert display_status.status_code == 200
    assert display_status.json["active_asset_id"] == asset_id
    assert display_status.json["mode"] == "displaying"


def test_rerender_active_reapplies_saved_crop_to_live_image(client):
    split_image = make_split_png_bytes((255, 0, 0), (0, 0, 255))
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(split_image), "live-crop.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    queue_add = client.post("/api/queue/items", json={"asset_ids": [asset_id]})
    queue_item_id = queue_add.json["items"][0]["id"]

    preview = client.post("/api/playback/preview", json={"queue_item_id": queue_item_id})
    assert preview.status_code == 200

    applied = client.post("/api/playback/apply")
    assert applied.status_code == 200, applied.json
    original_hash = applied.json["last_image_hash"]

    crop_put = client.put(
        f"/api/assets/{asset_id}/crop",
        json={"x": 0.7, "y": 0.0, "width": 0.3, "height": 1.0},
    )
    assert crop_put.status_code == 200, crop_put.json

    rerendered = client.post("/api/playback/rerender-active")
    assert rerendered.status_code == 200, rerendered.json
    assert rerendered.json["active_asset_id"] == asset_id
    assert rerendered.json["active_queue_item_id"] == queue_item_id
    assert rerendered.json["preview_asset_id"] is None
    assert rerendered.json["preview_queue_item_id"] is None
    assert rerendered.json["last_image_hash"] != original_hash


def test_apply_now_injects_after_live_item_and_continues_queue(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "one.png")},
        content_type="multipart/form-data",
    )
    second = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((90, 80, 70))), "two.png")},
        content_type="multipart/form-data",
    )
    injected = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((30, 140, 200))), "injected.png")},
        content_type="multipart/form-data",
    )

    asset_ids = [
        first.json["created"][0]["id"],
        second.json["created"][0]["id"],
    ]
    injected_asset_id = injected.json["created"][0]["id"]

    queue_add = client.post("/api/queue/items", json={"asset_ids": asset_ids})
    queue_ids = [item["id"] for item in queue_add.json["items"]]

    preview_live = client.post("/api/playback/preview", json={"queue_item_id": queue_ids[0]})
    assert preview_live.status_code == 200
    applied = client.post("/api/playback/apply")
    assert applied.status_code == 200
    assert applied.json["active_queue_item_id"] == queue_ids[0]

    apply_now = client.post("/api/queue/apply-now", json={"asset_id": injected_asset_id})
    assert apply_now.status_code == 201, apply_now.json
    injected_queue_item_id = apply_now.json["queue_item"]["id"]
    assert apply_now.json["state"]["active_queue_item_id"] == injected_queue_item_id
    assert apply_now.json["state"]["active_asset_id"] == injected_asset_id

    queue = client.get("/api/queue")
    assert queue.status_code == 200
    ordered_asset_ids = [item["asset"]["id"] for item in queue.json["items"]]
    assert ordered_asset_ids == [asset_ids[0], injected_asset_id, asset_ids[1]]
    assert [item["position"] for item in queue.json["items"]] == [0, 1, 2]

    next_item = client.post("/api/playback/next")
    assert next_item.status_code == 200, next_item.json
    assert next_item.json["active_asset_id"] == asset_ids[1]


def test_device_settings_patch(client):
    response = client.patch(
        "/api/device/settings",
        json={
            "image_settings": {
                "brightness": 1.2,
                "contrast": 1.1,
            },
        },
    )
    assert response.status_code == 200, response.json
    assert response.json["orientation"] == "vertical"
    assert response.json["image_settings"]["brightness"] == 1.2
    assert response.json["image_settings"]["contrast"] == 1.1
    assert response.json["image_settings"]["inky_saturation"] == 0.5


def test_combined_settings_patch_is_applied_together(client):
    response = client.patch(
        "/api/settings",
        json={
            "device_settings": {
                "image_settings": {
                    "brightness": 1.2,
                },
            },
            "playback_settings": {
                "default_timeout_seconds": 180,
                "queue_sort_mode": "uploaded_oldest",
            },
        },
    )
    assert response.status_code == 200, response.json
    assert response.json["device_settings"]["image_settings"]["brightness"] == 1.2
    assert response.json["playback_settings"]["default_timeout_seconds"] == 180
    assert response.json["playback_settings"]["queue_sort_mode"] == "uploaded_oldest"
    assert response.json["display_status"]["default_timeout_seconds"] == 180


def test_combined_settings_patch_accepts_full_device_snapshot(client):
    current_device = client.get("/api/device/settings")
    assert current_device.status_code == 200

    snapshot = current_device.json
    snapshot["image_settings"]["brightness"] = 1.15

    response = client.patch(
        "/api/settings",
        json={
            "device_settings": snapshot,
            "playback_settings": {
                "default_timeout_seconds": 150,
            },
        },
    )
    assert response.status_code == 200, response.json
    assert response.json["device_settings"]["image_settings"]["brightness"] == 1.15
    assert response.json["device_settings"]["orientation"] == "vertical"
    assert response.json["playback_settings"]["default_timeout_seconds"] == 150


def test_combined_settings_patch_rolls_back_device_settings_on_playback_failure(client, app, monkeypatch):
    baseline = client.get("/api/device/settings")
    assert baseline.status_code == 200
    original_brightness = baseline.json["image_settings"]["brightness"]

    def fail_commit(_prepared_settings):
        raise RuntimeError("sqlite write failed")

    monkeypatch.setattr(app.extensions["playback_controller"], "commit_prepared_settings", fail_commit)

    response = client.patch(
        "/api/settings",
        json={
            "device_settings": {
                **baseline.json,
                "image_settings": {
                    **baseline.json["image_settings"],
                    "brightness": 1.4,
                },
            },
            "playback_settings": {
                "default_timeout_seconds": 240,
            },
        },
    )
    assert response.status_code == 500
    assert response.json["error"] == "Failed to save settings"

    current = client.get("/api/device/settings")
    assert current.status_code == 200
    assert current.json["image_settings"]["brightness"] == original_brightness


def test_duplicate_reuse_existing_with_auto_queue(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "dup.png")},
        content_type="multipart/form-data",
    )
    assert first.status_code == 201
    asset_id = first.json["created"][0]["id"]

    second = client.post(
        "/api/assets",
        data={
            "files[]": (io.BytesIO(sample_png_bytes), "dup-again.png"),
            "duplicate_policy": "reuse_existing",
            "auto_add_to_queue": "true",
        },
        content_type="multipart/form-data",
    )
    assert second.status_code == 201, second.json
    assert second.json["duplicates"][0]["existing_asset_id"] == asset_id

    queue = client.get("/api/queue")
    assert queue.status_code == 200
    assert len(queue.json["items"]) == 1
    assert queue.json["items"][0]["asset"]["id"] == asset_id


def test_duplicate_keep_both_creates_second_asset(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "dup.png")},
        content_type="multipart/form-data",
    )
    assert first.status_code == 201

    second = client.post(
        "/api/assets",
        data={
            "files[]": (io.BytesIO(sample_png_bytes), "dup-copy.png"),
            "duplicate_policy": "keep_both",
        },
        content_type="multipart/form-data",
    )
    assert second.status_code == 201, second.json
    assert len(second.json["created"]) == 1
    assert second.json["duplicates"][0]["action"] == "keep_both"

    listed = client.get("/api/assets")
    assert listed.status_code == 200
    assert len(listed.json["items"]) == 2


def test_multi_file_upload_is_atomic_on_validation_error(client, sample_png_bytes):
    response = client.post(
        "/api/assets",
        data={
            "files[]": [
                (io.BytesIO(sample_png_bytes), "good.png"),
                (io.BytesIO(b"not-an-image"), "bad.png"),
            ],
            "duplicate_policy": "keep_both",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400

    listed = client.get("/api/assets")
    assert listed.status_code == 200
    assert listed.json["items"] == []

    queue = client.get("/api/queue")
    assert queue.status_code == 200
    assert queue.json["items"] == []


def test_upload_rollback_cleans_files_if_asset_creation_fails(client, app, sample_png_bytes, monkeypatch):
    def fail_create_asset(record):
        raise RuntimeError("db write failed")

    monkeypatch.setattr(app.extensions["asset_service"].assets_repo, "create_asset", fail_create_asset)

    response = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "broken.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 500

    listed = client.get("/api/assets")
    assert listed.status_code == 200
    assert listed.json["items"] == []

    media_store = app.extensions["asset_service"].media_store
    assert list(media_store.originals_dir.iterdir()) == []
    assert list(media_store.thumbnails_dir.iterdir()) == []


def test_heic_upload_reports_stored_mime_type(client, app):
    image = Image.new("RGB", (64, 48), color=(12, 34, 56))
    image.format = "HEIC"
    app.extensions["asset_service"]._load_image = lambda filename, payload: image.copy()

    response = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(b"fake-heic"), "sample.heic")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, response.json
    asset = response.json["created"][0]
    assert asset["mime_type"] == "image/png"
    assert asset["extension"] == "png"
    assert asset["source_mime_type"] == "image/heic"
    assert asset["source_extension"] == "heic"

    original = client.get(asset["original_url"])
    assert original.status_code == 200
    assert original.mimetype == "image/png"


def test_queue_reorder_swaps_adjacent_items(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "one.png")},
        content_type="multipart/form-data",
    )
    second = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((90, 80, 70))), "two.png")},
        content_type="multipart/form-data",
    )

    asset_ids = [first.json["created"][0]["id"], second.json["created"][0]["id"]]
    queue_add = client.post("/api/queue/items", json={"asset_ids": asset_ids})
    assert queue_add.status_code == 201, queue_add.json
    queue_ids = [item["id"] for item in queue_add.json["items"]]

    reordered = client.post("/api/queue/reorder", json={"ordered_queue_item_ids": list(reversed(queue_ids))})
    assert reordered.status_code == 200, reordered.json
    assert [item["id"] for item in reordered.json["items"]] == list(reversed(queue_ids))
    assert [item["position"] for item in reordered.json["items"]] == [0, 1]


def test_queue_reorder_rejects_duplicate_ids(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "one.png")},
        content_type="multipart/form-data",
    )
    second = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((90, 80, 70))), "two.png")},
        content_type="multipart/form-data",
    )
    asset_ids = [first.json["created"][0]["id"], second.json["created"][0]["id"]]
    queue_add = client.post("/api/queue/items", json={"asset_ids": asset_ids})
    queue_ids = [item["id"] for item in queue_add.json["items"]]

    reordered = client.post("/api/queue/reorder", json={"ordered_queue_item_ids": [queue_ids[0], queue_ids[0]]})
    assert reordered.status_code == 400
    assert "must match the existing queue exactly" in reordered.json["error"]


def test_queue_initial_settings_are_validated(client, sample_png_bytes):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "queue.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    invalid_fit = client.post(
        "/api/queue/items",
        json={"asset_ids": [asset_id], "initial_settings": {"fit_mode": "stretch"}},
    )
    assert invalid_fit.status_code == 400
    assert "fit_mode" in invalid_fit.json["error"]

    invalid_color = client.post(
        "/api/queue/items",
        json={
            "asset_ids": [asset_id],
            "initial_settings": {"background_mode": "solid", "background_color": "not-a-color"},
        },
    )
    assert invalid_color.status_code == 400
    assert "background_color" in invalid_color.json["error"]


def test_preview_pause_resume_clears_preview_state(client, sample_png_bytes):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "one.png")},
        content_type="multipart/form-data",
    )
    second = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((90, 80, 70))), "two.png")},
        content_type="multipart/form-data",
    )
    asset_ids = [first.json["created"][0]["id"], second.json["created"][0]["id"]]
    queue_add = client.post("/api/queue/items", json={"asset_ids": asset_ids})
    queue_ids = [item["id"] for item in queue_add.json["items"]]

    preview_live = client.post("/api/playback/preview", json={"queue_item_id": queue_ids[0]})
    assert preview_live.status_code == 200
    applied = client.post("/api/playback/apply")
    assert applied.status_code == 200
    assert applied.json["active_queue_item_id"] == queue_ids[0]

    preview_other = client.post("/api/playback/preview", json={"queue_item_id": queue_ids[1]})
    assert preview_other.status_code == 200
    assert preview_other.json["mode"] == "preview"

    paused = client.post("/api/playback/pause")
    assert paused.status_code == 200
    assert paused.json["mode"] == "paused"
    assert paused.json["preview_queue_item_id"] is None
    assert paused.json["preview_asset_id"] is None

    resumed = client.post("/api/playback/resume")
    assert resumed.status_code == 200
    assert resumed.json["mode"] == "displaying"
    assert resumed.json["preview_queue_item_id"] is None
    assert resumed.json["preview_asset_id"] is None
    assert resumed.json["active_queue_item_id"] == queue_ids[0]


def test_apply_preview_failure_does_not_commit_state(client, sample_png_bytes, app):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "queue.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]
    queue_add = client.post("/api/queue/items", json={"asset_ids": [asset_id]})
    queue_item_id = queue_add.json["items"][0]["id"]

    preview = client.post("/api/playback/preview", json={"queue_item_id": queue_item_id})
    assert preview.status_code == 200

    def fail_display(_image, image_settings=None):
        return {"success": False, "hardware_updated": False, "reason": "display offline"}

    app.extensions["display_service"].display_manager.display.display_image = fail_display

    apply_response = client.post("/api/playback/apply")
    assert apply_response.status_code == 503
    assert "display offline" in apply_response.json["error"]

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "preview"
    assert playback.json["state"]["active_queue_item_id"] is None
    assert playback.json["state"]["preview_queue_item_id"] == queue_item_id


def test_next_failure_returns_503_without_committing_state(client, sample_png_bytes, app):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "queue.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]
    queue_add = client.post("/api/queue/items", json={"asset_ids": [asset_id]})
    queue_item_id = queue_add.json["items"][0]["id"]

    def fail_render(*args, **kwargs):
        raise RuntimeError("display offline")

    app.extensions["playback_controller"].display_service.render_asset = fail_render

    response = client.post("/api/playback/next")
    assert response.status_code == 503
    assert "display offline" in response.json["error"]

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "idle"
    assert playback.json["state"]["active_queue_item_id"] is None
    assert playback.json["state"]["preview_queue_item_id"] is None
    assert playback.json["state"]["active_asset_id"] is None
    assert queue_item_id is not None


def test_device_settings_reject_unsupported_fields(client):
    immutable_resolution = client.patch(
        "/api/device/settings",
        json={"resolution": [9999, 9999]},
    )
    assert immutable_resolution.status_code == 400
    assert "resolution" in immutable_resolution.json["error"]

    unknown_image_setting = client.patch(
        "/api/device/settings",
        json={"image_settings": {"gamma": 1.2}},
    )
    assert unknown_image_setting.status_code == 400
    assert "image_settings" in unknown_image_setting.json["error"]

    wrong_type_image_settings = client.patch(
        "/api/device/settings",
        json={"image_settings": []},
    )
    assert wrong_type_image_settings.status_code == 400
    assert "image_settings" in wrong_type_image_settings.json["error"]


def test_cross_site_browser_mutation_is_rejected(client):
    response = client.post(
        "/api/playback/pause",
        headers={"Origin": "http://evil.example"},
    )
    assert response.status_code == 403
    assert "Cross-site" in response.json["error"]


def test_untrusted_host_is_rejected(client):
    response = client.get(
        "/health",
        headers={"Host": "evil.example"},
    )
    assert response.status_code in {400, 403}


def test_trusted_host_is_allowed(client):
    response = client.get(
        "/health",
        headers={"Host": "localhost"},
    )
    assert response.status_code == 200
    assert response.json["ok"] is True


def test_asset_upload_limit_is_enforced(client, sample_png_bytes, app):
    app.extensions["asset_service"].MAX_UPLOAD_BYTES = 8
    response = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "too-large.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "exceeds" in response.json["error"]


def test_auto_advance_failure_falls_back_to_paused(client, sample_png_bytes, app):
    first = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "one.png")},
        content_type="multipart/form-data",
    )
    second = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(make_png_bytes((90, 80, 70))), "two.png")},
        content_type="multipart/form-data",
    )
    asset_ids = [first.json["created"][0]["id"], second.json["created"][0]["id"]]
    queue_add = client.post("/api/queue/items", json={"asset_ids": asset_ids})
    queue_ids = [item["id"] for item in queue_add.json["items"]]

    preview_live = client.post("/api/playback/preview", json={"queue_item_id": queue_ids[0]})
    assert preview_live.status_code == 200
    applied = client.post("/api/playback/apply")
    assert applied.status_code == 200

    def fail_render(*args, **kwargs):
        raise RuntimeError("display offline")

    app.extensions["playback_controller"].display_service.render_asset = fail_render
    expired_at = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
    app.extensions["playback_repo"].update_state(
        {
            "mode": "displaying",
            "display_expires_at": expired_at,
            "updated_at": expired_at,
        }
    )

    app.extensions["playback_controller"].wake_event.set()
    time.sleep(1.2)

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "paused"
    assert playback.json["state"]["active_queue_item_id"] == queue_ids[0]
    assert playback.json["state"]["display_expires_at"] is None


def test_playback_reconciles_after_asset_delete(client, sample_png_bytes):
    upload = client.post(
        "/api/assets",
        data={"files[]": (io.BytesIO(sample_png_bytes), "to-delete.png")},
        content_type="multipart/form-data",
    )
    asset_id = upload.json["created"][0]["id"]

    queue_add = client.post("/api/queue/items", json={"asset_ids": [asset_id]})
    queue_item_id = queue_add.json["items"][0]["id"]

    preview = client.post("/api/playback/preview", json={"queue_item_id": queue_item_id})
    assert preview.status_code == 200

    applied = client.post("/api/playback/apply")
    assert applied.status_code == 200
    assert applied.json["active_asset_id"] == asset_id

    deleted = client.delete(f"/api/assets/{asset_id}")
    assert deleted.status_code == 200

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "idle"
    assert playback.json["state"]["active_asset_id"] is None
    assert playback.json["state"]["active_queue_item_id"] is None
