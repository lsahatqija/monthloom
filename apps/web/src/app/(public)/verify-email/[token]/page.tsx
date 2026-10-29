import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/ui/index';
import { VerifyEmail } from '@/features/auth/verify-email';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('verifyEmail') };
}

export default async function VerifyEmailPage({ params }: { params: { token: string } }) {
  const t = await getTranslations('Pages.verifyEmail');
  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <VerifyEmail token={params.token} />
    </PageContainer>
  );
}
