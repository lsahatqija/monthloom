'use client';

import { Defaults } from '@monthloom/contracts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const THEMES = [
  { id: 'linen-sage' },
  { id: 'sea-glass' },
  { id: 'lavender-mist' },
  { id: 'apricot-cotton' },
  { id: 'blue-hour' },
  { id: 'rosewood-ember' },
  { id: 'golden-hour' },
  { id: 'terracotta-grove' },
  { id: 'high-contrast' },
  { id: 'monochrome' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ColorMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'monthloom-theme';
const MODE_STORAGE_KEY = 'monthloom-mode';
const DARK_HEADER_STORAGE_KEY = 'monthloom-dark-header';

interface ThemeContextValue {
  theme: ThemeId;
  mode: ColorMode;
  darkHeaderInLightMode: boolean;
  setTheme: (theme: ThemeId) => void;
  setDarkHeaderInLightMode: (enabled: boolean) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

function applyAppearance(theme: ThemeId, mode: ColorMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
}

function applyHeaderStyle(enabled: boolean) {
  document.documentElement.dataset.headerStyle = enabled ? 'dark' : 'theme';
}

function syncThemeColor() {
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) return;

  const probe = document.createElement('span');
  probe.style.background = 'var(--ml-pwa-theme-color)';
  document.body.append(probe);
  themeColor.content = getComputedStyle(probe).backgroundColor;
  probe.remove();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(Defaults.THEME);
  const [mode, setMode] = useState<ColorMode>(Defaults.COLOR_MODE);
  const [darkHeaderInLightMode, setDarkHeaderState] = useState(Defaults.DARK_HEADER_IN_LIGHT_MODE);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const storedDarkHeader = localStorage.getItem(DARK_HEADER_STORAGE_KEY);
    const initialDarkHeader =
      storedDarkHeader === null ? Defaults.DARK_HEADER_IN_LIGHT_MODE : storedDarkHeader === 'true';
    const initialTheme = isThemeId(storedTheme) ? storedTheme : Defaults.THEME;
    const initialMode =
      storedMode === 'light' || storedMode === 'dark' ? storedMode : Defaults.COLOR_MODE;

    setThemeState(initialTheme);
    setMode(initialMode);
    setDarkHeaderState(initialDarkHeader);
    applyAppearance(initialTheme, initialMode);
    applyHeaderStyle(initialDarkHeader);
    syncThemeColor();
  }, []);

  const setDarkHeaderInLightMode = useCallback((enabled: boolean) => {
    setDarkHeaderState(enabled);
    localStorage.setItem(DARK_HEADER_STORAGE_KEY, String(enabled));
    applyHeaderStyle(enabled);
  }, []);

  const setTheme = useCallback(
    (nextTheme: ThemeId) => {
      setThemeState(nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      applyAppearance(nextTheme, mode);
      syncThemeColor();
    },
    [mode],
  );

  const toggleMode = useCallback(() => {
    setMode((currentMode) => {
      const nextMode = currentMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(MODE_STORAGE_KEY, nextMode);
      applyAppearance(theme, nextMode);
      syncThemeColor();
      return nextMode;
    });
  }, [theme]);

  const value = useMemo(
    () => ({ theme, mode, darkHeaderInLightMode, setTheme, setDarkHeaderInLightMode, toggleMode }),
    [darkHeaderInLightMode, mode, setDarkHeaderInLightMode, setTheme, theme, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}
