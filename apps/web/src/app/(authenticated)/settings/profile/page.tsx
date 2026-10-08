import type { Metadata } from 'next';

import { ChangePassword } from '@/features/users/change-password';
import { ProfileForm } from '@/features/users/profile-form';
import { getServerUser } from '@/lib/auth/get-server-user';

export const metadata: Metadata = { title: 'Profile settings' };

export default async function ProfileSettingsPage() {
  const user = await getServerUser();
  if (!user) return null;

  return (
    <section className="settingsView" aria-labelledby="profile-settings-heading">
      <div className="settingsViewHeading">
        <h2 id="profile-settings-heading">Profile</h2>
        <p>Update your name, profile picture, and color.</p>
      </div>
      <div className="settingsAccountSummary">
        <p>
          <strong>{user.displayName}</strong>
        </p>
        <p>{user.email}</p>
        <p className="settingsRole">{user.role} account</p>
      </div>
      <ProfileForm user={user} />
      <ChangePassword />
    </section>
  );
}
