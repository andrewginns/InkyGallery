from PIL import Image, ImageColor, ImageOps

from utils.image_loader import AdaptiveImageLoader
from utils.image_utils import compute_image_hash, pad_image_blur


class DisplayService:
    def __init__(self, media_store, assets_repo, device_settings_service, display_manager):
        self.media_store = media_store
        self.assets_repo = assets_repo
        self.device_settings_service = device_settings_service
        self.display_manager = display_manager
        self.image_loader = AdaptiveImageLoader()

    def get_display_dimensions(self) -> tuple[int, int]:
        width, height = self.device_settings_service.get_resolution()
        orientation = self.device_settings_service.get_setting("orientation", "horizontal")
        return (width, height) if orientation == "horizontal" else (height, width)

    def render_asset(self, asset_id: str, fit_mode="cover", background_mode="blur", background_color=None):
        asset = self.assets_repo.get_asset(asset_id)
        if not asset:
            raise ValueError(f"Asset '{asset_id}' does not exist")

        original_path = self.media_store.original_path(asset_id, asset["filename_stored"])
        dimensions = self.get_display_dimensions()
        image = self.image_loader.from_file(str(original_path), dimensions, resize=False)
        if image is None:
            raise RuntimeError(f"Failed to load asset '{asset_id}'")

        crop_profile = self.assets_repo.get_crop_profile(asset_id)
        image = self._apply_render_mode(image, dimensions, fit_mode, background_mode, background_color, crop_profile)
        final_image = self.display_manager.display_image(image)
        return {
            "asset_id": asset_id,
            "image_hash": compute_image_hash(final_image),
            "current_image_path": str(self.media_store.current_image_path),
        }

    def _apply_render_mode(self, image, dimensions, fit_mode, background_mode, background_color, crop_profile=None):
        if fit_mode == "cover":
            if crop_profile:
                image = self._apply_saved_crop(image, crop_profile)
            return ImageOps.fit(image, dimensions, method=Image.Resampling.LANCZOS)
        if fit_mode != "contain":
            raise ValueError("fit_mode must be one of: cover, contain")

        if background_mode == "blur":
            return pad_image_blur(image, dimensions)
        if background_mode == "solid":
            color = ImageColor.getcolor(background_color or "#ffffff", "RGB")
            return ImageOps.pad(image, dimensions, color=color, method=Image.Resampling.LANCZOS)
        if background_mode == "none":
            return ImageOps.pad(image, dimensions, color=(255, 255, 255), method=Image.Resampling.LANCZOS)
        raise ValueError("background_mode must be one of: blur, solid, none")

    def _apply_saved_crop(self, image: Image.Image, crop_profile: dict):
        width, height = image.size
        left = max(0, min(width - 1, round(float(crop_profile["crop_x"]) * width)))
        top = max(0, min(height - 1, round(float(crop_profile["crop_y"]) * height)))
        right = max(left + 1, min(width, round((float(crop_profile["crop_x"]) + float(crop_profile["crop_width"])) * width)))
        bottom = max(top + 1, min(height, round((float(crop_profile["crop_y"]) + float(crop_profile["crop_height"])) * height)))
        return image.crop((left, top, right, bottom))
