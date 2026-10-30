import { getTranslations } from 'next-intl/server';

import { LoadingIndicator } from '../components/ui/index';

export default async function Loading() {
  const t = await getTranslations('Common');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
      <LoadingIndicator label={t('loading')} />
    </div>
  );
}
