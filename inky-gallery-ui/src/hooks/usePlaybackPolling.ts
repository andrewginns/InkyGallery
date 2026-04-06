import { useEffect, useEffectEvent } from 'react';

interface UsePlaybackPollingOptions {
  enabled: boolean;
  refreshPlaybackAndDisplay: () => Promise<void>;
  intervalMs?: number;
}

export function usePlaybackPolling({
  enabled,
  refreshPlaybackAndDisplay,
  intervalMs = 5000,
}: UsePlaybackPollingOptions) {
  const refreshEvent = useEffectEvent(async () => {
    await refreshPlaybackAndDisplay();
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshEvent();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);
}
