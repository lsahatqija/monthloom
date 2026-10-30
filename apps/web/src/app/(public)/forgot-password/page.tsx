import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/ui/index';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('forgotPassword') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Pages.forgotPassword');
  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <ForgotPasswordForm />
      <p>
        {t('remembered')} <Link href="/login">{t('backToLogin')}</Link>
      </p>
    </PageContainer>
  );
}
