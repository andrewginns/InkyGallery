import { useState } from 'react';
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
import { useActionState } from '@/hooks/useActionState';
import { useAssetActions } from '@/hooks/useAssetActions';
import { useBootstrap } from '@/hooks/useBootstrap';
import { usePlaybackActions } from '@/hooks/usePlaybackActions';
import { usePlaybackPolling } from '@/hooks/usePlaybackPolling';
import { useQueueActions } from '@/hooks/useQueueActions';
import { useSettingsActions } from '@/hooks/useSettingsActions';
import { useTheme } from '@/hooks/useTheme';

type TabId = 'now-playing' | 'library' | 'queue' | 'settings';

const tabs: { id: TabId; label: string; icon: typeof MonitorPlay }[] = [
  { id: 'now-playing', label: 'Now Playing', icon: MonitorPlay },
  { id: 'library', label: 'Library', icon: ImageIcon },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('now-playing');
  const [isRenderingToDevice, setIsRenderingToDevice] = useState(false);
  const { busyMessage, errorMessage, setErrorMessage, runAction } = useActionState();
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const {
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
    refreshPlaybackAndDisplay,
  } = useBootstrap({ setErrorMessage });

  usePlaybackPolling({
    enabled: !loading,
    refreshPlaybackAndDisplay,
  });

  const {
    handlePreviewQueueItem,
    handlePause,
    handleResume,
    handleApply,
    applyPreviewNow,
  } = usePlaybackActions({
    queue,
    playbackState,
    playbackSettings,
    setPlaybackState,
    setActiveTab,
    refreshPlaybackAndDisplay,
    runAction,
    setErrorMessage,
    setIsRenderingToDevice,
  });

  const {
    handleUpload,
    handleToggleFavorite,
    handleSaveCaption,
    handleSaveAssetCrop,
    handleSaveAssetCropAndApply,
    handleDeleteAssets,
  } = useAssetActions({
    deviceSettings,
    playbackState,
    setActiveTab,
    setAssets,
    setQueue,
    replaceAssetInState,
    refreshPlaybackAndDisplay,
    runAction,
    setErrorMessage,
    setIsRenderingToDevice,
    applyPreviewNow,
  });

  const {
    handleAddToQueue,
    handleApplyAssetNow,
    handleUpdateQueueItem,
    handleRemoveQueueItem,
    handleMoveQueueItem,
    handleSortQueue,
  } = useQueueActions({
    queue,
    setQueue,
    setActiveTab,
    setPlaybackSettings,
    refreshPlaybackAndDisplay,
    runAction,
  });

  const { handleSaveSettings } = useSettingsActions({
    setDeviceSettings,
    setPlaybackSettings,
    setDisplayStatus,
    refreshPlaybackAndDisplay,
    runAction,
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
                themePreference={themePreference}
                resolvedTheme={resolvedTheme}
                onThemePreferenceChange={setThemePreference}
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
