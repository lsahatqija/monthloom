'use client';

import { Button } from '../ui';

import { restartOnboarding } from './onboarding-tour';

export function RestartOnboardingButton({ userId }: { userId: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => restartOnboarding(userId)}>
      Restart onboarding tutorial
    </Button>
  );
}
