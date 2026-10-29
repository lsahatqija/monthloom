import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '../../../components/ui/index';
import { LoginForm } from '../../../features/auth/login-form';
import { getServerUser } from '../../../lib/auth/get-server-user';
import { sanitizeRedirectTarget } from '../../../lib/auth/safe-redirect';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('login') };
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const t = await getTranslations('Pages.login');
  const user = await getServerUser();
  const redirectTo = sanitizeRedirectTarget(searchParams.next);

  if (user) {
    redirect(redirectTo);
  }

  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <LoginForm redirectTo={redirectTo} />
      <p>
        {t('noAccount')}{' '}
        <Link href={`/register?next=${encodeURIComponent(redirectTo)}`}>{t('register')}</Link>
      </p>
    </PageContainer>
  );
}
