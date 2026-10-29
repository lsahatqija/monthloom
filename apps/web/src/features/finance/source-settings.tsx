'use client';

import type { HouseholdSource, ManagedHousehold } from '@monthloom/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Alert, Button, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import {
  copyHouseholdSources,
  deleteHouseholdSource,
  financeKeys,
  getHouseholdSources,
} from './finance.api';
import { SourceModal } from './source-modal';

function errorMessage(error: unknown, fallback: string): string {
  return isApiClientError(error) ? error.message : fallback;
}

interface CopySourcesModalProps {
  households: ManagedHousehold[];
  initialSourceHouseholdId: string;
  onClose: () => void;
  onComplete: (message: string) => void;
}

function CopySourcesModal({
  households,
  initialSourceHouseholdId,
  onClose,
  onComplete,
}: CopySourcesModalProps) {
  const t = useTranslations('Finance');
  const queryClient = useQueryClient();
  const [sourceHouseholdId, setSourceHouseholdId] = useState(initialSourceHouseholdId);
  const [targetHouseholdId, setTargetHouseholdId] = useState(
    households.find((household) => household.id !== initialSourceHouseholdId)?.id ?? '',
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const sourceQuery = useQuery({
    queryKey: financeKeys.sources(sourceHouseholdId),
    queryFn: () => getHouseholdSources(sourceHouseholdId),
    enabled: Boolean(sourceHouseholdId),
  });
  const copyMutation = useMutation({
    mutationFn: () =>
      copyHouseholdSources(sourceHouseholdId, {
        targetHouseholdId,
        sourceIds: [...selectedSourceIds],
      }),
    onSuccess: async ({ copiedCount, skippedCount }) => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onComplete(t('sourcesCopied', { copied: copiedCount, skipped: skippedCount }));
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !copyMutation.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyMutation.isPending, onClose]);

  const setSourceHousehold = (householdId: string) => {
    setSourceHouseholdId(householdId);
    setSelectedSourceIds(new Set());
    if (householdId === targetHouseholdId) {
      setTargetHouseholdId(households.find((household) => household.id !== householdId)?.id ?? '');
    }
  };

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !copyMutation.isPending) onClose();
      }}
    >
      <section
        className="transactionModal copySourcesModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-sources-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">{t('householdSources')}</p>
            <h2 id="copy-sources-title">{t('copySources')}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            disabled={copyMutation.isPending}
            onClick={onClose}
            aria-label={t('closeCopySources')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="copySourcesContent">
          <div className="copyHouseholdSelectors">
            <label>
              <span>{t('fromHousehold')}</span>
              <select
                value={sourceHouseholdId}
                disabled={copyMutation.isPending}
                onChange={(event) => setSourceHousehold(event.target.value)}
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('toHousehold')}</span>
              <select
                value={targetHouseholdId}
                disabled={copyMutation.isPending}
                onChange={(event) => setTargetHouseholdId(event.target.value)}
              >
                {households
                  .filter((household) => household.id !== sourceHouseholdId)
                  .map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {sourceQuery.isPending ? <LoadingIndicator label={t('loadingSources')} /> : null}
          {sourceQuery.isError ? (
            <Alert variant="error">{errorMessage(sourceQuery.error, t('genericError'))}</Alert>
          ) : null}
          {sourceQuery.data ? (
            <div className="sourceTableScroll">
              <table className="sourceTable copySourceTable">
                <thead>
                  <tr>
                    <th scope="col">{t('copy')}</th>
                    <th scope="col">{t('displayName')}</th>
                    <th scope="col">{t('aliases')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceQuery.data.map((source) => (
                    <tr key={source.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t('copySource', { source: source.displayName })}
                          checked={selectedSourceIds.has(source.id)}
                          disabled={copyMutation.isPending}
                          onChange={(event) =>
                            setSelectedSourceIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(source.id);
                              else next.delete(source.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>{source.displayName}</td>
                      <td>{source.aliases.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sourceQuery.data.length === 0 ? (
                <p className="sourceTableEmpty">{t('noSourcesToCopy')}</p>
              ) : null}
            </div>
          ) : null}

          {copyMutation.isError ? (
            <Alert variant="error">{errorMessage(copyMutation.error, t('genericError'))}</Alert>
          ) : null}

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={copyMutation.isPending}
              onClick={onClose}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                copyMutation.isPending || !targetHouseholdId || selectedSourceIds.size === 0
              }
              onClick={() => copyMutation.mutate()}
            >
              {copyMutation.isPending ? t('copying') : t('copySelectedSources')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SourceSettings({ households }: { households: ManagedHousehold[] }) {
  const t = useTranslations('Finance');
  const queryClient = useQueryClient();
  const [householdId, setHouseholdId] = useState(
    households.find((household) => household.isPrimary)?.id ?? households[0]?.id ?? '',
  );
  const [addingSource, setAddingSource] = useState(false);
  const [editingSource, setEditingSource] = useState<HouseholdSource | null>(null);
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceQuery = useQuery({
    queryKey: financeKeys.sources(householdId),
    queryFn: () => getHouseholdSources(householdId),
    enabled: Boolean(householdId),
  });
  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => deleteHouseholdSource(householdId, sourceId),
    onSuccess: async () => {
      setError(null);
      setNotice(t('sourceDeleted'));
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
    onError: (mutationError) => setError(errorMessage(mutationError, t('genericError'))),
  });

  useEffect(() => {
    if (households.some((household) => household.id === householdId)) return;
    setHouseholdId(
      households.find((household) => household.isPrimary)?.id ?? households[0]?.id ?? '',
    );
  }, [householdId, households]);

  if (!households.length) return null;

  return (
    <section className="sourceSettings" aria-labelledby="source-settings-heading">
      <div className="settingsSectionHeading sourceSettingsHeading">
        <div>
          <h2 id="source-settings-heading">{t('sources')}</h2>
          <p>{t('manageSourcesDescription')}</p>
        </div>
        <div className="sourceSettingsActions">
          <Button
            type="button"
            onClick={() => {
              setNotice(null);
              setAddingSource(true);
            }}
          >
            {t('addSource')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={households.length < 2}
            title={households.length < 2 ? t('joinHouseholdToCopy') : undefined}
            onClick={() => {
              setNotice(null);
              setCopying(true);
            }}
          >
            {t('copySources')}
          </Button>
        </div>
      </div>

      <label className="sourceHouseholdPicker">
        <span>{t('household')}</span>
        <select
          value={householdId}
          onChange={(event) => {
            setHouseholdId(event.target.value);
            setError(null);
            setNotice(null);
          }}
        >
          {households.map((household) => (
            <option key={household.id} value={household.id}>
              {household.name}
            </option>
          ))}
        </select>
      </label>

      {notice ? <Alert>{notice}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {sourceQuery.isPending ? <LoadingIndicator label={t('loadingSources')} /> : null}
      {sourceQuery.isError ? (
        <Alert variant="error">{errorMessage(sourceQuery.error, t('genericError'))}</Alert>
      ) : null}
      {sourceQuery.data ? (
        <div className="sourceTableScroll sourceManagementTable">
          <table className="sourceTable">
            <thead>
              <tr>
                <th scope="col">{t('displayName')}</th>
                <th scope="col">{t('key')}</th>
                <th scope="col">{t('aliases')}</th>
                <th scope="col">
                  <span className="srOnly">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceQuery.data.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.displayName}</strong>
                  </td>
                  <td>
                    <code>{source.key}</code>
                  </td>
                  <td>{source.aliases.join(', ')}</td>
                  <td className="sourceTableActions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingSource(source)}
                    >
                      {t('edit')}
                    </Button>
                    <button
                      type="button"
                      className="textDangerButton"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(t('deleteSourceConfirm', { source: source.displayName }))
                        ) {
                          setNotice(null);
                          deleteMutation.mutate(source.id);
                        }
                      }}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sourceQuery.data.length === 0 ? (
            <p className="sourceTableEmpty">{t('noSourcesYet')}</p>
          ) : null}
        </div>
      ) : null}

      {addingSource ? (
        <SourceModal
          householdId={householdId}
          onClose={() => setAddingSource(false)}
          onSaved={() => {
            setAddingSource(false);
            setError(null);
            setNotice(t('sourceAdded'));
          }}
        />
      ) : null}
      {editingSource ? (
        <SourceModal
          householdId={householdId}
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onSaved={() => {
            setEditingSource(null);
            setError(null);
            setNotice(t('sourceUpdated'));
          }}
        />
      ) : null}
      {copying ? (
        <CopySourcesModal
          households={households}
          initialSourceHouseholdId={householdId}
          onClose={() => setCopying(false)}
          onComplete={(message) => {
            setCopying(false);
            setError(null);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
