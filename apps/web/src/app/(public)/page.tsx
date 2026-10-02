import { PageContainer } from '../../components/ui/index';
import { HouseholdDashboard } from '../../features/finance/household-dashboard';
import { getServerUser } from '../../lib/auth/get-server-user';

export default async function HomePage() {
  const user = await getServerUser();

  if (user) return <HouseholdDashboard />;

  return (
    <PageContainer>
      <h1>Welcome</h1>
      <p>
        Keep your shared monthly finances clear, calm, and in one place. Register or log in to get
        started with Monthloom.
      </p>
    </PageContainer>
  );
}
