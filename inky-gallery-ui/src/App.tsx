import { useState } from 'react';
import {
  MonitorPlay,
  Image as ImageIcon,
  ListOrdered,
  Settings,
} from 'lucide-react';
import NowPlaying from '@/components/NowPlaying';
import Library from '@/components/Library';
import QueueView from '@/components/QueueView';
import SettingsView from '@/components/SettingsView';
import {
  SAMPLE_ASSETS,
  SAMPLE_QUEUE,
  SAMPLE_PLAYBACK_STATE,
  SAMPLE_PLAYBACK_SETTINGS,
  SAMPLE_DEVICE_SETTINGS,
} from '@/data/mock';
import type { Asset, QueueItem, PlaybackState, PlaybackSettings, DeviceSettings } from '@/data/types';

type TabId = 'now-playing' | 'library' | 'queue' | 'settings';

const tabs: { id: TabId; label: string; icon: typeof MonitorPlay }[] = [
  { id: 'now-playing', label: 'Now Playing', icon: MonitorPlay },
  { id: 'library', label: 'Library', icon: ImageIcon },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('now-playing');
  const [assets, setAssets] = useState<Asset[]>(SAMPLE_ASSETS);
  const [queue, setQueue] = useState<QueueItem[]>(SAMPLE_QUEUE);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(SAMPLE_PLAYBACK_STATE);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(SAMPLE_PLAYBACK_SETTINGS);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(SAMPLE_DEVICE_SETTINGS);

  const handlePreviewAsset = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setPlaybackState((prev) => ({
      ...prev,
      mode: 'preview',
      preview_asset_id: assetId,
      preview_queue_item_id: null,
    }));
    setActiveTab('now-playing');
  };

  const handlePreviewQueueItem = (queueItemId: string) => {
    const item = queue.find((q) => q.id === queueItemId);
    if (!item) return;
    setPlaybackState((prev) => ({
      ...prev,
      mode: 'preview',
      preview_queue_item_id: queueItemId,
      preview_asset_id: item.asset_id,
    }));
    setActiveTab('now-playing');
  };

  const handleAddToQueue = (assetIds: string[]) => {
    const newItems: QueueItem[] = assetIds
      .filter((id) => !queue.some((q) => q.asset_id === id))
      .map((assetId, index) => {
        const asset = assets.find((a) => a.id === assetId)!;
        return {
          id: `qi_new_${Date.now()}_${index}`,
          asset_id: assetId,
          position: queue.length + index,
          enabled: true,
          timeout_seconds_override: null,
          fit_mode: 'cover' as const,
          background_mode: 'blur' as const,
          background_color: null,
          asset,
        };
      });
    setQueue((prev) => [...prev, ...newItems]);
  };

  const pageTitle = {
    'now-playing': 'Now Playing',
    library: 'Library',
    queue: 'Queue',
    settings: 'Settings',
  }[activeTab];

  return (
    <div className="h-dvh flex flex-col bg-background max-w-lg mx-auto relative">
      {/* Top header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-1 safe-top flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MonitorPlay className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
        </div>
        {activeTab === 'now-playing' && playbackState.mode === 'displaying' && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
            <span className="font-medium">Live</span>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'now-playing' && (
          <NowPlaying
            playbackState={playbackState}
            playbackSettings={playbackSettings}
            queue={queue}
            assets={assets}
            onPlaybackStateChange={setPlaybackState}
          />
        )}
        {activeTab === 'library' && (
          <Library
            assets={assets}
            onPreview={handlePreviewAsset}
            onAddToQueue={handleAddToQueue}
          />
        )}
        {activeTab === 'queue' && (
          <QueueView
            queue={queue}
            playbackState={playbackState}
            defaultTimeout={playbackSettings.default_timeout_seconds}
            onQueueChange={setQueue}
            onPreview={handlePreviewQueueItem}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            deviceSettings={deviceSettings}
            playbackSettings={playbackSettings}
            onDeviceSettingsChange={setDeviceSettings}
            onPlaybackSettingsChange={setPlaybackSettings}
          />
        )}
      </main>

      {/* Bottom tab bar */}
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
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                id={`tab-${tab.id}`}
              >
                {/* Active indicator line */}
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
