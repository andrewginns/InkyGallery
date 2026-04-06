import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  GripVertical,
  Eye,
  Trash2,
  Settings2,
  ArrowUpDown,
  Clock,
  Maximize,
  Minimize,
  Palette,
  MonitorPlay,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { QueueItem, PlaybackState, QueueSortMode } from '@/data/types';

interface QueueProps {
  queue: QueueItem[];
  playbackState: PlaybackState;
  defaultTimeout: number;
  sortMode: QueueSortMode;
  onPreview: (queueItemId: string) => void;
  onUpdateItem: (queueItemId: string, updates: Partial<QueueItem>) => void;
  onRemoveItem: (queueItemId: string) => void;
  onMoveItem: (queueItemId: string, direction: 'up' | 'down') => void;
  onSortChange: (sortMode: QueueSortMode) => void;
}

function formatTimeout(seconds: number | null, defaultSeconds: number): string {
  const s = seconds ?? defaultSeconds;
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  if (s % 60 === 0) return `${mins}m`;
  return `${mins}m ${s % 60}s`;
}

export default function Queue({
  queue,
  playbackState,
  defaultTimeout,
  sortMode,
  onPreview,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
  onSortChange,
}: QueueProps) {
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleSaveItemSettings = (updated: QueueItem) => {
    onUpdateItem(updated.id, {
      fit_mode: updated.fit_mode,
      background_mode: updated.background_mode,
      background_color: updated.background_color,
      timeout_seconds_override: updated.timeout_seconds_override,
    });
    setEditingItem(null);
  };

  const enabledCount = queue.filter((q) => q.enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">
              {queue.length} item{queue.length !== 1 ? 's' : ''} · {enabledCount} enabled
            </span>
          </div>
          <Select value={sortMode} onValueChange={(value) => onSortChange(value as QueueSortMode)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[120px] rounded-lg gap-1.5" id="queue-sort">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual order</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="name_desc">Name Z–A</SelectItem>
              <SelectItem value="uploaded_newest">Newest first</SelectItem>
              <SelectItem value="uploaded_oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <MonitorPlay className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Queue is empty
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Add images from the Library to build your playlist
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {queue.map((item, index) => {
              const isActive = item.id === playbackState.active_queue_item_id;
              const isPreview = item.id === playbackState.preview_queue_item_id;
              const isDragging = item.id === draggedId;

              return (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2.5 rounded-xl p-2 transition-[background-color,box-shadow,opacity,transform] duration-200 ease-out ${
                    isDragging
                      ? 'opacity-50 scale-[0.98]'
                      : isActive
                      ? 'bg-primary/8 ring-1 ring-primary/20'
                      : isPreview
                      ? 'bg-amber-500/8 ring-1 ring-amber-500/20'
                      : 'bg-card hover:bg-card/80'
                  } ${!item.enabled ? 'opacity-50' : ''}`}
                  id={`queue-item-${item.id}`}
                >
                  {/* Drag handle */}
                  <div
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground/70"
                    onMouseDown={() => setDraggedId(item.id)}
                    onMouseUp={() => setDraggedId(null)}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={item.asset.thumbnail_url || item.asset.original_url}
                      alt={item.asset.filename_original}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    {/* Status indicator */}
                    {isActive && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background">
                        <div className="w-full h-full rounded-full bg-emerald-500 animate-live-pulse" />
                      </div>
                    )}
                    {isPreview && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-background" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {item.asset.filename_original}
                      </p>
                      {isActive && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
                        >
                          LIVE
                        </Badge>
                      )}
                      {isPreview && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0"
                        >
                          PREVIEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{item.fit_mode}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {item.timeout_seconds_override
                          ? formatTimeout(item.timeout_seconds_override, defaultTimeout)
                          : 'Default'}
                      </span>
                      {item.background_mode !== 'none' && item.fit_mode === 'contain' && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span>{item.background_mode} bg</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(enabled: boolean) => onUpdateItem(item.id, { enabled })}
                      className="scale-75"
                      id={`toggle-${item.id}`}
                    />
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onMoveItem(item.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onMoveItem(item.id, 'down')}
                        disabled={index === queue.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onPreview(item.id)}
                      id={`queue-item-${item.id}-preview`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingItem(item)}
                      id={`queue-item-${item.id}-settings`}
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                      id={`queue-item-${item.id}-remove`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Settings Sheet */}
      <Sheet open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
          {editingItem && (
            <ItemSettingsEditor
              item={editingItem}
              defaultTimeout={defaultTimeout}
              onSave={handleSaveItemSettings}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Extracted item settings editor
function ItemSettingsEditor({
  item,
  defaultTimeout,
  onSave,
  onCancel,
}: {
  item: QueueItem;
  defaultTimeout: number;
  onSave: (item: QueueItem) => void;
  onCancel: () => void;
}) {
  const [fitMode, setFitMode] = useState(item.fit_mode);
  const [bgMode, setBgMode] = useState(item.background_mode);
  const [bgColor, setBgColor] = useState(item.background_color || '#000000');
  const [timeoutOverride, setTimeoutOverride] = useState<number | null>(
    item.timeout_seconds_override
  );
  const [useCustomTimeout, setUseCustomTimeout] = useState(
    item.timeout_seconds_override !== null
  );

  const handleSave = () => {
    onSave({
      ...item,
      fit_mode: fitMode,
      background_mode: bgMode,
      background_color: bgMode === 'solid' ? bgColor : null,
      timeout_seconds_override: useCustomTimeout ? (timeoutOverride ?? defaultTimeout) : null,
    });
  };

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <img
            src={item.asset.thumbnail_url || item.asset.original_url}
            alt={item.asset.filename_original}
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{item.asset.filename_original}</p>
            <p className="text-xs text-muted-foreground font-normal">Queue item settings</p>
          </div>
        </SheetTitle>
      </SheetHeader>

      {/* Fit Mode */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Fit Mode
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFitMode('cover')}
            className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-colors ${
              fitMode === 'cover'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Maximize className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Cover</p>
              <p className="text-[11px] text-muted-foreground">Fill the display</p>
            </div>
          </button>
          <button
            onClick={() => setFitMode('contain')}
            className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-colors ${
              fitMode === 'contain'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Minimize className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Contain</p>
              <p className="text-[11px] text-muted-foreground">Show full image</p>
            </div>
          </button>
        </div>
      </div>

      {/* Background Mode (only when contain) */}
      {fitMode === 'contain' && (
        <div className="space-y-2 animate-fade-in">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Background
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(['blur', 'solid', 'none'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBgMode(mode)}
                className={`p-2.5 rounded-xl border text-center text-sm font-medium capitalize transition-colors ${
                  bgMode === mode
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-border/80'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Color picker for solid */}
          {bgMode === 'solid' && (
            <div className="flex items-center gap-3 animate-fade-in">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-8 text-sm text-mono w-24 rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Timeout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Display Timeout
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Custom</span>
            <Switch
              checked={useCustomTimeout}
              onCheckedChange={(checked: boolean) => {
                setUseCustomTimeout(checked);
                if (checked && timeoutOverride === null) {
                  setTimeoutOverride(defaultTimeout);
                }
              }}
              className="scale-75"
            />
          </div>
        </div>

        {useCustomTimeout ? (
          <div className="space-y-2 animate-fade-in">
            <Slider
              value={[timeoutOverride ?? defaultTimeout]}
              min={10}
              max={3600}
              step={10}
              onValueChange={([v]: number[]) => setTimeoutOverride(v)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>10s</span>
              <span className="text-mono font-medium text-foreground">
                {formatTimeout(timeoutOverride, defaultTimeout)}
              </span>
              <span>60m</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Using default: {formatTimeout(null, defaultTimeout)}
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1 h-10 rounded-xl" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
