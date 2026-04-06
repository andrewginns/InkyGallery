from __future__ import annotations

import inspect
import re
from typing import Any

from flask import Blueprint, Response, current_app, jsonify


DOCUMENTED_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
METHOD_ORDER = {method: index for index, method in enumerate(DOCUMENTED_METHODS)}
PATH_PARAM_RE = re.compile(r"<(?:(?P<converter>[^:<>]+):)?(?P<name>[^<>]+)>")

ERROR_SCHEMA = {"$ref": "#/components/schemas/Error"}

COMPONENT_SCHEMAS: dict[str, Any] = {
    "Error": {
        "type": "object",
        "required": ["error"],
        "properties": {
            "error": {
                "type": "string",
                "description": "Human-readable error message.",
            }
        },
    },
    "AssetUploadInput": {
        "type": "object",
        "required": ["files[]"],
        "properties": {
            "files[]": {
                "type": "array",
                "items": {"type": "string", "format": "binary"},
                "description": "One or more image files to ingest.",
            },
            "duplicate_policy": {
                "type": "string",
                "enum": ["reject", "reuse_existing", "keep_both"],
                "default": "reject",
            },
            "auto_add_to_queue": {
                "type": "boolean",
                "default": False,
                "description": "Add successfully ingested assets to the playback queue.",
            },
        },
    },
    "AssetPatchInput": {
        "type": "object",
        "properties": {
            "favorite": {"type": "boolean"},
            "caption": {"type": "string", "nullable": True},
        },
    },
    "CropProfileInput": {
        "type": "object",
        "required": ["x", "y", "width", "height"],
        "properties": {
            "x": {"type": "number", "minimum": 0, "maximum": 1},
            "y": {"type": "number", "minimum": 0, "maximum": 1},
            "width": {"type": "number", "minimum": 0, "maximum": 1},
            "height": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "description": "Normalized crop rectangle in source-image coordinates.",
    },
    "BulkDeleteAssetsInput": {
        "type": "object",
        "required": ["asset_ids"],
        "properties": {
            "asset_ids": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            }
        },
    },
    "QueueItemSettingsInput": {
        "type": "object",
        "properties": {
            "enabled": {"type": "boolean"},
            "timeout_seconds_override": {
                "type": "integer",
                "nullable": True,
                "minimum": 1,
            },
            "fit_mode": {
                "type": "string",
                "enum": ["cover", "contain"],
            },
            "background_mode": {
                "type": "string",
                "enum": ["blur", "solid", "none"],
            },
            "background_color": {
                "type": "string",
                "nullable": True,
                "description": "CSS-style color value, used when background_mode is solid.",
            },
        },
    },
    "AddQueueItemsInput": {
        "type": "object",
        "required": ["asset_ids"],
        "properties": {
            "asset_ids": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "initial_settings": {"$ref": "#/components/schemas/QueueItemSettingsInput"},
        },
    },
    "QueueReorderInput": {
        "type": "object",
        "required": ["ordered_queue_item_ids"],
        "properties": {
            "ordered_queue_item_ids": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            }
        },
    },
    "QueueSortInput": {
        "type": "object",
        "properties": {
            "sort_mode": {
                "type": "string",
                "enum": ["manual", "name_asc", "name_desc", "uploaded_newest", "uploaded_oldest"],
                "default": "manual",
            }
        },
    },
    "ApplyNowInput": {
        "type": "object",
        "required": ["asset_id"],
        "properties": {
            "asset_id": {"type": "string"},
            "initial_settings": {"$ref": "#/components/schemas/QueueItemSettingsInput"},
        },
    },
    "PlaybackSettingsPatch": {
        "type": "object",
        "properties": {
            "default_timeout_seconds": {"type": "integer", "minimum": 1},
            "loop_enabled": {"type": "boolean"},
            "shuffle_enabled": {"type": "boolean"},
            "auto_advance_enabled": {"type": "boolean"},
            "queue_sort_mode": {
                "type": "string",
                "enum": ["manual", "name_asc", "name_desc", "uploaded_newest", "uploaded_oldest"],
            },
        },
    },
    "PlaybackPreviewInput": {
        "type": "object",
        "properties": {
            "queue_item_id": {"type": "string"},
            "asset_id": {"type": "string"},
            "direction": {
                "type": "string",
                "enum": ["next", "previous"],
            },
        },
        "description": "Provide exactly one preview target: queue_item_id, asset_id, or direction.",
    },
    "ImageSettingsPatch": {
        "type": "object",
        "properties": {
            "saturation": {"type": "number", "minimum": 0, "maximum": 2},
            "contrast": {"type": "number", "minimum": 0, "maximum": 2},
            "sharpness": {"type": "number", "minimum": 0, "maximum": 2},
            "brightness": {"type": "number", "minimum": 0, "maximum": 2},
            "inky_saturation": {"type": "number", "minimum": 0, "maximum": 1},
        },
    },
    "DeviceSettingsPatch": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "inverted_image": {"type": "boolean"},
            "timezone": {"type": "string"},
            "time_format": {"type": "string", "enum": ["12h", "24h"]},
            "log_system_stats": {"type": "boolean"},
            "image_settings": {"$ref": "#/components/schemas/ImageSettingsPatch"},
        },
        "description": "Orientation and resolution are not mutable in this build.",
    },
    "AppSettingsPatch": {
        "type": "object",
        "properties": {
            "device_settings": {"$ref": "#/components/schemas/DeviceSettingsPatch"},
            "playback_settings": {"$ref": "#/components/schemas/PlaybackSettingsPatch"},
        },
    },
}

