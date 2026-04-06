import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Crop, Move, RotateCcw, Send, ZoomIn } from 'lucide-react';
import type { Asset, CropProfile, DeviceSettings } from '@/data/types';
import {
  cropProfileToImageStyle,
  getCropZoom,
  getDefaultCropProfile,
  getEffectiveCropProfile,
  getPreviewAspectRatio,
  setCropZoom,
  translateCropByViewportDelta,
} from '@/lib/crop';

interface CropEditorDialogProps {
  asset: Asset | null;
  deviceSettings: DeviceSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (asset: Asset, cropProfile: CropProfile) => Promise<void>;
  onSaveAndApply?: (asset: Asset, cropProfile: CropProfile) => Promise<void>;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  crop: CropProfile;
}

export default function CropEditorDialog({
  asset,
  deviceSettings,
  open,
  onOpenChange,
  onSave,
  onSaveAndApply,
}: CropEditorDialogProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [cropProfile, setCropProfile] = useState<CropProfile | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [savingMode, setSavingMode] = useState<'save' | 'apply' | null>(null);

  const defaultCrop = useMemo(
    () => (asset ? getDefaultCropProfile(asset, deviceSettings) : null),
    [asset, deviceSettings]
  );
  const aspectRatio = useMemo(() => getPreviewAspectRatio(deviceSettings), [deviceSettings]);

  useEffect(() => {
    if (!open || !asset) {
      return;
    }
    const effectiveCrop = getEffectiveCropProfile(asset, deviceSettings);
    setCropProfile(effectiveCrop);
    setZoomValue(getCropZoom(effectiveCrop, asset, deviceSettings));
    dragStateRef.current = null;
  }, [asset, deviceSettings, open]);

  useEffect(() => {
    if (!open || !asset) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const viewport = viewportRef.current;
      if (!dragState || !viewport || event.pointerId !== dragState.pointerId) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const nextCrop = translateCropByViewportDelta(
        dragState.crop,
        event.clientX - dragState.startX,
        event.clientY - dragState.startY,
        rect.width,
        rect.height,
        asset,
        deviceSettings
      );
      setCropProfile(nextCrop);
      setZoomValue(getCropZoom(nextCrop, asset, deviceSettings));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [asset, deviceSettings, open]);

  const handleZoomChange = (values: number[]) => {
    if (!asset || !cropProfile) {
      return;
    }
    const nextZoom = values[0] ?? 1;
    const nextCrop = setCropZoom(cropProfile, nextZoom, asset, deviceSettings);
    setCropProfile(nextCrop);
    setZoomValue(nextZoom);
  };

  const handleReset = () => {
    if (!defaultCrop || !asset) {
      return;
    }
    setCropProfile(defaultCrop);
    setZoomValue(getCropZoom(defaultCrop, asset, deviceSettings));
  };

  const handleSave = async (mode: 'save' | 'apply') => {
    if (!asset || !cropProfile) {
      return;
    }
    setSavingMode(mode);
    try {
      if (mode === 'apply' && onSaveAndApply) {
        onOpenChange(false);
        await onSaveAndApply(asset, cropProfile);
      } else {
        await onSave(asset, cropProfile);
        onOpenChange(false);
      }
    } finally {
      setSavingMode(null);
    }
  };

  const previewStyle = cropProfile ? cropProfileToImageStyle(cropProfile) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col rounded-2xl p-0 overflow-hidden">
        {asset && cropProfile && (
          <>
            <div className="bg-card border-b border-border/50 px-4 py-2.5">
              <DialogHeader className="space-y-0">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Crop className="w-4 h-4 text-primary" />
                  Edit crop
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-3 space-y-3">
              <div
                ref={viewportRef}
                className="relative mx-auto overflow-hidden rounded-2xl bg-black shadow-inner touch-none select-none"
                style={{
                  aspectRatio: `${aspectRatio}`,
                  height: `min(50dvh, calc((100vw - 3rem) / ${aspectRatio}))`,
                  width: 'auto',
                  maxWidth: '100%',
                }}
                onPointerDown={(event) => {
                  if (!cropProfile || savingMode) {
                    return;
                  }
                  dragStateRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    crop: cropProfile,
                  };
                }}
              >
                <img
                  src={asset.original_url}
                  alt={asset.filename_original}
                  className="absolute max-w-none select-none"
                  draggable={false}
                  style={previewStyle}
                />
                <div className="pointer-events-none absolute inset-0 border-[1.5px] border-white/50 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.28)]" />
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="border border-white/12" />
                  ))}
                </div>
                <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/90">
                  <Move className="w-3.5 h-3.5" />
                  Drag to reposition
                </div>
              </div>

              <div className="rounded-2xl bg-muted/45 p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Zoom</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1.5"
                        onClick={handleReset}
                        disabled={Boolean(savingMode)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saved crops apply whenever this image is rendered in cover mode.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs font-medium">
                    <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
                    {zoomValue.toFixed(1)}×
                  </div>
                </div>
                <Slider
                  min={1}
                  max={6}
                  step={0.01}
                  value={[zoomValue]}
                  onValueChange={handleZoomChange}
                />
              </div>
            </div>

            <div className="border-t border-border/50 p-4 pt-3">
              <div className={`grid gap-2 ${onSaveAndApply ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Button
                  type="button"
                  variant={onSaveAndApply ? 'secondary' : 'default'}
                  className="w-full"
                  onClick={() => void handleSave('save')}
                  disabled={Boolean(savingMode)}
                >
                  {savingMode === 'save' ? 'Saving…' : 'Save crop'}
                </Button>
                {onSaveAndApply && (
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={() => void handleSave('apply')}
                    disabled={Boolean(savingMode)}
                  >
                    <Send className="w-4 h-4" />
                    {savingMode === 'apply' ? 'Applying…' : 'Save & Apply'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
