'use client';

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
  { id: 'linen-sage', label: 'Linen & Sage' },
  { id: 'sea-glass', label: 'Sea Glass' },
  { id: 'lavender-mist', label: 'Lavender Mist' },
  { id: 'apricot-cotton', label: 'Apricot Cotton' },
  { id: 'blue-hour', label: 'Blue Hour' },
  { id: 'rosewood-ember', label: 'Rosewood Ember' },
  { id: 'golden-hour', label: 'Golden Hour' },
  { id: 'terracotta-grove', label: 'Terracotta Grove' },
  { id: 'high-contrast', label: 'High Contrast' },
  { id: 'monochrome', label: 'Monochrome' },
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('linen-sage');
  const [mode, setMode] = useState<ColorMode>('light');
  const [darkHeaderInLightMode, setDarkHeaderState] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const initialDarkHeader = localStorage.getItem(DARK_HEADER_STORAGE_KEY) === 'true';
    const initialTheme = isThemeId(storedTheme) ? storedTheme : 'linen-sage';
    const initialMode = storedMode === 'dark' ? 'dark' : 'light';

    setThemeState(initialTheme);
    setMode(initialMode);
    setDarkHeaderState(initialDarkHeader);
    applyAppearance(initialTheme, initialMode);
    applyHeaderStyle(initialDarkHeader);
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
    },
    [mode],
  );

  const toggleMode = useCallback(() => {
    setMode((currentMode) => {
      const nextMode = currentMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(MODE_STORAGE_KEY, nextMode);
      applyAppearance(theme, nextMode);
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
