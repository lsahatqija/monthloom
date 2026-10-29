import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { EmptyState, PageContainer } from '../components/ui/index';

export default async function NotFound() {
  const t = await getTranslations('Common');

  return (
    <PageContainer>
      <EmptyState title={t('pageNotFoundTitle')} description={t('pageNotFoundDescription')} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Link href="/" className="button">
          {t('goHome')}
        </Link>
      </div>
    </PageContainer>
  );
}
