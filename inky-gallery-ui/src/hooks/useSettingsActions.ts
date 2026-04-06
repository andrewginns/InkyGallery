import type { Dispatch, SetStateAction } from 'react';
import { getDisplayStatus, updateDeviceSettings, updatePlaybackSettings } from '@/lib/api';
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
      const [savedDeviceSettings, savedPlaybackSettings] = await Promise.all([
        updateDeviceSettings(nextDeviceSettings),
        updatePlaybackSettings(nextPlaybackSettings),
      ]);
      const nextDisplayStatus = await getDisplayStatus();
      setDeviceSettings(savedDeviceSettings);
      setPlaybackSettings(savedPlaybackSettings);
      setDisplayStatus(nextDisplayStatus);
      await refreshPlaybackAndDisplay();
    });

  return {
    handleSaveSettings,
  };
}
