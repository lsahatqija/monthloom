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
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ColorMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'monthloom-theme';
const MODE_STORAGE_KEY = 'monthloom-mode';

interface ThemeContextValue {
  theme: ThemeId;
  mode: ColorMode;
  setTheme: (theme: ThemeId) => void;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('linen-sage');
  const [mode, setMode] = useState<ColorMode>('light');

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const initialTheme = isThemeId(storedTheme) ? storedTheme : 'linen-sage';
    const initialMode = storedMode === 'dark' ? 'dark' : 'light';

    setThemeState(initialTheme);
    setMode(initialMode);
    applyAppearance(initialTheme, initialMode);
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
    () => ({ theme, mode, setTheme, toggleMode }),
    [mode, setTheme, theme, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}
