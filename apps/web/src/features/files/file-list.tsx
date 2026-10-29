'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Button, Card, EmptyState, LoadingIndicator, Alert } from '../../components/ui/index';
import { useApiErrorMessage } from '../../lib/api/localized-error';
import { webConfig } from '../../lib/config/env';

import { deleteFile, filesKeys, listFiles } from './files.api';

export function FileList() {
  const t = useTranslations('Files');
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: filesKeys.list, queryFn: listFiles });

  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: filesKeys.list });
    },
  });

  if (query.isLoading) return <LoadingIndicator label={t('loading')} />;

  if (query.isError) {
    return <Alert variant="error">{errorMessage(query.error, t('loadError'))}</Alert>;
  }

  const files = query.data?.files ?? [];

  if (files.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {files.map((file) => (
        <Card key={file.id}>
          <Image
            src={`${webConfig.publicApiUrl}${file.url}`}
            alt={file.originalName}
            width={200}
            height={150}
            unoptimized
            style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius)' }}
          />
          <p style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{file.originalName}</p>
          <Button
            variant="secondary"
            onClick={() => deleteMutation.mutate(file.id)}
            disabled={deleteMutation.isPending}
          >
            {t('delete')}
          </Button>
        </Card>
      ))}
    </div>
  );
}
