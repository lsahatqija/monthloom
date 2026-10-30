import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '../../../components/ui/index';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('about') };
}

export default async function AboutPage() {
  const t = await getTranslations('Pages.about');
  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  );
}
