import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/ui/index';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('resetPassword') };
}

export default async function ResetPasswordPage({ params }: { params: { token: string } }) {
  const t = await getTranslations('Pages.resetPassword');
  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <ResetPasswordForm token={params.token} />
    </PageContainer>
  );
}
