import logging
import os
from display.abstract_display import AbstractDisplay


logger = logging.getLogger(__name__)

class InkyDisplay(AbstractDisplay):

    """
    Handles the Inky e-paper display.

    This class initializes and manages interactions with the Inky display,
    ensuring proper image rendering and configuration storage.

    The Inky display driver supports auto configuration.
    """
   
    def initialize_display(self):
        
        """
        Initializes the Inky display device.

        Sets the display border and stores the display resolution in the device configuration.

        Raises:
            ValueError: If the resolution cannot be retrieved or stored.
        """
        
        self.hardware_enabled = os.getenv("INKY_SKIP_HARDWARE", "0") != "1"
        self.hardware_ready = False
        self.init_error = None
        self.detected_model = None
        self.detected_resolution = None
        self.inky_display = None

        if not self.hardware_enabled:
            logger.warning("INKY_SKIP_HARDWARE=1, skipping physical Inky initialization")
            return

        try:
            from inky.auto import auto
        except ImportError as exc:
            self.init_error = (
                "Inky hardware support is required. Install the inky package or set "
                "INKY_SKIP_HARDWARE=1 for non-hardware runs."
            )
            logger.exception("Failed to import Inky hardware support")
            return

        try:
            self.inky_display = auto()
            self.inky_display.set_border(self.inky_display.BLACK)
            self.detected_model = type(self.inky_display).__name__
            self.detected_resolution = [int(self.inky_display.width), int(self.inky_display.height)]
            self.hardware_ready = True
        except Exception as exc:  # pragma: no cover - exercised on real hardware only
            self.init_error = str(exc)
            logger.exception("Failed to initialize Inky hardware")
            return

        # store display resolution in device config
        if not self.device_config.get_config("resolution"):
            self.device_config.update_value("resolution", self.detected_resolution, write=True)

    def display_image(self, image, image_settings=[]):
        
        """
        Displays the provided image on the Inky display.

        The image has been processed by adjusting orientation and resizing 
        before being sent to the display.

        Args:
            image (PIL.Image): The image to be displayed.
            image_settings (list, optional): Additional settings to modify image rendering.

        Raises:
            ValueError: If no image is provided.
        """

        logger.info("Displaying image to Inky display.")
        if not image:
            raise ValueError(f"No image provided.")

        if not self.hardware_enabled:
            logger.info("Hardware output skipped; current image file updated only.")
            return

        if not self.hardware_ready or self.inky_display is None:
            logger.warning("Inky hardware not ready; current image file updated only.")
            return

        # Display the image on the Inky display
        inky_saturation = self.device_config.get_config('image_settings').get("inky_saturation", 0.5)
        logger.info(f"Inky Saturation: {inky_saturation}")
        self.inky_display.set_image(image, saturation=inky_saturation)
        self.inky_display.show()

    def get_status(self):
        return {
            "display_type": "inky",
            "hardware_enabled": self.hardware_enabled,
            "hardware_ready": self.hardware_ready,
            "detected_model": self.detected_model,
            "detected_resolution": self.detected_resolution,
            "init_error": self.init_error,
        }
