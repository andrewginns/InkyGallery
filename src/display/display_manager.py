import logging

from display.inky_display import InkyDisplay
from utils.image_utils import apply_image_enhancement, change_orientation


logger = logging.getLogger(__name__)


class DisplayManager:
    def __init__(self, device_settings_service, current_image_path):
        self.device_settings_service = device_settings_service
        self.current_image_path = current_image_path
        self.display = InkyDisplay(device_settings_service)

    def display_image(self, image):
        settings = self.device_settings_service.get_settings()
        image = change_orientation(image, settings.get("orientation", "horizontal"))
        if settings.get("inverted_image"):
            image = image.rotate(180)
        image = apply_image_enhancement(image, settings.get("image_settings", {}))
        image.save(self.current_image_path)
        self.display.display_image(image)
        return image

    def get_status(self):
        status = self.display.get_status()
        status["current_image_path"] = str(self.current_image_path)
        status["current_image_exists"] = self.current_image_path.exists()
        return status
