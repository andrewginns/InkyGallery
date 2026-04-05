import { useState } from 'react';
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
  Eye,
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
  FileText,
} from 'lucide-react';
import type { Asset } from '@/data/types';

interface LibraryProps {
  assets: Asset[];
  onPreview: (assetId: string) => void;
  onAddToQueue: (assetIds: string[]) => void;
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

export default function Library({ assets, onPreview, onAddToQueue }: LibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('uploaded_newest');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const filteredAssets = assets
    .filter((a) => {
      if (showFavoritesOnly && !a.favorite) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.filename_original.toLowerCase().includes(q) ||
          a.caption.toLowerCase().includes(q)
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
          >
            <ListPlus className="w-3.5 h-3.5" />
            Add to Queue
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 rounded-lg text-destructive hover:text-destructive"
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
                    src={asset.thumbnail_url}
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
              <div className="relative w-full bg-black">
                <div style={{ paddingBottom: '75%' }} className="relative">
                  <img
                    src={detailAsset.original_url}
                    alt={detailAsset.filename_original}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="p-4 space-y-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-base">
                    {detailAsset.filename_original}
                  </DialogTitle>
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
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                    onClick={() => {
                      onPreview(detailAsset.id);
                      setDetailAsset(null);
                    }}
                    id="detail-preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                    onClick={() => {
                      onAddToQueue([detailAsset.id]);
                      setDetailAsset(null);
                    }}
                    id="detail-add-queue"
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
                  >
                    <Heart className="w-3.5 h-3.5" />
                    {detailAsset.favorite ? 'Unfavorite' : 'Favorite'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Caption
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Upload Images</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Tap to choose files</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG, JPG, WEBP, HEIC up to 20MB each
                </p>
              </div>
            </div>

            {/* Duplicate handling */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                If duplicates found
              </label>
              <Select defaultValue="reuse_existing">
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
              <input type="checkbox" className="w-4 h-4 rounded accent-primary" />
              <div>
                <p className="text-sm font-medium">Auto-add to queue</p>
                <p className="text-xs text-muted-foreground">
                  New uploads go straight to the playback queue
                </p>
              </div>
            </label>

            <Button className="w-full h-10 rounded-xl gap-2" id="btn-upload-submit">
              <Upload className="w-4 h-4" />
              Upload Files
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
