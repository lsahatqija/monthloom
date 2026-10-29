import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RestartOnboardingButton } from '@/components/onboarding/restart-onboarding-button';
import { ChangePassword } from '@/features/users/change-password';
import { ProfileForm } from '@/features/users/profile-form';
import { getServerUser } from '@/lib/auth/get-server-user';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('profile') };
}

export default async function ProfileSettingsPage() {
  const t = await getTranslations('Pages.profile');
  const user = await getServerUser();
  if (!user) return null;

  return (
    <section className="settingsView" aria-labelledby="profile-settings-heading">
      <div className="settingsViewHeading">
        <h2 id="profile-settings-heading">{t('title')}</h2>
        <p>{t('description')}</p>
      </div>
      <div className="settingsAccountSummary">
        <p>
          <strong>{user.displayName}</strong>
        </p>
        <p>{user.email}</p>
        <p>{user.emailVerified ? t('emailVerified') : t('emailNotVerified')}</p>
        <p className="settingsRole">{t('accountRole', { role: user.role })}</p>
      </div>
      <ProfileForm user={user} />
      <ChangePassword email={user.email} />
      <div className="settingsPanel settingsSecurityPanel">
        <div>
          <h3>{t('onboardingTitle')}</h3>
          <p>{t('onboardingDescription')}</p>
        </div>
        <div className="settingsSecurityActions">
          <RestartOnboardingButton userId={user.id} />
        </div>
      </div>
    </section>
  );
}
