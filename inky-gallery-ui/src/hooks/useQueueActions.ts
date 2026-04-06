import type { Dispatch, SetStateAction } from 'react';
import {
  addQueueItems,
  applyAssetNow,
  deleteQueueItem,
  getQueue,
  reorderQueue,
  sortQueue,
  updatePlaybackSettings,
  updateQueueItem,
} from '@/lib/api';
import type { PlaybackSettings, QueueItem, QueueSortMode } from '@/data/types';

interface UseQueueActionsOptions {
  queue: QueueItem[];
  setQueue: Dispatch<SetStateAction<QueueItem[]>>;
  setActiveTab: (tab: 'now-playing' | 'library' | 'queue' | 'settings') => void;
  setPlaybackSettings: Dispatch<SetStateAction<PlaybackSettings>>;
  refreshPlaybackAndDisplay: () => Promise<void>;
  runAction: (message: string, action: () => Promise<void>) => Promise<void>;
}

export function useQueueActions({
  queue,
  setQueue,
  setActiveTab,
  setPlaybackSettings,
  refreshPlaybackAndDisplay,
  runAction,
}: UseQueueActionsOptions) {
  const handleAddToQueue = (assetIds: string[]) =>
    runAction('Updating queue…', async () => {
      await addQueueItems(assetIds);
      setQueue(await getQueue());
    });

  const handleApplyAssetNow = (assetId: string) =>
    runAction('Rendering to device…', async () => {
      setActiveTab('now-playing');
      await applyAssetNow(assetId);
      setQueue(await getQueue());
      await refreshPlaybackAndDisplay();
    });

  const handleUpdateQueueItem = (queueItemId: string, updates: Partial<QueueItem>) =>
    runAction('Saving queue settings…', async () => {
      const updated = await updateQueueItem(queueItemId, updates);
      setQueue((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshPlaybackAndDisplay();
    });

  const handleRemoveQueueItem = (queueItemId: string) =>
    runAction('Removing queue item…', async () => {
      await deleteQueueItem(queueItemId);
      setQueue(await getQueue());
      await refreshPlaybackAndDisplay();
    });

  const handleMoveQueueItem = (queueItemId: string, direction: 'up' | 'down') =>
    runAction('Reordering queue…', async () => {
      const currentIndex = queue.findIndex((item) => item.id === queueItemId);
      if (currentIndex < 0) {
        return;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= queue.length) {
        return;
      }

      const orderedIds = queue.map((item) => item.id);
      [orderedIds[currentIndex], orderedIds[targetIndex]] = [
        orderedIds[targetIndex],
        orderedIds[currentIndex],
      ];
      const nextQueue = await reorderQueue(orderedIds);
      setQueue(nextQueue);
      const nextSettings = await updatePlaybackSettings({ queue_sort_mode: 'manual' });
      setPlaybackSettings(nextSettings);
    });

  const handleSortQueue = (sortMode: QueueSortMode) =>
    runAction('Sorting queue…', async () => {
      const [nextQueue, nextSettings] = await Promise.all([
        sortQueue(sortMode),
        updatePlaybackSettings({ queue_sort_mode: sortMode }),
      ]);
      setQueue(nextQueue);
      setPlaybackSettings(nextSettings);
      await refreshPlaybackAndDisplay();
    });

  return {
    handleAddToQueue,
    handleApplyAssetNow,
    handleUpdateQueueItem,
    handleRemoveQueueItem,
    handleMoveQueueItem,
    handleSortQueue,
  };
}
