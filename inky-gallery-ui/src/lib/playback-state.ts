import type { DisplayStatus, PlaybackPayload, PlaybackSettings, PlaybackState, QueueItem } from '@/data/types';

function buildImageUrl(url: string | null | undefined, cacheKey: string | null | undefined) {
  if (!url) {
    return null;
  }
  if (!cacheKey) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(cacheKey)}`;
}

export function normalizePlaybackState(
  state: PlaybackState,
  displayStatus: DisplayStatus | null
): PlaybackState {
  const cacheKey =
    state.last_image_hash ||
    state.last_rendered_at ||
    displayStatus?.current_image_hash ||
    displayStatus?.last_rendered_at ||
    null;
  const baseUrl = state.current_image_url || displayStatus?.current_image_url || '/api/current-image';
  const currentImageUrl = buildImageUrl(baseUrl, cacheKey);

  return {
    ...state,
    current_image_url: currentImageUrl,
    last_rendered_url: currentImageUrl,
  };
}

export function applyPlaybackPayload(
  payload: PlaybackPayload,
  nextDisplayStatus: DisplayStatus | null
) {
  return {
    settings: payload.settings,
    state: normalizePlaybackState(payload.state, nextDisplayStatus),
  };
}

export function buildOptimisticApplyState(
  current: PlaybackState,
  queue: QueueItem[],
  settings: PlaybackSettings
): PlaybackState {
  const previewQueueItem = current.preview_queue_item_id
    ? queue.find((item) => item.id === current.preview_queue_item_id) || null
    : null;
  const timeoutSeconds =
    previewQueueItem?.timeout_seconds_override ?? settings.default_timeout_seconds;
  const now = new Date();

  return {
    ...current,
    mode: 'displaying',
    active_queue_item_id: current.preview_queue_item_id ?? current.active_queue_item_id,
    active_asset_id: current.preview_asset_id ?? current.active_asset_id,
    preview_queue_item_id: null,
    preview_asset_id: null,
    display_started_at: now.toISOString(),
    display_expires_at: new Date(now.getTime() + timeoutSeconds * 1000).toISOString(),
    time_remaining_seconds: timeoutSeconds,
  };
}
