import atexit
import ipaddress
import logging.config
import logging
import os
import socket
from pathlib import Path
from urllib.parse import urlparse

import psutil
from flask import Flask, jsonify, request, send_from_directory
from PIL import Image

try:
    from pi_heif import register_heif_opener
except ImportError:  # pragma: no cover - optional dependency during local bootstrap
    register_heif_opener = None

from api.assets import create_assets_blueprint
from api.device import create_device_blueprint
from api.playback import create_playback_blueprint
from api.queue import create_queue_blueprint
from display.display_manager import DisplayManager
from repositories.assets_repo import AssetsRepository
from repositories.playback_repo import PlaybackRepository
from repositories.queue_repo import QueueRepository
from services.asset_service import AssetService
from services.device_settings_service import DeviceSettingsService
from services.display_service import DisplayService
from services.playback_controller import PlaybackController
from services.queue_service import QueueService
from storage.database import Database
from storage.media_store import MediaStore
from utils.paths import PROJECT_ROOT, SRC_DIR


def _path_from_env(env_name: str, default: Path) -> Path:
    value = os.getenv(env_name)
    return Path(value).expanduser() if value else default


def _resolve_frontend_dir() -> Path:
    configured = os.getenv("INKYGALLERY_FRONTEND_DIR")
    if configured:
        return Path(configured).expanduser()

    preferred = SRC_DIR / "static" / "app"
    legacy = PROJECT_ROOT / "inky-gallery-ui" / "dist"
    return preferred if preferred.exists() else legacy


def _normalize_host(host: str | None) -> str | None:
    if not host:
        return None
    normalized = host.strip().lower()
    if normalized.startswith("[") and "]" in normalized:
        normalized = normalized[1:normalized.index("]")]
    elif ":" in normalized and normalized.count(":") == 1:
        normalized = normalized.split(":", 1)[0]
    return normalized


def _discover_trusted_hosts() -> set[str]:
    hosts = {"localhost", "127.0.0.1", "::1"}

    configured = os.getenv("INKYGALLERY_TRUSTED_HOSTS", "")
    hosts.update(filter(None, (_normalize_host(value) for value in configured.split(","))))

    hostname = socket.gethostname().strip().lower()
    if hostname:
        hosts.add(hostname)
        hosts.add(f"{hostname}.local")

    for addresses in psutil.net_if_addrs().values():
        for address in addresses:
            value = getattr(address, "address", "")
            host = _normalize_host(value.split("%", 1)[0] if "%" in value else value)
            if not host:
                continue
            try:
                parsed = ipaddress.ip_address(host)
            except ValueError:
                continue
            if parsed.is_loopback or parsed.is_private or parsed.is_link_local:
                hosts.add(host)

    return hosts


