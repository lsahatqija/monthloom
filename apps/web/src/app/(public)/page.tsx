import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '../../components/ui/index';
import { LoginForm } from '../../features/auth/login-form';
import { HouseholdDashboard } from '../../features/finance/household-dashboard';
import { getServerUser } from '../../lib/auth/get-server-user';

export default async function HomePage() {
  const t = await getTranslations('Pages.home');
  const user = await getServerUser();

  if (user) return <HouseholdDashboard />;

  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <p>{t('loginPrompt')}</p>

      <h2>{t('login')}</h2>
      <LoginForm redirectTo="/" />

      <p>
        <Link className="button buttonSecondary" href="/register">
          {t('notRegistered')}
        </Link>
      </p>
    </PageContainer>
  );
}
