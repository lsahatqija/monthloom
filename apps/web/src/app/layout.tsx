import { Defaults } from '@monthloom/contracts';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { PwaRegistration } from '../components/pwa-registration';
import { ThemeProvider } from '../components/theme-provider';
import { QueryProvider } from '../providers/query-provider';

import '../styles/globals.css';
import '../components/ui/ui.css';
import '../components/layout/layout.css';
import '../components/onboarding/onboarding.css';
import '../features/finance/household-dashboard.css';
import '../features/finance/household-settings.css';
import '../features/finance/graph/graph-view.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: { default: 'Monthloom', template: '%s | Monthloom' },
    description: t('description'),
    applicationName: 'Monthloom',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const defaultHeaderStyle = Defaults.DARK_HEADER_IN_LIGHT_MODE ? 'dark' : 'theme';
  const appearanceScript = `(function(){try{var t=localStorage.getItem('monthloom-theme');var m=localStorage.getItem('monthloom-mode');var h=localStorage.getItem('monthloom-dark-header');var themes=['linen-sage','sea-glass','lavender-mist','apricot-cotton','blue-hour','rosewood-ember','golden-hour','terracotta-grove','high-contrast','monochrome'];document.documentElement.dataset.theme=themes.includes(t)?t:${JSON.stringify(Defaults.THEME)};document.documentElement.dataset.mode=m==='light'||m==='dark'?m:${JSON.stringify(Defaults.COLOR_MODE)};document.documentElement.dataset.headerStyle=h===null?${JSON.stringify(defaultHeaderStyle)}:h==='true'?'dark':'theme'}catch(e){document.documentElement.dataset.theme=${JSON.stringify(Defaults.THEME)};document.documentElement.dataset.mode=${JSON.stringify(Defaults.COLOR_MODE)};document.documentElement.dataset.headerStyle=${JSON.stringify(defaultHeaderStyle)}}})()`;

  return (
    <html
      lang={locale}
      data-theme={Defaults.THEME}
      data-mode={Defaults.COLOR_MODE}
      data-header-style={defaultHeaderStyle}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#263732" />
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <PwaRegistration>
            <ThemeProvider>
              <QueryProvider>{children}</QueryProvider>
            </ThemeProvider>
          </PwaRegistration>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
