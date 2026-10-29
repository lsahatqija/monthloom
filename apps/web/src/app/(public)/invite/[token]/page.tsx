import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/ui/index';
import { HouseholdInvitationPrompt } from '@/features/finance/household-invitation';
import { getServerUser } from '@/lib/auth/get-server-user';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('invitation') };
}

export default async function HouseholdInvitationPage({ params }: { params: { token: string } }) {
  const user = await getServerUser();

  return (
    <PageContainer>
      <HouseholdInvitationPrompt token={params.token} user={user} />
    </PageContainer>
  );
}
