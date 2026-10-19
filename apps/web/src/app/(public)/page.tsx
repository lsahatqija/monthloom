import Link from 'next/link';

import { PageContainer } from '../../components/ui/index';
import { LoginForm } from '../../features/auth/login-form';
import { HouseholdDashboard } from '../../features/finance/household-dashboard';
import { getServerUser } from '../../lib/auth/get-server-user';

export default async function HomePage() {
  const user = await getServerUser();

  if (user) return <HouseholdDashboard />;

  return (
    <PageContainer>
      <h1>Welcome to Monthloom</h1>
      <p>
        Monthloom helps you plan your household budget, track income and expenses, and keep
        everyone on the same page each month.
      </p>
      <p>Log in to view your household finances and continue planning.</p>

      <h2>Log in</h2>
      <LoginForm redirectTo="/" />

      <p>
        <Link className="button buttonSecondary" href="/register">
          Not registered?
        </Link>
      </p>
    </PageContainer>
  );
}
