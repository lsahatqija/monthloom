'use client';

import { useTranslations } from 'next-intl';

import { ProfileImage } from '../../components/profile-image';
import { Alert, Card, LoadingIndicator } from '../../components/ui/index';
import { useApiErrorMessage } from '../../lib/api/localized-error';

import { useCurrentUser } from './use-current-user';

/** Demonstrates the dashboard retrieving the current user from the backend via TanStack Query. */
export function CurrentUserCard() {
  const t = useTranslations('Auth');
  const errorMessage = useApiErrorMessage();
  const { data, isLoading, isError, error } = useCurrentUser();

  if (isLoading) return <LoadingIndicator label={t('loadingAccount')} />;

  if (isError) {
    return <Alert variant="error">{errorMessage(error, t('loadAccountError'))}</Alert>;
  }

  const user = data?.user;
  if (!user) {
    return <Alert variant="error">{t('sessionExpired')}</Alert>;
  }

  return (
    <Card>
      <ProfileImage image={user.profileImage} color={user.desiredColor} />
      <p>
        {t.rich('welcomeBack', {
          strong: (chunks) => <strong>{chunks}</strong>,
          name: user.displayName,
        })}
      </p>
      <p>{t('emailValue', { email: user.email })}</p>
      <p>{t('roleValue', { role: user.role })}</p>
    </Card>
  );
}
