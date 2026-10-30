'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Alert, Button, PageContainer } from '../components/ui/index';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Common');
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <Alert variant="error">{t('pageLoadError')}</Alert>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <Button onClick={reset}>{t('tryAgain')}</Button>
        <Link href="/">{t('goHome')}</Link>
      </div>
    </PageContainer>
  );
}
