import type { Dispatch, SetStateAction } from 'react';
import { applyPreview, pausePlayback, previewPlayback, resumePlayback } from '@/lib/api';
import { buildOptimisticApplyState } from '@/lib/playback-state';
import { extractErrorMessage } from '@/lib/error';
import type { PlaybackSettings, PlaybackState, QueueItem } from '@/data/types';

interface UsePlaybackActionsOptions {
  queue: QueueItem[];
  playbackState: PlaybackState;
  playbackSettings: PlaybackSettings;
  setPlaybackState: Dispatch<SetStateAction<PlaybackState>>;
  setActiveTab: (tab: 'now-playing' | 'library' | 'queue' | 'settings') => void;
  refreshPlaybackAndDisplay: () => Promise<void>;
  runAction: (message: string, action: () => Promise<void>) => Promise<void>;
  setErrorMessage: (message: string | null) => void;
  setIsRenderingToDevice: (value: boolean) => void;
}

export function usePlaybackActions({
  queue,
  playbackState,
  playbackSettings,
  setPlaybackState,
  setActiveTab,
  refreshPlaybackAndDisplay,
  runAction,
  setErrorMessage,
  setIsRenderingToDevice,
}: UsePlaybackActionsOptions) {
  const handlePreviewQueueItem = async (queueItemId: string) => {
    setErrorMessage(null);
    setActiveTab('now-playing');
    try {
      await previewPlayback({ queue_item_id: queueItemId });
      await refreshPlaybackAndDisplay();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    }
  };

  const handlePause = () =>
    runAction('Pausing playback…', async () => {
      await pausePlayback();
      await refreshPlaybackAndDisplay();
    });

  const handleResume = () =>
    runAction('Resuming playback…', async () => {
      await resumePlayback();
      await refreshPlaybackAndDisplay();
    });

  const applyPreviewNow = async () => {
    const previousPlaybackState = playbackState;
    setErrorMessage(null);
    setIsRenderingToDevice(true);
    setPlaybackState(buildOptimisticApplyState(playbackState, queue, playbackSettings));
    try {
      await applyPreview();
      await refreshPlaybackAndDisplay();
    } catch (error) {
      setPlaybackState(previousPlaybackState);
      setErrorMessage(extractErrorMessage(error));
      throw error;
    } finally {
      setIsRenderingToDevice(false);
    }
  };

  const handleApply = async () => {
    try {
      await applyPreviewNow();
    } catch {
      // error state is already surfaced by applyPreviewNow
    }
  };

  return {
    handlePreviewQueueItem,
    handlePause,
    handleResume,
    handleApply,
    applyPreviewNow,
  };
}
