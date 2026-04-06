import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Clock, Crop, Eye, FileText, Pause, Play, Repeat, Send, Shuffle } from 'lucide-react';
import type { Asset, DeviceSettings, PlaybackSettings, PlaybackState, QueueItem } from '@/data/types';
import CropEditorDialog from '@/components/CropEditorDialog';
import {
  cropProfileToImageStyle,
  getEffectiveCropProfile,
  getPreviewAspectRatio,
} from '@/lib/crop';
import { derivePlaybackView } from '@/lib/playback-view';

interface NowPlayingProps {
  playbackState: PlaybackState;
  playbackSettings: PlaybackSettings;
  deviceSettings: DeviceSettings;
  queue: QueueItem[];
  assets: Asset[];
  isRendering?: boolean;
  onPause: () => void;
  onResume: () => void;
  onApply: () => void;
  onPreviewQueueItem: (queueItemId: string) => void;
  onSaveCrop: (asset: Asset, cropProfile: Asset['crop_profile']) => Promise<void>;
  onSaveCropAndApply: (asset: Asset, cropProfile: Asset['crop_profile']) => Promise<void>;
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

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NowPlaying({
  playbackState,
  playbackSettings,
  deviceSettings,
  queue,
  assets,
  isRendering = false,
  onPause,
  onResume,
  onApply,
  onPreviewQueueItem,
  onSaveCrop,
  onSaveCropAndApply,
}: NowPlayingProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const loadedImageUrlsRef = useRef<Set<string>>(new Set());
  const filmStripRef = useRef<HTMLDivElement | null>(null);
  const queueItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [timeRemaining, setTimeRemaining] = useState(
    playbackState.time_remaining_seconds ?? playbackSettings.default_timeout_seconds
  );

  const {
    activeAsset,
    previewAsset,
    displayedAsset,
    liveQueueItem,
    selectedQueueItem,
  } = derivePlaybackView(playbackState, queue, assets);
  const displayedUrl =
    previewAsset?.original_url ||
    activeAsset?.original_url ||
    playbackState.current_image_url ||
    playbackState.last_rendered_url;
  const selectedFitMode = selectedQueueItem?.fit_mode ?? 'cover';
  const previewAspectRatio = getPreviewAspectRatio(deviceSettings);
  const displayedCrop =
    displayedAsset && selectedFitMode === 'cover'
      ? getEffectiveCropProfile(displayedAsset, deviceSettings)
      : null;

  const hasDisplayableImage = Boolean(playbackState.active_asset_id || playbackState.preview_asset_id);
  const effectiveMode: PlaybackState['mode'] = isRendering
    ? (hasDisplayableImage ? 'displaying' : 'idle')
    : playbackState.mode;
  const isPreview = !isRendering && effectiveMode === 'preview';
  const isPaused = playbackState.mode === 'paused';
  const isIdle = effectiveMode === 'idle';
  const hasQueue = queue.length > 0;
  const effectiveTimeout =
    liveQueueItem?.timeout_seconds_override ?? playbackSettings.default_timeout_seconds;
  const selectedTimeout =
    selectedQueueItem?.timeout_seconds_override ?? playbackSettings.default_timeout_seconds;

  useEffect(() => {
    if (playbackState.mode === 'paused' || !playbackState.display_expires_at) {
      setTimeRemaining(playbackState.time_remaining_seconds ?? effectiveTimeout);
      return undefined;
    }

    const updateRemaining = () => {
      if (playbackState.display_expires_at) {
        const remaining = Math.max(
          0,
          Math.ceil(
            (new Date(playbackState.display_expires_at).getTime() - Date.now()) / 1000
          )
        );
        setTimeRemaining(remaining);
        return;
      }
      setTimeRemaining(playbackState.time_remaining_seconds ?? effectiveTimeout);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [
    effectiveTimeout,
    playbackState.display_expires_at,
    playbackState.mode,
    playbackState.time_remaining_seconds,
  ]);

  useEffect(() => {
    if (!displayedUrl) {
      setImageLoaded(false);
      return;
    }
    setImageLoaded(loadedImageUrlsRef.current.has(displayedUrl));
  }, [displayedUrl]);

  useEffect(() => {
    if (!liveQueueItem) {
      return;
    }

    const filmStrip = filmStripRef.current;
    const liveItem = queueItemRefs.current[liveQueueItem.id];
    if (!filmStrip || !liveItem) {
      return;
    }

    const centerLiveItem = () => {
      const targetScrollLeft =
        liveItem.offsetLeft - filmStrip.clientWidth / 2 + liveItem.clientWidth / 2;
      const maxScrollLeft = Math.max(0, filmStrip.scrollWidth - filmStrip.clientWidth);
      filmStrip.scrollTo({
        left: Math.min(Math.max(0, targetScrollLeft), maxScrollLeft),
        behavior: 'smooth',
      });
    };

    const frame = window.requestAnimationFrame(centerLiveItem);
    return () => window.cancelAnimationFrame(frame);
  }, [liveQueueItem?.id, queue.length]);

  const modeLabel: Record<PlaybackState['mode'], string> = {
    idle: 'Idle',
    preview: 'Previewing',
    displaying: 'Live',
    paused: 'Paused',
  };

  const modeColor: Record<PlaybackState['mode'], string> = {
    idle: 'bg-muted text-muted-foreground',
    preview:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    displaying:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    paused:
      'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30',
  };
  const statusLabel = modeLabel[effectiveMode];
  const statusClass = modeColor[effectiveMode];

  return (
    <div className="flex flex-col h-full">
      <div className="relative mx-4 mt-3 mb-2 rounded-xl overflow-hidden bg-black/90 shadow-lg shadow-black/20">
        <div
          className={`relative w-full ${isIdle ? '' : 'cursor-zoom-in'}`}
          style={{ paddingBottom: '60%' }}
          onClick={() => {
            if (!isIdle) {
              setShowDetail(true);
            }
          }}
        >
          {isIdle ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                <Play className="w-5 h-5 ml-0.5" />
              </div>
              <span className="text-sm font-medium">No image displayed</span>
              <span className="text-xs text-white/25">
                Add images to the queue to get started
              </span>
            </div>
          ) : (
            <>
              {!imageLoaded && <div className="absolute inset-0 animate-shimmer rounded-xl" />}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  className="relative h-full max-w-full overflow-hidden rounded-lg"
                  style={{ aspectRatio: `${previewAspectRatio}` }}
                >
                  <img
                    src={displayedUrl || ''}
                    alt={displayedAsset?.filename_original || 'Display'}
                    className={`absolute transition-opacity duration-500 ${
                      isRendering ? 'animate-rendering-image' : ''
                    } ${displayedCrop ? 'max-w-none select-none' : 'inset-0 h-full w-full object-contain'} ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={displayedCrop ? cropProfileToImageStyle(displayedCrop) : undefined}
                    onLoad={(event) => {
                      if (event.currentTarget.currentSrc) {
                        loadedImageUrlsRef.current.add(event.currentTarget.currentSrc);
                      }
                      if (displayedUrl) {
                        loadedImageUrlsRef.current.add(displayedUrl);
                      }
                      setImageLoaded(true);
                    }}
                    onError={() => setImageLoaded(true)}
                  />
                </div>
              </div>
              {isRendering && imageLoaded && (
                <div className="absolute inset-0 animate-rendering-overlay pointer-events-none">
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 py-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-primary animate-live-pulse" />
                      Rendering to device…
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!isRendering && (
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md ${statusClass}`}
              >
                {effectiveMode === 'displaying' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
                )}
                {statusLabel}
              </span>
            </div>
          )}

          {isPreview && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-950/80 to-transparent p-3 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-100">
                    Preview — not yet live
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFitMode === 'cover' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowCropEditor(true);
                      }}
                      className="text-xs h-7 px-3"
                    >
                      <Crop className="w-3 h-3 mr-1" />
                      Edit crop
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onApply();
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-7 px-3"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isPreview && !isIdle && !isRendering && selectedFitMode === 'cover' && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent p-3 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {displayedAsset?.crop_profile && (
                    <Badge
                      variant="secondary"
                      className="border-white/10 bg-black/45 text-[10px] text-white/85 backdrop-blur-md"
                    >
                      Saved crop
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCropEditor(true);
                  }}
                  className="h-7 px-3 text-xs"
                >
                  <Crop className="mr-1 h-3 w-3" />
                  Edit crop
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex-1 overflow-auto">
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

        {!isIdle && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-mono text-xs">{formatTimeout(timeRemaining)}</span>
              </div>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                {liveQueueItem?.timeout_seconds_override
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

        {queue.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {selectedQueueItem
                  ? `${selectedQueueItem.position + 1} of ${queue.length}${
                      selectedQueueItem.id === liveQueueItem?.id
                        ? ' · live on device'
                        : ' · selected for preview'
                    }`
                  : 'Tap a queued image to preview it here'}
              </p>
              {liveQueueItem && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 h-6 gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
                  Live {liveQueueItem.position + 1}/{queue.length}
                </Badge>
              )}
            </div>
            <div
              ref={filmStripRef}
              className="-mx-4 px-4 py-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex min-w-max gap-3">
                {queue.map((item) => {
                  const isLive = item.id === liveQueueItem?.id;
                  const isSelected = item.id === selectedQueueItem?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onPreviewQueueItem(item.id)}
                      className="flex w-16 flex-col gap-1.5 text-left"
                      disabled={!item.enabled}
                      ref={(node) => {
                        queueItemRefs.current[item.id] = node;
                      }}
                    >
                      <div
                        className={`relative h-20 w-16 overflow-hidden rounded-xl border transition-all ${
                          isSelected
                            ? 'border-primary shadow-md shadow-primary/15'
                            : 'border-border/60'
                        } ${isLive ? 'ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-background' : ''} ${
                          item.enabled ? '' : 'opacity-45'
                        }`}
                      >
                        <img
                          src={item.asset.thumbnail_url || item.asset.original_url}
                          alt={item.asset.filename_original}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1">
                          <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            {item.position + 1}
                          </span>
                          {isLive && (
                            <span className="rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              Live
                            </span>
                          )}
                        </div>
                        {isSelected && !isLive && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/90 to-transparent px-2 py-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                              Preview
                            </span>
                          </div>
                        )}
                        {!item.enabled && (
                          <div className="absolute inset-0 bg-background/70" />
                        )}
                      </div>
                      <p className="truncate text-[10px] font-medium text-foreground/85">
                        {item.asset.filename_original}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!isIdle && queue.length > 1 && liveQueueItem && (
          <div className="mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Up Next
            </span>
            {(() => {
              const nextIndex = (liveQueueItem.position + 1) % queue.length;
              const nextItem = queue.find((item) => item.position === nextIndex);
              if (!nextItem) return null;
              return (
                <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-card/60">
                  <img
                    src={nextItem.asset.thumbnail_url || nextItem.asset.original_url}
                    alt={nextItem.asset.filename_original}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {nextItem.asset.filename_original}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nextItem.fit_mode} ·{' '}
                      {nextItem.timeout_seconds_override
                        ? formatTimeout(nextItem.timeout_seconds_override)
                        : 'Default timeout'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center justify-center">
          {isIdle ? (
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              id="btn-play"
              disabled
            >
              <Play className="w-6 h-6 ml-0.5" />
            </Button>
          ) : isPaused ? (
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={onResume}
              id="btn-play"
            >
              <Play className="w-6 h-6 ml-0.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={onPause}
              id="btn-pause"
            >
              <Pause className="w-6 h-6" />
            </Button>
          )}
        </div>
        {hasQueue && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Tap a queue thumbnail to preview it here. Use Apply to send the selected image live.
          </p>
        )}
      </div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden">
          {displayedAsset && (
            <>
              <div className="relative w-full bg-black">
                <div style={{ aspectRatio: `${previewAspectRatio}` }} className="relative overflow-hidden">
                  <img
                    src={displayedAsset.original_url || displayedUrl || ''}
                    alt={displayedAsset.filename_original}
                    className={displayedCrop ? 'absolute max-w-none select-none' : 'absolute inset-0 w-full h-full object-contain'}
                    style={displayedCrop ? cropProfileToImageStyle(displayedCrop) : undefined}
                    draggable={false}
                  />
                </div>
              </div>

              <div className="p-4 space-y-4">
                <DialogHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <DialogTitle className="text-base min-w-0 truncate">
                      {displayedAsset.filename_original}
                    </DialogTitle>
                    {selectedQueueItem && (
                      <Badge variant="secondary" className="shrink-0">
                        #{selectedQueueItem.position + 1}
                      </Badge>
                    )}
                  </div>
                  {displayedAsset.caption && (
                    <p className="text-sm text-muted-foreground">{displayedAsset.caption}</p>
                  )}
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {isRendering ? 'Applying to device' : isPreview ? 'Previewing' : isPaused ? 'Paused live' : 'Live on device'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTimeout(selectedTimeout)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{formatFileSize(displayedAsset.file_size_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(displayedAsset.created_at)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      Resolution
                    </span>
                    <span className="block mt-1">
                      {displayedAsset.width} × {displayedAsset.height}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      Queue
                    </span>
                    <span className="block mt-1">
                      {selectedQueueItem ? `Position ${selectedQueueItem.position + 1}` : 'Not queued'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedFitMode === 'cover' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                      onClick={() => setShowCropEditor(true)}
                    >
                      <Crop className="w-3.5 h-3.5" />
                      Edit Crop
                    </Button>
                  )}
                  {isPreview ? (
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                      onClick={() => {
                        onApply();
                        setShowDetail(false);
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Apply
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full h-9 text-xs rounded-lg"
                      onClick={() => setShowDetail(false)}
                    >
                      Close
                    </Button>
                  )}
                </div>
                {isPreview && liveQueueItem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 text-xs rounded-lg"
                    onClick={() => {
                      onPreviewQueueItem(liveQueueItem.id);
                      setShowDetail(false);
                    }}
                  >
                    Back to Live
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CropEditorDialog
        asset={displayedAsset}
        deviceSettings={deviceSettings}
        open={showCropEditor}
        onOpenChange={setShowCropEditor}
        onSave={async (asset, cropProfile) => {
          await onSaveCrop(asset, cropProfile);
        }}
        onSaveAndApply={async (asset, cropProfile) => {
          await onSaveCropAndApply(asset, cropProfile);
          setShowDetail(false);
        }}
      />
    </div>
  );
}
