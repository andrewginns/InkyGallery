import type { Dispatch, SetStateAction } from 'react';
import { deleteAssetCrop, listAssets, bulkDeleteAssets, updateAsset, updateAssetCrop, uploadAssets, getQueue, rerenderActivePlayback } from '@/lib/api';
import { getDefaultCropProfile, areCropProfilesEquivalent } from '@/lib/crop';
import { extractErrorMessage } from '@/lib/error';
import type { Asset, DeviceSettings, PlaybackState, QueueItem } from '@/data/types';

interface UseAssetActionsOptions {
  deviceSettings: DeviceSettings;
  playbackState: PlaybackState;
  setActiveTab: (tab: 'now-playing' | 'library' | 'queue' | 'settings') => void;
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  setQueue: Dispatch<SetStateAction<QueueItem[]>>;
  replaceAssetInState: (asset: Asset) => void;
  refreshPlaybackAndDisplay: () => Promise<void>;
  runAction: (message: string, action: () => Promise<void>) => Promise<void>;
  setErrorMessage: (message: string | null) => void;
  setIsRenderingToDevice: (value: boolean) => void;
  applyPreviewNow: () => Promise<void>;
}

export function useAssetActions({
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
}: UseAssetActionsOptions) {
  const handleUpload = (files: File[], options: { duplicatePolicy: 'reject' | 'reuse_existing' | 'keep_both'; autoAddToQueue: boolean }) =>
    runAction('Uploading images…', async () => {
      await uploadAssets(files, options);
      const [nextAssets, nextQueue] = await Promise.all([listAssets(), getQueue()]);
      setAssets(nextAssets);
      setQueue(nextQueue);
      await refreshPlaybackAndDisplay();
    });

  const handleToggleFavorite = (asset: Asset) =>
    runAction('Updating asset…', async () => {
      const updated = await updateAsset(asset.id, { favorite: !asset.favorite });
      setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setQueue((current) =>
        current.map((item) =>
          item.asset_id === updated.id
            ? {
                ...item,
                asset: {
                  ...item.asset,
                  filename_original: updated.filename_original,
                  thumbnail_url: updated.thumbnail_url,
                  original_url: updated.original_url,
                },
              }
            : item
        )
      );
    });

  const handleSaveCaption = (asset: Asset, caption: string | null) =>
    runAction('Saving caption…', async () => {
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
    if (playbackState.preview_asset_id) {
      await applyPreviewNow();
      return;
    }

    setActiveTab('now-playing');
    setErrorMessage(null);
    setIsRenderingToDevice(true);
    try {
      await rerenderActivePlayback();
      await refreshPlaybackAndDisplay();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      throw error;
    } finally {
      setIsRenderingToDevice(false);
    }
  };

  const handleDeleteAssets = (assetIds: string[]) =>
    runAction('Deleting images…', async () => {
      await bulkDeleteAssets(assetIds);
      const [nextAssets, nextQueue] = await Promise.all([listAssets(), getQueue()]);
      setAssets(nextAssets);
      setQueue(nextQueue);
      await refreshPlaybackAndDisplay();
    });

  return {
    handleUpload,
    handleToggleFavorite,
    handleSaveCaption,
    handleSaveAssetCrop,
    handleSaveAssetCropAndApply,
    handleDeleteAssets,
  };
}
