import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Image as ImageIcon,
  ListOrdered,
  LoaderCircle,
  MonitorPlay,
  Settings,
} from 'lucide-react';
import NowPlaying from '@/components/NowPlaying';
import Library from '@/components/Library';
import QueueView from '@/components/QueueView';
import SettingsView from '@/components/SettingsView';
import {
  addQueueItems,
  applyAssetNow,
  ApiError,
  applyPreview,
  bulkDeleteAssets,
  deleteAssetCrop,
  deleteQueueItem,
  fetchBootstrap,
  getQueue,
  getDisplayStatus,
  getPlayback,
  listAssets,
  pausePlayback,
  previewPlayback,
  reorderQueue,
  resumePlayback,
  sortQueue,
  updateAsset,
  updateAssetCrop,
  updateDeviceSettings,
  updatePlaybackSettings,
  updateQueueItem,
  uploadAssets,
} from '@/lib/api';
import type {
  Asset,
  DeviceSettings,
  DisplayStatus,
  PlaybackPayload,
  PlaybackSettings,
  PlaybackState,
  QueueItem,
  QueueSortMode,
} from '@/data/types';
import { areCropProfilesEquivalent, getDefaultCropProfile } from '@/lib/crop';

type TabId = 'now-playing' | 'library' | 'queue' | 'settings';