def _json_request_body(schema_ref: str) -> dict[str, Any]:
    return {
        "required": True,
        "content": {
            "application/json": {
                "schema": {"$ref": schema_ref},
            }
        },
    }


def _json_response(description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {"application/json": {"schema": {"type": "object"}}},
    }


def _error_response(description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {"application/json": {"schema": ERROR_SCHEMA}},
    }


ROUTE_METADATA: dict[tuple[str, str], dict[str, Any]] = {
    ("GET", "/health"): {
        "summary": "Health check",
        "description": (
            "Basic liveness endpoint. When `verbose=1`, extra runtime paths are included only for "
            "loopback clients or when DEBUG=1."
        ),
        "tags": ["System"],
        "parameters": [
            {
                "name": "verbose",
                "in": "query",
                "required": False,
                "schema": {"type": "string", "enum": ["0", "1"]},
                "description": "Set to `1` to request extended local debug details.",
            }
        ],
    },
    ("GET", "/api/assets"): {
        "summary": "List assets",
        "description": "List uploaded assets with optional search, favorites filtering, sorting, and cursor pagination.",
        "parameters": [
            {"name": "q", "in": "query", "required": False, "schema": {"type": "string"}},
            {
                "name": "sort",
                "in": "query",
                "required": False,
                "schema": {
                    "type": "string",
                    "enum": ["uploaded_newest", "uploaded_oldest", "name_asc", "name_desc"],
                    "default": "uploaded_newest",
                },
            },
            {
                "name": "favorite",
                "in": "query",
                "required": False,
                "schema": {"type": "string", "enum": ["true", "false"]},
            },
            {
                "name": "limit",
                "in": "query",
                "required": False,
                "schema": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
            },
            {
                "name": "cursor",
                "in": "query",
                "required": False,
                "schema": {"type": "integer", "minimum": 0, "default": 0},
            },
        ],
    },
    ("POST", "/api/assets"): {
        "summary": "Upload assets",
        "description": "Upload one or more supported image files.",
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {"$ref": "#/components/schemas/AssetUploadInput"}
                }
            },
        },
        "responses": {
            "201": _json_response("Assets created"),
            "400": _error_response("Invalid upload or duplicate policy"),
            "413": _error_response("Upload exceeds size limits"),
        },
    },
    ("PATCH", "/api/assets/{asset_id}"): {
        "summary": "Update asset metadata",
        "requestBody": _json_request_body("#/components/schemas/AssetPatchInput"),
    },
    ("PUT", "/api/assets/{asset_id}/crop"): {
        "summary": "Save crop profile",
        "requestBody": _json_request_body("#/components/schemas/CropProfileInput"),
    },
    ("POST", "/api/assets/bulk-delete"): {
        "summary": "Bulk delete assets",
        "requestBody": _json_request_body("#/components/schemas/BulkDeleteAssetsInput"),
    },
    ("GET", "/api/assets/{asset_id}/thumbnail"): {
        "summary": "Fetch asset thumbnail",
        "parameters": [
            {
                "name": "size",
                "in": "query",
                "required": False,
                "schema": {"type": "string", "enum": ["sm", "md"], "default": "sm"},
            }
        ],
        "responses": {
            "200": {
                "description": "Thumbnail image",
                "content": {"image/webp": {"schema": {"type": "string", "format": "binary"}}},
            },
            "404": _error_response("Thumbnail not found"),
        },
    },
    ("POST", "/api/queue/items"): {
        "summary": "Add assets to queue",
        "requestBody": _json_request_body("#/components/schemas/AddQueueItemsInput"),
        "responses": {
            "201": _json_response("Queue items created"),
            "400": _error_response("Invalid queue payload"),
        },
    },
    ("PATCH", "/api/queue/items/{queue_item_id}"): {
        "summary": "Update queue item",
        "requestBody": _json_request_body("#/components/schemas/QueueItemSettingsInput"),
    },
    ("POST", "/api/queue/reorder"): {
        "summary": "Reorder queue",
        "requestBody": _json_request_body("#/components/schemas/QueueReorderInput"),
    },
    ("POST", "/api/queue/sort"): {
        "summary": "Sort queue",
        "requestBody": _json_request_body("#/components/schemas/QueueSortInput"),
    },
    ("POST", "/api/queue/apply-now"): {
        "summary": "Insert and apply an asset immediately",
        "requestBody": _json_request_body("#/components/schemas/ApplyNowInput"),
        "responses": {
            "201": _json_response("Queue item inserted and applied"),
            "400": _error_response("Invalid apply-now payload"),
            "503": _error_response("Queue or device unavailable"),
        },
    },
    ("PATCH", "/api/playback"): {
        "summary": "Update playback settings",
        "requestBody": _json_request_body("#/components/schemas/PlaybackSettingsPatch"),
    },
    ("POST", "/api/playback/preview"): {
        "summary": "Preview a playback target",
        "requestBody": _json_request_body("#/components/schemas/PlaybackPreviewInput"),
    },
    ("PATCH", "/api/device/settings"): {
        "summary": "Update device settings",
        "requestBody": _json_request_body("#/components/schemas/DeviceSettingsPatch"),
    },
    ("PATCH", "/api/settings"): {
        "summary": "Save device and playback settings together",
        "requestBody": _json_request_body("#/components/schemas/AppSettingsPatch"),
    },
    ("GET", "/api/current-image"): {
        "summary": "Fetch current rendered image",
        "responses": {
            "200": {
                "description": "Current image rendered for the device",
                "content": {"image/png": {"schema": {"type": "string", "format": "binary"}}},
            },
            "404": _error_response("Current image not found"),
        },
    },
}


