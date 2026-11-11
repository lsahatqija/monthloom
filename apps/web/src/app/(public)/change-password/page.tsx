import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/ui/index';
import { InitialPasswordForm } from '@/features/auth/initial-password-form';
import { getServerUser } from '@/lib/auth/get-server-user';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('changeInitialPassword') };
}

export default async function ChangeInitialPasswordPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.mustChangePassword) redirect('/');
  const t = await getTranslations('Pages.changeInitialPassword');

  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <InitialPasswordForm />
    </PageContainer>
  );
}
