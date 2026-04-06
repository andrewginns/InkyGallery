import type { Asset, DeviceSettings } from '@/data/types';

export interface CropProfile {
  x: number;
  y: number;
  width: number;
  height: number;
  updated_at?: string;
}

const CROP_EPSILON = 0.0005;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getPreviewDimensions(deviceSettings: DeviceSettings): [number, number] {
  const [width, height] = deviceSettings.resolution;
  return deviceSettings.orientation === 'vertical' ? [height, width] : [width, height];
}

export function getPreviewAspectRatio(deviceSettings: DeviceSettings): number {
  const [width, height] = getPreviewDimensions(deviceSettings);
  return width / height;
}

export function getDefaultCropProfile(
  asset: Pick<Asset, 'width' | 'height'>,
  deviceSettings: DeviceSettings
): CropProfile {
  const imageAspect = asset.width / asset.height;
  const targetAspect = getPreviewAspectRatio(deviceSettings);

  if (imageAspect > targetAspect) {
    const width = targetAspect / imageAspect;
    return {
      x: (1 - width) / 2,
      y: 0,
      width,
      height: 1,
    };
  }

  const height = imageAspect / targetAspect;
  return {
    x: 0,
    y: (1 - height) / 2,
    width: 1,
    height,
  };
}

export function getEffectiveCropProfile(
  asset: Pick<Asset, 'width' | 'height' | 'crop_profile'>,
  deviceSettings: DeviceSettings
): CropProfile {
  return asset.crop_profile
    ? normalizeCropProfile(asset.crop_profile, asset, deviceSettings)
    : getDefaultCropProfile(asset, deviceSettings);
}

export function normalizeCropProfile(
  crop: CropProfile,
  asset: Pick<Asset, 'width' | 'height'>,
  deviceSettings: DeviceSettings
): CropProfile {
  const defaultCrop = getDefaultCropProfile(asset, deviceSettings);
  const aspectRatio = defaultCrop.width / defaultCrop.height;
  const maxWidth = defaultCrop.width;
  const maxHeight = defaultCrop.height;
  const minWidth = maxWidth / 6;
  const minHeight = maxHeight / 6;

  let width = clamp(crop.width, minWidth, maxWidth);
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  if (height < minHeight) {
    height = minHeight;
    width = height * aspectRatio;
  }

  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
    updated_at: crop.updated_at,
  };
}

export function areCropProfilesEquivalent(a: CropProfile, b: CropProfile): boolean {
  return (
    Math.abs(a.x - b.x) <= CROP_EPSILON &&
    Math.abs(a.y - b.y) <= CROP_EPSILON &&
    Math.abs(a.width - b.width) <= CROP_EPSILON &&
    Math.abs(a.height - b.height) <= CROP_EPSILON
  );
}

export function cropProfileToImageStyle(crop: CropProfile) {
  return {
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${-(crop.x / crop.width) * 100}%`,
    top: `${-(crop.y / crop.height) * 100}%`,
  } as const;
}

export function getCropZoom(
  crop: CropProfile,
  asset: Pick<Asset, 'width' | 'height'>,
  deviceSettings: DeviceSettings
): number {
  const defaultCrop = getDefaultCropProfile(asset, deviceSettings);
  return clamp(defaultCrop.width / crop.width, 1, 6);
}

export function setCropZoom(
  crop: CropProfile,
  zoom: number,
  asset: Pick<Asset, 'width' | 'height'>,
  deviceSettings: DeviceSettings
): CropProfile {
  const defaultCrop = getDefaultCropProfile(asset, deviceSettings);
  const nextZoom = clamp(zoom, 1, 6);
  const nextWidth = defaultCrop.width / nextZoom;
  const nextHeight = defaultCrop.height / nextZoom;
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;

  return normalizeCropProfile(
    {
      x: centerX - nextWidth / 2,
      y: centerY - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
    },
    asset,
    deviceSettings
  );
}

export function translateCropByViewportDelta(
  crop: CropProfile,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number,
  asset: Pick<Asset, 'width' | 'height'>,
  deviceSettings: DeviceSettings
): CropProfile {
  if (!viewportWidth || !viewportHeight) {
    return crop;
  }

  return normalizeCropProfile(
    {
      x: crop.x - (deltaX / viewportWidth) * crop.width,
      y: crop.y - (deltaY / viewportHeight) * crop.height,
      width: crop.width,
      height: crop.height,
    },
    asset,
    deviceSettings
  );
}
