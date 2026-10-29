import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HouseholdSettings } from '@/features/finance/household-settings';
import { getServerUser } from '@/lib/auth/get-server-user';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('households') };
}

export default async function HouseholdSettingsPage() {
  const user = await getServerUser();
  if (!user) return null;

  return <HouseholdSettings user={user} />;
}
