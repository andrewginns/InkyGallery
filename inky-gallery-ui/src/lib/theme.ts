export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'inkygallery-theme-preference';
export const THEME_META_COLORS: Record<ResolvedTheme, string> = {
  light: '#f6efe5',
  dark: '#141417',
};

export function sanitizeThemePreference(value: string | null | undefined): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readStoredThemePreference(): ThemePreference {
  return sanitizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function readDocumentThemePreference(): ThemePreference {
  return sanitizeThemePreference(document.documentElement.dataset.themePreference);
}

export function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', THEME_META_COLORS[resolvedTheme]);
  }
}
