'use client';

import { THEMES, useTheme } from './theme-provider';

export function ThemePicker() {
  const {
    darkHeaderInLightMode,
    setDarkHeaderInLightMode,
    theme: selectedTheme,
    setTheme,
  } = useTheme();

  return (
    <div className="appearanceOptions">
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
      <label className="appearanceToggle">
        <span>
          <strong>Dark header in light mode</strong>
          <small>Use a dark, theme-tinted header while the rest of the app stays light.</small>
        </span>
        <input
          type="checkbox"
          checked={darkHeaderInLightMode}
          onChange={(event) => setDarkHeaderInLightMode(event.target.checked)}
        />
      </label>
    </div>
  );
}
