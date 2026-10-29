'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { authKeys, verifyEmail } from './auth.api';

export function VerifyEmail({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const queryClient = useQueryClient();
  const attempted = useRef(false);
  const mutation = useMutation({
    mutationFn: () => verifyEmail({ token }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    mutation.mutate();
    // The token identifies this one-shot operation; the mutation object is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (mutation.isPending || mutation.isIdle) {
    return <LoadingIndicator label={t('verifyingEmail')} />;
  }

  if (mutation.isError) {
    return (
      <div className="authConfirmation">
        <Alert variant="error">
          {isApiClientError(mutation.error) ? mutation.error.message : t('verifyEmailError')}
        </Alert>
        <Link className="button" href="/settings/profile">
          {t('goToProfile')}
        </Link>
      </div>
    );
  }

  return (
    <div className="authConfirmation">
      <Alert>{t('emailVerified')}</Alert>
      <Link className="button" href="/dashboard">
        {t('openMonthloom')}
      </Link>
    </div>
  );
}