def create_app():
    logging.config.fileConfig(str(SRC_DIR / "config" / "logging.conf"), disable_existing_loggers=False)
    if register_heif_opener is not None:
        register_heif_opener()
    else:
        logging.getLogger(__name__).warning("pi_heif not installed; HEIF/HEIC uploads will not be available")

    app = Flask(__name__)
    default_request_limit = AssetService.MAX_UPLOAD_BYTES + (2 * 1024 * 1024)
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("INKYGALLERY_MAX_REQUEST_BYTES", default_request_limit))
    app.config["FRONTEND_DIR"] = _resolve_frontend_dir()
    app.config["TRUSTED_HOSTS"] = _discover_trusted_hosts()

    data_dir = _path_from_env("INKYGALLERY_DATA_DIR", SRC_DIR / "data")
    device_config_path = _path_from_env("INKYGALLERY_DEVICE_CONFIG_PATH", SRC_DIR / "config" / "device.json")
    current_image_path = _path_from_env("INKYGALLERY_CURRENT_IMAGE_PATH", SRC_DIR / "static" / "images" / "current_image.png")

    media_store = MediaStore(data_dir=data_dir, current_image_path=current_image_path)
    device_settings_service = DeviceSettingsService(device_config_path)
    if not media_store.current_image_path.exists():
        Image.new("RGB", device_settings_service.get_resolution(), color=(255, 255, 255)).save(media_store.current_image_path)
    database = Database(data_dir / "inkygallery.db")
    database.initialize(SRC_DIR / "storage" / "schema.sql")

    assets_repo = AssetsRepository(database)
    queue_repo = QueueRepository(database)
    playback_repo = PlaybackRepository(database)

    display_manager = DisplayManager(device_settings_service, media_store.current_image_path)
    display_service = DisplayService(media_store, assets_repo, device_settings_service, display_manager)
    asset_service = AssetService(assets_repo, queue_repo, media_store)
    queue_service = QueueService(queue_repo, assets_repo)
    playback_controller = PlaybackController(playback_repo, queue_repo, display_service, queue_service=queue_service)

    app.register_blueprint(create_assets_blueprint(asset_service, playback_controller))
    app.register_blueprint(create_queue_blueprint(queue_service, playback_controller))
    app.register_blueprint(create_playback_blueprint(playback_controller))
    app.register_blueprint(create_device_blueprint(device_settings_service, playback_controller, media_store))

    @app.before_request
    def reject_untrusted_hosts():
        host = _normalize_host(request.host)
        if host and host not in app.config["TRUSTED_HOSTS"]:
            return jsonify({"error": "Untrusted host"}), 403
        return None

    @app.before_request
    def reject_cross_site_mutations():
        if request.method not in {"POST", "PATCH", "PUT", "DELETE"}:
            return None
        if not request.path.startswith("/api/"):
            return None

        sec_fetch_site = request.headers.get("Sec-Fetch-Site", "").lower()
        if sec_fetch_site and sec_fetch_site not in {"same-origin", "same-site", "none"}:
            return jsonify({"error": "Cross-site browser requests are not allowed"}), 403

        origin = request.headers.get("Origin")
        if origin:
            origin_host = _normalize_host(urlparse(origin).netloc)
            if origin_host and origin_host not in app.config["TRUSTED_HOSTS"]:
                return jsonify({"error": "Cross-site browser requests are not allowed"}), 403
        return None

    @app.get("/health")
    def health():
        return {
            "ok": True,
            "project_root": str(PROJECT_ROOT),
            "frontend_dir": str(app.config["FRONTEND_DIR"]),
            "data_dir": str(data_dir),
            "device_config_path": str(device_config_path),
            "current_image_path": str(current_image_path),
        }

    @app.get("/")
    def frontend_index():
        frontend_dir = Path(app.config["FRONTEND_DIR"])
        if not (frontend_dir / "index.html").exists():
            return {"error": "Frontend build not found", "frontend_dir": str(frontend_dir)}, 503
        return send_from_directory(frontend_dir, "index.html")

    @app.get("/<path:path>")
    def frontend_files(path: str):
        if path.startswith("api/"):
            return {"error": "API route not found"}, 404
        frontend_dir = Path(app.config["FRONTEND_DIR"])
        candidate = frontend_dir / path
        if candidate.exists() and candidate.is_file():
            return send_from_directory(frontend_dir, path)
        if candidate.suffix:
            return {"error": "Frontend asset not found", "path": path}, 404
        if (frontend_dir / "index.html").exists():
            return send_from_directory(frontend_dir, "index.html")
        return {"error": "Frontend build not found", "frontend_dir": str(frontend_dir)}, 503

    playback_controller.start()
    atexit.register(playback_controller.stop)

    app.extensions["device_settings_service"] = device_settings_service
    app.extensions["database"] = database
    app.extensions["media_store"] = media_store
    app.extensions["assets_repo"] = assets_repo
    app.extensions["queue_repo"] = queue_repo
    app.extensions["playback_repo"] = playback_repo
    app.extensions["asset_service"] = asset_service
    app.extensions["queue_service"] = queue_service
    app.extensions["display_service"] = display_service
    app.extensions["playback_controller"] = playback_controller
    app.extensions["frontend_dir"] = app.config["FRONTEND_DIR"]
    return app
