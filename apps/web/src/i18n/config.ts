import { Constants, Defaults, type Locale, localeSchema } from '@monthloom/contracts';

export const SUPPORTED_LOCALES = Constants.SUPPORTED_LOCALES;
export const DEFAULT_LOCALE = Defaults.USER_LOCALE;
export const LOCALE_COOKIE_NAME = 'monthloom-locale';
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  sq: 'Shqip',
  fr: 'Français',
  tr: 'Türkçe',
  de: 'Deutsch',
};
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '/flags/gb.svg',
  sq: '/flags/al.svg',
  fr: '/flags/fr.svg',
  tr: '/flags/tr.svg',
  de: '/flags/de.svg',
};

export function resolveLocale(profileLocale: unknown, cookieLocale: unknown): Locale {
  const profileResult = localeSchema.safeParse(profileLocale);
  if (profileResult.success) return profileResult.data;

  const cookieResult = localeSchema.safeParse(cookieLocale);
  return cookieResult.success ? cookieResult.data : DEFAULT_LOCALE;
}
