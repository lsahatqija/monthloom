import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '../../../components/ui/index';
import { RegisterForm } from '../../../features/auth/register-form';
import { getServerUser } from '../../../lib/auth/get-server-user';
import { sanitizeRedirectTarget } from '../../../lib/auth/safe-redirect';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('register') };
}

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const t = await getTranslations('Pages.register');
  const user = await getServerUser();
  const redirectTo = sanitizeRedirectTarget(searchParams.next);

  if (user) {
    redirect(redirectTo);
  }

  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <RegisterForm redirectTo={redirectTo} />
      <p>
        {t('hasAccount')}{' '}
        <Link href={`/login?next=${encodeURIComponent(redirectTo)}`}>{t('login')}</Link>
      </p>
    </PageContainer>
  );
}
