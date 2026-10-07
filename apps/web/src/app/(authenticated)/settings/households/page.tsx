import type { Metadata } from 'next';

import { HouseholdSettings } from '@/features/finance/household-settings';
import { getServerUser } from '@/lib/auth/get-server-user';

export const metadata: Metadata = { title: 'Household settings' };

export default async function HouseholdSettingsPage() {
  const user = await getServerUser();
  if (!user) return null;

  return <HouseholdSettings user={user} />;
}
