import io


def test_health_and_defaults(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json["ok"] is True

    settings = client.get("/api/device/settings")
    assert settings.status_code == 200
    assert settings.json["name"] == "InkyGallery"
    assert settings.json["image_settings"]["brightness"] == 1.0
    assert settings.json["image_settings"]["inky_saturation"] == 0.5

    current_image = client.get("/api/current-image")
    assert current_image.status_code == 200
    assert current_image.mimetype == "image/png"


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

    listed = client.get("/api/assets")
    assert listed.status_code == 200
    assert len(listed.json["items"]) == 1

    original = client.get(f"/api/assets/{asset_id}/file")
    assert original.status_code == 200

    thumbnail = client.get(f"/api/assets/{asset_id}/thumbnail?size=sm")
    assert thumbnail.status_code == 200
    assert thumbnail.mimetype == "image/webp"


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

    apply_response = client.post("/api/playback/apply")
    assert apply_response.status_code == 200, apply_response.json
    assert apply_response.json["mode"] == "displaying"
    assert apply_response.json["active_queue_item_id"] == queue_item_id

    playback = client.get("/api/playback")
    assert playback.status_code == 200
    assert playback.json["state"]["mode"] == "displaying"
    assert playback.json["active_item"]["id"] == queue_item_id

    display_status = client.get("/api/display/status")
    assert display_status.status_code == 200
    assert display_status.json["active_asset_id"] == asset_id
    assert display_status.json["mode"] == "displaying"


def test_device_settings_patch(client):
    response = client.patch(
        "/api/device/settings",
        json={
            "orientation": "vertical",
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
