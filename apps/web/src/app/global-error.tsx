'use client';

import { Defaults, localeSchema, type Locale } from '@monthloom/contracts';
import { useEffect, useState } from 'react';

const messages: Record<Locale, { title: string; description: string; retry: string }> = {
  en: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred while loading the application.',
    retry: 'Try again',
  },
  sq: {
    title: 'Diçka shkoi keq',
    description: 'Ndodhi një gabim i papritur gjatë ngarkimit të aplikacionit.',
    retry: 'Provo përsëri',
  },
  fr: {
    title: 'Une erreur est survenue',
    description: "Une erreur inattendue s'est produite lors du chargement de l’application.",
    retry: 'Réessayer',
  },
  tr: {
    title: 'Bir şeyler ters gitti',
    description: 'Uygulama yüklenirken beklenmeyen bir hata oluştu.',
    retry: 'Tekrar dene',
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(Defaults.USER_LOCALE);
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    const savedLocale = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('monthloom-locale='))
      ?.split('=')[1];
    const parsedLocale = localeSchema.safeParse(savedLocale);
    if (parsedLocale.success) setLocale(parsedLocale.data);
  }, [error]);
  const message = messages[locale];

  return (
    <html lang={locale}>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>{message.title}</h1>
          <p>{message.description}</p>
          <button onClick={reset}>{message.retry}</button>
        </div>
      </body>
    </html>
  );
}