def create_openapi_blueprint() -> Blueprint:
    blueprint = Blueprint("openapi_api", __name__)

    @blueprint.get("/api/openapi.json")
    def openapi_spec():
        return jsonify(build_openapi_spec())

    @blueprint.get("/api/docs")
    def swagger_ui():
        html = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>InkyGallery API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        background: #f6efe5;
      }
      .fallback {
        max-width: 720px;
        margin: 48px auto;
        padding: 24px;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 18px 48px rgba(17, 24, 39, 0.08);
        font: 16px/1.5 system-ui, sans-serif;
        color: #1f2937;
      }
      .fallback code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui">
      <div class="fallback">
        Loading Swagger UI. If the browser cannot fetch the UI assets, the raw OpenAPI document is
        still available at <a href="/api/openapi.json"><code>/api/openapi.json</code></a>.
      </div>
    </div>
    <script>
      window.__inkygallerySwaggerFallback = function () {
        const target = document.getElementById('swagger-ui');
        if (!target) return;
        target.innerHTML =
          '<div class="fallback">Swagger UI assets could not be loaded. Open the raw OpenAPI document at ' +
          '<a href="/api/openapi.json"><code>/api/openapi.json</code></a>.</div>';
      };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" onerror="window.__inkygallerySwaggerFallback()"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js" onerror="window.__inkygallerySwaggerFallback()"></script>
    <script>
      window.addEventListener('load', function () {
        if (!window.SwaggerUIBundle || !window.SwaggerUIStandalonePreset) {
          window.__inkygallerySwaggerFallback();
          return;
        }
        window.ui = window.SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          presets: [window.SwaggerUIBundle.presets.apis, window.SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
        });
      });
    </script>
  </body>
