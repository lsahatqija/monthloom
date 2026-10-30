import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '../../../components/ui/index';
import { FileList } from '../../../features/files/file-list';
import { FileUploadForm } from '../../../features/files/file-upload-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('files') };
}

export default async function FilesPage() {
  const t = await getTranslations('Pages.files');
  return (
    <PageContainer>
      <h1>{t('title')}</h1>
      <FileUploadForm />
      <div style={{ marginTop: 'var(--space-6)' }}>
        <FileList />
      </div>
    </PageContainer>
  );
}
