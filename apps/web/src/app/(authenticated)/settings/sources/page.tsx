import type { Metadata } from 'next';

import { HouseholdSourceSettings } from '@/features/finance/household-source-settings';

export const metadata: Metadata = { title: 'Source settings' };

export default function SourceSettingsPage() {
  return <HouseholdSourceSettings />;
}
