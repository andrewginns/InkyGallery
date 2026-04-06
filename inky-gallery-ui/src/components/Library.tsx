import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Upload,
  Heart,
  Star,
  ListPlus,
  MoreHorizontal,
  Trash2,
  Edit3,
  X,
  CheckSquare,
  Square,
  ImageIcon,
  Filter,
  ArrowUpDown,
  Clock,
  Crop,
  FileText,
  Send,
} from 'lucide-react';
import type { Asset, DeviceSettings } from '@/data/types';
import CropEditorDialog from '@/components/CropEditorDialog';
import {
  cropProfileToImageStyle,
  getEffectiveCropProfile,
  getPreviewAspectRatio,
} from '@/lib/crop';

interface LibraryProps {
  assets: Asset[];
  deviceSettings: DeviceSettings;
  onApplyNow: (assetId: string) => void;
  onAddToQueue: (assetIds: string[]) => void;
  onUpload: (
    files: File[],
    options: { duplicatePolicy: 'reject' | 'reuse_existing' | 'keep_both'; autoAddToQueue: boolean }
  ) => void;
  onToggleFavorite: (asset: Asset) => void;
  onSaveCaption: (asset: Asset, caption: string | null) => void;
  onSaveCrop: (asset: Asset, cropProfile: Asset['crop_profile']) => Promise<void>;
  onDelete: (assetIds: string[]) => void;
  busy?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Library({
  assets,
  deviceSettings,
  onApplyNow,
  onAddToQueue,
  onUpload,
  onToggleFavorite,
  onSaveCaption,
  onSaveCrop,
  onDelete,
  busy = false,
}: LibraryProps) {
  type PendingUpload = {
    id: string;
    file: File;
    previewUrl: string | null;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('uploaded_newest');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'reject' | 'reuse_existing' | 'keep_both'>('reuse_existing');
  const [autoAddToQueue, setAutoAddToQueue] = useState(true);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadSelectionRequestRef = useRef(0);

  useEffect(() => {
    if (!detailAsset) {
      return;
    }
    const latestAsset = assets.find((asset) => asset.id === detailAsset.id) || null;
    if (!latestAsset) {
      setDetailAsset(null);
      return;
    }
    if (latestAsset !== detailAsset) {
      setDetailAsset(latestAsset);
    }
  }, [assets, detailAsset]);

  const clearPendingUploads = () => {
    setPendingUploads([]);
    setBrokenPreviewIds(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => clearPendingUploads, []);

  const filteredAssets = assets
    .filter((a) => {
      if (showFavoritesOnly && !a.favorite) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.filename_original.toLowerCase().includes(q) ||
          (a.caption ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortMode) {
        case 'name_asc':
          return a.filename_original.localeCompare(b.filename_original);
        case 'name_desc':
          return b.filename_original.localeCompare(a.filename_original);
        case 'uploaded_oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleDelete = (assetIds: string[]) => {
    if (assetIds.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      assetIds.length === 1
        ? 'Delete this image from the library and queue?'
        : `Delete ${assetIds.length} images from the library and queue?`
    );
    if (!confirmed) {
      return;
    }
    onDelete(assetIds);
    if (detailAsset && assetIds.includes(detailAsset.id)) {
      setDetailAsset(null);
    }
    clearSelection();
  };

  const readPreviewDataUrl = (file: File) =>
    new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const handleChooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const requestId = uploadSelectionRequestRef.current + 1;
    uploadSelectionRequestRef.current = requestId;
    setBrokenPreviewIds(new Set());
    const nextUploads = await Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: await readPreviewDataUrl(file),
      }))
    );
    if (uploadSelectionRequestRef.current !== requestId) {
      return;
    }
    setPendingUploads(nextUploads);
  };

