import type { DeviceSettings, PlaybackSettings, PlaybackState } from '@/data/types';

export const EMPTY_PLAYBACK_STATE: PlaybackState = {
  mode: 'idle',
  active_queue_item_id: null,
  active_asset_id: null,
  preview_queue_item_id: null,
  preview_asset_id: null,
  display_started_at: null,
  display_expires_at: null,
  current_image_url: null,
  last_rendered_url: null,
  time_remaining_seconds: null,
};

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  default_timeout_seconds: 300,
  loop_enabled: true,
  shuffle_enabled: false,
  auto_advance_enabled: true,
  queue_sort_mode: 'manual',
};

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  name: 'InkyGallery',
  resolution: [800, 480],
  orientation: 'vertical',
  inverted_image: false,
  timezone: 'UTC',
  time_format: '24h',
  log_system_stats: false,
  image_settings: {
    saturation: 1.0,
    contrast: 1.0,
    sharpness: 1.0,
    brightness: 1.0,
    inky_saturation: 0.5,
  },
};
