import { useEffect, useEffectEvent, useState } from 'react';
import { fetchBootstrap, getDisplayStatus, getPlayback } from '@/lib/api';
import {
  DEFAULT_DEVICE_SETTINGS,
  DEFAULT_PLAYBACK_SETTINGS,
  EMPTY_PLAYBACK_STATE,
} from '@/lib/app-defaults';
import { extractErrorMessage } from '@/lib/error';
import { applyPlaybackPayload } from '@/lib/playback-state';
import type { Asset, DeviceSettings, DisplayStatus, PlaybackPayload, PlaybackSettings, PlaybackState, QueueItem } from '@/data/types';

interface UseBootstrapOptions {
  setErrorMessage: (message: string | null) => void;
}

export function useBootstrap({ setErrorMessage }: UseBootstrapOptions) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(EMPTY_PLAYBACK_STATE);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(DEFAULT_PLAYBACK_SETTINGS);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(DEFAULT_DEVICE_SETTINGS);
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const replaceAssetInState = (updatedAsset: Asset) => {
    setAssets((current) => current.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
  };

  const setPlaybackPayload = (payload: PlaybackPayload, nextDisplayStatus: DisplayStatus | null) => {
    const normalized = applyPlaybackPayload(payload, nextDisplayStatus);
    setPlaybackSettings(normalized.settings);
    setPlaybackState(normalized.state);
  };

  const loadBootstrapEvent = useEffectEvent(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const bootstrap = await fetchBootstrap();
      setAssets(bootstrap.assets);
      setQueue(bootstrap.queue);
      setDisplayStatus(bootstrap.displayStatus);
      setDeviceSettings(bootstrap.deviceSettings);
      setPlaybackPayload(bootstrap.playback, bootstrap.displayStatus);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  });

  const refreshPlaybackAndDisplayEvent = useEffectEvent(async () => {
    try {
      const [playback, nextDisplayStatus] = await Promise.all([getPlayback(), getDisplayStatus()]);
      setDisplayStatus(nextDisplayStatus);
      setPlaybackPayload(playback, nextDisplayStatus);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    }
  });

  useEffect(() => {
    void loadBootstrapEvent();
  }, []);

  return {
    assets,
    setAssets,
    queue,
    setQueue,
    playbackState,
    setPlaybackState,
    playbackSettings,
    setPlaybackSettings,
    deviceSettings,
    setDeviceSettings,
    displayStatus,
    setDisplayStatus,
    loading,
    replaceAssetInState,
    loadBootstrap: async () => loadBootstrapEvent(),
    refreshPlaybackAndDisplay: async () => refreshPlaybackAndDisplayEvent(),
  };
}