  const handleSubmitUpload = () => {
    if (pendingUploads.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    onUpload(
      pendingUploads.map((item) => item.file),
      { duplicatePolicy, autoAddToQueue }
    );
    clearPendingUploads();
    setAutoAddToQueue(true);
    setDuplicatePolicy('reuse_existing');
    setShowUploadDialog(false);
  };

  const removePendingUpload = (uploadId: string) => {
    setPendingUploads((current) => {
      const next = current.filter((item) => item.id !== uploadId);
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return next;
    });
    setBrokenPreviewIds((current) => {
      const next = new Set(current);
      next.delete(uploadId);
      return next;
    });
  };

  const detailPreviewAspectRatio = detailAsset ? getPreviewAspectRatio(deviceSettings) : 1;
  const detailPreviewCrop = detailAsset ? getEffectiveCropProfile(detailAsset, deviceSettings) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="px-4 pt-3 pb-2 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-10 bg-card border-border/60 rounded-xl text-sm"
            id="library-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-3 rounded-lg gap-1.5"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            id="filter-favorites"
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            Favorites
          </Button>

          <Select value={sortMode} onValueChange={setSortMode}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] rounded-lg gap-1.5" id="sort-select">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uploaded_newest">Newest first</SelectItem>
              <SelectItem value="uploaded_oldest">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="name_desc">Name Z–A</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {!selectionMode ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setSelectionMode(true)}
                id="btn-select-mode"
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs px-3 rounded-lg gap-1.5"
                onClick={() => setShowUploadDialog(true)}
                id="btn-upload"
                disabled={busy}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={clearSelection}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selection action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-accent/60 border-y border-border/50 flex items-center gap-2 animate-fade-in">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1 rounded-lg"
            onClick={() => {
              onAddToQueue(Array.from(selectedIds));
              clearSelection();
            }}
            disabled={busy}
          >
            <ListPlus className="w-3.5 h-3.5" />
            Add to Queue
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 rounded-lg text-destructive hover:text-destructive"
            onClick={() => handleDelete(Array.from(selectedIds))}
            disabled={busy}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 pt-2 pb-4">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            {searchQuery || showFavoritesOnly ? (
              <>
                <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No images found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try a different search or clear filters
                </p>
              </>
            ) : (
              <>
                <ImageIcon className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Your library is empty
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                  Upload some images to get started
                </p>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Upload className="w-4 h-4" />
                  Upload Images
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
            {filteredAssets.map((asset, index) => (
              <div
                key={asset.id}
                className="animate-scale-in relative group"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <button
                  className={`relative w-full aspect-square rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    selectedIds.has(asset.id)
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : ''
                  }`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelect(asset.id);
                    } else {
                      setDetailAsset(asset);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!selectionMode) {
                      setSelectionMode(true);
                      toggleSelect(asset.id);
                    }
                  }}
                  id={`asset-${asset.id}`}
                >
                  <img
                    src={asset.thumbnail_url || asset.original_url}
                    alt={asset.filename_original}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Selection checkbox overlay */}
                  {selectionMode && (
                    <div className="absolute top-1.5 left-1.5">
                      {selectedIds.has(asset.id) ? (
                        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                          <CheckSquare className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-white/80 bg-black/30 backdrop-blur-sm">
                          <Square className="w-3.5 h-3.5 text-transparent" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Favorite indicator */}
                  {asset.favorite && !selectionMode && (
                    <div className="absolute top-1.5 right-1.5">
                      <Heart className="w-4 h-4 text-rose-400 fill-rose-400 drop-shadow" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  {!selectionMode && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                      <div className="w-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white font-medium truncate drop-shadow">
                          {asset.filename_original}
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Result count */}
        {filteredAssets.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60 mt-4 mb-2">
            {filteredAssets.length} image{filteredAssets.length !== 1 ? 's' : ''}
            {showFavoritesOnly ? ' (favorites)' : ''}
          </p>
        )}
      </div>

      {/* Asset Detail Dialog */}
      <Dialog open={!!detailAsset} onOpenChange={() => setDetailAsset(null)}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden">
          {detailAsset && (
            <>
              {/* Image preview */}
              <div className="relative w-full bg-black/90" style={{ paddingBottom: '60%' }}>
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div
                    style={{ aspectRatio: `${detailPreviewAspectRatio}` }}
                    className="relative h-full max-w-full overflow-hidden rounded-lg"
                  >
                    <img
                      src={detailAsset.original_url}
                      alt={detailAsset.filename_original}
                      className={
                        detailPreviewCrop
                          ? 'absolute max-w-none select-none'
                          : 'absolute inset-0 h-full w-full object-contain'
                      }
                      style={detailPreviewCrop ? cropProfileToImageStyle(detailPreviewCrop) : undefined}
                      draggable={false}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <DialogHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <DialogTitle className="text-base">
                      {detailAsset.filename_original}
                    </DialogTitle>
                    {detailAsset.crop_profile && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] px-2 py-0 h-6">
                        Saved crop
                      </Badge>
                    )}
                  </div>
                  {detailAsset.caption && (
                    <p className="text-sm text-muted-foreground">{detailAsset.caption}</p>
                  )}
                </DialogHeader>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{detailAsset.width} × {detailAsset.height}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{formatFileSize(detailAsset.file_size_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(detailAsset.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Heart className={`w-3.5 h-3.5 ${detailAsset.favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                    <span>{detailAsset.favorite ? 'Favorited' : 'Not favorited'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                    onClick={() => {
                      onApplyNow(detailAsset.id);
                      setDetailAsset(null);
                    }}
                    id="detail-apply-now"
                    disabled={busy}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Apply Now
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                    onClick={() => setShowCropEditor(true)}
                    disabled={busy}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    Edit Crop
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                    onClick={() => {
                      onAddToQueue([detailAsset.id]);
                      setDetailAsset(null);
                    }}
                    id="detail-add-queue"
                    disabled={busy}
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    Add to Queue
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => {
                      const updatedAsset = { ...detailAsset, favorite: !detailAsset.favorite };
                      setDetailAsset(updatedAsset);
                      onToggleFavorite(detailAsset);
                    }}
                    disabled={busy}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    {detailAsset.favorite ? 'Unfavorite' : 'Favorite'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => {
                      const nextCaption = window.prompt(
                        `Caption for ${detailAsset.filename_original}`,
                        detailAsset.caption || ''
                      );
                      if (nextCaption === null) {
                        return;
                      }
                      setDetailAsset({ ...detailAsset, caption: nextCaption.trim() || null });
                      onSaveCaption(detailAsset, nextCaption.trim() || null);
                    }}
                    disabled={busy}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Caption
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleDelete([detailAsset.id])}
                    disabled={busy}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CropEditorDialog
        asset={detailAsset}
        deviceSettings={deviceSettings}
        open={showCropEditor}
        onOpenChange={setShowCropEditor}
        onSave={async (asset, cropProfile) => {
          await onSaveCrop(asset, cropProfile);
        }}
        onSaveAndApply={
          detailAsset
            ? async (asset, cropProfile) => {
                await onSaveCrop(asset, cropProfile);
                onApplyNow(asset.id);
                setDetailAsset(null);
              }
            : undefined
        }
      />

      {/* Upload Dialog */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          setShowUploadDialog(open);
          if (!open) {
            clearPendingUploads();
            setAutoAddToQueue(true);
            setDuplicatePolicy('reuse_existing');
          }
        }}
      >
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Upload Images</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Drop zone */}
            <button
              type="button"
              className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {pendingUploads.length > 0
                    ? `${pendingUploads.length} file${pendingUploads.length === 1 ? '' : 's'} selected`
                    : 'Tap to choose files'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingUploads.length > 0
                    ? 'Tap again to replace this selection'
                    : 'PNG, JPG, WEBP, HEIC up to 20MB each'}
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={handleChooseFiles}
            />

            {pendingUploads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Review before upload
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {pendingUploads.length} selected
                  </p>
                </div>
                <div className="max-h-52 overflow-auto rounded-xl border border-border/60 bg-card p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {pendingUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="rounded-lg border border-border/50 bg-background/80 p-2"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
                          {upload.previewUrl && !brokenPreviewIds.has(upload.id) ? (
                            <img
                              src={upload.previewUrl}
                              alt={upload.file.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                              onError={() => {
                                setBrokenPreviewIds((current) => {
                                  const next = new Set(current);
                                  next.add(upload.id);
                                  return next;
                                });
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/80 px-2 text-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                              <p className="line-clamp-2 text-[11px] font-medium text-muted-foreground">
                                Preview unavailable
                              </p>
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/75"
                            onClick={() => removePendingUpload(upload.id)}
                            aria-label={`Remove ${upload.file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-0.5">
                          <p className="truncate text-xs font-medium">
                            {upload.file.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatFileSize(upload.file.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate handling */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                If duplicates found
              </label>
              <Select value={duplicatePolicy} onValueChange={(value) => setDuplicatePolicy(value as 'reject' | 'reuse_existing' | 'keep_both')}>
                <SelectTrigger className="h-9 text-sm rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuse_existing">Reuse existing</SelectItem>
                  <SelectItem value="keep_both">Keep both</SelectItem>
                  <SelectItem value="reject">Skip duplicates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-add to queue */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary"
                checked={autoAddToQueue}
                onChange={(event) => setAutoAddToQueue(event.target.checked)}
              />
              <div>
                <p className="text-sm font-medium">Auto-add to queue</p>
                <p className="text-xs text-muted-foreground">
                  New uploads go straight to the playback queue by default
                </p>
              </div>
            </label>

            <Button
              className="w-full h-10 rounded-xl gap-2"
              id="btn-upload-submit"
              onClick={handleSubmitUpload}
              disabled={busy}
            >
              <Upload className="w-4 h-4" />
              {pendingUploads.length > 0 ? `Upload ${pendingUploads.length} file${pendingUploads.length === 1 ? '' : 's'}` : 'Choose Files'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
