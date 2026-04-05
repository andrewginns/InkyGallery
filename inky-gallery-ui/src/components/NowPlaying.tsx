import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Eye,
  Send,
  Clock,
  Repeat,
  Shuffle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { PlaybackState, PlaybackSettings, QueueItem, Asset } from '@/data/types';

interface NowPlayingProps {
  playbackState: PlaybackState;
  playbackSettings: PlaybackSettings;
  queue: QueueItem[];
  assets: Asset[];
  onPlaybackStateChange: (state: PlaybackState) => void;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function formatTimeout(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (seconds % 60 === 0) return `${mins}m`;
  return `${mins}m ${seconds % 60}s`;
}

export default function NowPlaying({
  playbackState,
  playbackSettings,
  queue,
  assets,
  onPlaybackStateChange,
}: NowPlayingProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const activeAsset = assets.find((a) => a.id === playbackState.active_asset_id);
  const previewAsset = playbackState.preview_asset_id
    ? assets.find((a) => a.id === playbackState.preview_asset_id)
    : null;
  const activeQueueItem = queue.find((q) => q.id === playbackState.active_queue_item_id);

  const displayedAsset = previewAsset || activeAsset;
  const displayedUrl = previewAsset
    ? previewAsset.original_url
    : playbackState.last_rendered_url;

  const isPreview = playbackState.mode === 'preview';
  const isPaused = playbackState.mode === 'paused';
  const isIdle = playbackState.mode === 'idle';

  const effectiveTimeout = activeQueueItem?.timeout_seconds_override ?? playbackSettings.default_timeout_seconds;

  // Simulate time remaining
  const [timeRemaining, setTimeRemaining] = useState(effectiveTimeout);
  useEffect(() => {
    if (playbackState.mode !== 'displaying') return;
    const interval = setInterval(() => {
      setTimeRemaining((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [playbackState.mode]);

  const modeLabel = {
    idle: 'Idle',
    preview: 'Previewing',
    displaying: 'Live',
    paused: 'Paused',
  }[playbackState.mode];

  const modeColor = {
    idle: 'bg-muted text-muted-foreground',
    preview: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    displaying: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    paused: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30',
  }[playbackState.mode];

  const handlePause = () => {
    onPlaybackStateChange({ ...playbackState, mode: 'paused' });
  };
  const handleResume = () => {
    onPlaybackStateChange({ ...playbackState, mode: 'displaying' });
  };
  const handleApply = () => {
    if (!previewAsset) return;
    onPlaybackStateChange({
      ...playbackState,
      mode: 'displaying',
      active_asset_id: previewAsset.id,
      preview_asset_id: null,
      preview_queue_item_id: null,
      last_rendered_url: previewAsset.original_url,
      display_started_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Display area */}
      <div className="relative mx-4 mt-3 mb-2 rounded-xl overflow-hidden bg-black/90 shadow-lg shadow-black/20">
        {/* Aspect ratio container matching Inky 800x480 */}
        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
          {isIdle ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                <Play className="w-5 h-5 ml-0.5" />
              </div>
              <span className="text-sm font-medium">No image displayed</span>
              <span className="text-xs text-white/25">Add images to the queue to get started</span>
            </div>
          ) : (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 animate-shimmer rounded-xl" />
              )}
              <img
                src={displayedUrl || ''}
                alt={displayedAsset?.filename_original || 'Display'}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          )}

          {/* Status badge overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md ${modeColor}`}
            >
              {playbackState.mode === 'displaying' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
              )}
              {modeLabel}
            </span>
          </div>

          {/* Preview overlay indicator */}
          {isPreview && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-950/80 to-transparent p-3 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-100">
                    Preview — not yet live
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-7 px-3"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info section */}
      <div className="px-4 py-2 flex-1 overflow-auto">
        {/* Current image info */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold truncate">
              {displayedAsset?.filename_original || 'No image selected'}
            </h2>
            {displayedAsset?.caption && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {displayedAsset.caption}
              </p>
            )}
          </div>
          {!isIdle && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-3 flex-shrink-0 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(playbackState.display_started_at)}</span>
            </div>
          )}
        </div>

        {/* Timeout & settings row */}
        {!isIdle && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-mono text-xs">
                  {formatTimeout(timeRemaining)}
                </span>
              </div>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                {activeQueueItem?.timeout_seconds_override
                  ? 'Item override'
                  : `Default ${formatTimeout(playbackSettings.default_timeout_seconds)}`}
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {playbackSettings.loop_enabled && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                  <Repeat className="w-3 h-3" />
                  Loop
                </Badge>
              )}
              {playbackSettings.shuffle_enabled && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                  <Shuffle className="w-3 h-3" />
                  Shuffle
                </Badge>
              )}
            </div>
          </div>
        )}

        <Separator className="mb-4" />

        {/* Queue position indicator */}
        {!isIdle && queue.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Queue Position
              </span>
              <span className="text-xs text-muted-foreground">
                {(activeQueueItem ? activeQueueItem.position + 1 : 0)} of {queue.length}
              </span>
            </div>
            <div className="flex gap-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    item.id === playbackState.active_queue_item_id
                      ? 'bg-primary'
                      : item.enabled
                      ? 'bg-muted-foreground/20'
                      : 'bg-muted-foreground/8'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Up next preview */}
        {!isIdle && queue.length > 1 && activeQueueItem && (
          <div className="mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Up Next
            </span>
            {(() => {
              const nextIndex = (activeQueueItem.position + 1) % queue.length;
              const nextItem = queue.find((q) => q.position === nextIndex);
              if (!nextItem) return null;
              return (
                <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-card/60">
                  <img
                    src={nextItem.asset.thumbnail_url}
                    alt={nextItem.asset.filename_original}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{nextItem.asset.filename_original}</p>
                    <p className="text-xs text-muted-foreground">
                      {nextItem.fit_mode} · {nextItem.timeout_seconds_override ? formatTimeout(nextItem.timeout_seconds_override) : 'Default timeout'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Playback controls bar */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            id="btn-previous"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            id="btn-preview-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {isPaused ? (
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={handleResume}
              id="btn-play"
            >
              <Play className="w-6 h-6 ml-0.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={handlePause}
              id="btn-pause"
            >
              <Pause className="w-6 h-6" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            id="btn-preview-next"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            id="btn-next"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center justify-center gap-6 mt-1 text-[10px] text-muted-foreground">
          <span>Previous</span>
          <span>Preview</span>
          <span className="w-14" />
          <span>Preview</span>
          <span>Next</span>
        </div>
      </div>
    </div>
  );
}
