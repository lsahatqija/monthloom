import type { Metadata } from 'next';

import { PageContainer } from '@/components/ui/index';
import { HouseholdInvitationPrompt } from '@/features/finance/household-invitation';
import { getServerUser } from '@/lib/auth/get-server-user';

export const metadata: Metadata = { title: 'Household invitation' };

export default async function HouseholdInvitationPage({ params }: { params: { token: string } }) {
  const user = await getServerUser();

  return (
    <PageContainer>
      <HouseholdInvitationPrompt token={params.token} user={user} />
    </PageContainer>
  );
}
