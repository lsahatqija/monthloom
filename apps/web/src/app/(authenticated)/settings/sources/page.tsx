import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HouseholdSourceSettings } from '@/features/finance/household-source-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('sources') };
}

export default function SourceSettingsPage() {
  return <HouseholdSourceSettings />;
}