const tabs: { id: TabId; label: string; icon: typeof MonitorPlay }[] = [
  { id: 'now-playing', label: 'Now Playing', icon: MonitorPlay },
  { id: 'library', label: 'Library', icon: ImageIcon },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const EMPTY_PLAYBACK_STATE: PlaybackState = {
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

const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  default_timeout_seconds: 300,
  loop_enabled: true,
  shuffle_enabled: false,
  auto_advance_enabled: true,
  queue_sort_mode: 'manual',
};

const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
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

function normalizePlaybackState(state: PlaybackState, displayStatus: DisplayStatus | null): PlaybackState {
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

function buildOptimisticApplyState(
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

function extractErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('now-playing');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(EMPTY_PLAYBACK_STATE);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(DEFAULT_PLAYBACK_SETTINGS);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(DEFAULT_DEVICE_SETTINGS);
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [isRenderingToDevice, setIsRenderingToDevice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const replaceAssetInState = (updatedAsset: Asset) => {
    setAssets((current) => current.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
  };

  const setPlaybackPayload = (payload: PlaybackPayload, nextDisplayStatus: DisplayStatus | null) => {
    setPlaybackSettings(payload.settings);
    setPlaybackState(normalizePlaybackState(payload.state, nextDisplayStatus));
  };

  const loadBootstrap = async () => {
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
  };

  const refreshPlaybackAndDisplay = async () => {
    try {
      const [playback, nextDisplayStatus] = await Promise.all([getPlayback(), getDisplayStatus()]);
      setDisplayStatus(nextDisplayStatus);
      setPlaybackPayload(playback, nextDisplayStatus);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    }
  };

  const withAction = async (message: string, action: () => Promise<void>) => {
    setBusyMessage(message);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setBusyMessage(null);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshPlaybackAndDisplay();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loading]);

  const handlePreviewQueueItem = (queueItemId: string) =>
    (async () => {
      setErrorMessage(null);
      setActiveTab('now-playing');
      try {
        await previewPlayback({ queue_item_id: queueItemId });
        await refreshPlaybackAndDisplay();
      } catch (error) {
        setErrorMessage(extractErrorMessage(error));
      }
    })();

  const handleAddToQueue = (assetIds: string[]) =>
    withAction('Updating queue…', async () => {
      await addQueueItems(assetIds);
      setQueue(await getQueue());
    });

  const handleApplyAssetNow = (assetId: string) =>
    withAction('Rendering to device…', async () => {
      setActiveTab('now-playing');
      await applyAssetNow(assetId);
      setQueue(await getQueue());
      await refreshPlaybackAndDisplay();
    });

  const handleUpload = (files: File[], options: { duplicatePolicy: 'reject' | 'reuse_existing' | 'keep_both'; autoAddToQueue: boolean }) =>
    withAction('Uploading images…', async () => {
      await uploadAssets(files, options);
      const [nextAssets, nextQueue] = await Promise.all([listAssets(), getQueue()]);
      setAssets(nextAssets);
      setQueue(nextQueue);
      await refreshPlaybackAndDisplay();
    });

  const handleToggleFavorite = (asset: Asset) =>
    withAction('Updating asset…', async () => {
      const updated = await updateAsset(asset.id, { favorite: !asset.favorite });
      setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setQueue((current) =>
        current.map((item) =>
          item.asset_id === updated.id
            ? {
                ...item,
                asset: { ...item.asset, filename_original: updated.filename_original, thumbnail_url: updated.thumbnail_url, original_url: updated.original_url },
              }
            : item
        )
      );
    });

  const handleSaveCaption = (asset: Asset, caption: string | null) =>
    withAction('Saving caption…', async () => {
      const updated = await updateAsset(asset.id, { caption });
      replaceAssetInState(updated);
    });

  const persistAssetCrop = async (asset: Asset, cropProfile: Asset['crop_profile']) => {
    if (!cropProfile) {
      return;
    }
    const defaultCrop = getDefaultCropProfile(asset, deviceSettings);
    const response = areCropProfilesEquivalent(cropProfile, defaultCrop)
      ? await deleteAssetCrop(asset.id)
      : await updateAssetCrop(asset.id, cropProfile);
    replaceAssetInState(response.asset);
  };

  const handleSaveAssetCrop = async (asset: Asset, cropProfile: Asset['crop_profile']) => {
    setErrorMessage(null);
    try {
      await persistAssetCrop(asset, cropProfile);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      throw error;
    }
  };

  const handleSaveAssetCropAndApply = async (asset: Asset, cropProfile: Asset['crop_profile']) => {
    await handleSaveAssetCrop(asset, cropProfile);
    await handleApply();
  };

  const handleDeleteAssets = (assetIds: string[]) =>
    withAction('Deleting images…', async () => {
      await bulkDeleteAssets(assetIds);
      const [nextAssets, nextQueue] = await Promise.all([listAssets(), getQueue()]);
      setAssets(nextAssets);
      setQueue(nextQueue);
      await refreshPlaybackAndDisplay();
    });

  const handleUpdateQueueItem = (queueItemId: string, updates: Partial<QueueItem>) =>
    withAction('Saving queue settings…', async () => {
      const updated = await updateQueueItem(queueItemId, updates);
      setQueue((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshPlaybackAndDisplay();
    });

  const handleRemoveQueueItem = (queueItemId: string) =>
    withAction('Removing queue item…', async () => {
      await deleteQueueItem(queueItemId);
      setQueue(await getQueue());
      await refreshPlaybackAndDisplay();
    });

  const handleMoveQueueItem = (queueItemId: string, direction: 'up' | 'down') =>
    withAction('Reordering queue…', async () => {
      const currentIndex = queue.findIndex((item) => item.id === queueItemId);
      if (currentIndex < 0) {
        return;
      }
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= queue.length) {
        return;
      }
      const orderedIds = queue.map((item) => item.id);
      [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]];
      const nextQueue = await reorderQueue(orderedIds);
      setQueue(nextQueue);
      const nextSettings = await updatePlaybackSettings({ queue_sort_mode: 'manual' });
      setPlaybackSettings(nextSettings);
    });

  const handleSortQueue = (sortMode: QueueSortMode) =>
    withAction('Sorting queue…', async () => {
      const [nextQueue, nextSettings] = await Promise.all([
        sortQueue(sortMode),
        updatePlaybackSettings({ queue_sort_mode: sortMode }),
      ]);
      setQueue(nextQueue);
      setPlaybackSettings(nextSettings);
      await refreshPlaybackAndDisplay();
    });

  const handlePause = () =>
    withAction('Pausing playback…', async () => {
      await pausePlayback();
      await refreshPlaybackAndDisplay();
    });

  const handleResume = () =>
    withAction('Resuming playback…', async () => {
      await resumePlayback();
      await refreshPlaybackAndDisplay();
    });

  const handleApply = () =>
    (async () => {
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
      } finally {
        setIsRenderingToDevice(false);
      }
    })();

  const handleSaveSettings = (nextDeviceSettings: DeviceSettings, nextPlaybackSettings: PlaybackSettings) =>
    withAction('Saving settings…', async () => {
      const [savedDeviceSettings, savedPlaybackSettings] = await Promise.all([
        updateDeviceSettings(nextDeviceSettings),
        updatePlaybackSettings(nextPlaybackSettings),
      ]);
      const nextDisplayStatus = await getDisplayStatus();
      setDeviceSettings(savedDeviceSettings);
      setPlaybackSettings(savedPlaybackSettings);
      setDisplayStatus(nextDisplayStatus);
      await refreshPlaybackAndDisplay();
    });

  const hardwareWarning =
    displayStatus?.hardware.hardware_enabled && !displayStatus.hardware.hardware_ready
      ? displayStatus.hardware.init_error || 'Inky hardware is attached but not ready.'
      : null;

  const pageTitle = {
    'now-playing': 'Now Playing',
    library: 'Library',
    queue: 'Queue',
    settings: 'Settings',
  }[activeTab];

  return (
    <div className="h-dvh flex flex-col bg-background max-w-lg mx-auto relative">
      <header className="flex items-center justify-between px-4 pt-3 pb-1 safe-top flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MonitorPlay className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
        </div>
        {activeTab === 'now-playing' && playbackState.mode === 'displaying' && !isRenderingToDevice && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
            <span className="font-medium">Live</span>
          </div>
        )}
      </header>

      {(errorMessage || hardwareWarning || (busyMessage && !isRenderingToDevice)) && (
        <div className="px-4 pt-2 flex-shrink-0">
          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {!errorMessage && hardwareWarning && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{hardwareWarning}</span>
            </div>
          )}
          {!errorMessage && !hardwareWarning && busyMessage && !isRenderingToDevice && (
            <div className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <LoaderCircle className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>{busyMessage}</span>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <LoaderCircle className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading library and playback state…</p>
          </div>
        ) : (
          <>
            {activeTab === 'now-playing' && (
              <NowPlaying
                playbackState={playbackState}
                playbackSettings={playbackSettings}
                deviceSettings={deviceSettings}
                queue={queue}
                assets={assets}
                onPause={handlePause}
                onResume={handleResume}
                onApply={handleApply}
                onPreviewQueueItem={handlePreviewQueueItem}
                onSaveCrop={handleSaveAssetCrop}
                onSaveCropAndApply={handleSaveAssetCropAndApply}
                isRendering={isRenderingToDevice}
              />
            )}
            {activeTab === 'library' && (
              <Library
                assets={assets}
                deviceSettings={deviceSettings}
                onApplyNow={handleApplyAssetNow}
                onAddToQueue={handleAddToQueue}
                onUpload={handleUpload}
                onToggleFavorite={handleToggleFavorite}
                onSaveCaption={handleSaveCaption}
                onSaveCrop={handleSaveAssetCrop}
                onDelete={handleDeleteAssets}
                busy={Boolean(busyMessage)}
              />
            )}
            {activeTab === 'queue' && (
              <QueueView
                queue={queue}
                playbackState={playbackState}
                defaultTimeout={playbackSettings.default_timeout_seconds}
                sortMode={playbackSettings.queue_sort_mode}
                onPreview={handlePreviewQueueItem}
                onUpdateItem={handleUpdateQueueItem}
                onRemoveItem={handleRemoveQueueItem}
                onMoveItem={handleMoveQueueItem}
                onSortChange={handleSortQueue}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView
                deviceSettings={deviceSettings}
                playbackSettings={playbackSettings}
                onSave={handleSaveSettings}
                saving={Boolean(busyMessage)}
              />
            )}
          </>
        )}
      </main>

      <nav
        className="flex-shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-lg safe-bottom"
        id="bottom-nav"
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const queueBadge = tab.id === 'queue' && queue.length > 0 ? queue.length : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
                id={`tab-${tab.id}`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {queueBadge && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                      {queueBadge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
