'use client';

import { useTranslations } from 'next-intl';

import { Button } from '../ui';

import { restartOnboarding } from './onboarding-tour';

export function RestartOnboardingButton({ userId }: { userId: string }) {
  const t = useTranslations('Profile');

  return (
    <Button type="button" variant="secondary" onClick={() => restartOnboarding(userId)}>
      {t('restartOnboarding')}
    </Button>
  );
}
