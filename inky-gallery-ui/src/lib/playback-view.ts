import type { Asset, PlaybackState, QueueItem } from '@/data/types';

export function derivePlaybackView(
  playbackState: PlaybackState,
  queue: QueueItem[],
  assets: Asset[]
) {
  const activeAsset = assets.find((asset) => asset.id === playbackState.active_asset_id) || null;
  const previewAsset = assets.find((asset) => asset.id === playbackState.preview_asset_id) || null;
  const liveQueueItem = queue.find((item) => item.id === playbackState.active_queue_item_id) || null;
  const previewQueueItem = queue.find((item) => item.id === playbackState.preview_queue_item_id) || null;

  return {
    activeAsset,
    previewAsset,
    displayedAsset: previewAsset || activeAsset,
    liveQueueItem,
    previewQueueItem,
    selectedQueueItem: previewQueueItem || liveQueueItem,
  };
}
