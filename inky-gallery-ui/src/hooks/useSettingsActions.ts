import type { Dispatch, SetStateAction } from 'react';
import { updateAppSettings } from '@/lib/api';
import type { DeviceSettings, DisplayStatus, PlaybackSettings } from '@/data/types';

interface UseSettingsActionsOptions {
  setDeviceSettings: Dispatch<SetStateAction<DeviceSettings>>;
  setPlaybackSettings: Dispatch<SetStateAction<PlaybackSettings>>;
  setDisplayStatus: Dispatch<SetStateAction<DisplayStatus | null>>;
  refreshPlaybackAndDisplay: () => Promise<void>;
  runAction: (message: string, action: () => Promise<void>) => Promise<void>;
}

export function useSettingsActions({
  setDeviceSettings,
  setPlaybackSettings,
  setDisplayStatus,
  refreshPlaybackAndDisplay,
  runAction,
}: UseSettingsActionsOptions) {
  const handleSaveSettings = (nextDeviceSettings: DeviceSettings, nextPlaybackSettings: PlaybackSettings) =>
    runAction('Saving settings…', async () => {
      const result = await updateAppSettings(nextDeviceSettings, nextPlaybackSettings);
      setDeviceSettings(result.device_settings);
      setPlaybackSettings(result.playback_settings);
      setDisplayStatus(result.display_status);
      await refreshPlaybackAndDisplay();
    });

  return {
    handleSaveSettings,
  };
}
