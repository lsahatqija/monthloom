import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { SettingsNavigation } from '@/components/settings-navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('settings') };
}

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Pages.settings');
  return (
    <div className="settingsPage">
      <header className="settingsHeader">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <div className="settingsLayout">
        <SettingsNavigation />
        <div className="settingsContent">{children}</div>
      </div>
    </div>
  );
}
