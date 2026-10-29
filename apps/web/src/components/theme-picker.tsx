'use client';

import { useTranslations } from 'next-intl';

import { THEMES, useTheme } from './theme-provider';

export function ThemePicker() {
  const t = useTranslations('Profile.appearance');
  const labels = useTranslations('Labels');
  const {
    darkHeaderInLightMode,
    setDarkHeaderInLightMode,
    theme: selectedTheme,
    setTheme,
  } = useTheme();

  return (
    <div className="appearanceOptions">
      <fieldset className="themePicker">
        <legend>{t('theme')}</legend>
        <p className="fieldHint">{t('themeDescription')}</p>
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
              <span>{labels(`themes.${theme.id}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="appearanceToggle">
        <span>
          <strong>{t('darkHeader')}</strong>
          <small>{t('darkHeaderDescription')}</small>
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
