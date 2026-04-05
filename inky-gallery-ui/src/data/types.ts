export interface Asset {
  id: string;
  filename_original: string;
  width: number;
  height: number;
  file_size_bytes: number;
  mime_type: string;
  favorite: boolean;
  caption: string;
  created_at: string;
  thumbnail_url: string;
  original_url: string;
}

export interface QueueItem {
  id: string;
  asset_id: string;
  position: number;
  enabled: boolean;
  timeout_seconds_override: number | null;
  fit_mode: 'cover' | 'contain';
  background_mode: 'blur' | 'solid' | 'none';
  background_color: string | null;
  asset: Asset;
}

export interface PlaybackSettings {
  default_timeout_seconds: number;
  loop_enabled: boolean;
  shuffle_enabled: boolean;
  auto_advance_enabled: boolean;
  queue_sort_mode: 'manual' | 'name_asc' | 'name_desc' | 'uploaded_newest' | 'uploaded_oldest';
}

export interface PlaybackState {
  mode: 'idle' | 'preview' | 'displaying' | 'paused';
  active_queue_item_id: string | null;
  active_asset_id: string | null;
  preview_queue_item_id: string | null;
  preview_asset_id: string | null;
  display_started_at: string | null;
  display_expires_at: string | null;
  last_rendered_url: string | null;
}

export interface DeviceSettings {
  name: string;
  resolution: [number, number];
  orientation: 'horizontal' | 'vertical';
  inverted_image: boolean;
  timezone: string;
  time_format: '12h' | '24h';
  log_system_stats: boolean;
  image_settings: {
    saturation: number;
    contrast: number;
    sharpness: number;
    brightness: number;
    inky_saturation: number;
  };
}