</html>
"""
        return Response(html, mimetype="text/html")

    return blueprint


def build_openapi_spec() -> dict[str, Any]:
    paths: dict[str, dict[str, Any]] = {}

    for rule in sorted(current_app.url_map.iter_rules(), key=lambda candidate: candidate.rule):
        if not _should_document_rule(rule.rule):
            continue

        openapi_path = _normalize_rule_path(rule.rule)
        path_item = paths.setdefault(openapi_path, {})
        for method in sorted(
            (value for value in rule.methods if value in DOCUMENTED_METHODS),
            key=METHOD_ORDER.__getitem__,
        ):
            path_item[method.lower()] = _build_operation(method, openapi_path, rule.endpoint, rule.rule)

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "InkyGallery API",
            "version": "0.1.0",
            "description": (
                "Auto-generated OpenAPI document for the live Flask routes. "
                "The route list is discovered from the app at runtime and enriched with the current request "
                "validation rules used by the backend."
            ),
        },
        "servers": [{"url": "/"}],
        "tags": [
            {"name": "System"},
            {"name": "Assets"},
            {"name": "Queue"},
            {"name": "Playback"},
            {"name": "Device"},
            {"name": "Display"},
        ],
        "paths": paths,
        "components": {"schemas": COMPONENT_SCHEMAS},
    }


def _build_operation(method: str, openapi_path: str, endpoint: str, raw_rule: str) -> dict[str, Any]:
    metadata = ROUTE_METADATA.get((method, openapi_path), {})
    view = current_app.view_functions.get(endpoint)
    description = metadata.get("description")
    if description is None and view is not None:
        description = inspect.getdoc(view)

    operation = {
        "operationId": f"{endpoint.replace('.', '_')}_{method.lower()}",
        "summary": metadata.get("summary") or _summary_from_endpoint(endpoint, method, openapi_path),
        "tags": metadata.get("tags") or [_tag_for_path(openapi_path)],
        "responses": metadata.get("responses") or _default_responses(method, openapi_path),
    }
    if description:
        operation["description"] = description

    parameters = _path_parameters(raw_rule) + metadata.get("parameters", [])
    if parameters:
        operation["parameters"] = parameters

    request_body = metadata.get("requestBody")
    if request_body:
        operation["requestBody"] = request_body

    return operation


def _path_parameters(raw_rule: str) -> list[dict[str, Any]]:
    parameters: list[dict[str, Any]] = []
    for match in PATH_PARAM_RE.finditer(raw_rule):
        converter = (match.group("converter") or "string").lower()
        name = match.group("name")
        schema: dict[str, Any] = {"type": "string"}
        if converter == "int":
            schema = {"type": "integer"}
        elif converter == "float":
            schema = {"type": "number"}
        elif converter == "uuid":
            schema = {"type": "string", "format": "uuid"}

        parameters.append(
            {
                "name": name,
                "in": "path",
                "required": True,
                "schema": schema,
            }
        )
    return parameters


def _default_responses(method: str, openapi_path: str) -> dict[str, Any]:
    if method == "POST" and openapi_path in {"/api/assets", "/api/queue/items", "/api/queue/apply-now"}:
        success_code = "201"
    else:
        success_code = "200"

    responses: dict[str, Any] = {success_code: _json_response("Success")}
    if method in {"POST", "PUT", "PATCH"}:
        responses["400"] = _error_response("Invalid request")
    if openapi_path != "/health":
        responses["404"] = _error_response("Not found")
    if method in {"POST"} and openapi_path == "/api/assets":
        responses["413"] = _error_response("Upload exceeds size limits")
    if openapi_path in {
        "/api/queue/apply-now",
        "/api/playback/apply",
        "/api/playback/rerender-active",
        "/api/playback/next",
        "/api/playback/previous",
    }:
        responses["503"] = _error_response("Device or playback service unavailable")
    return responses


def _tag_for_path(openapi_path: str) -> str:
    if openapi_path == "/health":
        return "System"
    if openapi_path.startswith("/api/assets"):
        return "Assets"
    if openapi_path.startswith("/api/queue"):
        return "Queue"
    if openapi_path.startswith("/api/playback"):
        return "Playback"
    if openapi_path.startswith("/api/device") or openapi_path == "/api/settings":
        return "Device"
    if openapi_path.startswith("/api/display") or openapi_path == "/api/current-image":
        return "Display"
    return "System"


def _summary_from_endpoint(endpoint: str, method: str, openapi_path: str) -> str:
    endpoint_name = endpoint.rsplit(".", 1)[-1]
    words = endpoint_name.replace("_", " ").strip()
    if words:
        return words.capitalize()
    return f"{method.title()} {openapi_path}"


def _normalize_rule_path(rule: str) -> str:
    return PATH_PARAM_RE.sub(lambda match: "{" + match.group("name") + "}", rule)


def _should_document_rule(rule: str) -> bool:
    if rule in {"/api/openapi.json", "/api/docs", "/", "/<path:path>"}:
        return False
    return rule == "/health" or rule.startswith("/api/")
