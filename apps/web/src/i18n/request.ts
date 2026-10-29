import type { Locale } from '@monthloom/contracts';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { getServerUser } from '../lib/auth/get-server-user';

import { LOCALE_COOKIE_NAME, resolveLocale } from './config';

async function loadMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async () => {
  const user = await getServerUser();
  const locale = resolveLocale(user?.locale, cookies().get(LOCALE_COOKIE_NAME)?.value);

  return { locale, messages: await loadMessages(locale) };
});
