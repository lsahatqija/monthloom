import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ThemePicker } from '@/components/theme-picker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('appearance') };
}

export default async function AppearanceSettingsPage() {
  const t = await getTranslations('Pages.appearance');
  return (
    <section className="settingsView" aria-labelledby="appearance-settings-heading">
      <div className="settingsViewHeading">
        <h2 id="appearance-settings-heading">{t('title')}</h2>
        <p>{t('description')}</p>
      </div>
      <div className="settingsPanel">
        <ThemePicker />
      </div>
    </section>
  );
}
