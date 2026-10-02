'use client';

import { THEMES, useTheme } from './theme-provider';

export function ThemePicker() {
  const { theme: selectedTheme, setTheme } = useTheme();

  return (
    <fieldset className="themePicker">
      <legend>App theme</legend>
      <p className="fieldHint">Choose the color palette used throughout Monthloom.</p>
      <div className="themeOptions">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className="themeOption"
            data-palette={theme.id}
            aria-pressed={selectedTheme === theme.id}
            onClick={() => setTheme(theme.id)}
          >
            <span className="themeSwatches" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>{theme.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
