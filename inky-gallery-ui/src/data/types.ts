export interface CropProfile {
  x: number;
  y: number;
  width: number;
  height: number;
  updated_at?: string;
}

export interface Asset {
  id: string;
  filename_original: string;
  width: number;
  height: number;
  file_size_bytes: number;
  mime_type: string;
  favorite: boolean;
  caption: string | null;
  created_at: string;
  updated_at?: string;
  thumbnail_url: string | null;
  thumbnail_url_md?: string | null;
  original_url: string;
  crop_profile: CropProfile | null;
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
  asset: Pick<Asset, 'id' | 'filename_original' | 'thumbnail_url' | 'original_url'>;
}

export type QueueSortMode =
  | 'manual'
  | 'name_asc'
  | 'name_desc'
  | 'uploaded_newest'
  | 'uploaded_oldest';

export interface PlaybackSettings {
  default_timeout_seconds: number;
  loop_enabled: boolean;
  shuffle_enabled: boolean;
  auto_advance_enabled: boolean;
  queue_sort_mode: QueueSortMode;
}

export interface PlaybackState {
  mode: 'idle' | 'preview' | 'displaying' | 'paused';
  active_queue_item_id: string | null;
  active_asset_id: string | null;
  preview_queue_item_id: string | null;
  preview_asset_id: string | null;
  display_started_at: string | null;
  display_expires_at: string | null;
  current_image_url: string | null;
  last_rendered_url: string | null;
  last_image_hash?: string | null;
  last_rendered_at?: string | null;
  time_remaining_seconds?: number | null;
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

export interface DisplayStatus {
  resolution: [number, number];
  orientation: 'horizontal' | 'vertical';
  active_asset_id: string | null;
  preview_asset_id: string | null;
  mode: PlaybackState['mode'];
  current_image_url: string;
  current_image_hash: string | null;
  last_rendered_at: string | null;
  default_timeout_seconds: number;
  time_remaining_seconds: number | null;
  hardware: {
    display_type: 'inky';
    hardware_enabled: boolean;
    hardware_ready: boolean;
    detected_model: string | null;
    detected_resolution: [number, number] | null;
    init_error: string | null;
    current_image_path: string;
    current_image_exists: boolean;
  };
}

export interface PlaybackPayload {
  settings: PlaybackSettings;
  state: PlaybackState;
  active_item: QueueItem | null;
  preview_item: QueueItem | null;
}
