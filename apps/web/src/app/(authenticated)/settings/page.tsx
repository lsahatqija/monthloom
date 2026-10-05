import type { Metadata } from 'next';

import { PageContainer } from '../../../components/ui/index';
import { HouseholdSettings } from '../../../features/finance/household-settings';
import { ProfileForm } from '../../../features/users/profile-form';
import { getServerUser } from '../../../lib/auth/get-server-user';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  // The parent authenticated layout already guarantees a user is present.
  const user = await getServerUser();

  return (
    <PageContainer>
      <h1>Settings</h1>
      {user ? (
        <>
          <div className="settingsAccountSummary">
            <p>
              <strong>{user.displayName}</strong>
            </p>
            <p>{user.email}</p>
            <p className="settingsRole">{user.role} account</p>
          </div>
          <ProfileForm user={user} />
          <HouseholdSettings user={user} />
        </>
      ) : null}
    </PageContainer>
  );
}
