import { useEffect, useState } from 'react';
import {
  applyResolvedTheme,
  getSystemTheme,
  readDocumentThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    typeof document === 'undefined' ? 'system' : readDocumentThemePreference()
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    typeof document === 'undefined'
      ? 'light'
      : document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = (systemTheme: ResolvedTheme) => {
      const resolved = resolveThemePreference(themePreference, systemTheme);
      document.documentElement.dataset.themePreference = themePreference;
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
      applyResolvedTheme(resolved);
      setResolvedTheme(resolved);
    };

    syncTheme(getSystemTheme());

    if (themePreference !== 'system') {
      return undefined;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      syncTheme(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  return {
    themePreference,
    resolvedTheme,
    setThemePreference,
  };
}
