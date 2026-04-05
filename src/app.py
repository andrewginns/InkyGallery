import atexit
import logging.config
import logging

from flask import Flask
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


def create_app():
    logging.config.fileConfig(str(SRC_DIR / "config" / "logging.conf"), disable_existing_loggers=False)
    if register_heif_opener is not None:
        register_heif_opener()
    else:
        logging.getLogger(__name__).warning("pi_heif not installed; HEIF/HEIC uploads will not be available")

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024

    media_store = MediaStore()
    device_settings_service = DeviceSettingsService(SRC_DIR / "config" / "device.json")
    if not media_store.current_image_path.exists():
        Image.new("RGB", device_settings_service.get_resolution(), color=(255, 255, 255)).save(media_store.current_image_path)
    database = Database(SRC_DIR / "data" / "inkygallery.db")
    database.initialize(SRC_DIR / "storage" / "schema.sql")

    assets_repo = AssetsRepository(database)
    queue_repo = QueueRepository(database)
    playback_repo = PlaybackRepository(database)

    display_manager = DisplayManager(device_settings_service, media_store.current_image_path)
    display_service = DisplayService(media_store, assets_repo, device_settings_service, display_manager)
    asset_service = AssetService(assets_repo, queue_repo, media_store)
    queue_service = QueueService(queue_repo, assets_repo)
    playback_controller = PlaybackController(playback_repo, queue_repo, display_service)

    app.register_blueprint(create_assets_blueprint(asset_service))
    app.register_blueprint(create_queue_blueprint(queue_service, playback_controller))
    app.register_blueprint(create_playback_blueprint(playback_controller))
    app.register_blueprint(create_device_blueprint(device_settings_service, playback_controller, media_store))

    @app.get("/health")
    def health():
        return {"ok": True, "project_root": str(PROJECT_ROOT)}

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
    return app
